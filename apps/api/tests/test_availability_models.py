"""API scenario identity/readiness boundaries; numerical validation lives in isolated tests."""

import pytest
from breathewise.core.config import get_settings
from breathewise.main import create_app
from breathewise.ml.availability_experiment import MODEL_VERSION, SCENARIO
from breathewise.schemas.models import ModelSummary
from fastapi.testclient import TestClient


def test_unregistered_availability_artifact_stays_unavailable(tmp_path, monkeypatch):
    monkeypatch.setenv("FORECAST_REGISTRY_ROOT", str(tmp_path))
    get_settings.cache_clear()
    try:
        client = TestClient(create_app())
        response = client.get(f"/api/v1/models/{MODEL_VERSION}/availability-evaluation")
        assert (
            response.status_code == 503
            and response.json()["error"]["code"] == "EVALUATION_UNAVAILABLE"
        )
        item = next(
            x
            for x in client.get("/api/v1/models").json()["data"]["models"]
            if x["model_version"] == MODEL_VERSION
        )
        assert (
            item["kind"] == "experimental_forecast"
            and item["dataset_mode"] == "utc_availability_scenario"
        )
        assert not item["live_forecast_ready"] and not item["experimental_shadow_ready"]
        assert client.get("/api/v1/models/not-a-model/availability-evaluation").status_code == 404
    finally:
        get_settings.cache_clear()


def test_experimental_readiness_cannot_become_public_live_or_trajectory():
    summary = ModelSummary(
        model_version=MODEL_VERSION,
        kind="experimental_forecast",
        dataset_mode="utc_availability_scenario",
        experimental_shadow_ready=True,
        status="available",
        limitations=["simulated historical availability"],
    )
    assert (
        summary.experimental_shadow_ready
        and not summary.live_forecast_ready
        and not summary.continuous_trajectory_ready
    )
    assert SCENARIO["historical_availability_observed"] is False
    assert (
        SCENARIO["minimum_input_age_hours"] == 3 and SCENARIO["maximum_latest_input_age_hours"] == 4
    )
    with pytest.raises(ValueError):
        ModelSummary(**{**summary.model_dump(), "live_forecast_ready": True})


def test_registered_experimental_model_cannot_use_public_forecast_route(monkeypatch):
    from breathewise.services import availability_models

    monkeypatch.setattr(availability_models, "manifest", lambda version: (None, {}))
    response = TestClient(create_app()).get(
        f"/api/v1/stations/openaq-235/forecast?model_version={MODEL_VERSION}&horizons=2"
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "MODEL_EXPERIMENTAL_ONLY"
