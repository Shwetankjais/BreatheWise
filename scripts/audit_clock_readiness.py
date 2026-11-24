"""Evidence-only clock audit; no timestamp shifts or raw archive/live source joins."""

import argparse
import csv
import hashlib
import json
import sqlite3
from datetime import UTC, datetime
from pathlib import Path

import duckdb
from breathewise.core.config import ROOT, get_settings

SOURCES = [
    "https://docs.openaq.org/using-the-api/dates-datetimes",
    "https://docs.openaq.org/resources/measurements",
    "https://docs.openaq.org/resources/latest",
    "https://docs.openaq.org/resources/sensors",
]


def audit(archive, history, database):
    manifest = json.loads((history / "manifest.json").read_text())
    raw = history / "raw"
    location_payload = json.loads((raw / "location-235.json").read_text())
    location = location_payload["body"]["results"][0]
    crosswalk = archive / "data/processed/tables/station_crosswalk.csv"
    with crosswalk.open() as stream:
        entry = next(r for r in csv.DictReader(stream) if r["site_id"] == "site_301")
    with duckdb.connect() as connection:
        approx = connection.execute(
            "SELECT weather_location,lat,lon FROM read_parquet(?) WHERE weather_location='Anand_Vihar'",
            [str(archive / "data/processed/station_coordinate_context.parquet")],
        ).fetchone()
    first_seen = []
    if database.exists():
        with sqlite3.connect(f"file:{database.resolve()}?mode=ro", uri=True) as connection:
            rows = connection.execute(
                "SELECT measured_at,available_at,value,quality_flags FROM observations WHERE station_id='openaq-235' AND pollutant='pm25' ORDER BY measured_at DESC"
            ).fetchall()
        for measured, available, value, flags in rows[:8]:
            measured_at = datetime.fromisoformat(measured)
            available_at = datetime.fromisoformat(available)
            measured_at = (
                measured_at.replace(tzinfo=UTC)
                if measured_at.tzinfo is None
                else measured_at.astimezone(UTC)
            )
            available_at = (
                available_at.replace(tzinfo=UTC)
                if available_at.tzinfo is None
                else available_at.astimezone(UTC)
            )
            first_seen.append(
                {
                    "measured_at_utc": measured_at.isoformat(),
                    "actual_first_seen_at_utc": available_at.isoformat(),
                    "value": value,
                    "unit": "µg/m³",
                    "quality_flags": json.loads(flags),
                    "first_seen_lag_minutes": (available_at - measured_at).total_seconds() / 60,
                }
            )
    examples = []
    coverage_bounds_mismatch = 0
    value_summary_difference = 0
    for path in sorted(raw.glob("*-p*.json")):
        payload = json.loads(path.read_text())
        for row in payload["body"]["results"]:
            if (row.get("coverage") or {}).get("datetimeFrom") != row.get("period", {}).get(
                "datetimeFrom"
            ):
                coverage_bounds_mismatch += 1
            if row.get("value") != (row.get("summary") or {}).get("avg"):
                value_summary_difference += 1
            if len(examples) < 2:
                examples.append(
                    {
                        "raw_file": path.name,
                        "period": row.get("period"),
                        "coverage": row.get("coverage"),
                        "value": row.get("value"),
                        "summary_avg": (row.get("summary") or {}).get("avg"),
                    }
                )
    return {
        "audited_at_utc": datetime.now(UTC).isoformat(),
        "authoritative_provider_docs": SOURCES,
        "archive": {
            "source_station_id": "site_301",
            "crosswalk_evidence": entry,
            "approximate_weather_coordinate_context": {
                "label": approx[0],
                "latitude": approx[1],
                "longitude": approx[2],
            },
            "crosswalk_sha256": hashlib.sha256(crosswalk.read_bytes()).hexdigest(),
            "clock_basis": "naive_recorded_clock_unverified",
            "timezone": None,
            "interval_start_or_end": None,
            "historical_publication_time_known": False,
            "authoritative_crosswalk_to_openaq235": False,
            "conclusion": "Name/provider lineage supports candidate association only. Approximate supplied weather coordinates are not official station registry proof. Neither source filenames nor Parquet UTC-adjustment=false proves IST or UTC. No shift applied or numerical-alignment optimization performed.",
        },
        "utc_native": {
            "station_id": "openaq-235",
            "sensor_id": 12235610,
            "provider_location": location,
            "provider_metadata_fetched_at_utc": location_payload["first_seen_at_utc"],
            "clock_basis": "UTC",
            "local_timezone": "Asia/Kolkata",
            "interval": "provider period datetimeFrom inclusive to datetimeTo exclusive; measured_at=period.datetimeTo.utc",
            "phase": "hour-ending UTC minute30 retained; IST whole-hour endpoint",
            "unit": "µg/m³",
            "aggregation": "provider /hours reported value; not recomputed from rounded source summaries",
            "coverage_caveat": "Provider percentCoverage and flagInfo are retained.100% is provider-declared completeness, not independent proof; coverage support bounds can differ from period bounds.",
            "raw_rows_coverage_start_differs_from_period_start": coverage_bounds_mismatch,
            "raw_rows_value_differs_from_summary_avg": value_summary_difference,
            "examples": examples,
            "history_manifest": manifest,
            "cache_replay_verified": {
                "network_requests": manifest["network_requests_this_run"],
                "cache_hits": manifest["cache_hits_this_run"],
                "dataset_sha256_unchanged": hashlib.sha256(
                    (history / "observations.csv").read_bytes()
                ).hexdigest()
                == manifest["dataset_sha256"],
            },
        },
        "availability": {
            "historical_publication_time_known": False,
            "actual_cached_recent_first_seen_examples": first_seen,
            "interpretation": "First_seen minus measurement end is observed retrieval lag and an upper bound on publication lag, not exact provider reporting delay. Backfill first_seen dates must never masquerade as historical issue-time availability. OpenAQ may deliver old measurements out of order; latest alone cannot recover all updates.",
        },
        "feature_cutoff_rules": [
            "UTC model must use exact verified station/sensor and hour-ending phase; no recorded-clock model promotion",
            "For retrospective UTC studies assume earlier measurements available only explicitly; historical publication is unknown",
            "For shadow issue time require first_seen_at<=issue_at and measurement_end<=input_cutoff<=issue_at",
            "Choose freshest eligible completed hour, reject stale newest input per declared limit and never zero-fill gaps",
            "Use exact elapsed-hour lags; rolling statistics only through cutoff; explicit missingness and full-hour target policy",
            "Log actual forecast issue/input cutoff/target/model version and score only subsequently first-seen compatible observations",
        ],
        "readiness": {
            "recorded_clock_v1_live_compatible": False,
            "utc_native_history_available": manifest["complete_hour_training_rows"] > 0,
            "historical_issue_availability_verified": False,
            "public_live_forecast_ready": False,
            "remaining": "Separate UTC training and honest retrospective validation; prospective input availability/staleness/coverage and forecast outcomes. No city or station-crosswalk generalization implied.",
        },
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, default=get_settings().archive_root)
    parser.add_argument("--history", type=Path, default=ROOT / "work/utc-history/openaq-235")
    parser.add_argument("--database", type=Path, default=ROOT / "work/delhi-live.db")
    parser.add_argument("--output", type=Path, default=ROOT / "docs/CLOCK_READINESS.json")
    args = parser.parse_args()
    report = audit(args.archive, args.history, args.database)
    args.output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"output": str(args.output), "readiness": report["readiness"]}))


if __name__ == "__main__":
    main()
