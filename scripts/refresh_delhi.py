"""Verify a small DPCC cohort and refresh bounded cached PM2.5 history, without a daemon."""

import argparse
import json
from datetime import UTC, datetime, timedelta

import httpx
from breathewise.adapters.openaq import OpenAQ, ProviderError, delhi_assignment, parse_time
from breathewise.core.config import get_settings
from breathewise.core.time import utc
from breathewise.db.models import IngestionRun
from breathewise.db.session import engine
from breathewise.jobs.cycle import run_cycle
from breathewise.jobs.locking import WorkerBusy, cycle_lock
from breathewise.services.catalogue import (
    cache_path,
    incremental_start,
    load_cache,
    merge_verification,
    quarantine_revisions,
)
from breathewise.services.imports import archive_provider
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

# Explicit current sensor candidates from bounded provider discovery, never all-India download.
CANDIDATES = [(235, 12235610), (50, 12234796), (8472, 12235294), (8365, 12235083)]


def verify_cohort(client, key, *, now=None):
    now = now or datetime.now(UTC)
    provider = OpenAQ(key, client)
    verified = []
    rejected = []
    for location_id, sensor_id in CANDIDATES:
        try:
            location = provider.get(f"/v3/locations/{location_id}")["results"][0]
            if (
                location.get("id") != location_id
                or location.get("country", {}).get("code") != "IN"
                or location.get("owner", {}).get("name") != "Delhi Pollution Control Committee"
                or location.get("isMobile") is not False
                or location.get("isMonitor") is not True
                or location.get("timezone") != "Asia/Kolkata"
            ):
                raise ProviderError("OPENAQ_STATION_INELIGIBLE")
            assignment = delhi_assignment(location)
            choices = [
                s
                for s in location.get("sensors", [])
                if s.get("id") == sensor_id and s.get("parameter", {}).get("name") == "pm25"
            ]
            if len(choices) != 1:
                raise ProviderError("OPENAQ_PM25_SENSOR_MISSING_OR_AMBIGUOUS")
            sensor = provider.get(f"/v3/sensors/{sensor_id}")["results"][0]
            parameter = sensor.get("parameter", {})
            if (
                sensor.get("id") != sensor_id
                or parameter.get("name") != "pm25"
                or parameter.get("units") not in {"µg/m³", "μg/m³", "µg/m3", "ug/m3"}
            ):
                raise ProviderError("OPENAQ_PARAMETER_OR_UNITS_UNSUPPORTED")
            last = parse_time(sensor["datetimeLast"]["utc"])
            if not timedelta(0) <= now - last <= timedelta(hours=24):
                raise ProviderError("OPENAQ_SENSOR_NO_RECENT_AVAILABILITY")
            coords = location["coordinates"]
            if not (-90 <= coords["latitude"] <= 90 and -180 <= coords["longitude"] <= 180):
                raise ProviderError("OPENAQ_COORDINATES_INVALID")
            registry = {}
            for item in location.get("sensors", []):
                p = item.get("parameter", {}).get("name")
                if p in {"pm25", "pm10", "no2", "so2", "o3", "co"}:
                    registry.setdefault(p, []).append(
                        {"id": item["id"], "unit": item["parameter"].get("units")}
                    )
            verified.append(
                {
                    "location_id": location_id,
                    "selected_sensors": {"pm25": sensor_id},
                    "name": location["name"],
                    "coordinates": coords,
                    "city_assignment_method": assignment,
                    "verified_at": now.isoformat(),
                    "sensor_datetime_last": last.isoformat(),
                    "sensor_unit": parameter["units"],
                    "sensors": registry,
                    "location_metadata": location,
                    "sensor_coverage_summary_used_for_selection": False,
                    "coverage_limit": "Sensor lifetime coverage percentages can exceed 100; only actual hourly row coverage is used",
                }
            )
        except (ProviderError, KeyError, IndexError, ValueError, TypeError) as exc:
            rejected.append(
                {
                    "location_id": location_id,
                    "code": exc.code
                    if isinstance(exc, ProviderError)
                    else "OPENAQ_METADATA_INVALID",
                }
            )
    return {
        "schema_version": "1.0",
        "verified_at": now.isoformat(),
        "scope": "four bounded DPCC candidate locations; PM2.5 only; no all-city coverage promise",
        "stations": verified,
        "rejected": rejected,
        "metadata_archive_sha256": archive_provider(provider.raw_responses),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--verify",
        action="store_true",
        help="Refresh selected provider identities; otherwise use <24h cache",
    )
    parser.add_argument("--lookback-hours", type=int, default=72)
    parser.add_argument("--overlap-hours", type=int, default=2)
    args = parser.parse_args()
    if not 1 <= args.lookback_hours <= 168 or not 1 <= args.overlap_hours <= 24:
        parser.error("lookback must be 1..168 hours, overlap 1..24")
    if get_settings().data_mode != "live":
        parser.error(
            "This verified provider cohort is live intake; use an isolated DATA_MODE=live database"
        )
    key = get_settings().openaq_api_key.get_secret_value()
    with httpx.Client() as client:
        cached = load_cache()
        if (
            args.verify
            or not cached
            or any(
                x.get("verification_status") == "verification_failed"
                for x in cached.get("stations", [])
            )
            or datetime.now(UTC) - parse_time(cached["verified_at"]) > timedelta(hours=24)
        ):
            # Discovery/cache publication shares the existing job lock; HTTP never runs in API requests.
            with cycle_lock(engine()):
                cached = merge_verification(cached, verify_cohort(client, key))
                path = cache_path()
                path.parent.mkdir(parents=True, exist_ok=True)
                temp = path.with_suffix(".tmp")
                temp.write_text(json.dumps(cached, indent=2, allow_nan=False) + "\n")
                temp.replace(path)
        results = []
        ingestion_attempted = False
        rejected_ids = {x["location_id"] for x in cached.get("rejected", [])}
        for station in cached["stations"]:
            if (
                station.get("verification_status") == "verification_failed"
                or station["location_id"] in rejected_ids
            ):
                results.append(
                    {
                        "location_id": station["location_id"],
                        "status": "verification_failed",
                        "inserted": 0,
                        "code": station.get("verification_error_code", "OPENAQ_NOT_REVERIFIED"),
                    }
                )
                continue

            ingestion_attempted = True

            def fetch(station=station):
                end = datetime.now(UTC)
                with Session(engine()) as db:
                    start = incremental_start(
                        db,
                        f"openaq-{station['location_id']}",
                        "pm25",
                        end,
                        args.lookback_hours,
                        args.overlap_hours,
                    )
                provider = OpenAQ(key, client)
                batch, details = provider.fetch_hourly(
                    location_id=station["location_id"],
                    sensor_id=station["selected_sensors"]["pm25"],
                    pollutant="pm25",
                    start=start,
                    end=end,
                    mode="live",
                    location_metadata=station["location_metadata"],
                )
                with Session(engine()) as db:
                    batch, quarantined = quarantine_revisions(db, batch)
                if quarantined:
                    details["skipped"]["provider_revisions_quarantined"] = len(quarantined)
                    details["quarantined_revisions"] = quarantined
                details |= {
                    "incremental_start": start.isoformat(),
                    "incremental_end": end.isoformat(),
                    "overlap_hours": args.overlap_hours,
                }
                return batch, details, provider.raw_responses

            result = run_cycle(
                engine(),
                fetch,
                provider="openaq",
                emit=lambda event: print(json.dumps(event), flush=True),
            )
            # Publish pending revisions durably; later refreshes never silently clear them.
            with cycle_lock(engine()), Session(engine()) as db:
                latest_cache = load_cache()
                target = next(
                    x
                    for x in latest_cache["stations"]
                    if x["location_id"] == station["location_id"]
                )
                pending = {
                    (x["pollutant"], x["measured_at"]): x
                    for x in target.get("pending_revisions", [])
                }
                journal = db.scalars(
                    select(IngestionRun)
                    .where(IngestionRun.provider == "openaq", IngestionRun.data_mode == "live")
                    .order_by(IngestionRun.started_at.desc())
                    .limit(1000)
                ).all()
                for entry in reversed(journal):
                    for revision in entry.details.get("quarantined_revisions", []):
                        if revision["station_id"] == f"openaq-{station['location_id']}":
                            revision_key = (revision["pollutant"], revision["measured_at"])
                            if revision_key not in pending:
                                pending[revision_key] = revision | {
                                    "detected_at": revision.get(
                                        "detected_at", utc(entry.finished_at).isoformat()
                                    )
                                }
                target["pending_revisions"] = list(pending.values())
                target["last_refresh_status"] = result["status"]
                target["last_refresh_at"] = datetime.now(UTC).isoformat()
                path = cache_path()
                temp = path.with_suffix(".tmp")
                temp.write_text(json.dumps(latest_cache, indent=2, allow_nan=False) + "\n")
                temp.replace(path)
            results.append(
                {
                    "location_id": station["location_id"],
                    "status": result["status"],
                    "inserted": (result["ingestion"] or {}).get("inserted"),
                }
            )
        alert_only = None
        if not ingestion_attempted:
            # Failed metadata verification must not suppress independently eligible
            # cached-observation alerts. No rejected provider sensor is fetched.
            alert_only = run_cycle(
                engine(),
                None,
                provider="none",
                emit=lambda event: print(json.dumps(event), flush=True),
            )
        result = {
            "event": "cohort_refresh",
            "scope": cached["scope"],
            "stations": results,
            "rejected": cached["rejected"],
            "model_inference": "unavailable",
            "alert_only_status": alert_only["status"] if alert_only else None,
        }
        print(json.dumps(result, allow_nan=False))
        return 0 if results and all(x["status"] == "success" for x in results) else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except WorkerBusy:
        raise SystemExit("WORKER_BUSY: overlapping cycle refused") from None
    except ProviderError as exc:
        raise SystemExit(exc.code) from None
    except SQLAlchemyError:
        raise SystemExit(
            "DATABASE_UNAVAILABLE: apply migrations to isolated live database"
        ) from None
    except (ValueError, OSError):
        raise SystemExit(
            "INVALID_INPUT_OR_CACHE: inspect local catalogue; no data inferred"
        ) from None
