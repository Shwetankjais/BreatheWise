"""Bounded read-only DuckDB exploration; naive clocks never become UTC observations."""

import hashlib
from contextlib import contextmanager
from datetime import timedelta
from functools import lru_cache
from itertools import combinations
from pathlib import Path

import duckdb
from breathewise.core.config import get_settings
from breathewise.core.errors import ServiceError
from breathewise.schemas.archive import (
    ArchiveBucket,
    ArchiveCatalogue,
    ArchiveCompare,
    ArchiveComparisonBucket,
    ArchiveDistribution,
    ArchiveExplore,
    ArchivePairAgreement,
    ArchivePollutantCoverage,
    ArchiveStation,
)
from breathewise.schemas.common import Pollutant

# Fixed identifiers only. No user string is interpolated into SQL.
COLUMNS = {name.value: name.value for name in Pollutant}
UNITS = {name: "µg/m³" for name in COLUMNS} | {"co": "mg/m³"}
REQUIRED = {
    "timestamp",
    "site_id",
    "source_folder",
    "source_label",
    "analysis_eligible",
    "source_file",
}


def inventory():
    root = Path(get_settings().archive_root)
    folder = root / "data/cleaned/pollutants"
    files = sorted(folder.glob("*.parquet"))
    if not files:
        raise ServiceError(
            503, "ARCHIVE_UNAVAILABLE", "Configured observed Parquet archive is unavailable"
        )
    signature = tuple((str(p.resolve()), p.stat().st_size, p.stat().st_mtime_ns) for p in files)
    return signature


def fingerprint(signature):
    # Identity/cache invalidation fingerprint, explicitly not a content checksum.
    value = "\n".join(f"{Path(p).name}|{size}|{mtime}" for p, size, mtime in signature)
    return "stat-v1:" + hashlib.sha256(value.encode()).hexdigest()


@contextmanager
def connection(signature):
    c = duckdb.connect()
    try:
        c.execute("SET threads=2")
        c.execute("SET memory_limit='512MB'")
        c.execute("SET temp_directory=''")
        c.read_parquet([p for p, _, _ in signature], union_by_name=True).create_view(
            "source_archive"
        )
        columns = set(c.sql("SELECT * FROM source_archive LIMIT 0").columns)
        if not REQUIRED <= columns:
            raise ServiceError(
                503, "ARCHIVE_SCHEMA_UNSUPPORTED", "Archive provenance columns are incomplete"
            )
        kind = c.sql("DESCRIBE source_archive").fetchall()
        time_kind = next(row[1] for row in kind if row[0] == "timestamp")
        if time_kind not in {"TIMESTAMP", "TIMESTAMP_NS", "TIMESTAMP_MS", "TIMESTAMP_S"}:
            raise ServiceError(
                503, "ARCHIVE_CLOCK_UNSUPPORTED", "Expected naive recorded timestamps"
            )
        expressions = [
            f'try_cast("{name}" AS DOUBLE) AS "{name}"'
            if name in columns
            else f'NULL::DOUBLE AS "{name}"'
            for name in COLUMNS
        ]
        c.execute(
            "CREATE VIEW eligible_archive AS SELECT timestamp,site_id,source_folder,source_label,source_file,"
            + ",".join(expressions)
            + " FROM source_archive WHERE analysis_eligible IS TRUE"
        )
        yield c
    except duckdb.Error:
        raise ServiceError(
            503, "ARCHIVE_QUERY_UNAVAILABLE", "Archive schema or bounded query unavailable"
        ) from None
    finally:
        c.close()


def valid_sql(column):
    return f'"{column}" IS NOT NULL AND isfinite("{column}") AND "{column}">=0'


def as_records(result):
    names = [x[0] for x in result.description]
    return [dict(zip(names, row, strict=True)) for row in result.fetchall()]


