"""Synthetic archive cases exercise exact recorded clocks, never live observations."""

from datetime import datetime
from types import SimpleNamespace

import duckdb
import pytest
from breathewise.api.archive import router
from breathewise.core.errors import ServiceError, error_body
from breathewise.services import archive
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient


@pytest.fixture
def local_archive(tmp_path, monkeypatch):
    folder = tmp_path / "data/cleaned/pollutants"
    folder.mkdir(parents=True)
    c = duckdb.connect()
    c.execute("""CREATE TABLE fixture(timestamp TIMESTAMP,site_id VARCHAR,source_folder VARCHAR,
              source_label VARCHAR,source_file VARCHAR,analysis_eligible BOOLEAN,pm25 DOUBLE,co DOUBLE)""")
    rows = []
    for station, points in {
        "a": [(0, 0.0), (1, None), (2, -1.0), (4, 100.0)],
        "b": [(0, 10.0), (1, 30.0), (2, 40.0), (3, 60.0), (4, None)],
        "quarantined": [(0, 999.0)],
    }.items():
        for hour, value in points:
            rows.append(
                (
                    datetime(2026, 1, 1, hour),
                    station,
                    station,
                    station,
                    station + ".csv",
                    station != "quarantined",
                    value,
                    0.6,
                )
            )
    c.executemany("INSERT INTO fixture VALUES (?,?,?,?,?,?,?,?)", rows)
    path = folder / "fixture.parquet"
    c.execute("COPY fixture TO ? (FORMAT PARQUET)", [str(path)])
    c.close()
    monkeypatch.setattr(archive, "get_settings", lambda: SimpleNamespace(archive_root=tmp_path))
    archive.cached_catalogue.cache_clear()
    yield tmp_path
    archive.cached_catalogue.cache_clear()


def interval():
    return datetime(2026, 1, 1), datetime(2026, 1, 1, 5)


def test_catalogue_excludes_quarantine_and_preserves_units_missingness(local_archive):
    result = archive.catalogue()
    assert result.station_count == 2 and result.excluded_row_count == 1
    assert result.timezone is None and result.publication_time_known is False
    a = next(s for s in result.stations if s.station_id == "a")
    assert a.grid_rows == 4 and a.expected_count == 5 and a.absent_hour_count == 1
    pm25 = next(x for x in a.pollutants if x.pollutant == "pm25")
    assert (pm25.valid_count, pm25.missing_count, pm25.invalid_count) == (2, 3, 1)
    assert pm25.coverage_fraction == 0.4
    assert next(x for x in a.pollutants if x.pollutant == "co").unit == "mg/m³"
    assert result.dataset_fingerprint.startswith("stat-v1:")


def test_exploration_zeros_and_null_buckets_not_imputed(local_archive):
    start, end = interval()
    result = archive.explore("a", "pm25", start, end, min_count=3)
    assert result.valid_count == 2 and result.missing_count == 3
    assert (
        result.source_null_count == 1
        and result.invalid_count == 1
        and result.absent_hour_count == 1
    )
    assert result.distribution.minimum == 0 and result.distribution.maximum == 100
    assert result.distribution.mean == 50 and result.distribution.median == 50
    assert result.points[0].value is None and result.points[0].valid_count == 2
    result = archive.explore("a", "pm25", start, end, min_count=1)
    assert result.points[0].value == 50 and result.points[0].coverage_fraction == 0.4
    empty = archive.explore("a", "pm25", datetime(2026, 2, 1), datetime(2026, 2, 3))
    assert len(empty.points) == 2 and all(p.value is None for p in empty.points)
    assert empty.distribution.count == 0 and empty.distribution.mean is None


def test_monthly_partial_bounds_and_requested_sufficiency(local_archive):
    result = archive.explore("a", "co", *interval(), aggregation="monthly", min_coverage=0.9)
    assert result.unit == "mg/m³" and result.distribution.mean == pytest.approx(0.6)
    assert result.expected_count == 5 and result.points[0].expected_count == 5
    assert (
        result.points[0].value is None
    )  # Missing hour remains missing; no scaling to a full month.
    assert result.points[0].period_end == datetime(2026, 1, 1, 5)


