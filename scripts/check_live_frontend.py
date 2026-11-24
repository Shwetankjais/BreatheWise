"""Opt-in real-asset UI verification on owned local ports; preserves other processes."""

import os
import socket
import subprocess
import sys
import time

import httpx
from breathewise.core.config import ROOT


def main():
    os.chdir(ROOT)
    for port in [8101, 5175]:
        with socket.socket() as sock:
            try:
                sock.bind(("127.0.0.1", port))
            except OSError:
                raise SystemExit(f"Port{port} occupied; no existing process touched") from None
    if not (ROOT / "work/frozen-frontend-1.2.json").exists():
        raise SystemExit("Record the acknowledged ready-path SHA256 snapshot before testing")
    children = []
    with (ROOT / "work/live-frontend-stack.log").open("w") as log:
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
                        "8101",
                    ],
                    stdout=log,
                    stderr=log,
                )
            )
            children.append(
                subprocess.Popen(
                    ["npm", "run", "dev", "--workspace", "apps/web", "--", "--port", "5175"],
                    stdout=log,
                    stderr=log,
                )
            )
            for _ in range(150):
                try:
                    if (
                        httpx.get("http://127.0.0.1:5175").status_code == 200
                        and httpx.get("http://127.0.0.1:8101/api/v1/health").status_code == 200
                    ):
                        break
                except httpx.HTTPError:
                    pass
                time.sleep(0.1)
            else:
                raise SystemExit("Owned API/frontend stack unavailable")
            return subprocess.run(
                ["node", "tools/browser-tests/live/features.mjs"], check=False
            ).returncode
        finally:
            for child in children:
                if child.poll() is None:
                    child.terminate()
            for child in children:
                try:
                    child.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    child.kill()
                    child.wait(timeout=5)


if __name__ == "__main__":
    raise SystemExit(main())
