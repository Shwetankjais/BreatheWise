"""Bounded single-sensor UTC hour archive; never asserts historical publication times."""

import argparse
import csv
import hashlib
import json
import math
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import httpx
from breathewise.adapters.openaq import OpenAQ, ProviderError, parse_time
from breathewise.core.config import ROOT, get_settings
from breathewise.jobs.locking import cycle_lock
from sqlalchemy import create_engine

LOCATION = 235
SENSOR = 12235610
FIELDS = [
    "station_id",
    "sensor_id",
    "interval_start_utc",
    "measured_at_utc",
    "value",
    "unit",
    "first_seen_at_utc",
    "historical_publication_at",
    "percent_coverage",
    "training_eligible",
    "quality_flags",
]


def windows(start, end):
    if start.tzinfo is None or end.tzinfo is None or not start < end:
        raise ValueError("Explicit increasing UTC bounds required")
    if end - start > timedelta(days=731):
        raise ValueError("Single-station history limited to731 days")
    while start < end:
        stop = min(end, start + timedelta(days=28))
        yield start, stop
        start = stop


def normalize_hour(row, first_seen, start, end):
    """Accept observed one-hour averages only; retain exact half-hour UTC phase."""
    period = row["period"]
    began = parse_time(period["datetimeFrom"]["utc"])
    ended = parse_time(period["datetimeTo"]["utc"])
    if not start <= ended < end:
        return None, "outside_half_open_bounds"
    if (
        ended - began != timedelta(hours=1)
        or ended.minute not in {0, 30}
        or ended.second
        or ended.microsecond
    ):
        return None, "unsupported_interval"
    # UTC/local pairs must denote the same instant, not merely plausible local text.
    for key in ["datetimeFrom", "datetimeTo"]:
        local = datetime.fromisoformat(period[key]["local"].replace("Z", "+00:00"))
        expected = parse_time(period[key]["utc"]).astimezone(ZoneInfo("Asia/Kolkata"))
        if (
            parse_time(period[key]["local"]) != parse_time(period[key]["utc"])
            or local.utcoffset() != expected.utcoffset()
        ):
            raise ValueError("Inconsistent provider UTC/local timestamps")
    if ended > parse_time(first_seen):
        return None, "measurement_after_actual_fetch"
    parameter = row["parameter"]
    if parameter.get("name") != "pm25" or parameter.get("units") not in {"µg/m³", "μg/m³"}:
        raise ValueError("Unexpected sensor parameter/units")
    value = row.get("value")
    if type(value) not in {int, float} or not math.isfinite(value) or value < 0:
        return None, "invalid_or_missing_value"
    if row.get("flagInfo", {}).get("hasFlags") is not False:
        return None, "flagged_or_unknown_quality"
    coverage = (row.get("coverage") or {}).get("percentCoverage")
    known = type(coverage) in {int, float} and math.isfinite(coverage) and 0 <= coverage <= 100
    flags = ["historic_publication_unknown", "first_seen_at_fetch"]
    if not known:
        flags.append("provider_coverage_unknown")
    elif coverage < 100:
        flags.append("provider_partial_hour")
    return {
        "station_id": "openaq-235",
        "sensor_id": SENSOR,
        "interval_start_utc": began.isoformat(),
        "measured_at_utc": ended.isoformat(),
        "value": value,
        "unit": "µg/m³",
        "first_seen_at_utc": first_seen,
        "historical_publication_at": "",
        "percent_coverage": coverage if known else "",
        "training_eligible": int(known and coverage == 100),
        "quality_flags": "|".join(flags),
    }, None


