"""Prospective UTC persistence baseline logging; never public learned-model inference."""

import hashlib
import json
import math
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from breathewise.core.config import get_settings
from breathewise.core.errors import ServiceError
from breathewise.core.time import utc
from breathewise.db.models import ForecastRun, Observation, ShadowPrediction, Station
from breathewise.jobs.locking import cycle_lock
from breathewise.schemas.shadow import (
    ForecastRunDetail,
    ForecastRunPage,
    ForecastRunView,
    ShadowPoint,
)
from breathewise.services.catalogue import load_cache
from sqlalchemy import func, select
from sqlalchemy.orm import Session

BASELINE_VERSION = "utc-persistence-shadow-v1"
RULES = {
    "max_input_age_minutes": 120,
    "max_generation_delay_minutes": 15,
    "input_available_at_lte_cutoff": True,
    "cutoff_lte_issue": True,
    "targets_strictly_after_generation": True,
    "complete_provider_hour_required": True,
    "model": "Repeat latest eligible issue-time observed PM2.5 at each target; baseline, not ML",
    "horizons_h": list(range(1, 25)),
    "unit": "µg/m³",
    "public_forecast_ready": False,
    "activity_planning_ready": False,
}


def aware(value):
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("Explicit timezone-aware UTC-compatible timestamp required")
    return value.astimezone(UTC)


