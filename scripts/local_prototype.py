"""Prepare and supervise the selected local real-data prototype; never print credentials."""

import argparse
import hashlib
import json
import os
import secrets
import signal
import socket
import stat
import subprocess
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

from dev import API_URL, ROOT, WEB_URL, check_ports, start_children, stop_children, wait_ready

WORK = ROOT / "work/prototype"
CONTROL = WORK / "control.sock"
STATE = WORK / "supervisor.json"
TOKEN = WORK / "session.token"
IDENTITY = WORK / "identity.json"
MODELS = (
    "delhi-recorded-pm25-hourly-v2",
    "delhi-openaq-pm25-hourly-v1",
    "delhi-openaq-pm25-delay3h-v2",
)


def configure():
    os.chdir(ROOT)
    WORK.mkdir(parents=True, exist_ok=True)
    os.chmod(WORK, 0o700)
    os.environ.setdefault("DATABASE_URL", f"sqlite:///{ROOT / 'work/delhi-live.db'}")
    os.environ.setdefault("DATA_MODE", "live")
    os.environ.setdefault("WEB_ORIGIN", WEB_URL)
    os.environ.setdefault("UV_CACHE_DIR", str(ROOT / "work/uv-cache"))
    os.environ.setdefault("npm_config_cache", str(ROOT / "work/npm-cache"))


def private_json(path, payload):
    temporary = path.with_suffix(path.suffix + ".tmp")
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    os.fchmod(fd, 0o600)
    with os.fdopen(fd, "w") as stream:
        json.dump(payload, stream)
    temporary.replace(path)