@lru_cache(maxsize=4)
def cached_catalogue(signature):
    with connection(signature) as c:
        aggregates = []
        for name in COLUMNS:
            good = valid_sql(name)
            aggregates.extend(
                [
                    f'count(*) FILTER(WHERE {good}) AS "{name}_valid"',
                    f'count(*) FILTER(WHERE "{name}" IS NOT NULL AND NOT ({good})) AS "{name}_invalid"',
                ]
            )
        rows = as_records(
            c.execute(
                "SELECT site_id, list_sort(list(DISTINCT source_folder)) AS source_folders,"
                "list_sort(list(DISTINCT source_label)) AS labels,min(timestamp) AS first_record,"
                "max(timestamp) AS last_record,count(*) AS n,count(DISTINCT timestamp) AS unique_hours,"
                "count(*) FILTER(WHERE timestamp IS NULL OR date_trunc('hour',timestamp)!=timestamp) AS invalid_clock,"
                + ",".join(aggregates)
                + " FROM eligible_archive GROUP BY site_id ORDER BY site_id"
            )
        )
        stations = []
        for row in rows:
            if row["n"] != row["unique_hours"] or row["invalid_clock"]:
                raise ServiceError(
                    503,
                    "ARCHIVE_DUPLICATE_HOURS",
                    "Eligible station has ambiguous duplicate recorded hours",
                )
            expected = int((row["last_record"] - row["first_record"]).total_seconds() / 3600) + 1
            pollutant_rows = []
            for name in COLUMNS:
                valid, invalid = row[f"{name}_valid"], row[f"{name}_invalid"]
                pollutant_rows.append(
                    ArchivePollutantCoverage(
                        pollutant=name,
                        unit=UNITS[name],
                        valid_count=valid,
                        missing_count=expected - valid,
                        invalid_count=invalid,
                        coverage_fraction=valid / expected,
                    )
                )
            stations.append(
                ArchiveStation(
                    station_id=row["site_id"],
                    source_folders=row["source_folders"],
                    labels=row["labels"],
                    first_record=row["first_record"],
                    last_record=row["last_record"],
                    grid_rows=row["n"],
                    expected_count=expected,
                    absent_hour_count=expected - row["n"],
                    pollutants=pollutant_rows,
                )
            )
        excluded = c.execute(
            "SELECT count(*) FROM source_archive WHERE analysis_eligible IS NOT TRUE"
        ).fetchone()[0]
    return ArchiveCatalogue(
        dataset_fingerprint=fingerprint(signature),
        stations=stations,
        station_count=len(stations),
        excluded_row_count=excluded,
        source_file_count=len(signature),
    )


def catalogue():
    # Copy: callers cannot mutate cached responses.
    return cached_catalogue(inventory()).model_copy(deep=True)


def range_check(start, end, aggregation):
    if start.tzinfo is not None or end.tzinfo is not None:
        raise ServiceError(
            422,
            "ARCHIVE_RECORDED_CLOCK_REQUIRED",
            "Use naive recorded-clock dates without UTC/offset",
        )
    if any(t.minute or t.second or t.microsecond for t in [start, end]):
        raise ServiceError(
            422, "ARCHIVE_HOUR_ALIGNMENT", "Bounds must be exact recorded-clock hours"
        )
    maximum = 366 if aggregation == "daily" else 3660
    if (
        aggregation not in {"daily", "monthly"}
        or not start < end
        or end - start > timedelta(days=maximum)
    ):
        raise ServiceError(
            422,
            "ARCHIVE_RANGE_LIMIT",
            "Use positive [start,end), daily <=366 days or monthly <=3660 days",
        )
    return int((end - start).total_seconds() / 3600)


def buckets(start, end, aggregation):
    anchor = start.replace(hour=0)
    if aggregation == "monthly":
        anchor = anchor.replace(day=1)
    while anchor < end:
        following = (
            anchor + timedelta(days=1)
            if aggregation == "daily"
            else (
                anchor.replace(year=anchor.year + 1, month=1)
                if anchor.month == 12
                else anchor.replace(month=anchor.month + 1)
            )
        )
        left, right = max(anchor, start), min(following, end)
        yield anchor, left, right, int((right - left).total_seconds() / 3600)
        anchor = following


def require_stations(signature, station_ids):
    known = {x.station_id for x in cached_catalogue(signature).stations}
    if any(x not in known for x in station_ids):
        raise ServiceError(
            404, "ARCHIVE_STATION_NOT_FOUND", "Station is absent or quarantined in this archive"
        )


