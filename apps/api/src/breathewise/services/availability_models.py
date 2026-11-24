"""Read an independently trained availability scenario without enabling public forecasts."""

from breathewise.core.config import get_settings
from breathewise.core.errors import ServiceError
from breathewise.ml.availability_experiment import MODEL_VERSION, load_manifest
from breathewise.schemas.availability_models import AvailabilityEvaluation
from breathewise.schemas.models import HorizonEvaluation, ModelSummary
from breathewise.schemas.utc_models import UtcSplit


def manifest(version):
    if version != MODEL_VERSION:
        raise ServiceError(
            404, "MODEL_VERSION_NOT_FOUND", "Unknown availability-aware experimental model"
        )
    folder = get_settings().forecast_registry_root / version
    try:
        return folder, load_manifest(folder)
    except FileNotFoundError:
        raise ServiceError(
            503,
            "EVALUATION_UNAVAILABLE",
            "Register the availability-scenario model artifacts first",
        ) from None
    except (OSError, ValueError, KeyError, TypeError):
        raise ServiceError(
            503, "MODEL_ARTIFACT_INVALID", "Availability-scenario artifact integrity check failed"
        ) from None


def summary():
    try:
        _, m = manifest(MODEL_VERSION)
        return ModelSummary(
            model_version=MODEL_VERSION,
            kind="experimental_forecast",
            dataset_mode="utc_availability_scenario",
            timezone="UTC",
            clock_basis="UTC",
            evaluation_cohort=m["evaluation_cohort"],
            evaluation_path=f"/api/v1/models/{MODEL_VERSION}/availability-evaluation",
            station_ids=m["source_station_ids"],
            target_unit=m["target_unit"],
            supported_horizons=m["supported_horizons"],
            feature_count=len(m["models"]["1"]["feature_names"]),
            dataset_sha256=m["dataset_sha256"],
            artifact_hashes={h: x["sha256"] for h, x in m["models"].items()},
            retrospective_evaluation_ready=True,
            experimental_shadow_ready=True,
            status="available",
            limitations=m["limitations"],
        )
    except ServiceError as exc:
        return ModelSummary(
            model_version=MODEL_VERSION,
            kind="experimental_forecast",
            dataset_mode="utc_availability_scenario",
            timezone="UTC",
            clock_basis="UTC",
            status="artifact_invalid"
            if exc.detail.code == "MODEL_ARTIFACT_INVALID"
            else "artifact_unavailable",
            limitations=[
                exc.detail.message,
                "Simulated historical delay is not observed publication; actual per-run eligibility still required",
            ],
        )


def evaluation(version, horizon=None):
    _, m = manifest(version)
    if horizon is not None and horizon not in m["supported_horizons"]:
        raise ServiceError(
            409, "UNSUPPORTED_HORIZON", "Choose an explicitly trained experimental horizon"
        )
    horizons = [horizon] if horizon is not None else m["supported_horizons"]
    return AvailabilityEvaluation(
        model_version=version,
        experimental_shadow_ready=m["experimental_shadow_ready"],
        station_ids=m["source_station_ids"],
        sensor_ids=m["sensor_ids"],
        dataset_sha256=m["dataset_sha256"],
        target_unit=m["target_unit"],
        supported_horizons=m["supported_horizons"],
        availability_scenario=m["availability_scenario"],
        splits=[
            UtcSplit(name=k, start_at_utc=v[0], end_at_utc_exclusive=v[1])
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
        features={str(h): m["models"][str(h)]["features"] for h in horizons},
        input_availability_assumption=m["input_availability_assumption"],
        preprocessing=m["preprocessing"],
        missing_input_behavior=m["missing_input_behavior"],
        limitations=m["limitations"],
    )
