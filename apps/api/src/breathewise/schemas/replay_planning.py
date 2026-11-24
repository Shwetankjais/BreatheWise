"""Historical forecast-only activity comparisons; never current safe-time guidance."""

from datetime import datetime
from typing import Literal

from breathewise.schemas.common import StrictModel
from pydantic import Field, model_validator


class ReplayPlanRequest(StrictModel):
    model_version: str = Field(min_length=1, max_length=100)
    issue_at: datetime
    split: str = Field(default="test", max_length=40)
    duration_minutes: int = Field(ge=60, le=1440, multiple_of=60)
    earliest_start_h: int = Field(default=0, ge=0, le=23)
    latest_end_h: int = Field(default=24, ge=1, le=24)
    sensitivity: Literal["general", "sensitive"] = "general"
    max_window_mean_ugm3: float | None = Field(default=None, ge=0)
    limit: int = Field(default=5, ge=1, le=24)

    @model_validator(mode="after")
    def ordered(self):
        if self.latest_end_h <= self.earliest_start_h:
            raise ValueError("latest_end_h must follow earliest_start_h")
        return self


class ReplayIssue(StrictModel):
    issue_at: str
    station_id: str
    split: str
    complete_hours: int = 24


class ReplayIssuePage(StrictModel):
    model_version: str
    dataset_mode: str
    clock_basis: str
    timezone: str | None
    forecast_artifact_sha256: str | None = None
    source_dataset_sha256: str | None = None
    historical_publication_time_known: Literal[False] = False
    retrospective_only: Literal[True] = True
    public_future_planning_ready: Literal[False] = False
    evaluation_cohort: Literal["fixed_model_issue_time_purged"] = "fixed_model_issue_time_purged"
    split: str
    limit: int
    offset: int
    total_count: int
    issues: list[ReplayIssue]
    limitations: list[str]


class ReplayTrajectoryPoint(StrictModel):
    horizon_h: int
    interval_start_at: str
    interval_end_at: str
    concentration: float
    unit: Literal["µg/m³"] = "µg/m³"


class ReplayWindow(StrictModel):
    rank: int
    start_horizon_h: int
    end_horizon_h: int
    start_at: str
    end_at: str
    duration_minutes: int
    concentration_time: float
    mean_concentration: float
    peak_concentration: float
    ranking_score: float
    concentration_time_unit: Literal["µg·h/m³"] = "µg·h/m³"


class ReplayPlan(StrictModel):
    status: Literal["available", "unavailable", "no_suitable_window"]
    code: str
    message: str
    model_version: str
    station_id: str | None = None
    issue_at: str
    dataset_mode: str
    clock_basis: str
    timezone: str | None
    forecast_artifact_sha256: str | None = None
    source_dataset_sha256: str | None = None
    historical_publication_time_known: Literal[False] = False
    split: str
    retrospective_only: Literal[True] = True
    public_future_planning_ready: Literal[False] = False
    label: Literal["Historical forecast exposure comparison, not current safe-time advice"] = (
        "Historical forecast exposure comparison, not current safe-time advice"
    )
    evaluation_cohort: Literal["fixed_model_issue_time_purged"] = "fixed_model_issue_time_purged"
    coverage_hours: int
    required_hours: int = 24
    duration_minutes: int
    sensitivity: Literal["general", "sensitive"]
    sensitivity_rule: str
    method: str
    target_observations_used_for_ranking: Literal[False] = False
    max_window_mean_ugm3: float | None
    candidate_count: int = 0
    eligible_count: int = 0
    trajectory: list[ReplayTrajectoryPoint] = []
    windows: list[ReplayWindow] = []
    limitations: list[str]
