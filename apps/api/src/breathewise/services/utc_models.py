"""Read registered UTC-native evaluations without presenting them as live forecasts."""

from datetime import UTC, datetime, timedelta

import duckdb
from breathewise.core.errors import ServiceError
from breathewise.ml.experiment import checked_artifact
from breathewise.ml.issue_purged import EXPECTED_SIDECAR_SHA256
from breathewise.ml.utc_experiment import UTC_BACKTESTS, UTC_MODEL_VERSION
from breathewise.schemas.models import HorizonEvaluation, IssuePurgeSummary
from breathewise.schemas.utc_models import (
    UtcHeldoutPrediction,
    UtcModelEvaluation,
    UtcPredictionPage,
    UtcSplit,
)


def manifest(version):
    from breathewise.services.models import experiment_manifest

    if version != UTC_MODEL_VERSION:
        raise ServiceError(
            409, "CLOCK_MODE_MISMATCH", "Use recorded-clock evaluation/playback for this version"
        )
    return experiment_manifest(version)


def evaluation(version, horizon=None):
    _, m = manifest(version)
    if horizon is not None and horizon not in m["supported_horizons"]:
        raise ServiceError(
            409, "UNSUPPORTED_HORIZON", "Select a separately evaluated hour for this version"
        )
    horizons = [horizon] if horizon is not None else m["supported_horizons"]
    purged = m["_issue_purged"]
    return UtcModelEvaluation(
        model_version=version,
        station_ids=m["source_station_ids"],
        sensor_ids=m["sensor_ids"],
        dataset_sha256=m["dataset_sha256"],
        target_unit=m["target_unit"],
        target_transform=m["target_transform"],
        supported_horizons=m["supported_horizons"],
        splits=[
            UtcSplit(name=k, start_at_utc=v[0], end_at_utc_exclusive=v[1])
            for k, v in m["protocol"]["splits"].items()
        ],
        horizons=[
            HorizonEvaluation(horizon_h=h, splits=purged["evaluation"][str(h)]) for h in horizons
        ],
        rolling_backtests={
            name: [
                HorizonEvaluation(horizon_h=h, splits={"backtest": scores[str(h)]})
                for h in horizons
            ]
            for name, scores in purged["rolling_backtests"].items()
        },
        features={str(h): m["models"][str(h)]["features"] for h in horizons},
        target_only_horizons=[
            HorizonEvaluation(horizon_h=h, splits=m["evaluation"][str(h)]) for h in horizons
        ],
        issue_time_purge=IssuePurgeSummary(
            rule=purged["rule"],
            row_counts={str(h): purged["row_counts"][str(h)] for h in horizons},
            source_predictions_sha256=purged["source_predictions_sha256"],
            sidecar_sha256=EXPECTED_SIDECAR_SHA256[version],
            limitations=purged["limitations"],
        ),
        preprocessing=m["preprocessing"],
        input_availability_assumption=m["input_availability_assumption"],
        missing_input_behavior=m["missing_input_behavior"],
        limitations=purged["limitations"],
    )


def predictions(
    version,
    horizon,
    split="test",
    limit=100,
    offset=0,
    target_start=None,
    target_end=None,
    issue_time_purged=False,
):
    folder, m = manifest(version)
    if horizon not in m["supported_horizons"]:
        raise ServiceError(409, "UNSUPPORTED_HORIZON", "Select a separately evaluated hour")
    if (
        split not in {"test", "validation", *(x["name"] for x in UTC_BACKTESTS)}
        or not 1 <= limit <= 1000
        or not 0 <= offset <= 1000000
    ):
        raise ServiceError(
            422, "INVALID_PREDICTION_FILTER", "Use known split and bounded pagination"
        )
    for stamp in [target_start, target_end]:
        if stamp is not None and (stamp.tzinfo is None or stamp.utcoffset() != timedelta(0)):
            raise ServiceError(
                422, "UTC_CLOCK_REQUIRED", "UTC playback filters need explicit UTC offset"
            )
    if target_start and target_end and target_start >= target_end:
        raise ServiceError(
            422, "INVALID_TARGET_RANGE", "target_start must precede exclusive target_end"
        )
    where = "horizon_h=? AND split=?"
    params = [horizon, split]
    for value, operator in [(target_start, ">="), (target_end, "<")]:
        if value is not None:
            where += f" AND target_at_utc{operator}?::TIMESTAMPTZ"
            params.append(value.isoformat())
    if issue_time_purged:
        from breathewise.services.models import issue_cutoff

        where += " AND issue_at_utc>=?::TIMESTAMPTZ"
        params.append(issue_cutoff(m, split))
    path = checked_artifact(folder, m["heldout_predictions"])
    try:
        with duckdb.connect() as connection:
            connection.execute("SET threads=2")
            connection.execute("SET TimeZone='UTC'")
            total = connection.execute(
                f"SELECT count(*) FROM read_csv(?,nullstr='') WHERE {where}", [str(path), *params]
            ).fetchone()[0]
            rows = connection.execute(
                f"SELECT station_id,split,horizon_h,issue_at_utc::VARCHAR,target_at_utc::VARCHAR,observed,lightgbm,persistence,previous_day_same_hour FROM read_csv(?,nullstr='') WHERE {where} ORDER BY target_at_utc,station_id LIMIT ? OFFSET ?",
                [str(path), *params, limit, offset],
            ).fetchall()
        points = []
        for row in rows:
            item = dict(zip(UtcHeldoutPrediction.model_fields, row, strict=True))
            for field in ["issue_at_utc", "target_at_utc"]:
                item[field] = datetime.fromisoformat(item[field]).astimezone(UTC)
            points.append(UtcHeldoutPrediction(**item))
    except (duckdb.Error, ValueError):
        raise ServiceError(
            503, "PREDICTIONS_UNAVAILABLE", "Registered UTC prediction table cannot be read"
        ) from None
    return UtcPredictionPage(
        model_version=version,
        evaluation_cohort="fixed_model_issue_time_purged"
        if issue_time_purged
        else "target_timestamp_split_only",
        unit=m["target_unit"],
        total_count=total,
        offset=offset,
        limit=limit,
        points=points,
    )
