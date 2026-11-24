"""Scheduled single-pass UTC shadow baseline batch plus exact observed-outcome matching."""

import argparse
import json
from datetime import datetime

from breathewise.db.models import ForecastRun
from breathewise.db.session import engine
from breathewise.jobs.locking import WorkerBusy
from breathewise.services.shadow import BASELINE_VERSION, reconcile_shadow, run_shadow
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session


def timestamp(raw):
    result = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    if result.tzinfo is None or result.utcoffset() is None:
        raise argparse.ArgumentTypeError("Explicit timezone required")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--station-id", action="append", default=[])
    parser.add_argument("--model-version", default=BASELINE_VERSION)
    parser.add_argument("--issue-at", type=timestamp)
    parser.add_argument("--input-cutoff", type=timestamp)
    parser.add_argument("--reconcile-only", action="store_true")
    args = parser.parse_args()
    if not args.reconcile_only and (
        not args.station_id or args.issue_at is None or args.input_cutoff is None
    ):
        parser.error(
            "Generation requires --station-id (repeatable), --issue-at and --input-cutoff; no implicit past issuance"
        )
    if len(args.station_id) > 10:
        parser.error("At most ten stations per bounded batch")
    try:
        results = []
        for station in sorted(set(args.station_id)) if not args.reconcile_only else []:
            run_id, created = run_shadow(
                engine(), station, args.model_version, args.issue_at, args.input_cutoff
            )
            with Session(engine()) as db:
                row = db.get(ForecastRun, run_id)
                results.append(
                    {
                        "station_id": station,
                        "run_id": run_id,
                        "created": created,
                        "status": row.status,
                        "error_code": row.error_code,
                    }
                )
        matched = reconcile_shadow(engine())
        print(
            json.dumps(
                {
                    "operation": "shadow",
                    "runs": results,
                    "newly_matched_outcomes": matched,
                    "public_live_forecast_ready": False,
                }
            )
        )
    except WorkerBusy:
        print(json.dumps({"status": "skipped_overlap", "operation": "shadow"}))
        return 2
    except SQLAlchemyError:
        print(json.dumps({"status": "database_unavailable", "operation": "shadow"}))
        return 1
    return 1 if any(row["status"] == "rejected" for row in results) else 0


if __name__ == "__main__":
    raise SystemExit(main())