def ensure_identity(db):
    from breathewise.core.auth import provision_session
    from breathewise.core.time import utc
    from breathewise.db.models import SessionToken, User

    previous = None
    if IDENTITY.is_file():
        previous = json.loads(IDENTITY.read_text()).get("user_id")
    if TOKEN.is_file():
        token = TOKEN.read_text().strip()
        row = db.get(SessionToken, hashlib.sha256(token.encode()).hexdigest())
        if (
            row is not None
            and utc(row.expires_at) > datetime.now(UTC)
            and db.get(User, row.user_id)
        ):
            os.chmod(TOKEN, 0o600)
            return row.user_id
    if previous is not None and db.get(User, previous) is None:
        previous = None
    user_id, token = provision_session(db, previous)
    fd = os.open(TOKEN, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    os.fchmod(fd, 0o600)
    with os.fdopen(fd, "w") as stream:
        stream.write(token + "\n")
    private_json(IDENTITY, {"user_id": user_id, "provisioned_at": datetime.now(UTC).isoformat()})
    return user_id


def prepare():
    from alembic import command
    from alembic.config import Config
    from breathewise.core.config import get_settings
    from breathewise.db.models import Observation, Station
    from breathewise.db.session import LATEST_SCHEMA_REVISION, engine
    from breathewise.services.models import experiment_manifest
    from sqlalchemy import func, select
    from sqlalchemy.orm import Session

    settings = get_settings()
    if settings.data_mode != "live":
        raise RuntimeError("This prototype workflow requires explicit DATA_MODE=live")
    archive = settings.archive_root / "data/cleaned/pollutants/Aanad Vihar.parquet"
    if not archive.is_file():
        raise RuntimeError("Configured audited archive source is missing; set ARCHIVE_ROOT locally")
    models = {}
    for version in MODELS:
        if version == "delhi-openaq-pm25-delay3h-v2":
            from breathewise.services.availability_models import manifest as availability_manifest

            folder, manifest = availability_manifest(version)
        else:
            folder, manifest = experiment_manifest(version)
        models[version] = {
            "path": str(folder),
            "dataset_mode": manifest["dataset_mode"],
            "supported_horizons": manifest["supported_horizons"],
            "live_forecast_ready": False,
        }
    command.upgrade(Config(str(ROOT / "alembic.ini")), "head")
    with Session(engine()) as db, db.begin():
        observations = db.scalar(select(func.count()).select_from(Observation))
        stations = db.scalar(
            select(func.count()).select_from(Station).where(Station.data_mode == "live")
        )
        user_id = ensure_identity(db)
    report = {
        "prepared_at": datetime.now(UTC).isoformat(),
        "database_driver": engine().dialect.name,
        "schema_revision": LATEST_SCHEMA_REVISION,
        "data_mode": "live",
        "observation_count": observations,
        "live_station_count": stations,
        "archive_source": str(archive),
        "forecast_registry_root": str(settings.forecast_registry_root),
        "models": models,
        "identity_user_id": user_id,
        "identity_token_file": str(TOKEN),
        "openaq_configured": bool(settings.openaq_api_key.get_secret_value()),
        "api_url": API_URL,
        "web_url": WEB_URL,
        "public_live_forecast_ready": False,
    }
    private_json(WORK / "prepared.json", report)
    return report


def request_control(action):
    if not CONTROL.exists() or not STATE.is_file():
        return None
    state = json.loads(STATE.read_text())
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as sock:
        sock.settimeout(3)
        try:
            sock.connect(str(CONTROL))
        except (ConnectionRefusedError, FileNotFoundError):
            return None
        sock.sendall(json.dumps({"nonce": state["nonce"], "action": action}).encode() + b"\n")
        response = sock.recv(4096)
    return json.loads(response)


def serve():
    if CONTROL.exists():
        raise RuntimeError("Control path already exists; no existing supervisor replaced")
    children = []
    nonce = secrets.token_urlsafe(32)
    stop_requested = False

    def interrupted(*_):
        nonlocal stop_requested
        stop_requested = True

    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    with (
        socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as control,
        (WORK / "server.log").open("a") as log,
    ):
        control.bind(str(CONTROL))
        os.chmod(CONTROL, 0o600)
        control.listen(2)
        control.settimeout(0.5)
        private_json(STATE, {"nonce": nonce, "pid": os.getpid()})
        try:
            children = start_children(output=log)
            wait_ready(children)
            while not stop_requested and all(child.poll() is None for child in children):
                try:
                    connection, _ = control.accept()
                except TimeoutError:
                    continue
                with connection:
                    connection.settimeout(2)
                    try:
                        message = json.loads(connection.recv(4096))
                    except (ValueError, TimeoutError):
                        continue
                    if not isinstance(message, dict):
                        continue
                    if not secrets.compare_digest(str(message.get("nonce", "")), nonce):
                        try:
                            connection.sendall(b'{"status":"unauthorized"}')
                        except OSError:
                            pass
                        continue
                    action = message.get("action")
                    if action == "stop":
                        stop_requested = True
                    result = {
                        "status": "stopping" if stop_requested else "running",
                        "api_url": API_URL,
                        "web_url": WEB_URL,
                        "owned_child_pids": [p.pid for p in children],
                    }
                    try:
                        connection.sendall(json.dumps(result).encode())
                    except OSError:
                        pass
        finally:
            stop_children(children)
            CONTROL.unlink(missing_ok=True)
            STATE.unlink(missing_ok=True)


def start():
    existing = request_control("status")
    if existing is not None:
        if existing.get("status") != "running":
            raise RuntimeError("Existing control endpoint did not authenticate; no process changed")
        return existing
    check_ports()
    if CONTROL.exists():
        if not stat.S_ISSOCK(CONTROL.stat().st_mode):
            raise RuntimeError("Unexpected control path; refusing to replace it")
        CONTROL.unlink()
    prepare()
    with (WORK / "supervisor.log").open("a") as log:
        process = subprocess.Popen(
            [sys.executable, str(Path(__file__).resolve()), "serve"],
            cwd=ROOT,
            env=os.environ.copy(),
            start_new_session=True,
            stdout=log,
            stderr=log,
        )
    for _ in range(350):
        if process.poll() is not None:
            raise RuntimeError("Owned supervisor failed; see work/prototype/supervisor.log")
        try:
            state = request_control("status")
            if state is not None:
                return state
        except (TimeoutError, ConnectionResetError):
            pass
        time.sleep(0.1)
    raise RuntimeError("Supervisor readiness timed out; use stop before retrying")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["prepare", "start", "status", "stop", "serve"])
    args = parser.parse_args()
    configure()
    if args.action == "prepare":
        result = prepare()
    elif args.action == "start":
        result = start()
    elif args.action == "serve":
        serve()
        return 0
    else:
        result = request_control(args.action) or {"status": "not_running"}
        if result.get("status") == "unauthorized":
            raise RuntimeError("Control endpoint did not authenticate; no process changed")
        if args.action == "stop" and result["status"] == "stopping":
            for _ in range(100):
                if not CONTROL.exists():
                    result = {"status": "stopped"}
                    break
                time.sleep(0.1)
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (RuntimeError, OSError, ValueError) as exc:
        print(json.dumps({"status": "unavailable", "message": str(exc)}), file=sys.stderr)
        raise SystemExit(1) from None
