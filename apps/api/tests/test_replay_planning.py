"""Forecast-only replay ranking mechanics, including deliberately hostile outcomes."""

import csv
import hashlib
from datetime import UTC, datetime, timedelta

import pytest
from breathewise.core.errors import ServiceError
from breathewise.ml.experiment import HOURLY_MODEL_VERSION
from breathewise.ml.utc_experiment import UTC_MODEL_VERSION
from breathewise.schemas.replay_planning import ReplayPlanRequest
from breathewise.services import replay_planning as service
from pydantic import ValidationError


@pytest.fixture(params=[False, True], ids=["recorded_clock", "UTC"])
def trajectory(request, tmp_path, monkeypatch):
    is_utc = request.param
    version = UTC_MODEL_VERSION if is_utc else HOURLY_MODEL_VERSION
    issue = datetime(2026, 7, 2, 0, 30 if is_utc else 0, tzinfo=UTC if is_utc else None)
    station = "openaq-235" if is_utc else "site_301"
    fields = [
        "model_version",
        "station_id",
        "pollutant",
        "split",
        "horizon_h",
        "issue_at_utc" if is_utc else "issue_at_recorded",
        "target_at_utc" if is_utc else "target_at_recorded",
        "lightgbm",
        "observed",
    ]
    rows = [
        [
            version,
            station,
            "pm25",
            "test",
            h,
            issue.isoformat(),
            (issue + timedelta(hours=h)).isoformat(),
            0 if h in (2, 3) else float(h),
            9999999 - h,
        ]
        for h in range(1, 25)
    ]
    manifest = {
        "model_version": version,
        "dataset_mode": "utc_provider_history" if is_utc else "recorded_clock",
        "supported_horizons": list(range(1, 25)),
        "target_unit": "µg/m³",
        "source_station_ids": [station],
        "protocol": {
            "splits": {
                "train": [
                    "2025-01-01T00:00:00" + ("+00:00" if is_utc else ""),
                    "2026-01-01T00:00:00" + ("+00:00" if is_utc else ""),
                ],
                "validation": [
                    "2026-01-01T00:00:00" + ("+00:00" if is_utc else ""),
                    "2026-07-01T00:00:00" + ("+00:00" if is_utc else ""),
                ],
                "test": [
                    "2026-07-01T00:00:00" + ("+00:00" if is_utc else ""),
                    "2026-11-01T00:00:00" + ("+00:00" if is_utc else ""),
                ],
            },
            "rolling_backtests": [],
        },
    }

    def save():
        path = tmp_path / "predictions.csv"
        with path.open("w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(fields)
            writer.writerows(rows)
        manifest["heldout_predictions"] = {
            "path": path.name,
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        }

    save()
    monkeypatch.setattr(service, "experiment_manifest", lambda requested: (tmp_path, manifest))
    yield {
        "version": version,
        "issue": issue,
        "station": station,
        "rows": rows,
        "save": save,
        "manifest": manifest,
        "is_utc": is_utc,
        "fields": fields,
    }


def body(t, **kwargs):
    return ReplayPlanRequest(
        model_version=t["version"], issue_at=t["issue"], duration_minutes=120, **kwargs
    )


def test_rankings_use_one_issue_complete_forecasts_and_not_outcomes(trajectory):
    t = trajectory
    result = service.plan(body(t))
    assert result.status == "available" and result.coverage_hours == 24
    assert result.windows[0].start_horizon_h == 1 and result.windows[0].end_horizon_h == 3
    assert result.windows[0].concentration_time == 0
    assert result.windows[0].ranking_score == 0
    assert result.windows[0].concentration_time_unit == "µg·h/m³"
    assert (
        not result.target_observations_used_for_ranking and not result.public_future_planning_ready
    )
    before = result.model_dump()
    for row in t["rows"]:
        row[-1] = -1e99 if row[4] % 2 else 1e99
    t["save"]()
    after = service.plan(body(t)).model_dump()
    assert after.pop("forecast_artifact_sha256") != before.pop("forecast_artifact_sha256")
    assert after == before
    page = service.issues(t["version"], limit=1)
    assert page.total_count == 1 and page.issues[0].issue_at == t["issue"].isoformat()
    assert page.clock_basis == (
        "UTC_hour_ending" if t["is_utc"] else "source_naive_clock_unverified"
    )


def test_complete_hours_are_mandatory_and_mixed_issues_are_never_filled(trajectory):
    t = trajectory
    t["rows"][-1][5] = (t["issue"] + timedelta(hours=1)).isoformat()
    t["save"]()
    result = service.plan(body(t))
    assert result.status == "unavailable" and result.code == "TRAJECTORY_INCOMPLETE"
    assert result.coverage_hours == 23 and not result.windows and not result.trajectory
    assert service.issues(t["version"]).total_count == 0


@pytest.mark.parametrize(
    "mutation,expected",
    [
        ("duplicate", "TRAJECTORY_DUPLICATE_OR_MIXED"),
        ("wrong_target", "TRAJECTORY_TARGET_MISALIGNED"),
        ("wrong_version", "TRAJECTORY_IDENTITY_MISMATCH"),
        ("wrong_station", "TRAJECTORY_IDENTITY_MISMATCH"),
        ("negative", "TRAJECTORY_INVALID_CONCENTRATION"),
        ("missing", "TRAJECTORY_INVALID_CONCENTRATION"),
    ],
)
def test_trajectory_integrity_failures_are_usefully_unavailable(trajectory, mutation, expected):
    t = trajectory
    row = t["rows"][-1]
    if mutation == "duplicate":
        row[4] = 23
    elif mutation == "wrong_target":
        row[6] = (t["issue"] + timedelta(hours=25)).isoformat()
    elif mutation == "wrong_version":
        row[0] = "some-other-version"
    elif mutation == "wrong_station":
        row[1] = "some-other-station"
    elif mutation == "negative":
        row[7] = -1
    elif mutation == "missing":
        row[7] = ""
    t["save"]()
    result = service.plan(body(t))
    assert result.status == "unavailable" and result.code == expected and not result.windows
    assert service.issues(t["version"]).total_count == 0


def test_sensitivity_peak_penalty_and_no_suitable_window_are_explicit(trajectory):
    t = trajectory
    # Compare two-hour windows [0,12] and [7,7]: raw totals12 vs14;
    # explicit peak penalty gives18 vs17.5 and reverses the preference.
    t["rows"][0][7] = 0
    t["rows"][1][7] = 12
    t["rows"][2][7] = 7
    t["rows"][3][7] = 7
    t["save"]()
    general = service.plan(body(t, earliest_start_h=0, latest_end_h=4))
    sensitive = service.plan(body(t, earliest_start_h=0, latest_end_h=4, sensitivity="sensitive"))
    assert general.windows[0].start_horizon_h == 0
    assert sensitive.windows[0].start_horizon_h == 2
    assert sensitive.windows[0].ranking_score == 17.5
    no_window = service.plan(body(t, max_window_mean_ugm3=0))
    assert (
        no_window.status == "no_suitable_window"
        and no_window.eligible_count == 0
        and not no_window.windows
    )
    too_long = service.plan(body(t, earliest_start_h=23, latest_end_h=24))
    assert too_long.status == "no_suitable_window" and too_long.candidate_count == 0


def test_issue_clock_and_model_fit_cutoff_are_not_silently_changed(trajectory):
    t = trajectory
    bad = t["issue"].replace(tzinfo=None if t["is_utc"] else UTC)
    with pytest.raises(ServiceError) as exc:
        service.plan(
            ReplayPlanRequest(model_version=t["version"], issue_at=bad, duration_minutes=60)
        )
    assert exc.value.status == 422
    old = datetime(2026, 6, 30, 0, 30 if t["is_utc"] else 0, tzinfo=UTC if t["is_utc"] else None)
    r = service.plan(
        ReplayPlanRequest(model_version=t["version"], issue_at=old, duration_minutes=60)
    )
    assert r.code == "ISSUE_BEFORE_MODEL_FIT_CUTOFF" and not r.windows
    assert service.issues(t["version"]).total_count == 1
    with pytest.raises(ServiceError):
        service.issues(t["version"], split="train")


def test_unsupported_models_and_non_hourly_durations_are_rejected():
    with pytest.raises(ServiceError) as exc:
        service.issues("supplied-native-75-v1")
    assert exc.value.status == 409
    with pytest.raises(ServiceError):
        service.issues("delhi-recorded-pm25-v1")
    for duration in [0, 30, 90, 1441]:
        with pytest.raises(ValidationError):
            ReplayPlanRequest(
                model_version=HOURLY_MODEL_VERSION,
                issue_at="2026-07-01T00:00:00",
                duration_minutes=duration,
            )
