"""Single-issue historical forecast concentration-time comparison, without outcomes."""

import math
from datetime import UTC, datetime, timedelta

import duckdb
from breathewise.core.errors import ServiceError
from breathewise.ml.experiment import HOURLY_MODEL_VERSION, checked_artifact
from breathewise.ml.utc_experiment import UTC_MODEL_VERSION
from breathewise.schemas.replay_planning import (
    ReplayIssue,
    ReplayIssuePage,
    ReplayPlan,
    ReplayPlanRequest,
    ReplayTrajectoryPoint,
    ReplayWindow,
)
from breathewise.services.models import experiment_manifest, issue_cutoff

SUPPORTED_MODELS = {HOURLY_MODEL_VERSION, UTC_MODEL_VERSION}
LIMITATIONS = [
    "Historical forecast exposure comparison only; not current safe-time, medical or inhaled-dose advice.",
    "Historical publication/input availability is unknown; retrospective feature-availability assumptions remain.",
    "One model, one issue, one station and all24 actual forecast hours are required; no gap interpolation.",
    "Recorded-clock durations are source-clock steps; absolute timezone/interval alignment remains unverified.",
    "Mean concentration ceilings and sensitivity scoring are engineering preferences, not health safety limits.",
]
METHOD = "Sum of selected forecast hourly concentrations multiplied by1hour, treating each target h as the preceding source-clock hour; no observations, interpolation or mixed issues"
RULES = {
    "general": "ranking_score = concentration_time",
    "sensitive": "ranking_score = concentration_time + 0.25 * peak_concentration * duration_hours; engineering peak-aversion preference, not clinical risk",
}


def clock_context(m):
    is_utc = m["dataset_mode"] == "utc_provider_history"
    return {
        "dataset_mode": m["dataset_mode"],
        "clock_basis": "UTC_hour_ending" if is_utc else "source_naive_clock_unverified",
        "timezone": "UTC" if is_utc else None,
        "forecast_artifact_sha256": m["heldout_predictions"]["sha256"],
        "source_dataset_sha256": m.get("dataset_sha256"),
    }


def manifest(version, split):
    if version not in SUPPORTED_MODELS:
        raise ServiceError(
            409,
            "REPLAY_MODEL_UNSUPPORTED",
            "Select a registered complete-hourly retrospective model",
        )
    folder, m = experiment_manifest(version)
    if m["supported_horizons"] != list(range(1, 25)) or m["target_unit"] != "µg/m³":
        raise ServiceError(
            409,
            "REPLAY_TRAJECTORY_UNSUPPORTED",
            "Replay needs24 trained PM2.5 hourly horizons in compatible units",
        )
    valid = {"validation", "test", *(x["name"] for x in m["protocol"].get("rolling_backtests", []))}
    if split not in valid:
        raise ServiceError(
            422, "INVALID_REPLAY_SPLIT", "Choose a split from this model's evaluation metadata"
        )
    return folder, m


def parse_issue(value, m):
    is_utc = m["dataset_mode"] == "utc_provider_history"
    if is_utc:
        if value.tzinfo is None or value.utcoffset() != timedelta(0):
            raise ServiceError(
                422, "UTC_CLOCK_REQUIRED", "Use an explicit UTC issue timestamp for this model"
            )
        return value.astimezone(UTC)
    if value.tzinfo is not None:
        raise ServiceError(
            422, "RECORDED_CLOCK_REQUIRED", "Use the naive recorded issue clock; do not assign UTC"
        )
    return value


def stamp(value, is_utc):
    result = datetime.fromisoformat(str(value))
    return result.astimezone(UTC).isoformat() if is_utc else result.isoformat()


def query_context(folder, m):
    path = checked_artifact(folder, m["heldout_predictions"])
    is_utc = m["dataset_mode"] == "utc_provider_history"
    suffix = "utc" if is_utc else "recorded"
    return (
        path,
        is_utc,
        f"issue_at_{suffix}",
        f"target_at_{suffix}",
        "TIMESTAMPTZ" if is_utc else "TIMESTAMP",
    )


def issues(version, split="test", limit=25, offset=0):
    folder, m = manifest(version, split)
    path, is_utc, issue_col, target_col, cast = query_context(folder, m)
    # Outcomes are deliberately absent from both projection and predicates.
    grouped = f"""
        SELECT station_id,{issue_col} AS issue_clock
        FROM read_csv(?,nullstr='')
        WHERE model_version=? AND pollutant='pm25' AND split=?
          AND station_id=? AND {issue_col}>=?::{cast}
        GROUP BY station_id,{issue_col}
        HAVING count(*)=24 AND count(DISTINCT horizon_h)=24
           AND min(horizon_h)=1 AND max(horizon_h)=24
           AND bool_and(coalesce(isfinite(try_cast(lightgbm AS DOUBLE)) AND try_cast(lightgbm AS DOUBLE)>=0,false))
           AND bool_and(epoch({target_col}-{issue_col})=horizon_h*3600)
    """
    params = [str(path), version, split, m["source_station_ids"][0], issue_cutoff(m, split)]
    try:
        with duckdb.connect() as connection:
            connection.execute("SET threads=2")
            connection.execute("SET TimeZone='UTC'")
            total = connection.execute(f"SELECT count(*) FROM ({grouped})", params).fetchone()[0]
            rows = connection.execute(
                f"SELECT station_id,issue_clock::VARCHAR FROM ({grouped}) ORDER BY issue_clock,station_id LIMIT ? OFFSET ?",
                [*params, limit, offset],
            ).fetchall()
    except duckdb.Error:
        raise ServiceError(
            503, "REPLAY_DATA_UNAVAILABLE", "Registered historical trajectories cannot be queried"
        ) from None
    return ReplayIssuePage(
        model_version=version,
        split=split,
        limit=limit,
        offset=offset,
        total_count=total,
        issues=[
            ReplayIssue(station_id=station, issue_at=stamp(issue, is_utc), split=split)
            for station, issue in rows
        ],
        limitations=LIMITATIONS,
        **clock_context(m),
    )


