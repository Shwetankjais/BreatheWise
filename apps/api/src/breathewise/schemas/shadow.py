"""UTC shadow data is separate from retrospective recorded-clock evaluation."""

from datetime import datetime
from typing import Literal

from breathewise.schemas.common import StrictModel


class ShadowPoint(StrictModel):
    horizon_h: int
    target_at: datetime
    lead_time_seconds: float
    concentration: float
    unit: str
    quality_flags: list[str]
    observed: float | None = None
    observation_available_at: datetime | None = None
    matched_at: datetime | None = None
    error: float | None = None


class ForecastRunView(StrictModel):
    id: str
    station_id: str
    model_version: str
    data_mode: str
    operation: Literal["shadow"] = "shadow"
    clock_basis: Literal["UTC_hour_ending"] = "UTC_hour_ending"
    public_live_forecast_ready: Literal[False] = False
    activity_planning_ready: Literal[False] = False
    status: Literal["succeeded", "rejected"]
    error_code: str | None
    issue_at: datetime
    input_cutoff: datetime
    generated_at: datetime
    input_sha256: str | None
    provenance: dict
    prediction_count: int
    matched_count: int


class ForecastRunPage(StrictModel):
    runs: list[ForecastRunView]
    total_count: int
    limit: int
    offset: int


class ForecastRunDetail(StrictModel):
    run: ForecastRunView
    predictions: list[ShadowPoint]
