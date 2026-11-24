"""One bounded cache read and two SQL queries; provider access belongs to the worker."""

import json
from datetime import UTC, datetime, timedelta

from breathewise.core.config import get_settings
from breathewise.core.time import utc
from breathewise.db.models import Observation, Station
from breathewise.repositories.observations import measurement, station_view
from breathewise.schemas.catalogue import (
    CatalogueStation,
    ObservedRank,
    ObservedRankings,
    PollutantAvailability,
    StationCatalogue,
)
from breathewise.schemas.common import Pollutant
from breathewise.schemas.environment import StationView
from sqlalchemy import func, select


def cache_path():
    return get_settings().data_root / "cache/catalogue/delhi.json"


def load_cache():
    path = cache_path()
    if not path.is_file():
        return {}
    try:
        result = json.loads(path.read_text())
        return result if result.get("schema_version") == "1.0" else {}
    except (ValueError, OSError, AttributeError):
        return {}


def coverage_state(row):
    flags = row.quality_flags
    if "provider_coverage_unknown" in flags:
        return "unknown"
    if "provider_partial_hour" in flags:
        return "reported_partial"
    return "reported_complete" if "availability_first_seen_at_fetch" in flags else "unknown"


def station_catalogue(db, city_id, cutoff):
    mode = get_settings().data_mode
    cached = load_cache() if mode == "live" else {}
    snapshot = {str(x["location_id"]): x for x in cached.get("stations", [])}
    rows = db.scalars(
        select(Station)
        .where(Station.city_id == city_id, Station.data_mode == mode)
        .order_by(Station.id)
    ).all()
    # Verified metadata remains visible even when its first observation fetch failed.
    known_ids = {x.id for x in rows}
    for item in cached.get("stations", []):
        station_id = f"openaq-{item['location_id']}"
        if city_id == "delhi" and station_id not in known_ids:
            location = item.get("location_metadata", {})
            coords = item.get("coordinates", {})
            if not all(k in coords for k in ["latitude", "longitude"]):
                continue
            rows.append(
                Station(
                    id=station_id,
                    name=item["name"],
                    city_id="delhi",
                    latitude=coords["latitude"],
                    longitude=coords["longitude"],
                    source=f"OpenAQ / {location.get('provider', {}).get('name', 'provider unknown')}; https://api.openaq.org/v3/locations/{item['location_id']}",
                    data_mode="live",
                )
            )
    rows.sort(key=lambda x: x.id)
    # Filter first, then window: no future-measured/available row can suppress an older usable row.
    ranked = (
        select(
            Observation.id,
            func.row_number()
            .over(
                partition_by=(Observation.station_id, Observation.pollutant),
                order_by=Observation.measured_at.desc(),
            )
            .label("position"),
        )
        .where(
            Observation.station_id.in_([x.id for x in rows]),
            Observation.measured_at <= cutoff,
            Observation.available_at <= cutoff,
        )
        .subquery()
    )
    latest = db.scalars(
        select(Observation)
        .join(ranked, ranked.c.id == Observation.id)
        .where(ranked.c.position == 1)
    ).all()
    by_key = {(x.station_id, x.pollutant): x for x in latest}
    stations = []
    for row in rows:
        suffix = row.id.removeprefix("openaq-") if row.id.startswith("openaq-") else ""
        location_id = suffix if suffix.isascii() and suffix.isdigit() else None
        detail = snapshot.get(location_id, {})
        available = []
        for pollutant in Pollutant:
            record = by_key.get((row.id, pollutant.value))
            sensors = detail.get("sensors", {}).get(pollutant.value, [])
            sensor = detail.get("selected_sensors", {}).get(pollutant.value)
            sensor_units = sorted({x["unit"] for x in sensors if x.get("unit")})
            selected_unit = next((x.get("unit") for x in sensors if x["id"] == sensor), None)
            pending = [
                x
                for x in detail.get("pending_revisions", [])
                if x["pollutant"] == pollutant.value
                and datetime.fromisoformat(x["detected_at"]) <= cutoff
            ]
            value = measurement(record, cutoff) if record else None
            if pending and value:
                value.quality_flags = sorted(
                    set(value.quality_flags + ["provider_revision_pending"])
                )
            if detail.get("verification_status") == "verification_failed" and value:
                value.quality_flags = sorted(
                    set(value.quality_flags + ["provider_verification_failed"])
                )
            cov = coverage_state(record) if record else "unknown"
            freshness = "no_observations" if not value else "stale" if value.stale else "fresh"
            status = (
                (
                    "stale"
                    if value.stale
                    else "coverage_unknown"
                    if cov == "unknown"
                    else "available"
                )
                if value
                else "no_observations"
                if sensors or not detail
                else "sensor_unavailable"
            )
            available.append(
                PollutantAvailability(
                    pollutant=pollutant,
                    sensor_id=sensor,
                    sensor_ids=[x["id"] for x in sensors],
                    reported_sensor_units=sensor_units,
                    selected_sensor_unit=selected_unit,
                    selected_unit_compatible=(
                        selected_unit in {"µg/m³", "μg/m³", "µg/m3", "ug/m3", "mg/m3", "mg/m³"}
                    )
                    if selected_unit
                    else None,
                    status=status,
                    freshness=freshness,
                    coverage_state=cov,
                    measurement=value,
                    provider_revision_pending=bool(pending),
                    revision_pending_count=len(pending),
                    limitations=(
                        [
                            "Latest provider identity/unit verification failed; prior verified metadata and stored observations retained; ingestion skipped"
                        ]
                        if detail.get("verification_status") == "verification_failed"
                        else []
                    )
                    + (
                        [
                            "Changed provider overlap records quarantined; stored originals retained pending explicit reconciliation"
                        ]
                        if pending
                        else []
                    )
                    + (
                        []
                        if value
                        else [
                            "No imported observation known at this cutoff; sensor metadata is not an observation"
                        ]
                    ),
                )
            )
        stations.append(
            CatalogueStation(
                **station_view(row).model_dump(),
                pollutants=available,
                provider_location_id=int(location_id) if location_id is not None else None,
                catalogue_verified_at=detail.get("verified_at"),
                provider_revision_pending=any(x.provider_revision_pending for x in available),
                last_refresh_status=detail.get("last_refresh_status"),
                verification_status=detail.get("verification_status", "unknown"),
                verification_error_code=detail.get("verification_error_code"),
                verification_attempted_at=detail.get("verification_attempted_at"),
            )
        )
    return StationCatalogue(
        city_id=city_id,
        input_cutoff_at=cutoff,
        catalogue_verified_at=cached.get("verified_at"),
        stations=stations,
    )


