"""Experimental UTC baseline/learned shadow logging; public forecasting remains gated."""

import hashlib
import json
import math
import os
import subprocess
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from breathewise.core.config import ROOT, get_settings
from breathewise.core.errors import ServiceError
from breathewise.core.time import utc
from breathewise.db.models import ForecastRun, Observation, ShadowPrediction, Station
from breathewise.jobs.locking import cycle_lock
from breathewise.ml.availability_experiment import MODEL_VERSION as AVAILABILITY_VERSION
from breathewise.ml.availability_experiment import SCENARIO as AVAILABILITY_SCENARIO
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

            if model_version == AVAILABILITY_VERSION:
                return run_availability_shadow(db, run, reject, issue, cutoff, generated)
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


def availability_prediction(folder, issue, observations):
    """Invoke only the existing isolated model runtime, with bounded JSON and no network."""
    runtime = ROOT / "tools/forecast-experiment/.venv/bin/python"
    if not runtime.is_file():
        raise ValueError("AVAILABILITY_RUNTIME_UNAVAILABLE")
    command = [
        str(runtime),
        str(ROOT / "scripts/predict_availability.py"),
        "--model-dir",
        str(folder),
    ]
    if os.environ.get("BREATHEWISE_OPENMP_LIBRARY"):
        command += ["--openmp-library", os.environ["BREATHEWISE_OPENMP_LIBRARY"]]
    try:
        result = subprocess.run(
            command,
            input=json.dumps(
                {"issue_at": issue.isoformat(), "observations": observations}, allow_nan=False
            ),
            text=True,
            capture_output=True,
            timeout=120,
            check=False,
            cwd=ROOT,
        )
    except (OSError, subprocess.TimeoutExpired):
        raise ValueError("AVAILABILITY_RUNTIME_UNAVAILABLE") from None
    if result.returncode or len(result.stdout) > 2_000_000:
        raise ValueError("AVAILABILITY_MODEL_INPUT_INVALID")
    try:
        payload = json.loads(result.stdout)
    except (ValueError, TypeError):
        raise ValueError("AVAILABILITY_MODEL_OUTPUT_INVALID") from None
    if (
        not isinstance(payload, dict)
        or payload.get("model_version") != AVAILABILITY_VERSION
        or not isinstance(payload.get("points"), list)
        or len(payload["points"]) != 24
    ):
        raise ValueError("AVAILABILITY_MODEL_OUTPUT_INVALID")
    return payload


