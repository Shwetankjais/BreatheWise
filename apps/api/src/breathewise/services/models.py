"""Hash-checked versioned retrospective artifacts; never enables live forecasts."""

import re

import duckdb
from breathewise.core.config import get_settings
from breathewise.core.errors import ServiceError
from breathewise.ml.experiment import EXPERIMENT_VERSIONS, checked_artifact, load_manifest
from breathewise.ml.issue_purged import EXPECTED_SIDECAR_SHA256, load_issue_purged
from breathewise.ml.utc_experiment import UTC_MODEL_VERSION, load_utc_manifest
from breathewise.schemas.models import (
    HeldoutPrediction,
    HorizonEvaluation,
    IssuePurgeSummary,
    ModelCatalogue,
    ModelEvaluation,
    ModelSummary,
    PredictionPage,
    RecordedSplit,
)

NATIVE_VERSION = "supplied-native-75-v1"
REGISTERED_VERSIONS = (*EXPERIMENT_VERSIONS, UTC_MODEL_VERSION)


def experiment_manifest(version):
    if version not in REGISTERED_VERSIONS or not re.fullmatch(r"[a-z0-9-]{1,100}", version):
        raise ServiceError(404, "MODEL_VERSION_NOT_FOUND", "Unknown retrospective model version")
    folder = get_settings().forecast_registry_root / version
    try:
        report = (
            load_utc_manifest(folder) if version == UTC_MODEL_VERSION else load_manifest(folder)
        )
        if not report.get("retrospective_evaluation_ready"):
            raise ValueError()
        if version in EXPECTED_SIDECAR_SHA256:
            report["_issue_purged"] = load_issue_purged(folder, EXPECTED_SIDECAR_SHA256[version])
        return folder, report
    except FileNotFoundError:
        raise ServiceError(
            503,
            "EVALUATION_UNAVAILABLE",
            "Run and register the independent experiment artifacts first",
        ) from None
    except (OSError, ValueError, KeyError, TypeError):
        raise ServiceError(
            503, "MODEL_ARTIFACT_INVALID", "Model/prediction integrity verification failed"
        ) from None


def catalogue():
    rows = [
        ModelSummary(
            model_version=NATIVE_VERSION,
            kind="native_diagnostic",
            dataset_mode="diagnostic",
            supported_horizons=[1, 3, 6, 12, 24],
            feature_count=75,
            native_diagnostics_ready=get_settings().model_artifact_path.is_file(),
            status="available"
            if get_settings().model_artifact_path.is_file()
            else "artifact_unavailable",
            limitations=[
                "Supplied 75-feature native adapter is offline diagnostic-only",
                "Original preprocessing, units, wrapper parity and independent validation unverified",
            ],
        )
    ]
    for version in REGISTERED_VERSIONS:
        try:
            _, manifest = experiment_manifest(version)
            rows.append(
                ModelSummary(
                    model_version=version,
                    kind="retrospective_forecast",
                    dataset_mode=manifest["dataset_mode"],
                    timezone=manifest["timezone"],
                    clock_basis="UTC_hour_ending"
                    if version == UTC_MODEL_VERSION
                    else "source_naive_clock_unverified",
                    evaluation_cohort="fixed_model_issue_time_purged"
                    if version in EXPECTED_SIDECAR_SHA256
                    else "target_timestamp_split_only",
                    evaluation_path=f"/api/v1/models/{version}/"
                    + ("utc-evaluation" if version == UTC_MODEL_VERSION else "evaluation"),
                    predictions_path=f"/api/v1/models/{version}/"
                    + ("utc-predictions" if version == UTC_MODEL_VERSION else "predictions"),
                    station_ids=manifest["source_station_ids"],
                    target_unit=manifest["target_unit"],
                    feature_count=len(manifest["models"]["1"]["feature_names"]),
                    dataset_sha256=manifest["dataset_sha256"],
                    artifact_hashes={h: item["sha256"] for h, item in manifest["models"].items()},
                    supported_horizons=manifest["supported_horizons"],
                    retrospective_evaluation_ready=True,
                    status="available",
                    limitations=manifest["limitations"],
                )
            )
        except ServiceError as exc:
            rows.append(
                ModelSummary(
                    model_version=version,
                    kind="retrospective_forecast",
                    dataset_mode="utc_provider_history"
                    if version == UTC_MODEL_VERSION
                    else "recorded_clock",
                    status="artifact_invalid"
                    if exc.detail.code == "MODEL_ARTIFACT_INVALID"
                    else "artifact_unavailable",
                    limitations=[
                        exc.detail.message,
                        "No live/provider clock compatibility established",
                    ],
                )
            )
    from breathewise.services.availability_models import summary as availability_summary

    rows.append(availability_summary())
    return ModelCatalogue(models=rows)


