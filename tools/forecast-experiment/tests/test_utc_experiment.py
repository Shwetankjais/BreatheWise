"""UTC research mechanics use synthetic arrays; never forecasting validation."""

import csv
import json
from datetime import UTC, datetime, timedelta

import numpy as np
import pytest
from breathewise.ml.experiment import HOURLY_HORIZONS, sha256
from breathewise.ml.utc_experiment import (
    UTC_MODEL_VERSION,
    load_utc_manifest,
    load_utc_observed,
    make_utc_frame,
    utc_features,
    utc_split_mask,
    utc_time,
)


def test_utc_clock_rejects_naive_and_wrong_grid_without_timezone_stripping():
    assert utc_time("2026-01-01T00:30:00Z").tzinfo is UTC
    with pytest.raises(ValueError, match="Explicit UTC"):
        utc_time("2026-01-01T00:30:00")
    times = [datetime(2026, 1, 1, 0, 30, tzinfo=UTC) + timedelta(hours=i) for i in range(50)]
    with pytest.raises(ValueError, match="explicit UTC"):
        make_utc_frame([t.replace(tzinfo=None) for t in times], np.arange(50.0), 1)
    with pytest.raises(ValueError, match="interval-end"):
        make_utc_frame([t.replace(minute=0) for t in times], np.arange(50.0), 1)
    for bad in (0, 25, 1.5, True):
        with pytest.raises(ValueError, match="Unsupported"):
            make_utc_frame(times, np.arange(50.0), bad)


@pytest.mark.parametrize("horizon", HOURLY_HORIZONS)
def test_utc_all_hourly_causality_baselines_missing_current_and_target_splits(horizon):
    times = [datetime(2025, 12, 29, 0, 30, tzinfo=UTC) + timedelta(hours=i) for i in range(150)]
    values = np.arange(150.0)
    values[80] = np.nan
    first = make_utc_frame(times, values, horizon)
    changed = values.copy()
    changed[90:] = 999
    second = make_utc_frame(times, changed, horizon)
    np.testing.assert_equal(first["x"][:90], second["x"][:90])
    np.testing.assert_equal(first["previous_day"][85], values[85 + horizon - 24])
    mask = utc_split_mask(first, "2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z")
    assert not mask[80]
    assert not mask[80 - horizon]
    assert all(
        datetime(2026, 1, 1, tzinfo=UTC) <= t < datetime(2026, 1, 2, tzinfo=UTC)
        for t in np.array(first["target_times"])[mask]
    )
    hour_index = first["feature_names"].index("target_hour_sin")
    expected = np.sin(2 * np.pi * (first["target_times"][0].hour + 0.5) / 24)
    assert first["x"][0, hour_index] == pytest.approx(expected)
    assert len(utc_features(horizon)) == 39


def test_utc_import_keeps_partial_coverage_missing_and_verifies_hash(tmp_path):
    source = tmp_path / "observations.csv"
    fields = [
        "station_id",
        "sensor_id",
        "unit",
        "interval_start_utc",
        "measured_at_utc",
        "value",
        "training_eligible",
        "percent_coverage",
    ]
    with source.open("w", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        for i in range(3):
            end = datetime(2026, 1, 1, 0, 30, tzinfo=UTC) + timedelta(hours=i)
            writer.writerow(
                {
                    "station_id": "openaq-235",
                    "sensor_id": 12235610,
                    "unit": "µg/m³",
                    "interval_start_utc": (end - timedelta(hours=1)).isoformat(),
                    "measured_at_utc": end.isoformat(),
                    "value": float(i),
                    "training_eligible": int(i != 1),
                    "percent_coverage": 100 if i != 1 else 75,
                }
            )
    m = {
        "station_id": "openaq-235",
        "sensor_id": 12235610,
        "unit": "µg/m³",
        "timezone": "UTC",
        "interval_semantics": "exclusive_hour_ending",
        "dataset_sha256": sha256(source),
    }
    (tmp_path / "manifest.json").write_text(json.dumps(m))
    _, times, values = load_utc_observed(source)
    assert values[0] == 0
    assert np.isnan(values[1])
    assert values[2] == 2
    assert times[0].tzinfo is UTC
    source.write_text(source.read_text() + "\n")
    with pytest.raises(ValueError, match="hash mismatch"):
        load_utc_observed(source)


def test_utc_manifest_does_not_accept_recorded_clock_or_live_state(tmp_path):
    (tmp_path / "manifest.json").write_text(
        json.dumps(
            {
                "model_version": UTC_MODEL_VERSION,
                "supported_horizons": list(HOURLY_HORIZONS),
                "dataset_mode": "recorded_clock",
                "timezone": None,
                "live_forecast_ready": False,
            }
        )
    )
    with pytest.raises(ValueError, match="semantics mismatch"):
        load_utc_manifest(tmp_path)
