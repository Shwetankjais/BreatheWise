from typing import Literal

from breathewise.schemas.common import StrictModel
from breathewise.schemas.environment import Coordinates
from pydantic import Field, field_validator


class GeometryRequest(StrictModel):
    origin: Coordinates
    destination: Coordinates
    mode: Literal["driving", "walking", "cycling"] = "driving"
    alternatives: int = Field(default=3, ge=1, le=3)


class LineString(StrictModel):
    type: Literal["LineString"] = "LineString"
    coordinates: list[tuple[float, float]] = Field(min_length=2, max_length=20000)

    @field_validator("coordinates")
    @classmethod
    def geographic(cls, value):
        if any(not (-180 <= lon <= 180 and -90 <= lat <= 90) for lon, lat in value):
            raise ValueError("Route geometry outside WGS84 bounds")
        return value


class RouteGeometry(StrictModel):
    id: str
    geometry: LineString
    distance_m: float = Field(ge=0)
    estimated_duration_s: float = Field(ge=0)
    traffic_aware: Literal[False] = False
    exposure: None = None
    exposure_status: Literal["unavailable"] = "unavailable"


class GeometryResponse(StrictModel):
    provider: str = "OSRM"
    profile: Literal["driving"] = "driving"
    attribution: str = "Routing: OSRM; road data © OpenStreetMap contributors"
    routes: list[RouteGeometry]
    alternatives_returned: int
    cached: bool = False
    exposure_ready: Literal[False] = False
    duration_method: str = (
        "Provider road-network travel estimate; no live traffic or departure-time adjustment"
    )
    limitations: list[str] = [
        "Provider may return fewer alternatives than requested",
        "No pollution exposure estimate or street-level concentration differences",
        "Public demonstration endpoint has no uptime/data-update guarantee; configure a production provider before deployment",
    ]
