"""Local process/identity mechanics; no external processes or credentials inspected."""

import importlib
import os
import socket
import stat
import subprocess
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from breathewise.db.models import SessionToken
from breathewise.db.session import engine
from sqlalchemy import func, select
from sqlalchemy.orm import Session


@pytest.fixture
def ops(monkeypatch):
    scripts = Path(__file__).resolve().parents[3] / "scripts"
    monkeypatch.syspath_prepend(str(scripts))
    return importlib.import_module("local_prototype")


def test_occupied_port_remains_owned_by_its_listener(ops):
    from dev import check_ports

    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        listener.listen(1)
        port = listener.getsockname()[1]
        with pytest.raises(RuntimeError, match="occupied"):
            check_ports((port,))
        with socket.create_connection(("127.0.0.1", port), timeout=1):
            connection, _ = listener.accept()
            connection.close()


def test_shutdown_stops_only_created_process_group(ops):
    from dev import stop_children

    owned = subprocess.Popen(
        [sys.executable, "-c", "import time;time.sleep(60)"], start_new_session=True
    )
    unrelated = subprocess.Popen(
        [sys.executable, "-c", "import time;time.sleep(60)"], start_new_session=True
    )
    try:
        stop_children([owned])
        assert owned.poll() is not None
        assert unrelated.poll() is None
    finally:
        if unrelated.poll() is None:
            os.killpg(unrelated.pid, 15)
        unrelated.wait(timeout=5)


def test_private_identity_reuses_session_then_rotates_expired_for_same_user(
    backend, ops, monkeypatch, tmp_path
):
    monkeypatch.setattr(ops, "TOKEN", tmp_path / "session.token")
    monkeypatch.setattr(ops, "IDENTITY", tmp_path / "identity.json")
    with Session(engine()) as db, db.begin():
        user = ops.ensure_identity(db)
    secret = ops.TOKEN.read_text()
    assert stat.S_IMODE(ops.TOKEN.stat().st_mode) == 0o600
    with Session(engine()) as db, db.begin():
        assert ops.ensure_identity(db) == user
        assert ops.TOKEN.read_text() == secret
        row = db.scalar(select(SessionToken).where(SessionToken.user_id == user))
        row.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    with Session(engine()) as db, db.begin():
        assert ops.ensure_identity(db) == user
        assert (
            db.scalar(
                select(func.count()).select_from(SessionToken).where(SessionToken.user_id == user)
            )
            == 2
        )
    assert ops.TOKEN.read_text() != secret
    assert stat.S_IMODE(ops.IDENTITY.stat().st_mode) == 0o600
