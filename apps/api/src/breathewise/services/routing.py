"""Bounded cached OSRM geometry; no spatial pollution inference or traffic claims."""

import fcntl
import hashlib
import threading
import time
from urllib.parse import urlsplit

import httpx
from breathewise.core.config import get_settings
from breathewise.core.errors import ServiceError
from breathewise.schemas.routing import GeometryResponse, LineString, RouteGeometry
from pydantic import ValidationError

_GATE = threading.Lock()


def geometry(body, client=None):
    settings = get_settings()
    if body.mode != "driving":
        raise ServiceError(
            409, "ROUTING_MODE_UNSUPPORTED", "Only verified driving profile is supported"
        )
    base = settings.routing_base_url.rstrip("/")
    parsed = urlsplit(base)
    if (
        not base
        or parsed.scheme != "https"
        or not parsed.hostname
        or parsed.username
        or parsed.query
        or parsed.fragment
    ):
        raise ServiceError(503, "ROUTING_UNAVAILABLE", "Configure a trusted HTTPS OSRM endpoint")
    # Initial bounded Delhi geometry slice: do not imply national route coverage.
    for point in [body.origin, body.destination]:
        if not (28.3 <= point.latitude <= 29.1 and 76.7 <= point.longitude <= 77.6):
            raise ServiceError(
                422,
                "ROUTE_OUTSIDE_SUPPORTED_SCOPE",
                "Initial route scope is the Delhi bounding region",
            )
    key = hashlib.sha256((base + body.model_dump_json()).encode()).hexdigest()
    directory = settings.data_root / "cache/routing"
    directory.mkdir(parents=True, exist_ok=True)
    cache = directory / (key + ".json")
    with _GATE, (directory / "provider.lock").open("a+") as gate:
        fcntl.flock(gate.fileno(), fcntl.LOCK_EX)
        if cache.exists() and 0 <= time.time() - cache.stat().st_mtime <= 21600:
            try:
                return GeometryResponse.model_validate_json(cache.read_text()).model_copy(
                    update={"cached": True}
                )
            except (ValueError, ValidationError):
                cache.unlink()
        # Cross-process throttle for the public provider's max1req/s policy.
        last = directory / "last_request.txt"
        try:
            elapsed = time.time() - float(last.read_text())
        except (ValueError, OSError):
            elapsed = 2
        if elapsed < 1.1:
            time.sleep(min(1.1 - elapsed, 1.1))
        last.write_text(str(time.time()))
        origin, destination = body.origin, body.destination
        coords = (
            f"{origin.longitude},{origin.latitude};{destination.longitude},{destination.latitude}"
        )
        own = client is None
        client = client or httpx.Client()
        try:
            response = client.get(
                f"{base}/route/v1/driving/{coords}",
                params={
                    "alternatives": body.alternatives,
                    "geometries": "geojson",
                    "overview": "full",
                    "steps": "false",
                    "generate_hints": "false",
                    "radiuses": "500;500",
                },
                timeout=20,
                follow_redirects=False,
            )
            if response.status_code == 429:
                raise ServiceError(
                    503, "ROUTING_RATE_LIMITED", "Provider rate limit; try later", retryable=True
                )
            if response.status_code == 400:
                try:
                    no_route = response.json().get("code") in {"NoRoute", "NoSegment"}
                except (ValueError, AttributeError):
                    no_route = False
                if no_route:
                    raise ServiceError(
                        409, "ROUTE_NOT_FOUND", "No provider route between supported endpoints"
                    )
            if response.status_code != 200:
                raise ServiceError(
                    503,
                    "ROUTING_PROVIDER_UNAVAILABLE",
                    "Routing provider request failed",
                    retryable=response.status_code >= 500,
                )
            if len(response.content) > 2_000_000:
                raise ServiceError(
                    503, "ROUTING_RESPONSE_TOO_LARGE", "Provider geometry exceeds supported bounds"
                )
            raw = response.json()
            if raw.get("code") in {"NoRoute", "NoSegment"}:
                raise ServiceError(
                    409, "ROUTE_NOT_FOUND", "No provider route between supported endpoints"
                )
            if (
                raw.get("code") != "Ok"
                or not isinstance(raw.get("routes"), list)
                or not raw["routes"]
            ):
                raise ValueError()
            routes = []
            for index, item in enumerate(raw["routes"][: body.alternatives]):
                routes.append(
                    RouteGeometry(
                        id=f"route-{index + 1}",
                        geometry=LineString.model_validate(item["geometry"]),
                        distance_m=item["distance"],
                        estimated_duration_s=item["duration"],
                    )
                )
            result = GeometryResponse(routes=routes, alternatives_returned=len(routes))
            temporary = cache.with_suffix(".tmp")
            temporary.write_text(result.model_dump_json())
            temporary.replace(cache)
            return result
        except httpx.HTTPError:
            raise ServiceError(
                503,
                "ROUTING_NETWORK_UNAVAILABLE",
                "Routing provider connection failed",
                retryable=True,
            ) from None
        except (KeyError, ValueError, TypeError, ValidationError):
            raise ServiceError(
                503, "ROUTING_INVALID_RESPONSE", "Provider returned unsupported route geometry"
            ) from None
        finally:
            if own:
                client.close()
