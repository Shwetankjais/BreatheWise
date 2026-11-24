"""Mechanics/causality checks use synthetic arrays, never environmental validation."""

import hashlib
import json
from datetime import UTC, datetime, timedelta

import numpy as np
import pytest
from breathewise.ml.experiment import (
    BACKTESTS,
    HORIZONS,
    MODEL_VERSION,
    SPLITS,
    checked_artifact,
    feature_definitions,
    load_manifest,
    make_frame,
    metrics,
    score_group,
    split_mask,
)


def complete_manifest(models, predictions):
    score = score_group(np.array([1.0]), np.array([1.0]), np.array([1.0]), np.array([1.0]))
    return {
        "model_version": MODEL_VERSION,
        "supported_horizons": list(HORIZONS),
        "dataset_mode": "recorded_clock",
        "live_forecast_ready": False,
        "retrospective_evaluation_ready": True,
        "source_station_ids": ["site_301"],
        "target_unit": "µg/m³",
        "target_transform": "identity",
        "dataset_sha256": "fixture",
        "protocol": {"splits": {key: list(value) for key, value in SPLITS.items()}},
        "models": models,
        "heldout_predictions": predictions,
        "evaluation": {str(h): {"test": score, "validation": score} for h in HORIZONS},
        "rolling_backtests": {
            fold["name"]: {str(h): score for h in HORIZONS} for fold in BACKTESTS
        },
        "preprocessing": "synthetic fixture only",
        "input_availability_assumption": "synthetic",
        "limitations": ["synthetic mechanics, not environmental validation"],
    }


def fixture_frame(horizon=3):
    times = [datetime(2024, 12, 29) + timedelta(hours=i) for i in range(150)]
    return times, np.arange(150, dtype=float), horizon


def test_future_source_changes_cannot_change_issue_features():
    times, values, horizon = fixture_frame()
    first = make_frame(times, values, horizon)
    changed = values.copy()
    changed[81:] = 900
    other = make_frame(times, changed, horizon)
    np.testing.assert_equal(first["x"][:81], other["x"][:81])
    assert first["y"][80] != other["y"][80]  # Target changes; causal feature tensor does not.


def test_exact_missing_lags_not_zero_and_rolling_minimum_observation_count():
    times, values, horizon = fixture_frame()
    values[10] = np.nan
    frame = make_frame(times, values, horizon)
    lag_index = frame["feature_names"].index("pm25_lag_1h")
    assert np.isnan(frame["x"][11, lag_index])
    assert frame["x"][11, lag_index + 1] == 1
    assert frame["x"][0, frame["feature_names"].index("pm25_trailing_6h_count")] == 1
    assert np.isnan(frame["x"][0, frame["feature_names"].index("pm25_trailing_6h_mean")])
    assert frame["x"][7, frame["feature_names"].index("pm25_trailing_6h_mean")] == pytest.approx(
        np.mean(values[2:8])
    )


def test_split_applies_to_observed_target_not_issue_time_and_drops_missing_targets():
    times, values, horizon = fixture_frame(24)
    values[90] = np.nan
    frame = make_frame(times, values, horizon)
    mask = split_mask(frame, "2025-01-01T00:00:00", "2025-01-02T00:00:00")
    assert any(mask)
    assert all(
        datetime(2025, 1, 1) <= t < datetime(2025, 1, 2)
        for t in np.array(frame["target_times"])[mask]
    )
    assert not mask[66]  # Missing target at90 cannot become a training/evaluation target.
    assert any(t < datetime(2025, 1, 1) for t in np.array(frame["issue_times"])[mask])


@pytest.mark.parametrize("horizon", HORIZONS)
def test_baselines_are_exact_and_issue_time_available(horizon):
    times, values, _ = fixture_frame()
    frame = make_frame(times, values, horizon)
    i = 80
    assert frame["persistence"][i] == values[i]
    assert frame["previous_day"][i] == values[i + horizon - 24]
    assert i + horizon - 24 <= i


def test_unsupported_horizons_and_non_hourly_or_aware_clocks_refused():
    times, values, _ = fixture_frame()
    with pytest.raises(ValueError, match="Unsupported"):
        feature_definitions(2)
    with pytest.raises(ValueError, match="timezone"):
        make_frame([t.replace(tzinfo=UTC) for t in times], values, 3)
    times[3] += timedelta(minutes=30)
    with pytest.raises(ValueError, match="hourly grid"):
        make_frame(times, values, 3)


