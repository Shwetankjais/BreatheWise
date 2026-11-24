import httpx
import pytest
from breathewise.core.config import get_settings
from breathewise.core.errors import ServiceError
from breathewise.schemas.routing import GeometryRequest
from breathewise.services.routing import geometry


def test_real_geometry_contract_cache_and_no_exposure(tmp_path, monkeypatch):
    monkeypatch.setenv("DATA_ROOT", str(tmp_path))
    monkeypatch.setenv("ROUTING_BASE_URL", "https://routing.example")
    get_settings.cache_clear()
    calls = []

    def handle(request):
        calls.append(request)
        return httpx.Response(
            200,
            json={
                "code": "Ok",
                "routes": [
                    {
                        "geometry": {
                            "type": "LineString",
                            "coordinates": [[77.2, 28.6], [77.25, 28.65]],
                        },
                        "distance": 8123,
                        "duration": 1234,
                    }
                ],
            },
        )

    body = GeometryRequest(
        origin={"latitude": 28.6, "longitude": 77.2},
        destination={"latitude": 28.65, "longitude": 77.25},
    )
    try:
        with httpx.Client(transport=httpx.MockTransport(handle)) as client:
            first = geometry(body, client)
            second = geometry(body, client)
        assert len(calls) == 1 and second.cached
        assert first.routes[0].geometry.coordinates[0] == (77.2, 28.6)
        assert first.routes[0].distance_m == 8123
        assert first.routes[0].exposure is None and not first.routes[0].traffic_aware
        assert first.alternatives_returned == 1
        with pytest.raises(ServiceError, match="Only verified driving"):
            geometry(body.model_copy(update={"mode": "walking"}))
    finally:
        get_settings.cache_clear()


def test_routing_network_failure_does_not_fabricate(tmp_path, monkeypatch):
    monkeypatch.setenv("DATA_ROOT", str(tmp_path))
    monkeypatch.setenv("ROUTING_BASE_URL", "https://routing.example")
    get_settings.cache_clear()
    try:
        body = GeometryRequest(
            origin={"latitude": 28.6, "longitude": 77.2},
            destination={"latitude": 28.65, "longitude": 77.25},
        )
        with (
            httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(503))) as client,
            pytest.raises(ServiceError) as error,
        ):
            geometry(body, client)
        assert error.value.detail.code == "ROUTING_PROVIDER_UNAVAILABLE"
    finally:
        get_settings.cache_clear()
