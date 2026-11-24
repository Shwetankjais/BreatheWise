"""Synthetic provider/database tests; actual cohort evidence is separate."""

from datetime import UTC, datetime, timedelta

import httpx
import pytest
from breathewise.adapters.openaq import OpenAQ, ProviderError
from breathewise.api.catalogue import router
from breathewise.core.config import get_settings
from breathewise.db.models import Station
from breathewise.db.session import engine
from breathewise.schemas.common import Pollutant
from breathewise.services.catalogue import incremental_start, observed_rankings, station_catalogue
from sqlalchemy.orm import Session


@pytest.mark.integration
def test_catalogue_retains_unknown_coverage_and_cutoff_leakage(backend):
    with Session(engine()) as db:
        cutoff = datetime(2026, 11, 20, 2, tzinfo=UTC)
        result = station_catalogue(db, "delhi", cutoff)
        assert len(result.stations) == 1
        pm = next(x for x in result.stations[0].pollutants if x.pollutant == "pm25")
        assert pm.measurement.value == 0
        assert pm.status == "coverage_unknown"
        assert pm.freshness == "fresh"
        assert pm.coverage_state == "unknown"
        absent = next(x for x in result.stations[0].pollutants if x.pollutant == "o3")
        assert absent.status == "no_observations"
        assert absent.measurement is None
        later = station_catalogue(db, "delhi", cutoff + timedelta(hours=2))
        pm = next(x for x in later.stations[0].pollutants if x.pollutant == "pm25")
        assert pm.measurement.value == 200
        assert pm.status == "stale" and pm.coverage_state == "unknown"


@pytest.mark.integration
def test_observed_rankings_filter_staleness_explicitly_and_keep_zero(backend):
    with Session(engine()) as db:
        cutoff = datetime(2026, 11, 20, 2, tzinfo=UTC)
        result = observed_rankings(db, "delhi", Pollutant.pm25, cutoff, 20, True)
        assert result.ranking_kind == "observed_concentration"
        assert result.rows[0].measurement.value == 0
        result = observed_rankings(
            db, "delhi", Pollutant.pm25, cutoff + timedelta(hours=4), 20, False
        )
        assert result.rows == [] and result.excluded_stale_count == 1
        missing = observed_rankings(db, "delhi", Pollutant.o3, cutoff, 20, True)
        assert missing.rows == [] and missing.excluded_missing_count == 1


@pytest.mark.integration
def test_incremental_refresh_is_bounded_and_overlaps_only_known_history(backend):
    end = datetime(2026, 11, 20, 6, tzinfo=UTC)
    with Session(engine()) as db:
        assert incremental_start(db, "fixture", "pm25", end) == datetime(
            2026, 11, 19, 23, tzinfo=UTC
        )
        assert incremental_start(db, "unimported", "pm25", end) == end - timedelta(hours=72)
        assert incremental_start(
            db, "fixture", "pm25", end + timedelta(days=20)
        ) == end + timedelta(days=17)
        with pytest.raises(ValueError):
            incremental_start(db, "fixture", "pm25", end, initial_hours=999)


@pytest.mark.integration
def test_verified_sensor_missingness_is_separate_from_observed_data(backend, monkeypatch):
    from breathewise.services import catalogue

    monkeypatch.setenv("DATA_MODE", "live")
    get_settings.cache_clear()
    monkeypatch.setattr(
        catalogue,
        "load_cache",
        lambda: {
            "verified_at": "2026-11-20T01:00:00Z",
            "stations": [
                {
                    "location_id": 235,
                    "sensors": {"pm25": [{"id": 42}]},
                    "selected_sensors": {"pm25": 42},
                    "verified_at": "2026-11-20T01:00:00Z",
                }
            ],
        },
    )
    with Session(engine()) as db, db.begin():
        db.add(
            Station(
                id="openaq-235",
                name="Synthetic registry",
                city_id="delhi",
                latitude=28.6,
                longitude=77.2,
                source="synthetic",
                data_mode="live",
            )
        )
    with Session(engine()) as db:
        result = station_catalogue(db, "delhi", datetime(2026, 11, 20, 2, tzinfo=UTC))
        station = result.stations[0]
        assert station.provider_location_id == 235
        pm = next(x for x in station.pollutants if x.pollutant == "pm25")
        assert pm.sensor_id == 42 and pm.status == "no_observations"
        no2 = next(x for x in station.pollutants if x.pollutant == "no2")
        assert no2.status == "sensor_unavailable" and no2.measurement is None