def run_availability_shadow(db, run, reject, issue, cutoff, generated):
    """New learned age3..4h regime; does not alter baseline or older model gates."""
    run.provenance = {
        "operation": "shadow",
        "forecast_kind": "learned_availability_scenario",
        "actual_issue_at": generated.isoformat(),
        "nominal_model_issue_at": issue.isoformat(),
        "clock_basis": "UTC_hour_ending",
        "generation_delay_seconds": (generated - issue).total_seconds(),
        "historical_publication_times_known": False,
        "availability_scenario": AVAILABILITY_SCENARIO,
        "rules": {
            "feature_cutoff_lag_h": 3,
            "latest_input_age_hours": [3, 4],
            "max_generation_delay_minutes_exclusive": 60,
            "actual_first_seen_lte_cutoff": True,
            "public_live_forecast_ready": False,
            "activity_planning_ready": False,
        },
    }
    if cutoff > issue or issue > generated:
        return reject("INVALID_INPUT_CUTOFF")
    if generated - issue >= timedelta(hours=1):
        return reject("SCHEDULED_ISSUE_EXPIRED")
    if (issue.minute, issue.second, issue.microsecond) != (30, 0, 0):
        return reject("SHADOW_INTERVAL_PHASE_MISMATCH")
    station = db.get(Station, run.station_id)
    if (
        station is None
        or station.data_mode != get_settings().data_mode
        or run.station_id != "openaq-235"
    ):
        return reject("AVAILABILITY_STATION_UNSUPPORTED")
    if station.data_mode not in {"live", "demo"}:
        return reject("PROSPECTIVE_INPUTS_REQUIRED")
    metadata = next(
        (x for x in load_cache().get("stations", []) if x.get("location_id") == 235), {}
    )
    if station.data_mode == "live":
        if (
            metadata.get("selected_sensors", {}).get("pm25") != 12235610
            or metadata.get("verification_status") == "verification_failed"
        ):
            return reject("SHADOW_PROVIDER_IDENTITY_UNVERIFIED")
        try:
            verified = aware(datetime.fromisoformat(metadata["verified_at"]))
        except (ValueError, KeyError, TypeError):
            return reject("SHADOW_PROVIDER_IDENTITY_UNVERIFIED")
        if verified > generated or generated - verified > timedelta(hours=24):
            return reject("SHADOW_PROVIDER_VERIFICATION_STALE")
    feature_cutoff = issue - timedelta(hours=3)
    raw = db.scalars(
        select(Observation)
        .where(
            Observation.station_id == run.station_id,
            Observation.pollutant == "pm25",
            Observation.measured_at <= feature_cutoff,
            Observation.measured_at >= issue - timedelta(hours=172),
            Observation.available_at <= cutoff,
        )
        .order_by(Observation.measured_at)
    ).all()
    pending = set()
    for revision in metadata.get("pending_revisions", []):
        if revision.get("pollutant") == "pm25":
            try:
                pending.add(aware(datetime.fromisoformat(revision["measured_at"])))
            except (ValueError, KeyError, TypeError):
                return reject("SHADOW_PROVIDER_REVISION_INVALID")
    observations = []
    excluded = {"incomplete": 0, "revision_pending": 0}
    for row in raw:
        if utc(row.measured_at) in pending:
            excluded["revision_pending"] += 1
            continue
        if any(
            x in row.quality_flags
            for x in [
                "provider_partial_hour",
                "provider_coverage_unknown",
                "provider_revision_pending",
                "provider_verification_failed",
            ]
        ):
            excluded["incomplete"] += 1
            continue
        if not math.isfinite(row.value) or row.value < 0 or row.unit != "µg/m³":
            return reject("SHADOW_INPUT_INCOMPATIBLE")
        if (
            station.data_mode == "live"
            and row.source.rsplit("; ", 1)[-1] != "https://api.openaq.org/v3/locations/235"
        ):
            return reject("SHADOW_INPUT_SOURCE_MISMATCH")
        observations.append(
            {
                "observation_id": row.id,
                "station_id": run.station_id,
                "measured_at": utc(row.measured_at).isoformat(),
                "available_at": utc(row.available_at).isoformat(),
                "value": row.value,
                "unit": row.unit,
                "source": row.source,
                "quality_flags": row.quality_flags,
            }
        )
    encoded = json.dumps(observations, sort_keys=True, allow_nan=False)
    run.input_sha256 = hashlib.sha256(encoded.encode()).hexdigest()
    run.provenance = {
        **run.provenance,
        "feature_cutoff": feature_cutoff.isoformat(),
        "input_observation_count": len(observations),
        "input_observation_ids": [x["observation_id"] for x in observations],
        "excluded_inputs_as_missing": excluded,
        "pending_revision_timestamps": [x.isoformat() for x in sorted(pending)],
        "provider_sensor_id": 12235610,
    }
    eligible = [
        x
        for x in observations
        if issue - aware(datetime.fromisoformat(x["measured_at"]))
        in [timedelta(hours=3), timedelta(hours=4)]
    ]
    if not eligible:
        return reject("AVAILABILITY_REQUIRED_INPUT_UNAVAILABLE")
    latest = max(eligible, key=lambda x: x["measured_at"])
    run.provenance = {
        **run.provenance,
        "input": latest,
        "latest_input_age_h": (
            issue - aware(datetime.fromisoformat(latest["measured_at"]))
        ).total_seconds()
        / 3600,
    }
    try:
        prediction = availability_prediction(
            get_settings().forecast_registry_root / AVAILABILITY_VERSION, issue, observations
        )
    except ValueError as exc:
        return reject(str(exc))
    points = prediction["points"]
    for horizon, point in enumerate(points, 1):
        try:
            target = aware(datetime.fromisoformat(point["target_at"]))
            value = float(point["concentration"])
            if (
                point["horizon_h"] != horizon
                or target != issue + timedelta(hours=horizon)
                or target <= generated
                or not math.isfinite(value)
                or value < 0
                or point["unit"] != "µg/m³"
            ):
                raise ValueError()
        except (ValueError, TypeError, KeyError):
            return reject("AVAILABILITY_MODEL_OUTPUT_INVALID")
    run.provenance = {
        **run.provenance,
        "prediction_method": "24 separately trained native LightGBM models; simulated3h historical delay, actual-known serving cutoff",
        "model_availability_scenario": prediction.get("availability_scenario"),
    }
    for point in points:
        db.add(
            ShadowPrediction(
                run_id=run.id,
                horizon_h=point["horizon_h"],
                target_at=aware(datetime.fromisoformat(point["target_at"])),
                concentration=point["concentration"],
                unit=point["unit"],
                quality_flags=[
                    "shadow_only",
                    "learned_model",
                    "simulated_historical_publication_delay",
                    "actual_first_seen_cutoff",
                    "no_calibrated_uncertainty",
                ]
                + (
                    ["provider_revision_inputs_excluded_as_missing"]
                    if excluded["revision_pending"]
                    else []
                ),
            )
        )
    run.status = "succeeded"
    run.error_code = None
    return run.id, True
