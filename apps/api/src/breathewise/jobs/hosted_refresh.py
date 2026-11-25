"""Refresh the verified Delhi OpenAQ cohort while the hosted API is running."""

import json
import os
import subprocess
import sys
import time

from breathewise.core.config import ROOT, get_settings


def main():
    settings = get_settings()
    if settings.data_mode != "live" or not settings.openaq_api_key.get_secret_value():
        raise SystemExit("Hosted refresh requires DATA_MODE=live and OPENAQ_API_KEY")
    interval = int(os.environ.get("BREATHEWISE_REFRESH_INTERVAL_SECONDS", "3600"))
    if interval < 900:
        raise SystemExit("BREATHEWISE_REFRESH_INTERVAL_SECONDS must be at least 900")

    while True:
        result = subprocess.run(
            [
                sys.executable,
                str(ROOT / "scripts/refresh_delhi.py"),
                "--lookback-hours",
                "24",
                "--overlap-hours",
                "2",
            ],
            cwd=ROOT,
            check=False,
        )
        print(
            json.dumps({"event": "hosted_refresh_finished", "exit_code": result.returncode}),
            flush=True,
        )
        time.sleep(interval)


if __name__ == "__main__":
    main()
