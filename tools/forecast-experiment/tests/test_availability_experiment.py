"""Synthetic mechanics for simulated publication delay; not forecasting accuracy."""

from datetime import UTC, datetime, timedelta

import numpy as np
import pytest
from breathewise.ml.availability_experiment import feature_definitions, make_frame, split_mask


@pytest.mark.parametrize("horizon", range(1, 25))
def test_delay_causality_current_gap_and_baselines(horizon):
    times = [datetime(2025, 12, 28, 0, 30, tzinfo=UTC) + timedelta(hours=i) for i in range(180)]
    values = np.arange(180.0)
    first = make_frame(times, values, horizon)
    changed = values.copy()
    changed[88:] = 999
    second = make_frame(times, changed, horizon)
    # An issue at90 may use only completed observations through87.
    np.testing.assert_equal(first["x"][:91], second["x"][:91])
    assert first["persistence"][90] == 87
    assert first["latest_known_age_h"][90] == 3
    assert first["y"][90] == 90 + horizon
    assert first["previous_day"][90] == 90 + horizon - 48
    assert first["x"].shape == (180, 40)
    assert first["feature_names"] == [x["name"] for x in feature_definitions(horizon)]
    values[87] = np.nan
    missing = make_frame(times, values, horizon)
    assert missing["persistence"][90] == 86 and missing["latest_known_age_h"][90] == 4
    assert np.isnan(missing["x"][90, 0]) and missing["x"][90, 1] == 1
    values[86] = np.nan
    missing = make_frame(times, values, horizon)
    assert np.isnan(missing["persistence"][90])
    mask = split_mask(first, "2026-01-01T00:00:00Z", "2026-01-03T00:00:00Z")
    assert all(times[i] >= datetime(2026, 1, 1, 3, tzinfo=UTC) for i in np.flatnonzero(mask))
    assert all(
        datetime(2026, 1, 1, tzinfo=UTC)
        <= first["target_times"][i]
        < datetime(2026, 1, 3, tzinfo=UTC)
        for i in np.flatnonzero(mask)
    )


def test_delay_manifest_hash_identity_features_and_frozen_scenario(tmp_path):
    import json

    from breathewise.ml.availability_experiment import (
        MODEL_VERSION,
        PARAMETERS,
        SCENARIO,
        SPLIT_RULE,
        UTC_BACKTESTS,
        UTC_SPLITS,
        load_manifest,
    )
    from breathewise.ml.experiment import sha256

    protocol = {
        "splits": {k: list(v) for k, v in UTC_SPLITS.items()},
        "availability_scenario": SCENARIO,
        "parameters": PARAMETERS,
        "issue_time_split_rule": SPLIT_RULE,
    }
    (tmp_path / "protocol.json").write_text(json.dumps(protocol))
    artifact = tmp_path / "native.txt"
    artifact.write_text("synthetic hash guard, not a loadable environmental model")
    predictions = tmp_path / "heldout.csv"
    predictions.write_text("synthetic header only")
    metric = {"count": 1, "mae": 1.0, "rmse": 1.0, "bias": -1.0}
    methods = {name: metric for name in ["lightgbm", "persistence", "previous_two_day_same_hour"]}
    group = {
        k: methods
        for k in [
            "all_available",
            "common_baseline_cohort",
            "high_pollution_observed_target_ge_150",
        ]
    }
    m = {
        "model_version": MODEL_VERSION,
        "supported_horizons": list(range(1, 25)),
        "dataset_mode": "utc_availability_scenario",
        "target_transform": "identity",
        "availability_scenario": SCENARIO,
        "timezone": "UTC",
        "source_station_ids": ["openaq-235"],
        "sensor_ids": [12235610],
        "target_unit": "µg/m³",
        "live_forecast_ready": False,
        "protocol": protocol,
        "protocol_sha256": sha256(tmp_path / "protocol.json"),
        "models": {
            str(h): {
                "path": artifact.name,
                "sha256": sha256(artifact),
                "feature_names": [x["name"] for x in feature_definitions(h)],
                "features": feature_definitions(h),
            }
            for h in range(1, 25)
        },
        "heldout_predictions": {"path": predictions.name, "sha256": sha256(predictions)},
        "evaluation": {str(h): {"test": group, "validation": group} for h in range(1, 25)},
        "rolling_backtests": {
            fold["name"]: {str(h): group for h in range(1, 25)} for fold in UTC_BACKTESTS
        },
    }
    manifest = tmp_path / "manifest.json"
    manifest.write_text(json.dumps(m))
    assert load_manifest(tmp_path)["model_version"] == MODEL_VERSION
    m["models"]["1"]["feature_names"][0] = "fabricated_compatibility"
    manifest.write_text(json.dumps(m))
    with pytest.raises(ValueError, match="feature order"):
        load_manifest(tmp_path)
    m["models"]["1"]["feature_names"][0] = feature_definitions(1)[0]["name"]
    manifest.write_text(json.dumps(m))
    artifact.write_text(artifact.read_text() + "changed")
    with pytest.raises(ValueError, match="SHA256"):
        load_manifest(tmp_path)
