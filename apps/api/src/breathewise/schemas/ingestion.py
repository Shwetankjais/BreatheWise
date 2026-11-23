from typing import Literal

from breathewise.schemas.common import Pollutant, StrictModel
from breathewise.schemas.environment import StationView
from breathewise.services.cities import CITY_GROUPS
from pydantic import AwareDatetime, Field, field_validator, model_validator


class InputObservation(StrictModel):
    station_id: str
    pollutant: Pollutant
    measured_at: AwareDatetime
    available_at: AwareDatetime
    value: float = Field(ge=0)
    unit: Literal["µg/m³", "ug/m3", "mg/m3"]
    source: str = Field(min_length=1, max_length=500)
    averaging_period_minutes: Literal[60]
    quality_flags: list[str] = Field(default_factory=list, max_length=20)

    @model_validator(mode="after")
    def known_after_measured(self):
        if self.available_at < self.measured_at:
            raise ValueError("available_at cannot precede end of measurement hour")
        if (
            self.measured_at.minute not in {0, 30}
            or self.measured_at.second
            or self.measured_at.microsecond
        ):
            raise ValueError(
                "canonical hourly series preserves UTC hour-ending phase (00 or 30 minutes); no shifting"
            )
        if self.measured_at.utcoffset().total_seconds() != 0:
            raise ValueError("canonical measurements must be explicitly normalized to UTC")
        return self


class ImportBatch(StrictModel):
    schema_version: Literal["1.0"]
    data_mode: Literal["live", "historical_replay", "demo"]
    timestamp_semantics: Literal["hour_ending_utc"]
    provenance: str = Field(min_length=1, max_length=1000)
    stations: list[StationView] = Field(min_length=1, max_length=1000)
    observations: list[InputObservation] = Field(max_length=100000)

    @field_validator("stations")
    @classmethod
    def city_scope(cls, rows):
        ids = [row.id for row in rows]
        if len(ids) != len(set(ids)):
            raise ValueError("duplicate station IDs")
        allowed = {city[0] for city in CITY_GROUPS}
        if any(row.city_id not in allowed for row in rows):
            raise ValueError("station city must belong to requested 16 city groups")
        if any(row.forecast_eligible for row in rows):
            raise ValueError("model eligibility cannot be asserted by an import")
        return rows

    @model_validator(mode="after")
    def consistent(self):
        ids = {s.id for s in self.stations}
        if any(s.data_mode != self.data_mode for s in self.stations):
            raise ValueError("mixed station data modes")
        if any(o.station_id not in ids for o in self.observations):
            raise ValueError("observation references absent station")
        keys = [(o.station_id, o.pollutant, o.measured_at) for o in self.observations]
        if len(keys) != len(set(keys)):
            raise ValueError(
                "deduplicate/resolve conflicting provider observations before canonical import"
            )
        return self
