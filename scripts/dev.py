"""Own only child processes created here; refuse occupied ports."""

import signal
import socket
import subprocess
import sys
import time
from pathlib import Path

if not Path("apps/web/src/main.tsx").exists():
    raise SystemExit(
        "Frontend source entry pending Antigravity; run uv run uvicorn breathewise.main:app --port 8000 independently"
    )
for port in [8000, 5173]:
    with socket.socket() as sock:
        try:
            sock.bind(("127.0.0.1", port))
        except OSError:
            raise SystemExit(f"Port {port} occupied; no existing process was stopped") from None
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
    sys.exit(0)


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
    while all(child.poll() is None for child in children):
        time.sleep(0.5)
finally:
    stop()
