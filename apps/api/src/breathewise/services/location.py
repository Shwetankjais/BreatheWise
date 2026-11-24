"""Location and environmental context service.

Binds user coordinates to:
1. Nearest ground monitoring station within calibrated geographic network bounds (50 km).
2. All available criteria pollutant ground readings (with missing parameters marked unavailable).
3. Gridded Open-Meteo numerical weather context with explicit non-ground labeling.
"""

import math
from datetime import UTC, datetime

from breathewise.adapters.openmeteo import WeatherContext, fetch_weather_context
from breathewise.core.config import get_settings
from breathewise.db.models import Observation, Station
from breathewise.repositories import observations as obs_repo
from breathewise.schemas.common import Pollutant
from breathewise.schemas.environment import Measurement, StationView
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(r * c, 2)


class PollutantReading(BaseModel):
    pollutant: str
    available: bool
    value: float | None = None
    unit: str | None = None
    measured_at: datetime | None = None
    source: str | None = None
    quality_flags: list[str] = []
    stale: bool = False
    averaging_period: str = "1-hour reading"


class LocationContext(BaseModel):
    user_latitude: float
    user_longitude: float
    nearest_station: StationView | None = None
    distance_km: float | None = None
    in_bounds: bool = True
    bounds_limit_km: float = 50.0
    boundary_message: str | None = None
    ground_pollutants: dict[str, PollutantReading] = {}
    weather: WeatherContext | None = None


def get_station_pollutants(db: Session, station_id: str) -> dict[str, PollutantReading]:
    """Retrieve the latest ground observation for every criteria pollutant."""
    cutoff = datetime.now(UTC)
    results: dict[str, PollutantReading] = {}
    all_pollutants = [
        Pollutant.pm25,
        Pollutant.pm10,
        Pollutant.no2,
        Pollutant.so2,
        Pollutant.co,
        Pollutant.o3,
    ]
    for p in all_pollutants:
        row = db.scalar(
            obs_repo.observations(db, station_id, p, cutoff)
            .order_by(None)
            .order_by(Observation.measured_at.desc())
            .limit(1)
        )
        if row:
            meas: Measurement = obs_repo.measurement(row, cutoff)
            results[p.value] = PollutantReading(
                pollutant=p.value,
                available=True,
                value=meas.value,
                unit=meas.unit,
                measured_at=meas.measured_at,
                source=meas.source,
                quality_flags=meas.quality_flags,
                stale=meas.stale,
                averaging_period="1-hour reading (not 24h official NAQI)",
            )
        else:
            results[p.value] = PollutantReading(
                pollutant=p.value,
                available=False,
                averaging_period="1-hour reading",
            )
    return results


def resolve_location_context(
    db: Session,
    latitude: float,
    longitude: float,
    city_id: str = "delhi",
) -> LocationContext:
    """Resolve location to nearest station, ground pollutants, and weather context."""
    # Find all active stations in this data mode
    mode = get_settings().data_mode
    stations = db.scalars(
        select(Station).where(Station.city_id == city_id, Station.data_mode == mode)
    ).all()

    if not stations:
        # Fallback to any station in city
        stations = db.scalars(select(Station).where(Station.city_id == city_id)).all()

    nearest = None
    min_dist = float("inf")
    for s in stations:
        dist = haversine_km(latitude, longitude, s.latitude, s.longitude)
        if dist < min_dist:
            min_dist = dist
            nearest = s

    in_bounds = min_dist <= 50.0
    boundary_msg = None
    if not in_bounds:
        boundary_msg = (
            f"Nearest monitor is {min_dist} km away (outside the 50 km Delhi NCR network). "
            "Manual station selection retained."
        )

    ground_pollutants: dict[str, PollutantReading] = {}
    station_view = None
    if nearest:
        station_view = obs_repo.station_view(nearest)
        ground_pollutants = get_station_pollutants(db, nearest.id)

    weather = fetch_weather_context(latitude, longitude)

    return LocationContext(
        user_latitude=latitude,
        user_longitude=longitude,
        nearest_station=station_view,
        distance_km=min_dist if nearest else None,
        in_bounds=in_bounds,
        boundary_message=boundary_msg,
        ground_pollutants=ground_pollutants,
        weather=weather,
    )
