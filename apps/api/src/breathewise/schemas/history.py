from breathewise.schemas.common import Pollutant, StrictModel
from pydantic import AwareDatetime


class HistoryPoint(StrictModel):
    measured_at: AwareDatetime
    value: float
    source: str


class History(StrictModel):
    station_id: str
    pollutant: Pollutant
    unit: str = "µg/m³"
    start: AwareDatetime
    end: AwareDatetime
    input_cutoff_at: AwareDatetime
    timestamp_semantics: str = "hour_ending_utc"
    aggregation: str = "hourly"
    valid_count: int
    missing_count: int
    expected_count: int
    points: list[HistoryPoint]