@pytest.mark.integration
def test_catalogue_routes_are_typed_bounded_and_do_not_fetch_provider(backend):
    client = backend[0]
    # Parent registration may already exist during parallel integration.
    if "/api/v1/station-catalogue" not in client.app.openapi()["paths"]:
        client.app.include_router(router, prefix="/api/v1")
    response = client.get("/api/v1/station-catalogue?city_id=delhi")
    assert response.status_code == 200
    assert len(response.json()["data"]["stations"][0]["pollutants"]) == 6
    response = client.get("/api/v1/observed-rankings?city_id=delhi&pollutant=pm25")
    assert response.status_code == 200
    assert response.json()["data"]["ranking_kind"] == "observed_concentration"
    assert client.get("/api/v1/observed-rankings?limit=1000").status_code == 422
    assert client.get("/api/v1/station-catalogue?city_id=unknown").status_code == 404


@pytest.mark.parametrize("coverage", [{}, {"percentCoverage": -1}, {"percentCoverage": 101}])
def test_parameter_selection_and_unknown_coverage_are_explicit(coverage):
    def provider(request):
        if "/locations/" in request.url.path:
            return httpx.Response(
                200,
                json={
                    "results": [
                        {
                            "id": 1,
                            "name": "Fixture",
                            "country": {"code": "IN"},
                            "locality": "Delhi",
                            "isMonitor": True,
                            "isMobile": False,
                            "timezone": "Asia/Kolkata",
                            "provider": {"name": "fixture"},
                            "coordinates": {"latitude": 28.6, "longitude": 77.2},
                            "sensors": [{"id": 10, "parameter": {"name": "no2"}}],
                        }
                    ]
                },
            )
        return httpx.Response(
            200,
            json={
                "results": [
                    {
                        "value": 30,
                        "flagInfo": {"hasFlags": False},
                        "parameter": {"name": "no2", "units": "µg/m³"},
                        "period": {
                            "datetimeFrom": {"utc": "2026-11-20T00:00:00Z"},
                            "datetimeTo": {"utc": "2026-11-20T01:00:00Z"},
                        },
                        "coverage": coverage,
                    }
                ]
            },
        )

    with httpx.Client(transport=httpx.MockTransport(provider)) as client:
        adapter = OpenAQ("synthetic-key", client)
        batch, details = adapter.fetch_hourly(
            location_id=1,
            sensor_id=10,
            pollutant="no2",
            start=datetime(2026, 11, 20, tzinfo=UTC),
            end=datetime(2026, 11, 20, 2, tzinfo=UTC),
            received_at=datetime(2026, 11, 20, 3, tzinfo=UTC),
            mode="live",
        )
        assert batch.observations[0].pollutant == "no2"
        assert "provider_coverage_unknown" in batch.observations[0].quality_flags
        assert details["pollutant"] == "no2"
        with pytest.raises(ProviderError, match="POLLUTANT_UNSUPPORTED"):
            adapter.fetch_hourly(
                location_id=1,
                pollutant="nox",
                start=datetime.now(UTC),
                end=datetime.now(UTC),
                mode="live",
            )