def test_metrics_comparison_counts_explicit_and_high_pollution_not_fabricated():
    result = score_group(
        np.array([0.0, 200.0]),
        np.array([10.0, 180.0]),
        np.array([0.0, 150.0]),
        np.array([np.nan, 190.0]),
    )
    assert result["all_available"]["lightgbm"]["mae"] == 15
    assert result["common_baseline_cohort"]["lightgbm"]["count"] == 1
    assert result["common_baseline_cohort"]["previous_day_same_hour"]["mae"] == 10
    assert result["high_pollution_observed_target_ge_150"]["lightgbm"]["mae"] == 20
    assert metrics(np.array([np.nan]), np.array([3.0]))["mae"] is None


def test_artifact_loader_verifies_prediction_and_model_hash_and_path(tmp_path):
    def artifact(name):
        (tmp_path / name).write_text("synthetic bytes")
        return {"path": name, "sha256": hashlib.sha256(b"synthetic bytes").hexdigest()}

    manifest = complete_manifest(
        {
            str(h): {
                **artifact(f"model{h}.txt"),
                "feature_names": [x["name"] for x in feature_definitions(h)],
            }
            for h in HORIZONS
        },
        artifact("predictions.csv"),
    )
    (tmp_path / "manifest.json").write_text(json.dumps(manifest))
    assert load_manifest(tmp_path)["live_forecast_ready"] is False
    (tmp_path / "predictions.csv").write_text("tampered")
    with pytest.raises(ValueError, match="SHA256"):
        load_manifest(tmp_path)
    with pytest.raises(ValueError, match="path/SHA256"):
        checked_artifact(tmp_path, {"path": "../other.txt", "sha256": "0"})


def test_native_model_reload_checks_actual_feature_order_and_iteration(tmp_path):
    import ctypes
    import os

    library = os.environ.get("BREATHEWISE_OPENMP_LIBRARY")
    if library:
        ctypes.CDLL(library, mode=ctypes.RTLD_GLOBAL)
    import lightgbm as lgb
    from breathewise.ml.experiment import load_native_model, sha256

    times, values, _ = fixture_frame()
    frame = make_frame(times, values, 3)
    names = frame["feature_names"]
    dataset = lgb.Dataset(frame["x"][:-3], label=frame["y"][:-3], feature_name=names)
    booster = lgb.train(
        {"objective": "regression", "verbosity": -1, "num_threads": 1, "min_data_in_leaf": 5},
        dataset,
        num_boost_round=3,
    )
    path = tmp_path / "synthetic_native.txt"
    booster.save_model(str(path))
    descriptor = {
        "path": path.name,
        "sha256": sha256(path),
        "feature_names": names,
        "best_iteration": booster.num_trees(),
    }
    predictions = tmp_path / "synthetic_predictions.csv"
    predictions.write_text("synthetic mechanics fixture only\n")
    manifest = complete_manifest(
        {str(h): descriptor for h in HORIZONS},
        {"path": predictions.name, "sha256": sha256(predictions)},
    )
    (tmp_path / "manifest.json").write_text(json.dumps(manifest))
    reloaded = load_native_model(tmp_path, 3)
    np.testing.assert_allclose(
        reloaded.predict(frame["x"][:-3]), booster.predict(frame["x"][:-3]), rtol=0, atol=1e-10
    )
    with pytest.raises(ValueError, match="Unsupported"):
        load_native_model(tmp_path, 2)
    descriptor["best_iteration"] += 1
    (tmp_path / "manifest.json").write_text(json.dumps(manifest))
    with pytest.raises(ValueError, match="iteration count"):
        load_native_model(tmp_path, 3)


def test_incomplete_or_malformed_manifest_rejected_as_valueerror(tmp_path):
    for payload in [{"model_version": MODEL_VERSION}, [], None]:
        (tmp_path / "manifest.json").write_text(json.dumps(payload))
        with pytest.raises(ValueError, match="Incomplete"):
            load_manifest(tmp_path)
