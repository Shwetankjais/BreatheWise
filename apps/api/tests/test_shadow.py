"""Synthetic shadow mechanics, not observed forecasting-performance evidence."""

from datetime import UTC, datetime, timedelta

import pytest
from breathewise.db.models import ForecastRun, Observation
from breathewise.db.session import engine
from breathewise.jobs.locking import WorkerBusy, cycle_lock
from breathewise.services.shadow import BASELINE_VERSION, reconcile_shadow, run_shadow
from sqlalchemy import func, select
from sqlalchemy.orm import Session

pytestmark = pytest.mark.integration
ISSUE = datetime(2026, 11, 20, 1, tzinfo=UTC)


def generate(**kwargs):
    return run_shadow(
        engine(),
        "fixture",
        BASELINE_VERSION,
        kwargs.pop("issue_at", ISSUE),
        kwargs.pop("input_cutoff", ISSUE),
        now=kwargs.pop("now", ISSUE + timedelta(minutes=5)),
        **kwargs,
    )


def test_shadow_actual_cutoff_persistence_idempotence_and_readonly_api(backend):
    client, *_ = backend
    run_id, created = generate()
    assert created
    assert generate() == (run_id, False)
    detail = client.get("/api/v1/forecast-runs/" + run_id).json()["data"]
    assert detail["run"]["status"] == "succeeded"
    assert detail["run"]["prediction_count"] == 24
    assert detail["run"]["matched_count"] == 0
    assert not detail["run"]["public_live_forecast_ready"]
    assert not detail["run"]["activity_planning_ready"]
    assert detail["run"]["provenance"]["input"]["value"] == 0
    # 01:00 reading (200) arrived at 03:00: never used at 01:00 issue.
    assert {x["concentration"] for x in detail["predictions"]} == {0}
    assert detail["predictions"][0]["target_at"] == "2026-11-20T02:00:00Z"
    assert detail["predictions"][0]["lead_time_seconds"] == 3300
    assert all(x["observed"] is None for x in detail["predictions"])
    page = client.get("/api/v1/forecast-runs?station_id=fixture&limit=1").json()["data"]
    assert page["total_count"] == 1 and len(page["runs"]) == 1
    assert client.get("/api/v1/forecast-runs?limit=101").status_code == 422
    assert client.get("/api/v1/forecast-runs/nonexistent").status_code == 404
    assert client.post("/api/v1/forecast-runs", json={}).status_code == 405
    assert client.get("/api/v1/ready").json()["data"]["database"] is True
    assert (
        client.get("/api/v1/capabilities").json()["data"]["shadow_forecast_runs"]["supported"]
        is True
    )
    with Session(engine()) as db:
        assert db.scalar(select(func.count(ForecastRun.id))) == 1


@pytest.mark.parametrize(
    ("issue", "cutoff", "now", "code"),
    [
        (ISSUE, ISSUE + timedelta(minutes=1), ISSUE + timedelta(minutes=5), "INVALID_INPUT_CUTOFF"),
        (ISSUE, ISSUE, ISSUE + timedelta(minutes=16), "SCHEDULED_ISSUE_EXPIRED"),
        (
            ISSUE,
            ISSUE - timedelta(hours=1),
            ISSUE + timedelta(minutes=5),
            "SHADOW_INPUTS_UNAVAILABLE",
        ),
        (
            ISSUE + timedelta(hours=3),
            ISSUE + timedelta(hours=3),
            ISSUE + timedelta(hours=3, minutes=5),
            "SHADOW_INPUT_STALE",
        ),
        (
            ISSUE + timedelta(minutes=30),
            ISSUE + timedelta(minutes=30),
            ISSUE + timedelta(minutes=35),
            "SHADOW_INTERVAL_PHASE_MISMATCH",
        ),
    ],
)
def test_shadow_rejections_are_visible_without_predictions(backend, issue, cutoff, now, code):
    client, *_ = backend
    run_id, _ = generate(issue_at=issue, input_cutoff=cutoff, now=now)
    d = client.get("/api/v1/forecast-runs/" + run_id).json()["data"]
    assert d["run"]["status"] == "rejected" and d["run"]["error_code"] == code
    assert d["predictions"] == []


def test_recorded_models_cannot_enter_shadow_operation(backend):
    client, *_ = backend
    for version in ["delhi-recorded-pm25-v1", "delhi-recorded-pm25-hourly-v2"]:
        run_id, _ = run_shadow(
            engine(), "fixture", version, ISSUE, ISSUE, now=ISSUE + timedelta(minutes=5)
        )
        d = client.get("/api/v1/forecast-runs/" + run_id).json()["data"]
        assert d["run"]["error_code"] == "MODEL_CLOCK_INCOMPATIBLE" and not d["predictions"]


def test_shadow_partial_hour_is_rejected(backend):
    client, *_ = backend
    with Session(engine()) as db, db.begin():
        row = db.scalar(
            select(Observation).where(Observation.pollutant == "pm25", Observation.value == 0)
        )
        row.quality_flags = ["provider_partial_hour"]
    run_id, _ = generate()
    assert (
        client.get("/api/v1/forecast-runs/" + run_id).json()["data"]["run"]["error_code"]
        == "SHADOW_INPUT_INCOMPLETE"
    )


