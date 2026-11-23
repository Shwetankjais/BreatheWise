"""Provider fixtures are synthetic; no live OpenAQ success is asserted here."""

from datetime import UTC, datetime, timedelta

import httpx
import pytest
from breathewise.adapters.openaq import OpenAQ, ProviderError
from breathewise.db.models import IngestionRun
from breathewise.db.session import engine
from breathewise.jobs.cycle import run_cycle
from breathewise.jobs.locking import WorkerBusy, cycle_lock
from breathewise.schemas.ingestion import ImportBatch
from breathewise.services.feature_bridge import observation_candidates
from breathewise.services.imports import retain_first_seen
from breathewise.services.ingestion import import_batch
from sqlalchemy import select
from sqlalchemy.orm import Session


def mock_provider(status=200, *, unit="ug/m3", value=42, mobile=False):
    def handle(request):
        assert request.headers["X-API-Key"] == "test-key-not-real"
        assert "test-key-not-real" not in str(request.url)
        if status != 200:
            return httpx.Response(status, json={"secret_in_error": "test-key-not-real"})
        if "/locations/" in request.url.path:
            return httpx.Response(
                200,
                json={
                    "results": [
                        {
                            "id": 235,
                            "name": "Synthetic provider fixture, not an actual station verification",
                            "country": {"code": "IN"},
                            "locality": "Delhi",
                            "timezone": "Asia/Kolkata",
                            "isMonitor": True,
                            "isMobile": mobile,
                            "coordinates": {"latitude": 28.6, "longitude": 77.2},
                            "provider": {"name": "synthetic fixture"},
                            "licenses": [{"name": "test fixture only"}],
                            "sensors": [{"id": 99, "parameter": {"name": "pm25", "units": unit}}],
                        }
                    ]
                },
            )
        return httpx.Response(
            200,
            json={
                "results": [
                    {
                        "value": value,
                        "flagInfo": {"hasFlags": False},
                        "parameter": {"name": "pm25", "units": unit},
                        "period": {
                            "datetimeFrom": {"utc": "2026-11-19T23:30:00Z"},
                            "datetimeTo": {"utc": "2026-11-20T00:30:00Z"},
                        },
                        "coverage": {"percentCoverage": 80},
                    }
                ]
            },
        )

    return httpx.Client(transport=httpx.MockTransport(handle))


def fetch(adapter):
    return adapter.fetch_hourly(
        location_id=235,
        start=datetime(2026, 11, 19, tzinfo=UTC),
        end=datetime(2026, 11, 20, 2, tzinfo=UTC),
        mode="live",
        received_at=datetime(2026, 11, 20, 3, tzinfo=UTC),
    )


def test_openaq_preserves_half_hour_units_and_first_seen():
    with mock_provider() as client:
        adapter = OpenAQ("test-key-not-real", client)
        batch, details = fetch(adapter)
    row = batch.observations[0]
    assert row.measured_at.minute == 30
    assert row.available_at == datetime(2026, 11, 20, 3, tzinfo=UTC)
    assert row.unit == "ug/m3" and row.value == 42
    assert "provider_partial_hour" in row.quality_flags
    assert details["actual_provider_fetch"] is True  # Mock transport only in this test.
    assert len(adapter.raw_responses) == 2


@pytest.mark.parametrize(
    "status,code,retryable",
    [
        (401, "OPENAQ_AUTH_FAILED", False),
        (429, "OPENAQ_RATE_LIMITED", True),
        (503, "OPENAQ_TEMPORARY_FAILURE", True),
    ],
)
def test_openaq_errors_are_sanitized(status, code, retryable):
    with mock_provider(status) as client, pytest.raises(ProviderError) as caught:
        fetch(OpenAQ("test-key-not-real", client))
    assert caught.value.code == code
    assert caught.value.retryable == retryable
    assert "test-key-not-real" not in str(caught.value)


def test_openaq_requires_key_and_refuses_units_or_mobile_station():
    with mock_provider() as client, pytest.raises(ProviderError, match="KEY_MISSING"):
        OpenAQ("", client)
    with (
        mock_provider(unit="ppm") as client,
        pytest.raises(ProviderError, match="UNITS_UNSUPPORTED"),
    ):
        fetch(OpenAQ("test-key-not-real", client))
    with mock_provider(mobile=True) as client, pytest.raises(ProviderError, match="INELIGIBLE"):
        fetch(OpenAQ("test-key-not-real", client))