@pytest.mark.integration
def test_provider_revisions_are_quarantined_not_overwritten_or_zeroed(backend):
    from breathewise.services.catalogue import quarantine_revisions
    from breathewise.services.imports import retain_first_seen
    from breathewise.services.ingestion import import_batch

    batch = backend[3].model_copy(deep=True)
    batch.observations[1].value = 9  # Existing observed zero must survive a provider revision.
    batch.observations.append(
        batch.observations[-1].model_copy(
            update={
                "measured_at": datetime(2026, 11, 20, 4, tzinfo=UTC),
                "available_at": datetime(2026, 11, 20, 5, tzinfo=UTC),
                "value": 300,
            }
        )
    )
    with Session(engine()) as db, db.begin():
        accepted, quarantined = quarantine_revisions(db, batch)
        assert len(quarantined) == 1
        assert quarantined[0]["stored_value_ugm3"] == 0
        assert quarantined[0]["incoming_value_ugm3"] == 9
        retain_first_seen(db, accepted)
        result = import_batch(db, accepted)
        assert result["inserted"] == 1
        original = station_catalogue(db, "delhi", datetime(2026, 11, 20, 2, tzinfo=UTC))
        assert (
            next(
                x for x in original.stations[0].pollutants if x.pollutant == "pm25"
            ).measurement.value
            == 0
        )


@pytest.mark.integration
def test_cached_only_station_and_pending_revision_are_visible(backend, monkeypatch):
    from breathewise.services import catalogue

    monkeypatch.setenv("DATA_MODE", "live")
    get_settings.cache_clear()
    monkeypatch.setattr(
        catalogue,
        "load_cache",
        lambda: {
            "verified_at": "2026-11-20T01:00:00Z",
            "stations": [
                {
                    "location_id": 235,
                    "name": "Synthetic verified metadata only",
                    "coordinates": {"latitude": 28.6, "longitude": 77.2},
                    "sensors": {"pm25": [{"id": 42}]},
                    "selected_sensors": {"pm25": 42},
                    "verified_at": "2026-11-20T01:00:00Z",
                    "last_refresh_status": "partial",
                    "pending_revisions": [
                        {
                            "pollutant": "pm25",
                            "measured_at": "2026-11-20T00:00:00Z",
                            "detected_at": "2026-11-20T01:10:00+00:00",
                        }
                    ],
                }
            ],
        },
    )
    with Session(engine()) as db:
        now = datetime(2026, 11, 20, 2, tzinfo=UTC)
        station = station_catalogue(db, "delhi", now).stations[0]
        assert station.provider_revision_pending
        assert station.last_refresh_status == "partial"
        pm = next(x for x in station.pollutants if x.pollutant == "pm25")
        assert pm.revision_pending_count == 1 and pm.status == "no_observations"
        assert pm.measurement is None
        earlier = station_catalogue(db, "delhi", datetime(2026, 11, 20, 1, tzinfo=UTC)).stations[0]
        assert not earlier.provider_revision_pending


@pytest.mark.integration
def test_failed_reverification_preserves_pending_journal_and_observations(backend, monkeypatch):
    from breathewise.services import catalogue

    previous = {
        "schema_version": "1.0",
        "verified_at": "2026-11-20T01:00:00+00:00",
        "stations": [
            {
                "location_id": 235,
                "name": "Synthetic prior verified station",
                "coordinates": {"latitude": 28.6, "longitude": 77.2},
                "verified_at": "2026-11-20T01:00:00+00:00",
                "sensors": {"pm25": [{"id": 42, "unit": "µg/m³"}]},
                "selected_sensors": {"pm25": 42},
                "pending_revisions": [
                    {
                        "pollutant": "pm25",
                        "measured_at": "2026-11-20T00:00:00Z",
                        "detected_at": "2026-11-20T01:10:00+00:00",
                    }
                ],
            }
        ],
    }
    failure = {
        "schema_version": "1.0",
        "verified_at": "2026-11-20T01:30:00+00:00",
        "stations": [],
        "rejected": [{"location_id": 235, "code": "OPENAQ_NETWORK_ERROR"}],
    }
    merged = catalogue.merge_verification(previous, failure)
    assert merged["verified_at"] == previous["verified_at"]
    cached = merged["stations"][0]
    assert cached["verified_at"] == previous["stations"][0]["verified_at"]
    assert cached["pending_revisions"] == previous["stations"][0]["pending_revisions"]
    assert cached["verification_status"] == "verification_failed"
    assert cached["verification_error_code"] == "OPENAQ_NETWORK_ERROR"
    assert cached["verification_attempted_at"] == failure["verified_at"]
    monkeypatch.setenv("DATA_MODE", "live")
    get_settings.cache_clear()
    monkeypatch.setattr(catalogue, "load_cache", lambda: merged)
    from breathewise.db.models import Observation

    with Session(engine()) as db, db.begin():
        db.add(
            Station(
                id="openaq-235",
                name="Synthetic prior verified station",
                city_id="delhi",
                latitude=28.6,
                longitude=77.2,
                source="synthetic",
                data_mode="live",
            )
        )
        db.flush()
        db.add(
            Observation(
                station_id="openaq-235",
                pollutant="pm25",
                measured_at=datetime(2026, 11, 20, tzinfo=UTC),
                available_at=datetime(2026, 11, 20, 0, 5, tzinfo=UTC),
                value=98,
                unit="µg/m³",
                original_value=98,
                original_unit="µg/m³",
                source="synthetic",
                quality_flags=[],
            )
        )
    with Session(engine()) as db:
        result = station_catalogue(db, "delhi", datetime(2026, 11, 20, 2, tzinfo=UTC)).stations[0]
        assert result.verification_status == "verification_failed"
        assert result.last_refresh_status == "verification_failed"
        pm = next(x for x in result.pollutants if x.pollutant == "pm25")
        assert pm.measurement.value == 98
        assert pm.provider_revision_pending and pm.revision_pending_count == 1
        assert "provider_verification_failed" in pm.measurement.quality_flags
        assert any("verification failed" in x for x in pm.limitations)


