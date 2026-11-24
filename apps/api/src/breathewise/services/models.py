"""Hash-checked versioned retrospective artifacts; never enables live forecasts."""

import re

import duckdb
from breathewise.core.config import get_settings
from breathewise.core.errors import ServiceError
from breathewise.ml.experiment import MODEL_VERSION, checked_artifact, load_manifest
from breathewise.schemas.models import (
    HeldoutPrediction,
    HorizonEvaluation,
    ModelCatalogue,
    ModelEvaluation,
    ModelSummary,
    PredictionPage,
    RecordedSplit,
)

NATIVE_VERSION = "supplied-native-75-v1"


def experiment_manifest(version):
    if version != MODEL_VERSION or not re.fullmatch(r"[a-z0-9-]{1,100}", version):
        raise ServiceError(404, "MODEL_VERSION_NOT_FOUND", "Unknown retrospective model version")
    folder = get_settings().forecast_registry_root / version
    try:
        report = load_manifest(folder)
        if not report.get("retrospective_evaluation_ready"):
            raise ValueError()
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
    try:
        _, manifest = experiment_manifest(MODEL_VERSION)
        rows.append(
            ModelSummary(
                model_version=MODEL_VERSION,
                kind="retrospective_forecast",
                dataset_mode="recorded_clock",
                station_ids=manifest["source_station_ids"],
                target_unit=manifest["target_unit"],
                supported_horizons=manifest["supported_horizons"],
                retrospective_evaluation_ready=True,
                status="available",
                limitations=manifest["limitations"],
            )
        )
    except ServiceError as exc:
        rows.append(
            ModelSummary(
                model_version=MODEL_VERSION,
                kind="retrospective_forecast",
                dataset_mode="recorded_clock",
                status="artifact_invalid"
                if exc.detail.code == "MODEL_ARTIFACT_INVALID"
                else "artifact_unavailable",
                limitations=[
                    exc.detail.message,
                    "No live/provider clock compatibility established",
                ],
            )
        )
    return ModelCatalogue(models=rows)


def evaluation(version, horizon=None):
    _, m = experiment_manifest(version)
    if horizon is not None and horizon not in m["supported_horizons"]:
        raise ServiceError(
            409, "UNSUPPORTED_HORIZON", "This experiment evaluates only horizons1,3,6,12,24"
        )
    horizons = [horizon] if horizon is not None else m["supported_horizons"]
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
        horizons=[HorizonEvaluation(horizon_h=h, splits=m["evaluation"][str(h)]) for h in horizons],
        rolling_backtests={
            name: [
                HorizonEvaluation(horizon_h=h, splits={"backtest": scores[str(h)]})
                for h in horizons
            ]
            for name, scores in m["rolling_backtests"].items()
        },
        preprocessing=m["preprocessing"],
        input_availability_assumption=m["input_availability_assumption"],
        limitations=m["limitations"],
    )


def predictions(version, horizon, split="test", limit=100, offset=0):
    folder, m = experiment_manifest(version)
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
    path = checked_artifact(folder, m["heldout_predictions"])
    try:
        with duckdb.connect() as connection:
            connection.execute("SET threads=2")
            total = connection.execute(
                "SELECT count(*) FROM read_csv(?,nullstr='') WHERE horizon_h=? AND split=?",
                [str(path), horizon, split],
            ).fetchone()[0]
            result = connection.execute(
                "SELECT station_id, split,horizon_h,issue_at_recorded::VARCHAR,target_at_recorded::VARCHAR,observed,lightgbm,persistence,previous_day_same_hour FROM read_csv(?,nullstr='') WHERE horizon_h=? AND split=? ORDER BY target_at_recorded,station_id LIMIT ? OFFSET ?",
                [str(path), horizon, split, limit, offset],
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
        unit=m["target_unit"],
        total_count=total,
        offset=offset,
        limit=limit,
        points=points,
    )
