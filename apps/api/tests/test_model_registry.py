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
    HOURLY_MODEL_VERSION,
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
    filtered = client.get(f"/api/v1/model-performance?model_version={MODEL_VERSION}&horizon_h=3")
    assert filtered.status_code == 200
    assert [row["horizon_h"] for row in filtered.json()["data"]["horizons"]] == [3]
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


def test_hourly_version_is_separate_and_playback_filters_preserve_recorded_clock(
    registry, monkeypatch
):
    from breathewise.ml.experiment import EXPERIMENT_VERSIONS, feature_definitions

    client, original = registry
    folder = original.parent / HOURLY_MODEL_VERSION
    folder.mkdir()
    manifest = json.loads((original / "manifest.json").read_text())
    manifest["model_version"] = HOURLY_MODEL_VERSION
    manifest["supported_horizons"] = list(EXPERIMENT_VERSIONS[HOURLY_MODEL_VERSION])
    for horizon in manifest["supported_horizons"]:
        key = str(horizon)
        data = dict(manifest["models"]["1"])
        data["features"] = feature_definitions(horizon)
        data["feature_names"] = [x["name"] for x in data["features"]]
        manifest["models"][key] = data
        manifest["evaluation"][key] = manifest["evaluation"]["1"]
        for fold in manifest["rolling_backtests"].values():
            fold[key] = fold["1"]
    for source in original.iterdir():
        if source.name != "manifest.json":
            (folder / source.name).write_bytes(source.read_bytes())
    (folder / "manifest.json").write_text(json.dumps(manifest))
    synthetic_issue_purge(folder, manifest, monkeypatch)
    base = f"/api/v1/models/{HOURLY_MODEL_VERSION}"
    assert client.get(f"{base}/evaluation?horizon_h=2").status_code == 200
    assert client.get(f"{base}/evaluation?horizon_h=25").status_code == 409
    assert (
        client.get(
            f"/api/v1/model-performance?model_version={HOURLY_MODEL_VERSION}&horizon_h=2"
        ).status_code
        == 200
    )
    assert client.get(f"/api/v1/models/{MODEL_VERSION}/evaluation?horizon_h=2").status_code == 409
    url = f"{base}/predictions?horizon_h=1"
    response = client.get(url + "&target_start=2025-01-01T00:00:00&target_end=2025-01-01T02:00:00")
    assert response.status_code == 200 and response.json()["data"]["total_count"] == 1
    assert client.get(url + "&target_end=2025-01-01T01:00:00").json()["data"]["total_count"] == 0
    assert (
        client.get(
            url + "&target_start=2025-01-01T02:00:00&target_end=2025-01-01T01:00:00"
        ).status_code
        == 422
    )
    assert client.get(url + "&target_start=2025-01-01T00:00:00Z").status_code == 422


def synthetic_issue_purge(folder, manifest, monkeypatch):
    """Hash-checked synthetic supplement; test trust anchor uses its own actual bytes."""
    from breathewise.ml.issue_purged import EXPECTED_SIDECAR_SHA256

    protocol = folder / "protocol.json"
    protocol.write_text(json.dumps(manifest["protocol"]))
    report = {
        "model_version": manifest["model_version"],
        "supported_horizons": list(range(1, 25)),
        "source_protocol_sha256": hashlib.sha256(protocol.read_bytes()).hexdigest(),
        "source_predictions_sha256": manifest["heldout_predictions"]["sha256"],
        "evaluation": manifest["evaluation"],
        "rolling_backtests": manifest["rolling_backtests"],
        "rule": {"test": "issue >= validation_end"},
        "row_counts": {
            str(h): {"test": {"original_rows": 1, "retained_rows": 1, "removed_boundary_rows": 0}}
            for h in range(1, 25)
        },
        "limitations": ["Synthetic mechanics fixture, not measured environmental scores"],
    }
    sidecar = folder / "issue_purged_evaluation.json"
    sidecar.write_text(json.dumps(report))
    monkeypatch.setitem(
        EXPECTED_SIDECAR_SHA256,
        manifest["model_version"],
        hashlib.sha256(sidecar.read_bytes()).hexdigest(),
    )
