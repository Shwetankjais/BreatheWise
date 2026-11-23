from breathewise.schemas.common import Pollutant, StrictModel
from pydantic import AwareDatetime, Field


class RuleInput(StrictModel):
    station_id: str
    pollutant: Pollutant
    threshold: float = Field(ge=0, le=1000000)
    cooldown_minutes: int = Field(default=60, ge=1, le=10080)
    enabled: bool = True
    channel: str = "in_app"
    averaging_period_minutes: int = 60


class RuleView(RuleInput):
    id: str
    unit: str = "µg/m³"
    trigger: str = "latest_known_hourly_observation_strictly_above_threshold"


class NotificationView(StrictModel):
    id: str
    rule_id: str
    created_at: AwareDatetime
    value: float
    threshold: float
    unit: str = "µg/m³"
    status: str
    read_at: AwareDatetime | None = None
