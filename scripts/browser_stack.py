"""Owned browser-check stack on explicit isolated synthetic data, never live telemetry."""

import json
import os
import signal
import socket
import subprocess
import sys
import time
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]


def main():
    os.chdir(ROOT)
    for port in [8000, 5173]:
        with socket.socket() as sock:
            try:
                sock.bind(("127.0.0.1", port))
            except OSError:
                raise SystemExit(
                    f"Port {port} occupied; refusing to replace another process"
                ) from None
    identity = uuid4().hex
    directory = ROOT / "work" / "browser-stack" / identity
    directory.mkdir(parents=True)
    os.environ["DATABASE_URL"] = f"sqlite:///{directory / 'test.db'}"
    os.environ["DATA_ROOT"] = str(directory / "data")
    os.environ["DATA_MODE"] = "demo"
    os.environ["ARCHIVE_ROOT"] = str(directory / "archive-unavailable")
    os.environ["FORECAST_REGISTRY_ROOT"] = str(directory / "models-unavailable")
    os.environ["ROUTING_BASE_URL"] = ""
    from alembic import command
    from alembic.config import Config
    from breathewise.core.auth import provision_session
    from breathewise.db.session import engine
    from breathewise.schemas.ingestion import ImportBatch
    from breathewise.services.ingestion import import_batch
    from sqlalchemy.orm import Session

    command.upgrade(Config("alembic.ini"), "head")
    batch = ImportBatch.model_validate_json(
        (ROOT / "packages/contracts/fixtures/demo-import.json").read_text()
    )
    with Session(engine()) as db, db.begin():
        import_batch(db, batch)
        stamp = datetime.now(UTC).replace(minute=0, second=0, microsecond=0)
        fresh = batch.model_copy(deep=True)
        fresh.observations[0].measured_at = stamp
        fresh.observations[0].available_at = datetime.now(UTC)
        fresh.observations[0].quality_flags = ["synthetic_browser_fixture"]
        import_batch(db, fresh)
        _, token = provision_session(db)
        _, other = provision_session(db)
    state = ROOT / "work/browser-state.json"
    fd = os.open(state, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    os.fchmod(fd, 0o600)
    with os.fdopen(fd, "w") as out:
        json.dump(
            {
                "token": token,
                "other_token": other,
                "station_id": batch.stations[0].id,
                "data_mode": "demo",
            },
            out,
        )
    children = []

    def stop(*args):
        for child in children:
            if child.poll() is None:
                child.terminate()
        for child in children:
            try:
                child.wait(timeout=5)
            except subprocess.TimeoutExpired:
                child.kill()
        raise SystemExit(0)

    signal.signal(signal.SIGINT, stop)
    signal.signal(signal.SIGTERM, stop)
    try:
        children.append(
            subprocess.Popen(
                [
                    sys.executable,
                    "-m",
                    "uvicorn",
                    "breathewise.main:app",
                    "--host",
                    "127.0.0.1",
                    "--port",
                    "8000",
                ]
            )
        )
        children.append(subprocess.Popen(["npm", "run", "dev", "--workspace", "apps/web"]))
        while all(c.poll() is None for c in children):
            time.sleep(0.3)
    finally:
        stop()


if __name__ == "__main__":
    main()
