"""Own only child process groups created here; refuse occupied documented ports."""

import os
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
API_URL = "http://127.0.0.1:8000"
WEB_URL = "http://127.0.0.1:5173"


def check_ports(ports=(8000, 5173)):
    for port in ports:
        with socket.socket() as sock:
            try:
                sock.bind(("127.0.0.1", port))
            except OSError:
                raise RuntimeError(
                    f"Port {port} occupied; no existing process was stopped"
                ) from None


def start_children(*, output=None):
    if not (ROOT / "apps/web/src/main.tsx").is_file():
        raise RuntimeError("Frontend source entry unavailable")
    check_ports()
    commands = [
        [
            sys.executable,
            "-m",
            "uvicorn",
            "breathewise.main:app",
            "--host",
            "127.0.0.1",
            "--port",
            "8000",
        ],
        [
            "npm",
            "run",
            "dev",
            "--workspace",
            "apps/web",
            "--",
            "--host",
            "127.0.0.1",
            "--port",
            "5173",
            "--strictPort",
        ],
    ]
    children = []
    try:
        for cmd in commands:
            children.append(
                subprocess.Popen(
                    cmd, cwd=ROOT, stdout=output, stderr=output, start_new_session=True
                )
            )
        return children
    except BaseException:
        stop_children(children)
        raise


def stop_children(children):
    # Never address a PID not created by start_children in this supervisor.
    for child in children:
        try:
            os.killpg(child.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
    for child in children:
        try:
            child.wait(timeout=5)
        except subprocess.TimeoutExpired:
            pass
        # A shell/npm leader can exit before a descendant. The process group was
        # created exclusively for this owned child, so clean up that group too.
        try:
            os.killpg(child.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        child.wait(timeout=5)


def wait_ready(children, timeout=30):
    deadline = time.monotonic() + timeout
    with httpx.Client(timeout=1, trust_env=False) as client:
        while time.monotonic() < deadline:
            if any(p.poll() is not None for p in children):
                raise RuntimeError("Owned API/web process exited before readiness")
            try:
                if (
                    client.get(API_URL + "/api/v1/health").status_code == 200
                    and client.get(WEB_URL).status_code == 200
                ):
                    return
            except httpx.HTTPError:
                pass
            time.sleep(0.1)
    raise RuntimeError("Owned API/web stack did not become ready within30seconds")


def main():
    children = []

    def interrupted(*_):
        raise KeyboardInterrupt

    signal.signal(signal.SIGINT, interrupted)
    signal.signal(signal.SIGTERM, interrupted)
    try:
        children = start_children()
        wait_ready(children)
        print(f"BreatheWise localhost ready: {WEB_URL} (API {API_URL}/docs)", flush=True)
        while all(p.poll() is None for p in children):
            time.sleep(0.5)
    except KeyboardInterrupt:
        return 0
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    finally:
        stop_children(children)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
