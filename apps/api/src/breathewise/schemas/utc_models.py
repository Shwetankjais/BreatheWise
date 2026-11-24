"""UTC-native retrospective contracts, separate from naive recorded-clock playback."""

from datetime import datetime
from typing import Literal

from breathewise.schemas.common import StrictModel
from breathewise.schemas.models import FeatureDefinition, HorizonEvaluation, IssuePurgeSummary


class UtcSplit(StrictModel):
    name: str
    start_at_utc: datetime
    end_at_utc_exclusive: datetime


class UtcModelEvaluation(StrictModel):
    model_version: str
    dataset_mode: Literal["utc_provider_history"] = "utc_provider_history"
    timezone: Literal["UTC"] = "UTC"
    clock_basis: Literal["exclusive_hour_ending_UTC"] = "exclusive_hour_ending_UTC"
    historical_publication_time_known: Literal[False] = False
    retrospective_only: Literal[True] = True
    live_forecast_ready: Literal[False] = False
    continuous_trajectory_ready: Literal[False] = False
    station_ids: list[str]
    sensor_ids: list[int]
    dataset_sha256: str
    target_unit: str
    target_transform: str
    supported_horizons: list[int]
    splits: list[UtcSplit]
    horizons: list[HorizonEvaluation]
    evaluation_cohort: str = "fixed_model_issue_time_purged"
    target_only_horizons: list[HorizonEvaluation] = []
    issue_time_purge: IssuePurgeSummary
    rolling_backtests: dict[str, list[HorizonEvaluation]]
    features: dict[str, list[FeatureDefinition]]
    preprocessing: str
    input_availability_assumption: str
    missing_input_behavior: dict[str, str]
    limitations: list[str]


class UtcHeldoutPrediction(StrictModel):
    station_id: str
    split: str
    horizon_h: int
    issue_at_utc: datetime
    target_at_utc: datetime
    observed: float
    lightgbm: float | None
    persistence: float | None
    previous_day_same_hour: float | None


class UtcPredictionPage(StrictModel):
    evaluation_cohort: str = "target_timestamp_split_only"
    model_version: str
    dataset_mode: Literal["utc_provider_history"] = "utc_provider_history"
    timezone: Literal["UTC"] = "UTC"
    historical_publication_time_known: Literal[False] = False
    retrospective_only: Literal[True] = True
    unit: str
    total_count: int
    offset: int
    limit: int
    points: list[UtcHeldoutPrediction]
