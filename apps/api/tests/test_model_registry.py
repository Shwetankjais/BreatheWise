"""Small synthetic registry proves version/hash/scope behavior; no production metrics."""

import csv
import hashlib
import json

import pytest
from breathewise.core.config import get_settings
from breathewise.main import create_app
from breathewise.ml.experiment import (
    BACKTESTS,
    HORIZONS,
    MODEL_VERSION,
    SPLITS,
    feature_definitions,
)
from fastapi.testclient import TestClient


@pytest.fixture
def registry(tmp_path, monkeypatch):
    monkeypatch.setenv("FORECAST_REGISTRY_ROOT", str(tmp_path))
    get_settings.cache_clear()
    folder = tmp_path / MODEL_VERSION
    folder.mkdir()
    models = {}
    for h in HORIZONS:
        p = folder / f"horizon_{h}h.txt"
        p.write_text("Synthetic hash guard bytes, not a loadable production model\n")
        models[str(h)] = {
            "path": p.name,
            "sha256": hashlib.sha256(p.read_bytes()).hexdigest(),
            "best_iteration": 1,
            "feature_names": [x["name"] for x in feature_definitions(h)],
            "features": feature_definitions(h),
        }
    pred = folder / "heldout_predictions.csv"
    with pred.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(
            [
                "model_version",
                "station_id",
                "pollutant",
                "split",
                "horizon_h",
                "issue_at_recorded",
                "target_at_recorded",
                "observed",
                "lightgbm",
                "persistence",
                "previous_day_same_hour",
            ]
        )
        w.writerow(
            [
                MODEL_VERSION,
                "site_301",
                "pm25",
                "test",
                1,
                "2025-01-01T00:00:00",
                "2025-01-01T01:00:00",
                0,
                2,
                3,
                "",
            ]
        )
    score = {
        "lightgbm": {"count": 1, "mae": 2.0, "rmse": 2.0, "bias": 2.0},
        "persistence": {"count": 1, "mae": 3.0, "rmse": 3.0, "bias": 3.0},
        "previous_day_same_hour": {"count": 0, "mae": None, "rmse": None, "bias": None},
    }
    group = {
        "all_available": score,
        "common_baseline_cohort": score,
        "high_pollution_observed_target_ge_150": score,
        "high_pollution_threshold_ugm3": 150,
        "high_pollution_definition": "synthetic schema fixture only",
    }
    manifest = {
        "model_version": MODEL_VERSION,
        "dataset_mode": "recorded_clock",
        "timezone": None,
        "source_station_ids": ["site_301"],
        "pollutant": "pm25",
        "target_unit": "µg/m³",
        "target_transform": "identity",
        "supported_horizons": list(HORIZONS),
        "continuous_trajectory": False,
        "live_forecast_ready": False,
        "retrospective_evaluation_ready": True,
        "models": models,
        "heldout_predictions": {
            "path": pred.name,
            "sha256": hashlib.sha256(pred.read_bytes()).hexdigest(),
        },
        "evaluation": {str(h): {"test": group, "validation": group} for h in HORIZONS},
        "rolling_backtests": {f["name"]: {str(h): group for h in HORIZONS} for f in BACKTESTS},
        "protocol": {"splits": {k: list(v) for k, v in SPLITS.items()}},
        "dataset_sha256": "synthetic-fixture-not-data",
        "preprocessing": "synthetic fixture",
        "input_availability_assumption": "publication unknown",
        "limitations": ["synthetic API schema fixture"],
    }
    (folder / "manifest.json").write_text(json.dumps(manifest))
    yield TestClient(create_app()), folder
    get_settings.cache_clear()


def test_registry_evaluation_and_bounded_predictions_preserve_scope(registry):
    client, _ = registry
    r = client.get(f"/api/v1/models/{MODEL_VERSION}/evaluation")
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["timezone"] is None and not data["publication_time_known"]
    assert data["retrospective_only"] and not data["live_forecast_ready"]
    r = client.get(f"/api/v1/models/{MODEL_VERSION}/predictions?horizon_h=1&limit=1")
    assert r.status_code == 200
    p = r.json()["data"]
    assert p["total_count"] == 1
    assert p["points"][0]["observed"] == 0 and p["points"][0]["previous_day_same_hour"] is None
    assert "+" not in p["points"][0]["issue_at_recorded"] and not p["points"][0][
        "issue_at_recorded"
    ].endswith("Z")
    assert client.get(f"/api/v1/models/{MODEL_VERSION}/predictions?horizon_h=2").status_code == 409
    assert (
        client.get(f"/api/v1/models/{MODEL_VERSION}/predictions?horizon_h=1&limit=1001").status_code
        == 422
    )
    r = client.get(f"/api/v1/stations/openaq-235/forecast?model_version={MODEL_VERSION}")
    assert r.status_code == 409 and r.json()["error"]["code"] == "MODEL_RETROSPECTIVE_ONLY"
    assert client.get(f"/api/v1/model-performance?model_version={MODEL_VERSION}").status_code == 200
    assert client.get("/api/v1/models/unknown/evaluation").status_code == 404


def test_tampered_predictions_disable_evaluation_and_registry_readiness(registry):
    client, folder = registry
    with (folder / "heldout_predictions.csv").open("a") as f:
        f.write("tampered\n")
    r = client.get(f"/api/v1/models/{MODEL_VERSION}/evaluation")
    assert r.status_code == 503 and r.json()["error"]["code"] == "MODEL_ARTIFACT_INVALID"
    entries = client.get("/api/v1/models").json()["data"]["models"]
    item = next(m for m in entries if m["model_version"] == MODEL_VERSION)
    assert item["status"] == "artifact_invalid" and not item["retrospective_evaluation_ready"]