def explore(station_id, pollutant, start, end, aggregation="daily", min_count=1, min_coverage=0.0):
    expected = range_check(start, end, aggregation)
    if min_count not in range(1, 745) or not 0 <= min_coverage <= 1:
        raise ServiceError(
            422, "ARCHIVE_SUFFICIENCY_INVALID", "min_count must be 1..744 and min_coverage 0..1"
        )
    name = str(pollutant)
    if name not in COLUMNS:
        raise ServiceError(422, "ARCHIVE_POLLUTANT_UNSUPPORTED", "Unsupported pollutant")
    signature = inventory()
    require_stations(signature, [station_id])
    good = valid_sql(name)
    with connection(signature) as c:
        c.execute(
            "CREATE TEMP TABLE selected AS SELECT * FROM eligible_archive WHERE site_id=? AND timestamp>=? AND timestamp<?",
            [station_id, start, end],
        )
        total, nulls, invalid, valid = c.execute(
            f'SELECT count(*),count(*) FILTER(WHERE "{name}" IS NULL),'
            f'count(*) FILTER(WHERE "{name}" IS NOT NULL AND NOT ({good})),count(*) FILTER(WHERE {good}) FROM selected'
        ).fetchone()
        stats = c.execute(
            f'SELECT min("{name}"),quantile_cont("{name}",0.05),quantile_cont("{name}",0.25),'
            f'median("{name}"),quantile_cont("{name}",0.75),quantile_cont("{name}",0.95),'
            f'max("{name}"),avg("{name}"),stddev_samp("{name}") FROM selected WHERE {good}'
        ).fetchone()
        groups = {
            row[0]: (row[1], row[2])
            for row in c.execute(
                f'SELECT date_trunc(?,timestamp),avg("{name}"),count(*) FROM selected WHERE {good} GROUP BY 1',
                ["day" if aggregation == "daily" else "month"],
            ).fetchall()
        }
        source_files = [
            row[0]
            for row in c.execute(
                "SELECT DISTINCT source_file FROM selected ORDER BY source_file LIMIT 100"
            ).fetchall()
        ]
    points = []
    for anchor, left, right, n in buckets(start, end, aggregation):
        mean, count = groups.get(anchor, (None, 0))
        coverage = count / n
        enough = count >= min_count and coverage >= min_coverage
        points.append(
            ArchiveBucket(
                period_start=left,
                period_end=right,
                value=mean if enough else None,
                valid_count=count,
                expected_count=n,
                missing_count=n - count,
                coverage_fraction=coverage,
                meets_requested_sufficiency=enough,
            )
        )
    return ArchiveExplore(
        dataset_fingerprint=fingerprint(signature),
        station_id=station_id,
        pollutant=name,
        unit=UNITS[name],
        start=start,
        end=end,
        aggregation=aggregation,
        min_count=min_count,
        min_coverage=min_coverage,
        valid_count=valid,
        expected_count=expected,
        missing_count=expected - valid,
        source_null_count=nulls,
        invalid_count=invalid,
        absent_hour_count=expected - total,
        coverage_fraction=valid / expected,
        distribution=ArchiveDistribution(
            count=valid,
            **dict(
                zip(
                    ["minimum", "p05", "p25", "median", "p75", "p95", "maximum", "mean", "stddev"],
                    stats,
                    strict=True,
                )
            ),
        ),
        points=points,
        lineage_source_files=source_files,
    )


def compare(station_ids, pollutant, start, end, aggregation="daily", clock_assumption=None):
    expected = range_check(start, end, aggregation)
    if not 2 <= len(station_ids) <= 4 or len(set(station_ids)) != len(station_ids):
        raise ServiceError(
            422, "ARCHIVE_COMPARISON_STATIONS", "Use 2..4 distinct source station IDs"
        )
    if clock_assumption != "same_recorded_clock":
        raise ServiceError(
            409,
            "ARCHIVE_CLOCK_INCOMPATIBLE",
            "Explicit same_recorded_clock assumption required; no live UTC joins",
        )
    name = str(pollutant)
    if name not in COLUMNS:
        raise ServiceError(422, "ARCHIVE_POLLUTANT_UNSUPPORTED", "Unsupported pollutant")
    signature = inventory()
    require_stations(signature, station_ids)
    with connection(signature) as c:
        c.execute(
            f'SELECT timestamp,site_id,"{name}" FROM eligible_archive WHERE site_id IN (SELECT unnest(?)) '
            f"AND timestamp>=? AND timestamp<? AND {valid_sql(name)} ORDER BY timestamp,site_id",
            [station_ids, start, end],
        )
        # At most 4 * 3660 * 24 numeric cells. No full-history HTTP export.
        by_time = {}
        for at, station, value in c.fetchall():
            by_time.setdefault(at, {})[station] = value
    paired = {at: values for at, values in by_time.items() if len(values) == len(station_ids)}
    points = []
    for _, left, right, n in buckets(start, end, aggregation):
        values = [v for at, v in paired.items() if left <= at < right]
        points.append(
            ArchiveComparisonBucket(
                period_start=left,
                period_end=right,
                paired_hour_count=len(values),
                expected_count=n,
                paired_coverage_fraction=len(values) / n,
                means={
                    s: sum(v[s] for v in values) / len(values) if values else None
                    for s in station_ids
                },
            )
        )
    agreement = []
    for a, b in combinations(station_ids, 2):
        differences = [values[a] - values[b] for values in paired.values()]
        agreement.append(
            ArchivePairAgreement(
                station_a=a,
                station_b=b,
                count=len(differences),
                mean_difference=sum(differences) / len(differences) if differences else None,
                mean_absolute_difference=sum(abs(x) for x in differences) / len(differences)
                if differences
                else None,
            )
        )
    return ArchiveCompare(
        dataset_fingerprint=fingerprint(signature),
        station_ids=station_ids,
        pollutant=name,
        unit=UNITS[name],
        start=start,
        end=end,
        aggregation=aggregation,
        clock_assumption=clock_assumption,
        matched_hour_count=len(paired),
        expected_count=expected,
        unmatched_or_missing_hour_count=expected - len(paired),
        points=points,
        pair_agreement=agreement,
    )
