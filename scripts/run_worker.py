"""Run once under a scheduler, or loop explicitly; only one cycle per database."""

import argparse
import json
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path

import httpx
from breathewise.adapters.openaq import OpenAQ, ProviderError
from breathewise.core.config import get_settings
from breathewise.db.session import engine
from breathewise.jobs.cycle import run_cycle
from breathewise.jobs.locking import WorkerBusy
from breathewise.schemas.ingestion import ImportBatch
from sqlalchemy.exc import SQLAlchemyError


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--provider", choices=["none", "canonical", "openaq"], default="none")
    parser.add_argument("--input", type=Path)
    parser.add_argument("--location-id", type=int)
    parser.add_argument("--lookback-hours", type=int, default=72)
    parser.add_argument("--interval-seconds", type=int, default=0)
    args = parser.parse_args()
    if (
        not 1 <= args.lookback_hours <= 168
        or args.interval_seconds not in [0]
        and args.interval_seconds < 300
    ):
        parser.error("lookback must be 1..168h; loop interval must be zero (once) or >=300s")
    if args.provider == "canonical" and not args.input:
        parser.error("canonical requires --input")
    if args.provider == "openaq" and (args.location_id is None or args.location_id <= 0):
        parser.error("OpenAQ requires a verified candidate --location-id")

    def emit(event):
        print(json.dumps(event, allow_nan=False), flush=True)

    with httpx.Client() as client:

        def fetch():
            if args.provider == "canonical":
                batch = ImportBatch.model_validate_json(args.input.read_text())
                return (
                    batch,
                    {"actual_provider_fetch": False, "source": "explicit canonical archive"},
                    [],
                )
            adapter = OpenAQ(get_settings().openaq_api_key.get_secret_value(), client)
            end = datetime.now(UTC)
            batch, details = adapter.fetch_hourly(
                location_id=args.location_id,
                start=end - timedelta(hours=args.lookback_hours),
                end=end,
                mode=get_settings().data_mode,
            )
            return batch, details, adapter.raw_responses

        while True:
            result = run_cycle(
                engine(),
                fetch if args.provider != "none" else None,
                provider=args.provider,
                emit=emit,
            )
            emit(
                {
                    "event": "worker_result",
                    "status": result["status"],
                    "data_mode": result["data_mode"],
                }
            )
            if not args.interval_seconds:
                return 0 if result["status"] == "success" else 1
            time.sleep(args.interval_seconds)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except WorkerBusy:
        raise SystemExit("WORKER_BUSY: overlapping cycle refused") from None
    except ProviderError as exc:
        raise SystemExit(exc.code) from None
    except SQLAlchemyError:
        raise SystemExit("DATABASE_UNAVAILABLE: configure database and apply migrations") from None
    except (ValueError, OSError):
        raise SystemExit(
            "INVALID_INPUT_OR_ARCHIVE: inspect canonical data/configuration; no data inferred"
        ) from None