@pytest.mark.integration
def test_half_hour_import_history_and_no_mixed_phase(backend):
    client, _, _, base = backend
    payload = base.model_dump(mode="json")
    payload["stations"] = payload["stations"][:1]
    payload["stations"][0]["id"] = "half-hour"
    payload["observations"] = [payload["observations"][0]]
    row = payload["observations"][0]
    row.update(
        station_id="half-hour",
        measured_at="2026-11-20T00:30:00Z",
        available_at="2026-11-20T00:35:00Z",
    )
    batch = ImportBatch.model_validate(payload)
    with Session(engine()) as db, db.begin():
        assert import_batch(db, batch)["inserted"] == 1
    history = client.get(
        "/api/v1/history?station_id=half-hour&pollutant=co&start=2026-11-20T00:30:00Z&end=2026-11-20T02:30:00Z&issue_at=2026-11-20T04:00:00Z"
    )
    assert history.status_code == 200
    assert history.json()["data"]["valid_count"] == 1
    assert history.json()["data"]["points"][0]["measured_at"] == "2026-11-20T00:30:00Z"
    batch.observations[0].measured_at = datetime(2026, 11, 20, 1, tzinfo=UTC)
    batch.observations[0].available_at = datetime(2026, 11, 20, 2, tzinfo=UTC)
    with (
        pytest.raises(ValueError, match="Mixed hourly phases"),
        Session(engine()) as db,
        db.begin(),
    ):
        import_batch(db, batch)


@pytest.mark.integration
def test_candidate_lags_exclude_future_availability_and_never_fill(backend):
    with Session(engine()) as db:
        result = observation_candidates(db, "fixture", datetime(2026, 11, 20, 2, tzinfo=UTC))
        assert "pm25_lag_1h" not in result["candidate_features"]
        assert "pm25" not in result["candidate_features"]
        later = observation_candidates(db, "fixture", datetime(2026, 11, 20, 3, tzinfo=UTC))
        assert later["candidate_features"]["pm25_lag_3h"] == 0
        assert later["production_model_compatible"] is False


@pytest.mark.integration
def test_repeated_provider_fetch_keeps_original_first_seen(backend):
    *_, batch = backend
    copy = batch.model_copy(deep=True)
    for row in copy.observations:
        row.available_at += timedelta(hours=10)
    with Session(engine()) as db, db.begin():
        retain_first_seen(db, copy)
        assert [r.available_at for r in copy.observations] == [
            r.available_at for r in batch.observations
        ]
        assert import_batch(db, copy)["inserted"] == 0


@pytest.mark.integration
def test_worker_retries_sanitizes_persists_and_releases_overlap(backend):
    *_, batch = backend
    attempts = []
    events = []
    sleeps = []

    def fetch_batch():
        attempts.append(1)
        if len(attempts) == 1:
            raise ProviderError("OPENAQ_TEMPORARY_FAILURE", retryable=True)
        return batch, {"actual_provider_fetch": False}, []

    result = run_cycle(
        engine(), fetch_batch, provider="canonical", sleep=sleeps.append, emit=events.append
    )
    assert result["status"] == "success" and sleeps == [2]
    with Session(engine()) as db:
        assert sorted(db.scalars(select(IngestionRun.status)).all()) == ["failed", "success"]
    with cycle_lock(engine()), pytest.raises(WorkerBusy):
        run_cycle(engine())
    assert run_cycle(engine())["status"] == "success"


@pytest.mark.integration
def test_worker_does_not_retry_rate_limit_or_report_success(backend):
    events = []
    sleeps = []

    def limited():
        raise ProviderError("OPENAQ_RATE_LIMITED", retryable=True)

    result = run_cycle(
        engine(), limited, provider="openaq", sleep=sleeps.append, emit=events.append
    )
    assert result["status"] == "partial" and result["ingestion"] is None
    assert sleeps == []
    assert events[0]["code"] == "OPENAQ_RATE_LIMITED"
    assert "alerts_created" in events[-1]


@pytest.mark.integration
def test_readiness_requires_recent_success_not_key_or_future_timestamp(backend, monkeypatch):
    from breathewise.core.config import get_settings

    client, *_ = backend
    monkeypatch.setenv("OPENAQ_API_KEY", "test-only-placeholder")
    get_settings.cache_clear()
    assert client.get("/api/v1/ready").json()["data"]["providers"] is False
    now = datetime.now(UTC)
    with Session(engine()) as db, db.begin():
        db.add(
            IngestionRun(
                id="readiness-fixture",
                provider="openaq",
                data_mode="demo",
                status="success",
                started_at=now,
                finished_at=now,
                details={"actual_provider_fetch": True},
            )
        )
    response = client.get("/api/v1/ready")
    assert response.status_code == 503  # Model still unavailable.
    assert response.json()["data"]["providers"] is True
    for finished in [now - timedelta(minutes=20), now + timedelta(minutes=20)]:
        with Session(engine()) as db, db.begin():
            db.get(IngestionRun, "readiness-fixture").finished_at = finished
        assert client.get("/api/v1/ready").json()["data"]["providers"] is False
