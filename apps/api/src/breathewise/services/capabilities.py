from pydantic import BaseModel, Field

MODEL_MISSING = [
    "original HyperlocalAQPipeline class and exact feature builder/helpers",
    "compatible requirements and runnable inference example",
    "complete golden station/issue-time/features/expected outputs/units/tolerance",
    "accessible observations, driver forecast archives and evaluation files with split dates",
]


class Capability(BaseModel):
    supported: bool = False
    method: str | None = None
    requirements_missing: list[str] = Field(default_factory=list)
    supported_scope: list[str] = Field(default_factory=list)


class Capabilities(BaseModel):
    model_forecast: Capability
    observations: Capability
    history: Capability
    saved_places: Capability
    alerts: Capability
    continuous_hourly_trajectory: Capability
    calibrated_intervals: Capability
    calibrated_exceedance_probability: Capability
    spatial_exposure: Capability
    routes: Capability
    weather_scenarios: Capability
    population_coverage: Capability
    evaluation: Capability
    traffic_live: Capability
    declared_artifact_horizons: list[int] = [1, 3, 6, 12, 24]
    verified_forecast_horizons: list[int] = []
    verified_forecast_pollutants: list[str] = []


def capabilities() -> Capabilities:
    def missing(*items):
        return Capability(requirements_missing=list(items))

    return Capabilities(
        model_forecast=Capability(requirements_missing=MODEL_MISSING),
        observations=missing("audited imported station observations"),
        history=missing("audited imported observations"),
        saved_places=missing("database migration and provisioned session"),
        alerts=missing("observations and persisted alert worker"),
        continuous_hourly_trajectory=missing("validated full hourly trajectory"),
        calibrated_intervals=missing("held-out calibration evidence"),
        calibrated_exceedance_probability=missing("held-out calibrated probabilities"),
        spatial_exposure=missing("validated spatial estimator and coverage"),
        routes=missing("configured routing provider and spatial estimator"),
        weather_scenarios=Capability(requirements_missing=MODEL_MISSING),
        population_coverage=missing("complete population raster, epoch and extraction audit"),
        evaluation=missing("evaluation predictions, split dates and baselines"),
        traffic_live=missing("live traffic provider"),
    )
