from breathewise.main import create_app
from fastapi.testclient import TestClient


def test_v5_registry_does_not_enable_operational_inference():
    client = TestClient(create_app())
    response = client.get("/api/v1/models")
    assert response.status_code == 200
    models = response.json()["data"]["models"]
    row = next(m for m in models if m["model_version"] == "supplied-horizon-ensemble-v5")
    assert row["kind"] == "native_diagnostic"
    assert row["feature_count"] == 69
    assert row["supported_horizons"] == [1, 3, 6, 12, 24]
    assert row["live_supported_horizons"] == []
    assert row["target_unit"] is None
    assert row["golden_parity_verified"] is False
    assert row["live_forecast_ready"] is False
    assert row["retrospective_evaluation_ready"] is False
    assert row["continuous_trajectory_ready"] is False
    assert row["evaluation_path"] is None
    assert row["predictions_path"] is None
    assert "V5_GOLDEN_PARITY_MISSING" in row["unavailable_reasons"]
    assert "V5_ISSUE_TIME_INPUTS_UNVERIFIED" in row["unavailable_reasons"]
    assert any(m["model_version"] == "delhi-recorded-pm25-hourly-v2" for m in models)