def observed_rankings(db, city_id, pollutant, cutoff, limit, include_stale):
    catalogue = station_catalogue(db, city_id, cutoff)
    found = []
    missing = stale = 0
    for station in catalogue.stations:
        item = next(x for x in station.pollutants if x.pollutant == pollutant)
        if item.measurement is None:
            missing += 1
        elif item.measurement.stale and not include_stale:
            stale += 1
        else:
            found.append((station, item))
    found.sort(key=lambda pair: (-pair[1].measurement.value, pair[0].id))
    return ObservedRankings(
        city_id=city_id,
        pollutant=pollutant,
        input_cutoff_at=cutoff,
        includes_stale=include_stale,
        excluded_missing_count=missing,
        excluded_stale_count=stale,
        rows=[
            ObservedRank(
                rank=i + 1,
                station=StationView.model_validate(
                    station.model_dump(include=set(StationView.model_fields))
                ),
                measurement=item.measurement,
                coverage_state=item.coverage_state,
                provider_revision_pending=item.provider_revision_pending,
            )
            for i, (station, item) in enumerate(found[:limit])
        ],
    )


def incremental_start(db, station_id, pollutant, end, initial_hours=72, overlap_hours=2):
    if not 1 <= initial_hours <= 168 or not 1 <= overlap_hours <= 24:
        raise ValueError("Incremental windows must remain bounded")
    latest = db.scalar(
        select(func.max(Observation.measured_at)).where(
            Observation.station_id == station_id,
            Observation.pollutant == pollutant,
            Observation.measured_at <= end,
        )
    )
    earliest = end - timedelta(hours=initial_hours)
    return max(earliest, utc(latest) - timedelta(hours=overlap_hours)) if latest else earliest


def quarantine_revisions(db, batch):
    """Keep immutable originals; retain changed incoming rows in provider archive/run details.

    This is explicit quarantine, not replacement, calibration or source reconciliation.
    Independent new hours can still enter the cache. The worker reports partial/nonzero.
    """
    if not batch.observations:
        return batch, []
    rows = batch.observations
    known = db.scalars(
        select(Observation).where(
            Observation.station_id.in_([s.id for s in batch.stations]),
            Observation.measured_at >= min(x.measured_at for x in rows),
            Observation.measured_at <= max(x.measured_at for x in rows),
        )
    ).all()
    known = {(x.station_id, x.pollutant, utc(x.measured_at)): x for x in known}
    retained, quarantine = [], []
    for row in rows:
        prior = known.get((row.station_id, row.pollutant.value, utc(row.measured_at)))
        normalized = row.value * (1000 if row.unit == "mg/m3" else 1)
        if prior is not None and (prior.value != normalized or prior.source != row.source):
            quarantine.append(
                {
                    "station_id": row.station_id,
                    "pollutant": row.pollutant.value,
                    "measured_at": row.measured_at.isoformat(),
                    "stored_value_ugm3": prior.value,
                    "incoming_value_ugm3": normalized,
                    "policy": "preserve_existing_pending_explicit_reconciliation",
                    "detected_at": datetime.now(UTC).isoformat(),
                }
            )
        else:
            retained.append(row)
    return batch.model_copy(update={"observations": retained}), quarantine


def merge_verification(previous, attempted):
    """A failed identity check never erases earlier verified facts or pending revisions.

    Failed retained entries are display-only until a later successful verification.
    Their original verification timestamp is preserved, not advanced to attempt time.
    """
    previous_stations = {x["location_id"]: x for x in previous.get("stations", [])}
    rejected = {x["location_id"]: x["code"] for x in attempted.get("rejected", [])}
    succeeded = {x["location_id"]: x for x in attempted.get("stations", [])}
    attempted_at = attempted["verified_at"]
    merged = []
    for location_id in sorted(set(previous_stations) | set(succeeded)):
        prior = previous_stations.get(location_id, {})
        if location_id in succeeded and location_id not in rejected:
            item = succeeded[location_id] | {
                "pending_revisions": prior.get("pending_revisions", []),
                "verification_status": "verified",
                "verification_error_code": None,
                "verification_attempted_at": attempted_at,
            }
        else:
            item = prior | {
                "verification_status": "verification_failed",
                "verification_error_code": rejected.get(location_id, "OPENAQ_NOT_REVERIFIED"),
                "verification_attempted_at": attempted_at,
                "last_refresh_status": "verification_failed",
            }
        merged.append(item)
    result = attempted | {
        "stations": merged,
        "verification_attempted_at": attempted_at,
        "verification_status": "verified"
        if not rejected
        else "partial"
        if succeeded
        else "verification_failed",
    }
    if not succeeded and previous.get("verified_at"):
        result["verified_at"] = previous["verified_at"]
    return result
