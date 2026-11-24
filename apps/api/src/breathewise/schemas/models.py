from typing import Literal

from breathewise.schemas.common import StrictModel
from pydantic import Field


class ModelSummary(StrictModel):
    model_version: str
    kind: Literal["native_diagnostic", "retrospective_forecast"]
    dataset_mode: Literal["diagnostic", "recorded_clock"]
    station_ids: list[str] = []
    pollutant: str = "pm25"
    target_unit: str | None = None
    feature_count: int | None = None
    dataset_sha256: str | None = None
    artifact_hashes: dict[str, str] = {}
    supported_horizons: list[int] = []
    live_supported_horizons: list[int] = []
    native_diagnostics_ready: bool = False
    retrospective_evaluation_ready: bool = False
    live_forecast_ready: Literal[False] = False
    continuous_trajectory_ready: Literal[False] = False
    status: Literal["available", "artifact_unavailable", "artifact_invalid"]
    limitations: list[str]


class ModelCatalogue(StrictModel):
    models: list[ModelSummary]


class ErrorMetrics(StrictModel):
    count: int = Field(ge=0)
    mae: float | None = None
    rmse: float | None = None
    bias: float | None = None


class EvaluationGroup(StrictModel):
    all_available: dict[str, ErrorMetrics]
    common_baseline_cohort: dict[str, ErrorMetrics]
    high_pollution_observed_target_ge_150: dict[str, ErrorMetrics]
    high_pollution_threshold_ugm3: float
    high_pollution_definition: str


class HorizonEvaluation(StrictModel):
    horizon_h: int
    splits: dict[str, EvaluationGroup]


class RecordedSplit(StrictModel):
    name: str
    start_recorded_at: str
    end_recorded_at_exclusive: str


class FeatureDefinition(StrictModel):
    name: str
    unit: str
    formula: str


class ModelEvaluation(StrictModel):
    model_version: str
    dataset_mode: Literal["recorded_clock"] = "recorded_clock"
    timezone: None = None
    publication_time_known: Literal[False] = False
    retrospective_only: Literal[True] = True
    live_forecast_ready: Literal[False] = False
    station_ids: list[str]
    dataset_sha256: str
    target_unit: str
    target_transform: str
    supported_horizons: list[int]
    splits: list[RecordedSplit]
    horizons: list[HorizonEvaluation]
    rolling_backtests: dict[str, list[HorizonEvaluation]]
    features: dict[str, list[FeatureDefinition]]
    preprocessing: str
    input_availability_assumption: str
    limitations: list[str]


class HeldoutPrediction(StrictModel):
    station_id: str
    split: str
    horizon_h: int
    issue_at_recorded: str
    target_at_recorded: str
    observed: float
    lightgbm: float | None
    persistence: float | None
    previous_day_same_hour: float | None


class PredictionPage(StrictModel):
    model_version: str
    dataset_mode: Literal["recorded_clock"] = "recorded_clock"
    timezone: None = None
    publication_time_known: Literal[False] = False
    retrospective_only: Literal[True] = True
    unit: str
    total_count: int
    offset: int
    limit: int
    points: list[HeldoutPrediction]
