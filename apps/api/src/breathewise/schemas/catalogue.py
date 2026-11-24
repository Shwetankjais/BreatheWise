"""Cached provider catalogue and explicitly observed, never predicted, rankings."""

from typing import Literal

from breathewise.schemas.common import Pollutant, StrictModel
from breathewise.schemas.environment import Measurement, StationView
from pydantic import AwareDatetime, Field


class PollutantAvailability(StrictModel):
    pollutant: Pollutant
    sensor_id: int | None = None
    sensor_ids: list[int] = Field(default_factory=list)
    reported_sensor_units: list[str] = Field(default_factory=list)
    selected_sensor_unit: str | None = None
    selected_unit_compatible: bool | None = None
    status: Literal[
        "available", "stale", "no_observations", "sensor_unavailable", "coverage_unknown"
    ]
    freshness: Literal["fresh", "stale", "no_observations"]
    coverage_state: Literal["reported_complete", "reported_partial", "unknown"] = "unknown"
    measurement: Measurement | None = None
    provider_revision_pending: bool = False
    revision_pending_count: int = 0
    limitations: list[str] = Field(default_factory=list)


class CatalogueStation(StationView):
    pollutants: list[PollutantAvailability]
    provider_location_id: int | None = None
    catalogue_verified_at: AwareDatetime | None = None
    provider_revision_pending: bool = False
    last_refresh_status: str | None = None
    verification_status: Literal["verified", "verification_failed", "unknown"] | None = None
    verification_error_code: str | None = None
    verification_attempted_at: AwareDatetime | None = None


class StationCatalogue(StrictModel):
    city_id: str
    input_cutoff_at: AwareDatetime
    catalogue_verified_at: AwareDatetime | None = None
    scope: str = "bounded imported station cohort; not all-city coverage"
    stations: list[CatalogueStation]


class ObservedRank(StrictModel):
    rank: int
    station: StationView
    measurement: Measurement
    coverage_state: Literal["reported_complete", "reported_partial", "unknown"]
    provider_revision_pending: bool = False


class ObservedRankings(StrictModel):
    city_id: str
    pollutant: Pollutant
    unit: Literal["µg/m³"] = "µg/m³"
    ranking_kind: Literal["observed_concentration"] = "observed_concentration"
    input_cutoff_at: AwareDatetime
    includes_stale: bool
    excluded_missing_count: int
    excluded_stale_count: int
    rows: list[ObservedRank]
    limitations: list[str] = [
        "Latest station observations may have different measurement times and partial coverage",
        "Not predicted hotspots, forecasts, area-wide concentration or a common-time city average",
    ]
