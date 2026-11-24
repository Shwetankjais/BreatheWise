"""Scenario-trained experimental model metadata; not observed historical publication."""

from typing import Literal

from breathewise.schemas.common import StrictModel
from breathewise.schemas.models import FeatureDefinition, HorizonEvaluation
from breathewise.schemas.utc_models import UtcSplit


class AvailabilityScenario(StrictModel):
    name: str
    historical_availability_observed: Literal[False] = False
    minimum_input_age_hours: int
    maximum_latest_input_age_hours: int
    latest_input_policy: str
    older_missing_policy: str
    first_seen_serving_rule: str


class AvailabilityEvaluation(StrictModel):
    model_version: str
    dataset_mode: Literal["utc_availability_scenario"] = "utc_availability_scenario"
    clock_basis: Literal["UTC"] = "UTC"
    timezone: Literal["UTC"] = "UTC"
    historical_publication_time_known: Literal[False] = False
    historical_delay_simulated: Literal[True] = True
    retrospective_only: Literal[True] = True
    public_live_forecast_ready: Literal[False] = False
    activity_planning_ready: Literal[False] = False
    experimental_shadow_ready: bool
    evaluation_cohort: Literal["issue_time_purged_availability_scenario"] = (
        "issue_time_purged_availability_scenario"
    )
    station_ids: list[str]
    sensor_ids: list[int]
    dataset_sha256: str
    target_unit: str
    supported_horizons: list[int]
    availability_scenario: AvailabilityScenario
    splits: list[UtcSplit]
    horizons: list[HorizonEvaluation]
    rolling_backtests: dict[str, list[HorizonEvaluation]]
    features: dict[str, list[FeatureDefinition]]
    input_availability_assumption: str
    preprocessing: str
    missing_input_behavior: dict[str, str]
    limitations: list[str]
