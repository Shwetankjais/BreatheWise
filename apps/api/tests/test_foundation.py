from breathewise.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_liveness_has_contract_metadata():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["meta"]["contract_version"] == "1.1.0"
    assert response.headers["x-request-id"] == response.json()["meta"]["request_id"]


def test_model_disabled_and_no_false_accuracy():
    response = client.get("/api/v1/stations/example/forecast")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "MODEL_UNAVAILABLE"
    caps = client.get("/api/v1/capabilities").json()["data"]
    assert caps["verified_forecast_horizons"] == []
    assert not caps["model_forecast"]["supported"]
    assert not caps["calibrated_intervals"]["supported"]


def test_unsupported_horizon_and_pollutant():
    assert client.get("/api/v1/stations/example/forecast?horizons=2").status_code == 409
    assert client.get("/api/v1/stations/example/forecast?pollutant=no2").status_code == 409


def test_invalid_request_is_sanitized():
    response = client.post(
        "/api/v1/routes/compare",
        json={"origin": {"latitude": 999, "longitude": 0}, "secret": "do-not-echo"},
    )
    assert response.status_code == 422
    assert "do-not-echo" not in response.text
    assert response.json()["error"]["fields"]


def test_requested_cities_do_not_imply_coverage():
    cities = client.get("/api/v1/cities").json()["data"]
    assert len(cities) == 16
    assert all(row["availability"] == "unaudited" for row in cities)


def test_duration_planner_does_not_interpolate_fake_hours():
    response = client.post(
        "/api/v1/activity-plan",
        json={
            "station_id": "example",
            "activity": "walk",
            "duration_minutes": 30,
            "start": "2026-11-24T10:00:00Z",
            "end": "2026-11-24T12:00:00Z",
        },
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "TRAJECTORY_UNAVAILABLE"


def test_advisories_are_sourced_and_not_personalized():
    response = client.get("/api/v1/advisories?pollutant=pm25")
    assert response.status_code == 200
    data = response.json()["data"][0]
    assert data["scope"] == "general_education"
    assert data["source_url"].startswith("https://www.who.int/")
    assert "no clinical review" in data["review_scope"]
