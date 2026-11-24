"""Narrow JSON bridge in the isolated LightGBM runtime; no DB/network/secret access."""

import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/api/src"))
from breathewise.ml.availability_experiment import predict  # noqa:E402

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--model-dir", type=Path, required=True)
parser.add_argument(
    "--openmp-library", type=Path, default=os.environ.get("BREATHEWISE_OPENMP_LIBRARY")
)
args = parser.parse_args()
try:
    raw = sys.stdin.read(2_000_001)
    if len(raw) > 2_000_000:
        raise ValueError("Bounded explicit input required")
    payload = json.loads(raw)
    result = predict(
        args.model_dir,
        payload["issue_at"],
        payload["observations"],
        openmp_library=args.openmp_library,
    )
    print(json.dumps(result, allow_nan=False))
except (ValueError, KeyError, OSError, TypeError):
    print(json.dumps({"error": "AVAILABILITY_PREDICTION_INVALID"}))
    raise SystemExit(1) from None
