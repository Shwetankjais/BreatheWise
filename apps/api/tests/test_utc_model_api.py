"""UTC service filters/clock boundaries on explicitly synthetic registry data."""

import csv
import json

from breathewise.ml.experiment import sha256
from breathewise.ml.utc_experiment import UTC_BACKTESTS, UTC_MODEL_VERSION, UTC_SPLITS, utc_features
from test_model_registry import synthetic_issue_purge

pytest_plugins = ["test_model_registry"]


def test_utc_registry_playback_keeps_clock_and_live_boundaries(registry, monkeypatch):
    client, original = registry
    folder = original.parent / UTC_MODEL_VERSION
    folder.mkdir()
    m = json.loads((original / "manifest.json").read_text())
    m.update(
        model_version=UTC_MODEL_VERSION,
        dataset_mode="utc_provider_history",
        timezone="UTC",
        source_station_ids=["openaq-235"],
        sensor_ids=[12235610],
        supported_horizons=list(range(1, 25)),
        missing_input_behavior={"missing_current": "issue excluded"},
    )
    protocol = {"splits": {k: list(v) for k, v in UTC_SPLITS.items()}}
    (folder / "protocol.json").write_text(json.dumps(protocol))
    m["protocol"] = protocol
    m["protocol_sha256"] = sha256(folder / "protocol.json")
    group = m["evaluation"]["1"]["test"]
    m["rolling_backtests"] = {
        x["name"]: {str(h): group for h in range(1, 25)} for x in UTC_BACKTESTS
    }
    for h in range(1, 25):
        key = str(h)
        model = dict(m["models"]["1"])
        model["features"] = utc_features(h)
        model["feature_names"] = [x["name"] for x in model["features"]]
        m["models"][key] = model
        m["evaluation"][key] = {"test": group, "validation": group}
    for p in original.glob("*.txt"):
        (folder / p.name).write_bytes(p.read_bytes())
    pred = folder / "heldout_predictions.csv"
    with pred.open("w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "station_id",
                "split",
                "horizon_h",
                "issue_at_utc",
                "target_at_utc",
                "observed",
                "lightgbm",
                "persistence",
                "previous_day_same_hour",
            ]
        )
        writer.writerow(
            [
                "openaq-235",
                "test",
                2,
                "2026-07-01T00:30:00+00:00",
                "2026-07-01T02:30:00+00:00",
                0,
                1,
                2,
                "",
            ]
        )
    m["heldout_predictions"] = {"path": pred.name, "sha256": sha256(pred)}
    (folder / "manifest.json").write_text(json.dumps(m))
    synthetic_issue_purge(folder, m, monkeypatch)
    base = f"/api/v1/models/{UTC_MODEL_VERSION}"
    data = client.get(base + "/utc-evaluation?horizon_h=2").json()["data"]
    assert (
        data["timezone"] == "UTC" and data["retrospective_only"] and not data["live_forecast_ready"]
    )
    assert data["splits"][0]["start_at_utc"].endswith("Z")
    assert client.get(base + "/evaluation").status_code == 409
    assert client.get(base + "/predictions?horizon_h=2").status_code == 409
    response = client.get(
        base
        + "/utc-predictions?horizon_h=2&target_start=2026-07-01T00:00:00Z&target_end=2026-07-01T03:00:00Z"
    )
    assert response.status_code == 200
    points = response.json()["data"]["points"]
    assert len(points) == 1 and points[0]["target_at_utc"].endswith("Z")
    assert points[0]["observed"] == 0 and points[0]["previous_day_same_hour"] is None
    assert (
        client.get(base + "/utc-predictions?horizon_h=2&target_end=2026-07-01T02:30:00Z").json()[
            "data"
        ]["total_count"]
        == 0
    )
    assert (
        client.get(
            base + "/utc-predictions?horizon_h=2&target_start=2026-07-01T00:00:00"
        ).status_code
        == 422
    )
    assert client.get(base + "/utc-predictions?horizon_h=25").status_code == 409
    assert client.get(base + "/utc-predictions?horizon_h=2&split=rolling_2022").status_code == 422
    assert (
        client.get(
            "/api/v1/stations/openaq-235/forecast?model_version=" + UTC_MODEL_VERSION
        ).status_code
        == 409
    )
    entry = next(
        x
        for x in client.get("/api/v1/models").json()["data"]["models"]
        if x["model_version"] == UTC_MODEL_VERSION
    )
    assert entry["dataset_mode"] == "utc_provider_history" and entry["evaluation_path"].endswith(
        "utc-evaluation"
    )
    # A target inside test but issued before the fit cutoff stays in raw playback,
    # and is excluded only by the explicit issue-time-purged cohort filter.
    with pred.open("a", newline="") as f:
        csv.writer(f).writerow(
            [
                "openaq-235",
                "test",
                2,
                "2026-06-30T23:30:00+00:00",
                "2026-07-01T01:30:00+00:00",
                1,
                2,
                3,
                4,
            ]
        )
    m["heldout_predictions"]["sha256"] = sha256(pred)
    (folder / "manifest.json").write_text(json.dumps(m))
    synthetic_issue_purge(folder, m, monkeypatch)
    raw = client.get(base + "/utc-predictions?horizon_h=2").json()["data"]
    purged = client.get(base + "/utc-predictions?horizon_h=2&issue_time_purged=true").json()["data"]
    assert raw["total_count"] == 2 and purged["total_count"] == 1
    assert purged["evaluation_cohort"] == "fixed_model_issue_time_purged"
    pred.write_text(pred.read_text() + "tampered\n")
    assert client.get(base + "/utc-evaluation").json()["error"]["code"] == "MODEL_ARTIFACT_INVALID"
