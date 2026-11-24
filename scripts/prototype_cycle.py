"""One bounded real-data refresh/alert/learned-shadow cycle; no daemon or fake inputs."""

import argparse
import json
import subprocess
import sys
from datetime import UTC, datetime, timedelta

from breathewise.db.session import engine
from breathewise.jobs.locking import WorkerBusy, cycle_lock
from breathewise.ml.availability_experiment import MODEL_VERSION
from local_prototype import ROOT, configure


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--no-refresh",
        action="store_true",
        help="Use the actual existing cache without provider requests",
    )
    args = parser.parse_args()
    configure()
    try:
        with cycle_lock(engine(), "breathewise-local-prototype-cycle"):
            results = {}
            if not args.no_refresh:
                results["refresh"] = subprocess.run(
                    [
                        sys.executable,
                        str(ROOT / "scripts/refresh_delhi.py"),
                        "--lookback-hours",
                        "24",
                    ],
                    check=False,
                    cwd=ROOT,
                ).returncode
            results["alerts"] = subprocess.run(
                [sys.executable, str(ROOT / "scripts/run_worker.py"), "--provider", "none"],
                check=False,
                cwd=ROOT,
            ).returncode
            # Model issue stays on its declared UTC :30 grid. Actual wall-clock
            # generation/lead time is independently persisted and all targets must
            # remain future. No historical publication or backdated generation.
            now = datetime.now(UTC)
            issue = now.replace(minute=30, second=0, microsecond=0)
            if issue > now:
                issue -= timedelta(hours=1)
            results["learned_shadow"] = subprocess.run(
                [
                    sys.executable,
                    str(ROOT / "scripts/shadow_forecasts.py"),
                    "--station-id",
                    "openaq-235",
                    "--model-version",
                    MODEL_VERSION,
                    "--issue-at",
                    issue.isoformat(),
                    "--input-cutoff",
                    issue.isoformat(),
                ],
                check=False,
                cwd=ROOT,
            ).returncode
            print(
                json.dumps(
                    {
                        "event": "prototype_cycle_finished",
                        "model_version": MODEL_VERSION,
                        "nominal_issue_at": issue.isoformat(),
                        "exit_codes": results,
                        "public_live_forecast_ready": False,
                    }
                ),
                flush=True,
            )
            return 1 if any(results.values()) else 0
    except WorkerBusy:
        print(json.dumps({"event": "prototype_cycle_skipped_overlap"}), flush=True)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
