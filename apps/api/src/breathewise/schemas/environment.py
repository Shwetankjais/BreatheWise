from typing import Literal

from breathewise.schemas.common import Pollutant, StrictModel
from pydantic import AwareDatetime, Field, model_validator


class City(StrictModel):
    id: str
    name: str
    aliases: list[str]
    eligible_station_count: int = 0
    availability: str = "unaudited"


class StationView(StrictModel):
    id: str
    name: str
    city_id: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    source: str
    data_mode: Literal["live", "historical_replay", "demo"]
    forecast_eligible: bool = False


class Measurement(StrictModel):
    station_id: str
    pollutant: Pollutant
    measured_at: AwareDatetime
    available_at: AwareDatetime
    value: float = Field(ge=0)
    unit: Literal["µg/m³"] = "µg/m³"
    original_value: float
    original_unit: str
    source: str
    quality_flags: list[str] = []
    observation_age_minutes: float
    stale: bool


class ForecastPoint(StrictModel):
    horizon_h: Literal[1, 3, 6, 12, 24]
    valid_at: AwareDatetime
    predicted_concentration: float = Field(ge=0)
    lower: float | None = None
    upper: float | None = None
    interval_level: float | None = None


class Forecast(StrictModel):
    station_id: str
    pollutant: Pollutant
    unit: Literal["µg/m³"]
    model_version: str
    model_artifact_sha256: str
    issued_at: AwareDatetime
    input_cutoff_at: AwareDatetime
    supported_horizons: list[int]
    points: list[ForecastPoint]
    quality: dict


class ActivityRequest(StrictModel):
    station_id: str
    activity: str = Field(min_length=1, max_length=100)
    duration_minutes: int = Field(ge=1, le=1440)
    start: AwareDatetime
    end: AwareDatetime
    sensitivity: Literal["general", "sensitive"] = "general"

    @model_validator(mode="after")
    def ordered(self):
        if self.end <= self.start:
            raise ValueError("end must follow start")
        return self


class Coordinates(StrictModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class RouteRequest(StrictModel):
    origin: Coordinates
    destination: Coordinates
    mode: Literal["walking", "cycling", "driving"]
    departure: AwareDatetime
    tradeoff: float = Field(default=0.5, ge=0, le=1)


class WeatherRequest(StrictModel):
    station_id: str
    issued_at: AwareDatetime
    wind_speed_multiplier: float = Field(ge=0.1, le=2)