def plan(request: ReplayPlanRequest):
    folder, m = manifest(request.model_version, request.split)
    issue = parse_issue(request.issue_at, m)
    path, is_utc, issue_col, target_col, cast = query_context(folder, m)
    base = {
        "model_version": request.model_version,
        "issue_at": issue.isoformat(),
        "split": request.split,
        "duration_minutes": request.duration_minutes,
        "sensitivity": request.sensitivity,
        "sensitivity_rule": RULES[request.sensitivity],
        "max_window_mean_ugm3": request.max_window_mean_ugm3,
        "method": METHOD,
        "limitations": LIMITATIONS,
        **clock_context(m),
    }
    cutoff = datetime.fromisoformat(issue_cutoff(m, request.split))
    if issue < cutoff:
        return ReplayPlan(
            status="unavailable",
            code="ISSUE_BEFORE_MODEL_FIT_CUTOFF",
            message="This issue precedes the fixed-model fit/selection cutoff; choose an issue from replay-issues",
            coverage_hours=0,
            **base,
        )
    try:
        with duckdb.connect() as connection:
            connection.execute("SET threads=2")
            connection.execute("SET TimeZone='UTC'")
            rows = connection.execute(
                f"SELECT model_version,station_id,horizon_h,{target_col}::VARCHAR,lightgbm FROM read_csv(?,nullstr='') WHERE {issue_col}=?::{cast} AND split=? AND pollutant='pm25' ORDER BY horizon_h LIMIT 49",
                [str(path), issue.isoformat(), request.split],
            ).fetchall()
    except duckdb.Error:
        raise ServiceError(
            503, "REPLAY_DATA_UNAVAILABLE", "Registered historical trajectory cannot be queried"
        ) from None
    points = []
    seen = set()
    reason = None
    station_id = None
    for version, station, horizon, target_raw, value in rows:
        if version != request.model_version or station not in m["source_station_ids"]:
            reason = "TRAJECTORY_IDENTITY_MISMATCH"
            break
        if station_id is None:
            station_id = station
        if (
            station != station_id
            or type(horizon) is not int
            or horizon not in range(1, 25)
            or horizon in seen
        ):
            reason = "TRAJECTORY_DUPLICATE_OR_MIXED"
            break
        try:
            target = datetime.fromisoformat(target_raw)
        except (TypeError, ValueError):
            reason = "TRAJECTORY_TARGET_MISALIGNED"
            break
        if target != issue + timedelta(hours=horizon):
            reason = "TRAJECTORY_TARGET_MISALIGNED"
            break
        if type(value) not in {int, float} or not math.isfinite(value) or value < 0:
            reason = "TRAJECTORY_INVALID_CONCENTRATION"
            break
        seen.add(horizon)
        points.append(
            ReplayTrajectoryPoint(
                horizon_h=horizon,
                interval_start_at=(issue + timedelta(hours=horizon - 1)).isoformat(),
                interval_end_at=target.isoformat(),
                concentration=value,
            )
        )
    if reason or len(points) != 24 or seen != set(range(1, 25)):
        return ReplayPlan(
            status="unavailable",
            code=reason or "TRAJECTORY_INCOMPLETE",
            message="A complete validated24-hour forecast from this exact issue/model/station is unavailable; no missing hours were filled",
            station_id=station_id,
            coverage_hours=len(points),
            **base,
        )
    points.sort(key=lambda x: x.horizon_h)
    duration = request.duration_minutes // 60
    candidates = []
    for start in range(request.earliest_start_h, request.latest_end_h - duration + 1):
        selected = points[start : start + duration]
        total = math.fsum(p.concentration for p in selected)
        peak = max(p.concentration for p in selected)
        mean = total / duration
        score = total + (0.25 * peak * duration if request.sensitivity == "sensitive" else 0)
        candidates.append((score, start, total, mean, peak))
    eligible = [
        x
        for x in candidates
        if request.max_window_mean_ugm3 is None or x[3] <= request.max_window_mean_ugm3
    ]
    eligible.sort(key=lambda x: (x[0], x[1]))
    windows = [
        ReplayWindow(
            rank=i,
            start_horizon_h=start,
            end_horizon_h=start + duration,
            start_at=(issue + timedelta(hours=start)).isoformat(),
            end_at=(issue + timedelta(hours=start + duration)).isoformat(),
            duration_minutes=request.duration_minutes,
            concentration_time=total,
            mean_concentration=mean,
            peak_concentration=peak,
            ranking_score=score,
        )
        for i, (score, start, total, mean, peak) in enumerate(eligible[: request.limit], 1)
    ]
    return ReplayPlan(
        status="available" if windows else "no_suitable_window",
        code="REPLAY_WINDOWS_RANKED" if windows else "NO_WINDOW_MEETS_CRITERIA",
        message="Historical forecast-only windows ranked"
        if windows
        else "No complete window meets the requested duration/bounds and optional caller ceiling; this is not a health safety threshold",
        station_id=station_id,
        coverage_hours=24,
        candidate_count=len(candidates),
        eligible_count=len(eligible),
        trajectory=points,
        windows=windows,
        **base,
    )
