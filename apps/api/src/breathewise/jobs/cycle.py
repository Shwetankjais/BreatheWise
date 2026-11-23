"""Repeatable ingestion + independent in-app alert evaluation with safe retry logs."""

import time
from datetime import UTC, datetime
from uuid import uuid4

from breathewise.adapters.openaq import ProviderError
from breathewise.core.config import get_settings
from breathewise.db.models import IngestionRun
from breathewise.jobs.locking import cycle_lock
from breathewise.services.alerts import evaluate
from breathewise.services.imports import archive_and_import, archive_provider, retain_first_seen
from sqlalchemy.orm import Session


def run_cycle(
    engine, fetch=None, *, provider="none", retries=3, sleep=time.sleep, emit=lambda event: None
):
    if type(retries) is not int or not 1 <= retries <= 5:
        raise ValueError("Retry count must be 1..5")
    with cycle_lock(engine):
        status = "success"
        ingest_result = None
        if fetch is not None:
            for attempt in range(1, retries + 1):
                began = datetime.now(UTC)
                identity = str(uuid4())
                try:
                    batch, details, raw = fetch()
                    raw_hash = archive_provider(raw) if raw else None
                    with Session(engine) as db, db.begin():
                        if provider == "openaq":
                            retain_first_seen(db, batch)
                        ingest_result = archive_and_import(db, batch)
                        details = details | {
                            "inserted": ingest_result["inserted"],
                            "provider_archive_sha256": raw_hash,
                            "attempt": attempt,
                        }
                        state = "partial" if any(details.get("skipped", {}).values()) else "success"
                        db.add(
                            IngestionRun(
                                id=identity,
                                provider=provider,
                                data_mode=batch.data_mode,
                                status=state,
                                started_at=began,
                                finished_at=datetime.now(UTC),
                                details=details,
                            )
                        )
                    emit(
                        {
                            "event": "ingestion_finished",
                            "run_id": identity,
                            "status": state,
                            "inserted": ingest_result["inserted"],
                            "attempt": attempt,
                        }
                    )
                    if state == "partial":
                        status = "partial"
                    break
                except (ProviderError, ValueError) as exc:
                    code = (
                        exc.code
                        if isinstance(exc, ProviderError)
                        else "INGESTION_VALIDATION_FAILED"
                    )
                    retryable = exc.retryable if isinstance(exc, ProviderError) else False
                    with Session(engine) as db, db.begin():
                        db.add(
                            IngestionRun(
                                id=identity,
                                provider=provider,
                                data_mode=get_settings().data_mode,
                                status="failed",
                                started_at=began,
                                finished_at=datetime.now(UTC),
                                details={
                                    "error_code": code,
                                    "retryable": retryable,
                                    "attempt": attempt,
                                },
                            )
                        )
                    emit(
                        {
                            "event": "ingestion_failed",
                            "run_id": identity,
                            "code": code,
                            "retryable": retryable,
                            "attempt": attempt,
                        }
                    )
                    if not retryable or attempt == retries or code == "OPENAQ_RATE_LIMITED":
                        status = "partial"
                        break
                    sleep(min(2**attempt, 30))
        # Provider failure does not suppress independently eligible alert work.
        with Session(engine) as db, db.begin():
            alerts = evaluate(db)
        result = {
            "status": status,
            "provider": provider,
            "data_mode": get_settings().data_mode,
            "ingestion": ingest_result,
            "alerts": alerts,
            "model_inference": "unavailable",
        }
        emit({"event": "cycle_finished", "status": status, "alerts_created": alerts["created"]})
        return result
