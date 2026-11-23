"""Whole-cycle overlap guard: PostgreSQL session lock, local flock for SQLite."""

import fcntl
import hashlib
from contextlib import contextmanager

from breathewise.core.config import ROOT
from sqlalchemy import text


class WorkerBusy(Exception):
    pass


@contextmanager
def cycle_lock(engine, job="breathewise-ingestion-alerts"):
    key = int.from_bytes(hashlib.sha256(job.encode()).digest()[:8], "big", signed=True)
    if engine.dialect.name == "postgresql":
        with engine.connect() as connection:
            acquired = connection.scalar(text("SELECT pg_try_advisory_lock(:key)"), {"key": key})
            if not acquired:
                raise WorkerBusy("another worker owns the cycle")
            try:
                yield
            finally:
                connection.execute(text("SELECT pg_advisory_unlock(:key)"), {"key": key})
                connection.commit()
    else:
        directory = ROOT / "work/locks"
        directory.mkdir(parents=True, exist_ok=True)
        identity = hashlib.sha256((str(engine.url) + job).encode()).hexdigest()
        with (directory / (identity + ".lock")).open("a") as stream:
            try:
                fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise WorkerBusy("another local worker owns the cycle") from None
            try:
                yield
            finally:
                fcntl.flock(stream.fileno(), fcntl.LOCK_UN)