def evaluation(version, horizon=None):
    _, m = experiment_manifest(version)
    if version == UTC_MODEL_VERSION:
        raise ServiceError(409, "CLOCK_MODE_MISMATCH", "Use this version's utc-evaluation endpoint")
    if horizon is not None and horizon not in m["supported_horizons"]:
        raise ServiceError(
            409,
            "UNSUPPORTED_HORIZON",
            "Choose a separately trained and evaluated horizon for this version",
        )
    horizons = [horizon] if horizon is not None else m["supported_horizons"]
    purged = m.get("_issue_purged")
    evaluation_report = purged or m
    return ModelEvaluation(
        model_version=version,
        station_ids=m["source_station_ids"],
        dataset_sha256=m["dataset_sha256"],
        target_unit=m["target_unit"],
        target_transform=m["target_transform"],
        supported_horizons=m["supported_horizons"],
        splits=[
            RecordedSplit(name=k, start_recorded_at=v[0], end_recorded_at_exclusive=v[1])
            for k, v in m["protocol"]["splits"].items()
        ],
        horizons=[
            HorizonEvaluation(horizon_h=h, splits=evaluation_report["evaluation"][str(h)])
            for h in horizons
        ],
        rolling_backtests={
            name: [
                HorizonEvaluation(horizon_h=h, splits={"backtest": scores[str(h)]})
                for h in horizons
            ]
            for name, scores in evaluation_report["rolling_backtests"].items()
        },
        features={str(h): m["models"][str(h)]["features"] for h in horizons},
        evaluation_cohort="fixed_model_issue_time_purged"
        if purged
        else "target_timestamp_split_only",
        target_only_horizons=[
            HorizonEvaluation(horizon_h=h, splits=m["evaluation"][str(h)]) for h in horizons
        ]
        if purged
        else [],
        issue_time_purge=IssuePurgeSummary(
            rule=purged["rule"],
            row_counts={str(h): purged["row_counts"][str(h)] for h in horizons},
            source_predictions_sha256=purged["source_predictions_sha256"],
            sidecar_sha256=EXPECTED_SIDECAR_SHA256[version],
            limitations=purged["limitations"],
        )
        if purged
        else None,
        preprocessing=m["preprocessing"],
        input_availability_assumption=m["input_availability_assumption"],
        limitations=(
            purged["limitations"]
            if purged
            else m["limitations"]
            + [
                "Target-split-only v1 results may include fixed-model availability boundary violations up to24h; preserved as originally measured, not issue-purged."
            ]
        ),
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
    folder, m = experiment_manifest(version)
    if version == UTC_MODEL_VERSION:
        raise ServiceError(
            409, "CLOCK_MODE_MISMATCH", "Use this version's utc-predictions endpoint"
        )
    if horizon not in m["supported_horizons"]:
        raise ServiceError(
            409, "UNSUPPORTED_HORIZON", "Only separately evaluated horizons may be selected"
        )
    if (
        split not in {"test", "validation", "rolling_2022", "rolling_2023"}
        or not 1 <= limit <= 1000
        or not 0 <= offset <= 1000000
    ):
        raise ServiceError(
            422, "INVALID_PREDICTION_FILTER", "Use a known split and bounded pagination"
        )
    for value in [target_start, target_end]:
        if value is not None and value.tzinfo is not None:
            raise ServiceError(
                422,
                "RECORDED_CLOCK_REQUIRED",
                "Playback filters use naive recorded source clocks, never UTC",
            )
    if target_start and target_end and not target_start < target_end:
        raise ServiceError(
            422, "INVALID_TARGET_RANGE", "target_start must precede exclusive target_end"
        )
    where = "horizon_h=? AND split=?"
    params = [horizon, split]
    if target_start is not None:
        where += " AND target_at_recorded>=?::TIMESTAMP"
        params.append(target_start.isoformat())
    if target_end is not None:
        where += " AND target_at_recorded<?::TIMESTAMP"
        params.append(target_end.isoformat())
    if issue_time_purged:
        where += " AND issue_at_recorded>=?::TIMESTAMP"
        params.append(issue_cutoff(m, split))
    path = checked_artifact(folder, m["heldout_predictions"])
    try:
        with duckdb.connect() as connection:
            connection.execute("SET threads=2")
            total = connection.execute(
                f"SELECT count(*) FROM read_csv(?,nullstr='') WHERE {where}",
                [str(path), *params],
            ).fetchone()[0]
            result = connection.execute(
                f"SELECT station_id, split,horizon_h,issue_at_recorded::VARCHAR,target_at_recorded::VARCHAR,observed,lightgbm,persistence,previous_day_same_hour FROM read_csv(?,nullstr='') WHERE {where} ORDER BY target_at_recorded,station_id LIMIT ? OFFSET ?",
                [str(path), *params, limit, offset],
            ).fetchall()
        points = [
            HeldoutPrediction(**dict(zip(HeldoutPrediction.model_fields, row, strict=True)))
            for row in result
        ]
    except (duckdb.Error, ValueError):
        raise ServiceError(
            503, "PREDICTIONS_UNAVAILABLE", "Registered held-out prediction table cannot be read"
        ) from None
    return PredictionPage(
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


def issue_cutoff(manifest, split):
    if split == "validation":
        return manifest["protocol"]["splits"]["train"][1]
    if split == "test":
        return manifest["protocol"]["splits"]["validation"][1]
    from breathewise.ml.experiment import BACKTESTS
    from breathewise.ml.utc_experiment import UTC_BACKTESTS

    folds = UTC_BACKTESTS if manifest["model_version"] == UTC_MODEL_VERSION else BACKTESTS
    return next(x["train_end"] for x in folds if x["name"] == split)