def test_shadow_outcomes_wait_for_actual_receipt_and_match_exact_hour(backend):
    client, *_ = backend
    run_id, _ = generate()
    with Session(engine()) as db, db.begin():
        db.add(
            Observation(
                station_id="fixture",
                pollutant="pm25",
                measured_at=ISSUE + timedelta(hours=1),
                available_at=ISSUE + timedelta(hours=1, minutes=10),
                value=20,
                unit="µg/m³",
                original_value=20,
                original_unit="ug/m3",
                source="synthetic future outcome",
                quality_flags=[],
            )
        )
    assert reconcile_shadow(engine(), now=ISSUE + timedelta(hours=1, minutes=9)) == 0
    assert reconcile_shadow(engine(), now=ISSUE + timedelta(hours=1, minutes=11)) == 1
    assert reconcile_shadow(engine(), now=ISSUE + timedelta(hours=1, minutes=12)) == 0
    d = client.get("/api/v1/forecast-runs/" + run_id).json()["data"]
    assert d["run"]["matched_count"] == 1
    assert d["predictions"][0]["observed"] == 20 and d["predictions"][0]["error"] == -20
    assert d["predictions"][1]["observed"] is None


def test_shadow_overlap_and_naive_clock_are_rejected(backend):
    with cycle_lock(engine(), "breathewise-shadow-forecasts"):
        with pytest.raises(WorkerBusy):
            generate()
    with pytest.raises(ValueError, match="timezone-aware"):
        generate(issue_at=ISSUE.replace(tzinfo=None))


def test_live_shadow_requires_fresh_verified_identity_and_source(backend, monkeypatch):
    from breathewise.core.config import get_settings
    from breathewise.db.models import Station
    from breathewise.services import shadow

    monkeypatch.setenv("DATA_MODE", "live")
    get_settings.cache_clear()
    with Session(engine()) as db, db.begin():
        db.add(
            Station(
                id="openaq-235",
                name="Synthetic live mechanics station",
                city_id="delhi",
                latitude=28.64,
                longitude=77.31,
                source="test identity",
                data_mode="live",
            )
        )
        db.flush()
        db.add(
            Observation(
                station_id="openaq-235",
                pollutant="pm25",
                measured_at=ISSUE - timedelta(hours=1),
                available_at=ISSUE - timedelta(minutes=10),
                value=23,
                unit="µg/m³",
                original_value=23,
                original_unit="ug/m3",
                source="OpenAQ / synthetic; https://api.openaq.org/v3/locations/235",
                quality_flags=[],
            )
        )
    monkeypatch.setattr(shadow, "load_cache", lambda: {})
    first, _ = run_shadow(
        engine(), "openaq-235", BASELINE_VERSION, ISSUE, ISSUE, now=ISSUE + timedelta(minutes=5)
    )
    with Session(engine()) as db:
        assert db.get(ForecastRun, first).error_code == "SHADOW_PROVIDER_IDENTITY_UNVERIFIED"
    meta = {
        "location_id": 235,
        "verified_at": (ISSUE - timedelta(hours=1)).isoformat(),
        "selected_sensors": {"pm25": 12235610},
    }
    monkeypatch.setattr(shadow, "load_cache", lambda: {"stations": [meta]})
    second, _ = run_shadow(
        engine(),
        "openaq-235",
        BASELINE_VERSION,
        ISSUE + timedelta(hours=1),
        ISSUE + timedelta(hours=1),
        now=ISSUE + timedelta(hours=1, minutes=5),
    )
    with Session(engine()) as db:
        assert db.get(ForecastRun, second).status == "succeeded"
        assert db.get(ForecastRun, second).provenance["provider_sensor_id"] == 12235610
    # A separate issue with unchanged known input remains within120m; reject pending revisions.
    meta["pending_revisions"] = [{"reason": "synthetic revised provider input"}]
    third, _ = run_shadow(
        engine(),
        "openaq-235",
        BASELINE_VERSION,
        ISSUE + timedelta(hours=1),
        ISSUE + timedelta(minutes=59),
        now=ISSUE + timedelta(hours=1, minutes=5),
    )
    with Session(engine()) as db:
        assert db.get(ForecastRun, third).error_code == "SHADOW_PROVIDER_REVISION_PENDING"

    # Location2350 is not location235; reject prefix-only URL lookalikes.
    meta.pop("pending_revisions")
    with Session(engine()) as db, db.begin():
        row = db.scalar(select(Observation).where(Observation.station_id == "openaq-235"))
        row.source = "OpenAQ / synthetic; https://api.openaq.org/v3/locations/2350"
    fourth, _ = run_shadow(
        engine(),
        "openaq-235",
        BASELINE_VERSION,
        ISSUE + timedelta(hours=1),
        ISSUE + timedelta(minutes=58),
        now=ISSUE + timedelta(hours=1, minutes=5),
    )
    with Session(engine()) as db:
        assert db.get(ForecastRun, fourth).error_code == "SHADOW_INPUT_SOURCE_MISMATCH"