def run_shadow(engine, station_id, model_version, issue_at, input_cutoff, *, now=None):
    """One idempotent batch; rejects persist visibly, cutoff never moves forward on retry."""
    issue = aware(issue_at)
    cutoff = aware(input_cutoff)
    generated = aware(now) if now is not None else datetime.now(UTC)
    if len(station_id) > 100 or len(model_version) > 100:
        raise ValueError("Station and model identifiers must be <=100 characters")
    with cycle_lock(engine, "breathewise-shadow-forecasts"):
        with Session(engine) as db, db.begin():
            existing = db.scalar(
                select(ForecastRun).where(
                    ForecastRun.station_id == station_id,
                    ForecastRun.model_version == model_version,
                    ForecastRun.issue_at == issue,
                    ForecastRun.input_cutoff == cutoff,
                )
            )
            if existing:
                return existing.id, False
            run = ForecastRun(
                id=str(uuid4()),
                station_id=station_id,
                model_version=model_version,
                data_mode=get_settings().data_mode,
                status="rejected",
                issue_at=issue,
                input_cutoff=cutoff,
                generated_at=generated,
                provenance={
                    "rules": RULES,
                    "clock_basis": "UTC_hour_ending",
                    "operation": "shadow",
                    "historical_publication_times_known": False,
                    "generation_delay_seconds": (generated - issue).total_seconds(),
                },
            )
            db.add(run)
            db.flush()

            def reject(code):
                run.error_code = code
                return run.id, True

            if model_version != BASELINE_VERSION:
                return reject(
                    "MODEL_CLOCK_INCOMPATIBLE"
                    if model_version.startswith("delhi-recorded-")
                    else "SHADOW_MODEL_UNSUPPORTED"
                )
            if cutoff > issue or issue > generated:
                return reject("INVALID_INPUT_CUTOFF")
            if generated - issue > timedelta(minutes=15):
                return reject("SCHEDULED_ISSUE_EXPIRED")
            station = db.get(Station, station_id)
            if station is None or station.data_mode != get_settings().data_mode:
                return reject("SHADOW_STATION_UNAVAILABLE")
            if station.data_mode not in {"live", "demo"}:
                return reject("PROSPECTIVE_INPUTS_REQUIRED")
            row = db.scalar(
                select(Observation)
                .where(
                    Observation.station_id == station_id,
                    Observation.pollutant == "pm25",
                    Observation.measured_at <= cutoff,
                    Observation.available_at <= cutoff,
                )
                .order_by(Observation.measured_at.desc())
                .limit(1)
            )
            if row is None:
                return reject("SHADOW_INPUTS_UNAVAILABLE")
            if not math.isfinite(row.value) or row.value < 0 or row.unit != "µg/m³":
                return reject("SHADOW_INPUT_INCOMPATIBLE")
            snapshot = {
                "observation_id": row.id,
                "station_id": station_id,
                "value": row.value,
                "unit": row.unit,
                "source": row.source,
                "measured_at": utc(row.measured_at).isoformat(),
                "available_at": utc(row.available_at).isoformat(),
                "quality_flags": row.quality_flags,
            }
            encoded = json.dumps(snapshot, sort_keys=True, allow_nan=False)
            run.input_sha256 = hashlib.sha256(encoded.encode()).hexdigest()
            run.provenance = {
                **run.provenance,
                "input": snapshot,
                "baseline_version": BASELINE_VERSION,
            }
            if issue - utc(row.measured_at) > timedelta(minutes=120):
                return reject("SHADOW_INPUT_STALE")
            if any(
                x in row.quality_flags
                for x in [
                    "provider_partial_hour",
                    "provider_coverage_unknown",
                    "provider_revision_pending",
                    "provider_verification_failed",
                ]
            ):
                return reject("SHADOW_INPUT_INCOMPLETE")
            if (issue.minute, issue.second, issue.microsecond) != (
                utc(row.measured_at).minute,
                0,
                0,
            ):
                return reject("SHADOW_INTERVAL_PHASE_MISMATCH")
            if station.data_mode == "live":
                suffix = station_id.removeprefix("openaq-")
                metadata = next(
                    (
                        x
                        for x in load_cache().get("stations", [])
                        if str(x.get("location_id")) == suffix
                    ),
                    {},
                )
                if (
                    not station_id.startswith("openaq-")
                    or not metadata.get("verified_at")
                    or metadata.get("verification_status") == "verification_failed"
                    or not metadata.get("selected_sensors", {}).get("pm25")
                ):
                    return reject("SHADOW_PROVIDER_IDENTITY_UNVERIFIED")
                try:
                    verified = aware(datetime.fromisoformat(metadata["verified_at"]))
                except (ValueError, TypeError):
                    return reject("SHADOW_PROVIDER_IDENTITY_UNVERIFIED")
                if verified > generated or generated - verified > timedelta(hours=24):
                    return reject("SHADOW_PROVIDER_VERIFICATION_STALE")
                expected_source = f"https://api.openaq.org/v3/locations/{metadata['location_id']}"
                if row.source.rsplit("; ", 1)[-1] != expected_source:
                    return reject("SHADOW_INPUT_SOURCE_MISMATCH")
                if metadata.get("pending_revisions"):
                    return reject("SHADOW_PROVIDER_REVISION_PENDING")
                run.provenance = {
                    **run.provenance,
                    "provider_location_id": metadata["location_id"],
                    "provider_sensor_id": metadata["selected_sensors"]["pm25"],
                    "provider_verified_at": metadata["verified_at"],
                }
            targets = [issue + timedelta(hours=h) for h in range(1, 25)]
            if targets[0] <= generated:
                return reject("SHADOW_TARGET_ALREADY_ELAPSED")
            flags = sorted(
                set(
                    row.quality_flags
                    + [
                        "shadow_only",
                        "persistence_baseline",
                        "not_learned_model",
                        "no_calibrated_uncertainty",
                    ]
                )
            )
            for horizon, target in enumerate(targets, 1):
                db.add(
                    ShadowPrediction(
                        run_id=run.id,
                        horizon_h=horizon,
                        target_at=target,
                        concentration=row.value,
                        unit=row.unit,
                        quality_flags=flags,
                    )
                )
            run.status = "succeeded"
            run.error_code = None
            return run.id, True