@pytest.mark.integration
@pytest.mark.parametrize(
    "failure_code",
    ["OPENAQ_NETWORK_ERROR", "OPENAQ_AUTH_FAILED", "OPENAQ_PARAMETER_OR_UNITS_UNSUPPORTED"],
)
def test_refresh_skips_ingestion_for_retained_rejected_sensor(
    backend, monkeypatch, tmp_path, failure_code
):
    import importlib.util
    import json
    import sys
    from types import SimpleNamespace

    from breathewise.core.config import ROOT
    from pydantic import SecretStr

    spec = importlib.util.spec_from_file_location(
        "cohort_refresh_failure_test", ROOT / "scripts/refresh_delhi.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    path = tmp_path / "catalogue.json"
    previous = {
        "schema_version": "1.0",
        "verified_at": "2026-11-20T01:00:00+00:00",
        "scope": "synthetic",
        "stations": [
            {
                "location_id": 235,
                "verified_at": "2026-11-20T01:00:00+00:00",
                "selected_sensors": {"pm25": 42},
                "pending_revisions": [
                    {
                        "pollutant": "pm25",
                        "measured_at": "2026-11-20T00:00:00Z",
                        "detected_at": "2026-11-20T01:10:00+00:00",
                    }
                ],
            }
        ],
        "rejected": [],
    }
    path.write_text(json.dumps(previous))
    monkeypatch.setattr(module, "cache_path", lambda: path)
    monkeypatch.setattr(module, "load_cache", lambda: json.loads(path.read_text()))
    monkeypatch.setattr(
        module,
        "get_settings",
        lambda: SimpleNamespace(data_mode="live", openaq_api_key=SecretStr("synthetic-key")),
    )
    monkeypatch.setattr(
        module,
        "verify_cohort",
        lambda client, key: {
            "schema_version": "1.0",
            "verified_at": "2026-11-20T01:30:00+00:00",
            "scope": "synthetic",
            "stations": [],
            "rejected": [{"location_id": 235, "code": failure_code}],
        },
    )

    def forbidden_ingestion(*args, **kwargs):
        pytest.fail("Rejected retained sensor must not be ingested with cached identity")

    monkeypatch.setattr(module, "run_cycle", forbidden_ingestion)
    monkeypatch.setattr(sys, "argv", ["refresh_delhi.py", "--verify"])
    assert module.main() == 1
    retained = json.loads(path.read_text())["stations"][0]
    assert retained["verification_status"] == "verification_failed"
    assert retained["verification_error_code"] == failure_code
    assert retained["verified_at"] == previous["stations"][0]["verified_at"]
    assert retained["pending_revisions"] == previous["stations"][0]["pending_revisions"]
