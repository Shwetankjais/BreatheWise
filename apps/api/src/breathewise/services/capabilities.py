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
    station_catalogue: Capability = Field(default_factory=Capability)
    observed_rankings: Capability = Field(default_factory=Capability)
    archive_explorer: Capability = Field(default_factory=Capability)
    station_comparison: Capability = Field(default_factory=Capability)
    native_diagnostics: Capability = Field(default_factory=Capability)
    retrospective_evaluation: Capability = Field(default_factory=Capability)
    route_geometry: Capability = Field(default_factory=Capability)
    declared_artifact_horizons: list[int] = [1, 3, 6, 12, 24]
    verified_forecast_horizons: list[int] = []
    verified_forecast_pollutants: list[str] = []


def capabilities() -> Capabilities:
    def missing(*items):
        return Capability(requirements_missing=list(items))

    result = Capabilities(
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

    from breathewise.services.availability import availability

    db_ready, observation_count, city_counts = availability()
    if db_ready:
        result.saved_places = Capability(
            supported=True,
            method="persisted opaque bearer sessions; local administrator provisioning",
            supported_scope=["provisioned identities", "owned places/preferences"],
        )
    if observation_count:
        result.observations = Capability(
            supported=True,
            method="audited canonical hourly imports; no automatic provider polling",
            supported_scope=sorted(city_counts),
        )
        result.history = Capability(
            supported=True,
            method="UTC hour-ending records and issue-time availability cutoff",
            supported_scope=["station-level hourly; max 31 days"],
        )
        result.alerts = Capability(
            supported=True,
            method="fresh hourly observation threshold; transactional in-app notification",
            supported_scope=["in_app", "manual/scheduled worker command", "provisioned identities"],
        )
    from breathewise.core.config import get_settings
    from breathewise.services.models import catalogue as model_catalogue

    settings = get_settings()
    result.station_catalogue = Capability(
        supported=db_ready,
        method="verified provider catalogue plus cached observations",
        supported_scope=["configured bounded Delhi cohort"],
        requirements_missing=[] if db_ready else ["database migrations"],
    )
    result.observed_rankings = Capability(
        supported=bool(observation_count),
        method="rank actual cached concentration; include age/stale flags",
        supported_scope=sorted(city_counts),
    )
    archive_ready = (settings.archive_root / "data/cleaned/pollutants").is_dir()
    result.archive_explorer = Capability(
        supported=archive_ready,
        method="read-only observed Parquet DuckDB; recorded-clock only",
        supported_scope=["eligible Delhi source IDs; bounded daily/monthly aggregates"]
        if archive_ready
        else [],
        requirements_missing=[] if archive_ready else ["configured audited local archive"],
    )
    result.station_comparison = Capability(
        supported=archive_ready,
        method="exact matched recorded hours; explicit same-clock assumption",
        supported_scope=["2–4 eligible archive source series"] if archive_ready else [],
    )
    models = model_catalogue().models
    result.native_diagnostics = Capability(
        supported=models[0].native_diagnostics_ready,
        method="offline supplied native booster diagnostics; no wrapper parity",
        supported_scope=["explicit complete 75-feature input rows"],
    )
    ready_models = [m.model_version for m in models if m.retrospective_evaluation_ready]
    result.retrospective_evaluation = Capability(
        supported=bool(ready_models),
        method="independent recorded-clock experiment with frozen test and baselines",
        supported_scope=ready_models,
        requirements_missing=[]
        if ready_models
        else ["registered experiment model/prediction artifacts"],
    )
    if ready_models:
        result.evaluation = result.retrospective_evaluation
    result.route_geometry = Capability(
        supported=bool(settings.routing_base_url),
        method="configured OSRM driving geometry; cached/throttled; no exposure/traffic",
        supported_scope=["initial Delhi bounding region"] if settings.routing_base_url else [],
        requirements_missing=[] if settings.routing_base_url else ["trusted HTTPS OSRM endpoint"],
    )
    return result
