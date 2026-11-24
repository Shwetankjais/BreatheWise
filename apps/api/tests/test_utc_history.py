"""Focused UTC history normalization tests; no provider network or real key needed."""

import importlib.util
from copy import deepcopy
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[3] / "scripts/fetch_utc_history.py"
SPEC = importlib.util.spec_from_file_location("utc_history", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
START = datetime(2025, 1, 1, tzinfo=UTC)
END = START + timedelta(days=1)


def row():
    return {
        "value": 0,
        "flagInfo": {"hasFlags": False},
        "parameter": {"name": "pm25", "units": "µg/m³"},
        "coverage": {"percentCoverage": 100},
        "period": {
            "datetimeFrom": {"utc": "2025-01-01T00:30:00Z", "local": "2025-01-01T06:00:00+05:30"},
            "datetimeTo": {"utc": "2025-01-01T01:30:00Z", "local": "2025-01-01T07:00:00+05:30"},
        },
    }


def normalize(item):
    return MODULE.normalize_hour(item, "2026-11-24T06:00:00+00:00", START, END)


def test_exact_phase_zero_units_and_unknown_historic_publication():
    accepted, reason = normalize(row())
    assert reason is None
    assert accepted["value"] == 0
    assert accepted["measured_at_utc"] == "2025-01-01T01:30:00+00:00"
    assert accepted["historical_publication_at"] == ""
    assert accepted["first_seen_at_utc"].startswith("2026-11-24")
    assert accepted["training_eligible"] == 1


def test_partial_coverage_is_retained_but_not_training_eligible():
    item = row()
    item["coverage"]["percentCoverage"] = 75
    accepted, reason = normalize(item)
    assert reason is None and accepted["training_eligible"] == 0
    assert "partial_hour" in accepted["quality_flags"]
    item["coverage"] = None
    assert normalize(item)[0]["training_eligible"] == 0


@pytest.mark.parametrize("field,value", [("value", -1), ("value", float("nan")), ("flagInfo", {})])
def test_missing_invalid_or_unknown_quality_not_zero_filled(field, value):
    item = row()
    item[field] = value
    assert normalize(item)[0] is None


def test_inconsistent_local_pair_and_unrecognized_units_fail():
    item = row()
    item["period"]["datetimeTo"]["local"] = "2025-01-01T01:30:00+05:30"
    with pytest.raises(ValueError, match="UTC/local"):
        normalize(item)
    item = row()
    item["parameter"]["units"] = "ppm"
    with pytest.raises(ValueError, match="units"):
        normalize(item)


def test_half_open_selection_and_bounded_windows():
    item = deepcopy(row())
    stamp = datetime(2025, 1, 1, 1, 30, tzinfo=UTC)
    assert MODULE.normalize_hour(item, "now", START, stamp)[0] is None
    chunks = list(MODULE.windows(START, START + timedelta(days=60)))
    assert len(chunks) == 3
    assert all(end - start <= timedelta(days=28) for start, end in chunks)
    assert chunks[0][1] == chunks[1][0]
    with pytest.raises(ValueError):
        list(MODULE.windows(START, START + timedelta(days=732)))


def test_local_offset_matches_station_timezone_and_future_rows_rejected():
    item = row()
    item["period"]["datetimeTo"]["local"] = "2025-01-01T01:30:00+00:00"
    with pytest.raises(ValueError, match="UTC/local"):
        normalize(item)
    accepted, reason = MODULE.normalize_hour(row(), "2025-01-01T01:00:00Z", START, END)
    assert accepted is None and reason == "measurement_after_actual_fetch"