def test_matched_time_comparison_requires_clock_assumption(local_archive):
    with pytest.raises(ServiceError) as error:
        archive.compare(["a", "b"], "pm25", *interval())
    assert error.value.detail.code == "ARCHIVE_CLOCK_INCOMPATIBLE"
    result = archive.compare(
        ["a", "b"], "pm25", *interval(), clock_assumption="same_recorded_clock"
    )
    assert result.matched_hour_count == 1 and result.unmatched_or_missing_hour_count == 4
    assert result.points[0].means == {"a": 0.0, "b": 10.0}
    assert result.pair_agreement[0].mean_absolute_difference == 10
    assert result.pair_agreement[0].count == 1 and result.forecast_evaluation is False
    assert result.alignment_status == "conditional_same_recorded_clock_only"


def test_range_and_quarantined_identity_validation(local_archive):
    for start, end in [
        (datetime(2026, 1, 1), datetime(2028, 1, 1)),
        (datetime(2026, 1, 1, 0, 30), datetime(2026, 1, 2)),
    ]:
        with pytest.raises(ServiceError):
            archive.explore("a", "pm25", start, end)
    for ids in [["a", "a"], ["a", "quarantined"]]:
        with pytest.raises(ServiceError):
            archive.compare(ids, "pm25", *interval(), clock_assumption="same_recorded_clock")
    with pytest.raises(ServiceError) as error:
        archive.explore("' UNION SELECT * --", "pm25", *interval())
    assert error.value.status == 404


def client():
    app = FastAPI()

    @app.middleware("http")
    async def identity(request, call_next):
        request.state.request_id = "synthetic-archive-test"
        return await call_next(request)

    @app.exception_handler(ServiceError)
    async def service_error(request: Request, error: ServiceError):
        return JSONResponse(status_code=error.status, content=error_body(request, error.detail))

    app.include_router(router, prefix="/api/v1")
    return TestClient(app)


def test_api_rejects_aware_clock_and_returns_explicit_recorded_mode(local_archive):
    with client() as http:
        base = {
            "station_id": "a",
            "pollutant": "pm25",
            "start": "2026-01-01T00:00:00",
            "end": "2026-01-01T05:00:00",
        }
        response = http.get("/api/v1/archive/explore", params=base)
        assert response.status_code == 200
        body = response.json()
        assert body["data"]["dataset_mode"] == "recorded_clock" and body["data"]["timezone"] is None
        assert body["data"]["start"] == "2026-01-01T00:00:00"
        assert "recorded_clock_timezone_unverified" in body["meta"]["quality_flags"]
        assert (
            http.get(
                "/api/v1/archive/explore", params=base | {"start": "2026-01-01T00:00:00Z"}
            ).status_code
            == 422
        )
        assert (
            http.get("/api/v1/archive/explore", params=base | {"aggregation": "hourly"}).status_code
            == 422
        )
        assert (
            http.get(
                "/api/v1/archive/compare",
                params=[
                    ("station_ids", "a"),
                    ("station_ids", "b"),
                    ("pollutant", "pm25"),
                    ("start", base["start"]),
                    ("end", base["end"]),
                ],
            ).status_code
            == 422
        )


def test_duplicate_hours_fail_instead_of_changing_weights(local_archive):
    path = local_archive / "data/cleaned/pollutants/fixture.parquet"
    c = duckdb.connect()
    c.execute(
        "CREATE TABLE duplicated AS SELECT * FROM read_parquet(?) UNION ALL SELECT * FROM read_parquet(?) WHERE site_id='a' AND timestamp='2026-01-01'",
        [str(path), str(path)],
    )
    c.execute("COPY duplicated TO ? (FORMAT PARQUET)", [str(path)])
    c.close()
    with pytest.raises(ServiceError) as error:
        archive.catalogue()
    assert error.value.detail.code == "ARCHIVE_DUPLICATE_HOURS"
