"""Opt-in API-handler integration against actual configured local artifacts and database."""

import json
from datetime import UTC, datetime

from breathewise.core.config import ROOT
from breathewise.main import app
from fastapi.testclient import TestClient


def main():
    client = TestClient(app)
    checks = []

    def get(path, status=200):
        response = client.get("/api/v1" + path)
        assert response.status_code == status, (path, response.status_code, response.text[:200])
        checks.append({"path": path, "status": status})
        return response.json().get("data")

    registry = get("/models")
    versions = ["delhi-recorded-pm25-hourly-v2", "delhi-openaq-pm25-hourly-v1"]
    summaries = []
    for version in versions:
        row = next(m for m in registry["models"] if m["model_version"] == version)
        assert row["supported_horizons"] == list(range(1, 25))
        assert not row["live_forecast_ready"] and not row["continuous_trajectory_ready"]
        suffix = "utc-" if row["timezone"] == "UTC" else ""
        evaluation = get(f"/models/{version}/{suffix}evaluation")
        assert evaluation["evaluation_cohort"] == "fixed_model_issue_time_purged"
        assert len(evaluation["horizons"]) == 24 and len(evaluation["target_only_horizons"]) == 24
        samples = []
        for h in (1, 2, 24):
            page = get(
                f"/models/{version}/{suffix}predictions?horizon_h={h}&split=test&limit=2&issue_time_purged=true"
            )
            score = evaluation["horizons"][h - 1]["splits"]["test"]
            assert page["evaluation_cohort"] == "fixed_model_issue_time_purged"
            assert page["total_count"] == score["all_available"]["lightgbm"]["count"]
            for point in page["points"]:
                assert point["station_id"] in row["station_ids"]
                assert point["horizon_h"] == h
            samples.append(
                {
                    "horizon_h": h,
                    "rows": page["total_count"],
                    "common_baseline_cohort": score["common_baseline_cohort"],
                    "high_pollution": score["high_pollution_observed_target_ge_150"],
                }
            )
        get(f"/models/{version}/{suffix}predictions?horizon_h=25", 409)
        get(f"/stations/openaq-235/forecast?model_version={version}", 409)
        bad_filter = "2026-07-01T00:00:00" if suffix else "2026-07-01T00:00:00Z"
        get(f"/models/{version}/{suffix}predictions?horizon_h=1&target_start={bad_filter}", 422)
        summaries.append(
            {"model_version": version, "clock_basis": row["clock_basis"], "samples": samples}
        )
    runs = get("/forecast-runs?station_id=openaq-235&limit=100")
    run_summary = []
    for run in runs["runs"]:
        detail = get("/forecast-runs/" + run["id"])
        assert not detail["run"]["public_live_forecast_ready"]
        if run["status"] == "rejected":
            assert not detail["predictions"] and run["error_code"]
        run_summary.append(
            {
                k: run[k]
                for k in [
                    "id",
                    "model_version",
                    "status",
                    "error_code",
                    "prediction_count",
                    "generated_at",
                ]
            }
        )
    caps = get("/capabilities")
    for name in [
        "model_forecast",
        "continuous_hourly_trajectory",
        "calibrated_intervals",
        "spatial_exposure",
    ]:
        assert not caps[name]["supported"]
    report = {
        "verified_at_utc": datetime.now(UTC).isoformat(),
        "scope": "In-process actual FastAPI handlers with configured real local artifacts/observations, no browser or network-provider mock",
        "contract_version": "1.3.0",
        "checks": checks,
        "models": summaries,
        "shadow_runs": run_summary,
        "public_live_forecast_ready": False,
        "activity_planning_ready": False,
    }
    path = ROOT / "work/forecast-milestone-api-evidence.json"
    path.write_text(json.dumps(report, indent=2) + "\n")
    print(
        json.dumps(
            {
                "checks": len(checks),
                "models": versions,
                "shadow_runs": len(run_summary),
                "evidence": str(path),
            }
        )
    )


if __name__ == "__main__":
    main()