def fetch_history(directory, start, end):
    directory.mkdir(parents=True, exist_ok=True)
    raw = directory / "raw"
    raw.mkdir(exist_ok=True)
    requests = 0
    cache_hits = 0
    key = get_settings().openaq_api_key.get_secret_value()
    with httpx.Client() as client:
        adapter = OpenAQ(key, client)

        def cached(name, path, params=None):
            nonlocal requests, cache_hits
            target = raw / f"{name}.json"
            if target.exists():
                cache_hits += 1
                return json.loads(target.read_text())
            for attempt in range(3):
                try:
                    time.sleep(1.1)
                    requests += 1
                    body = adapter.get(path, params)
                    payload = {
                        "path": path,
                        "params": params,
                        "first_seen_at_utc": datetime.now(UTC).isoformat(),
                        "body": body,
                    }
                    target.write_text(json.dumps(payload, separators=(",", ":")))
                    return payload
                except ProviderError as error:
                    if not error.retryable or attempt == 2:
                        raise
                    time.sleep(2 ** (attempt + 1))
            raise RuntimeError("Unreachable retry loop")

        location = cached("location-235", "/v3/locations/235")["body"]["results"][0]
        sensor = cached("sensor-12235610", "/v3/sensors/12235610")["body"]["results"][0]
        if (
            location["id"] != LOCATION
            or location["timezone"] != "Asia/Kolkata"
            or location["country"]["code"] != "IN"
            or location["isMobile"] is not False
            or location["isMonitor"] is not True
            or location["provider"]["name"] != "CPCB"
            or location["owner"]["name"] != "Delhi Pollution Control Committee"
            or not any(s["id"] == SENSOR for s in location["sensors"])
            or sensor["id"] != SENSOR
            or sensor["parameter"]["name"] != "pm25"
            or sensor["parameter"]["units"] != "µg/m³"
        ):
            raise ValueError("Station/sensor identity mismatch")
        unique, rejected = {}, {}
        for began, ended in windows(start, end):
            tag = began.strftime("%Y%m%dT%H%M") + "-" + ended.strftime("%Y%m%dT%H%M")
            for page in range(1, 4):
                payload = cached(
                    tag + f"-p{page}",
                    f"/v3/sensors/{SENSOR}/hours",
                    {
                        "datetime_from": began.isoformat(),
                        "datetime_to": ended.isoformat(),
                        "limit": 1000,
                        "page": page,
                    },
                )
                rows = payload["body"]["results"]
                for row in rows:
                    accepted, reason = normalize_hour(
                        row, payload["first_seen_at_utc"], began, ended
                    )
                    if reason:
                        rejected[reason] = rejected.get(reason, 0) + 1
                        continue
                    stamp = accepted["measured_at_utc"]
                    if stamp in unique:
                        old = unique[stamp]
                        if any(
                            old[k] != accepted[k]
                            for k in ["value", "unit", "interval_start_utc", "percent_coverage"]
                        ):
                            raise ValueError("Conflicting hourly observations; no silent revision")
                        continue
                    unique[stamp] = accepted
                if len(rows) < 1000:
                    break
            else:
                raise ValueError("Bounded page count exceeded")
    csv_path = directory / "observations.csv"
    with csv_path.open("w", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(unique[k] for k in sorted(unique))
    report = {
        "schema_version": "1.0",
        "station_id": "openaq-235",
        "sensor_id": SENSOR,
        "location_name": location["name"],
        "coordinates": location["coordinates"],
        "owner": location["owner"],
        "provider": location["provider"],
        "sensor_first_measurement": sensor["datetimeFirst"],
        "sensor_last_measurement": sensor["datetimeLast"],
        "requested_start_utc": start.isoformat(),
        "requested_end_utc_exclusive": end.isoformat(),
        "dataset_mode": "utc_native_historical_observations",
        "timezone": "UTC",
        "local_timezone": location["timezone"],
        "interval_semantics": "exclusive_hour_ending",
        "pollutant": "pm25",
        "unit": "µg/m³",
        "observations": len(unique),
        "complete_hour_training_rows": sum(r["training_eligible"] for r in unique.values()),
        "partial_or_unknown_coverage_rows": sum(
            not r["training_eligible"] for r in unique.values()
        ),
        "first_observation_utc": min(unique) if unique else None,
        "last_observation_utc": max(unique) if unique else None,
        "historical_publication_time_known": False,
        "availability_semantics": "first_seen_at_utc is this actual fetch, never historical publication",
        "rejected": rejected,
        "network_requests_this_run": requests,
        "cache_hits_this_run": cache_hits,
        "dataset_sha256": hashlib.sha256(csv_path.read_bytes()).hexdigest(),
        "raw_response_count": len(list(raw.glob("*.json"))),
        "raw_response_hashes": {
            p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(raw.glob("*.json"))
        },
        "training_readiness": "observed_complete_hours_available_for_separate_UTC_retrospective_protocol; historical_issue_availability_unknown",
        "live_compatibility": "Requires exact sensor, UTC hour-ending phase, complete/stale policy and prospective availability checks",
    }
    (directory / "manifest.json").write_text(json.dumps(report, indent=2) + "\n")
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start", default="2025-02-19T00:00:00Z")
    parser.add_argument("--end", default="2026-11-01T00:00:00Z")
    parser.add_argument("--output", type=Path, default=ROOT / "work/utc-history/openaq-235")
    args = parser.parse_args()
    with cycle_lock(create_engine("sqlite://"), "utc-history-openaq-235"):
        report = fetch_history(args.output, parse_time(args.start), parse_time(args.end))
    print(json.dumps({k: v for k, v in report.items() if k != "raw_response_hashes"}, indent=2))


if __name__ == "__main__":
    main()
