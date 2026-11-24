"""Open-Meteo NWP weather and atmospheric model adapter.

Strict scientific controls:
- Gridded numerical weather prediction (NWP) model estimate, NOT a calibrated ground sensor.
- In-memory caching (10 min TTL) to prevent rate limits and unnecessary upstream traffic.
- Transparent source timestamps, units, and non-ground attribution.
"""

import time
from datetime import UTC, datetime
from typing import Any

import httpx
from pydantic import BaseModel

BASE_URL = "https://api.open-meteo.com/v1/forecast"

# In-memory coordinate cache: key -> (timestamp, data)
_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
CACHE_TTL_SECONDS = 600  # 10 minutes


class WeatherContext(BaseModel):
    temperature_c: float | None = None
    relative_humidity_pct: float | None = None
    apparent_temperature_c: float | None = None
    wind_speed_kmh: float | None = None
    wind_direction_deg: float | None = None
    surface_pressure_hpa: float | None = None
    precipitation_mm: float | None = None
    weather_code: int | None = None
    condition_description: str = "Unknown"
    source_timestamp: datetime | None = None
    source: str = "Open-Meteo.com (ECMWF/GFS Gridded NWP)"
    estimate_type: str = "gridded_numerical_weather_prediction"
    available: bool = True
    disclaimer: str = (
        "Gridded meteorological model estimate from numerical weather prediction (NWP); "
        "not a calibrated ground station observation."
    )


WMO_WEATHER_CODES: dict[int, str] = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    95: "Thunderstorm",
}


def _cache_key(lat: float, lon: float) -> str:
    # Round coordinates to ~2km resolution for caching
    return f"{round(lat, 2)}:{round(lon, 2)}"


def fetch_weather_context(
    latitude: float,
    longitude: float,
    client: httpx.Client | None = None,
) -> WeatherContext:
    """Fetch current weather context for coordinates with caching and error handling."""
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        return WeatherContext(
            available=False,
            condition_description="Invalid coordinates",
            disclaimer="Coordinates out of geographic range",
        )

    key = _cache_key(latitude, longitude)
    now = time.time()
    if key in _CACHE:
        cached_time, cached_data = _CACHE[key]
        if now - cached_time < CACHE_TTL_SECONDS:
            return WeatherContext(**cached_data)

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": (
            "temperature_2m,relative_humidity_2m,apparent_temperature,"
            "precipitation,wind_speed_10m,wind_direction_10m,surface_pressure,weather_code"
        ),
        "timezone": "UTC",
    }

    own_client = False
    if client is None:
        client = httpx.Client(timeout=5.0)
        own_client = True

    try:
        response = client.get(BASE_URL, params=params)
        if response.status_code != 200:
            return WeatherContext(
                available=False,
                condition_description=f"Upstream status {response.status_code}",
            )
        payload = response.json()
        current = payload.get("current", {})

        time_str = current.get("time")
        source_ts = None
        if time_str:
            try:
                source_ts = datetime.fromisoformat(time_str.replace("Z", "+00:00")).astimezone(UTC)
            except Exception:
                source_ts = datetime.now(UTC)

        code = current.get("weather_code")
        desc = (
            WMO_WEATHER_CODES.get(code, "Clear / Variable")
            if code is not None
            else "Clear / Variable"
        )

        context = WeatherContext(
            temperature_c=current.get("temperature_2m"),
            relative_humidity_pct=current.get("relative_humidity_2m"),
            apparent_temperature_c=current.get("apparent_temperature"),
            wind_speed_kmh=current.get("wind_speed_10m"),
            wind_direction_deg=current.get("wind_direction_10m"),
            surface_pressure_hpa=current.get("surface_pressure"),
            precipitation_mm=current.get("precipitation"),
            weather_code=code,
            condition_description=desc,
            source_timestamp=source_ts,
            available=True,
        )
        _CACHE[key] = (now, context.model_dump())
        return context
    except Exception as exc:
        return WeatherContext(
            available=False,
            condition_description=f"Weather context unavailable ({exc.__class__.__name__})",
        )
    finally:
        if own_client:
            client.close()