def reconcile_shadow(engine, *, now=None):
    """Match only exact future observed hours received after actual forecast generation."""
    clock = aware(now) if now is not None else datetime.now(UTC)
    matched = 0
    with cycle_lock(engine, "breathewise-shadow-forecasts"):
        with Session(engine) as db, db.begin():
            pairs = db.execute(
                select(ShadowPrediction, ForecastRun)
                .join(ForecastRun)
                .where(
                    ShadowPrediction.matched_observation_id.is_(None),
                    ForecastRun.status == "succeeded",
                    ForecastRun.data_mode == get_settings().data_mode,
                    ShadowPrediction.target_at <= clock,
                )
            ).all()
            for prediction, run in pairs:
                row = db.scalar(
                    select(Observation).where(
                        Observation.station_id == run.station_id,
                        Observation.pollutant == "pm25",
                        Observation.measured_at == prediction.target_at,
                        Observation.measured_at > run.generated_at,
                        Observation.available_at > run.generated_at,
                        Observation.available_at <= clock,
                        Observation.unit == prediction.unit,
                    )
                )
                if (
                    row is not None
                    and run.data_mode == "live"
                    and row.source != run.provenance.get("input", {}).get("source")
                ):
                    continue
                if row is None or any(
                    x in row.quality_flags
                    for x in [
                        "provider_partial_hour",
                        "provider_coverage_unknown",
                        "provider_revision_pending",
                        "provider_verification_failed",
                    ]
                ):
                    continue
                prediction.matched_observation_id = row.id
                prediction.matched_at = clock
                matched += 1
    return matched


def run_view(db, run):
    count, matched = db.execute(
        select(
            func.count(ShadowPrediction.id), func.count(ShadowPrediction.matched_observation_id)
        ).where(ShadowPrediction.run_id == run.id)
    ).one()
    return ForecastRunView(
        **{
            key: getattr(run, key)
            for key in [
                "id",
                "station_id",
                "model_version",
                "data_mode",
                "status",
                "error_code",
                "input_sha256",
                "provenance",
            ]
        },
        **{key: utc(getattr(run, key)) for key in ["issue_at", "input_cutoff", "generated_at"]},
        prediction_count=count,
        matched_count=matched,
    )


def list_runs(db, station_id=None, model_version=None, limit=50, offset=0):
    query = select(ForecastRun).where(ForecastRun.data_mode == get_settings().data_mode)
    if station_id:
        query = query.where(ForecastRun.station_id == station_id)
    if model_version:
        query = query.where(ForecastRun.model_version == model_version)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.scalars(
        query.order_by(ForecastRun.generated_at.desc(), ForecastRun.id).limit(limit).offset(offset)
    ).all()
    return ForecastRunPage(
        runs=[run_view(db, r) for r in rows], total_count=total, limit=limit, offset=offset
    )


def detail(db, run_id):
    run = db.get(ForecastRun, run_id)
    if run is None or run.data_mode != get_settings().data_mode:
        raise ServiceError(
            404, "FORECAST_RUN_NOT_FOUND", "No shadow run in the configured data mode"
        )
    points = []
    for prediction in db.scalars(
        select(ShadowPrediction)
        .where(ShadowPrediction.run_id == run.id)
        .order_by(ShadowPrediction.horizon_h)
    ):
        observed = (
            db.get(Observation, prediction.matched_observation_id)
            if prediction.matched_observation_id
            else None
        )
        points.append(
            ShadowPoint(
                horizon_h=prediction.horizon_h,
                target_at=utc(prediction.target_at),
                lead_time_seconds=(
                    utc(prediction.target_at) - utc(run.generated_at)
                ).total_seconds(),
                concentration=prediction.concentration,
                unit=prediction.unit,
                quality_flags=prediction.quality_flags,
                observed=observed.value if observed else None,
                observation_available_at=utc(observed.available_at) if observed else None,
                matched_at=utc(prediction.matched_at) if prediction.matched_at else None,
                error=prediction.concentration - observed.value if observed else None,
            )
        )
    return ForecastRunDetail(run=run_view(db, run), predictions=points)
