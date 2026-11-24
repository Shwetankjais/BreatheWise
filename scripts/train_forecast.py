"""Train the isolated independent recorded-clock PM2.5 experiment; never enable live inference."""

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/api/src"))
from breathewise.ml.experiment import run_experiment  # noqa: E402

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--source", required=True, type=Path)
parser.add_argument(
    "--output", type=Path, default=ROOT / "work/forecast-experiment/delhi-recorded-pm25-v1"
)
parser.add_argument("--openmp-library", type=Path)
args = parser.parse_args()
if not args.output.resolve().is_relative_to(ROOT / "work/forecast-experiment"):
    parser.error("Model and held-out predictions must remain in ignored work/forecast-experiment")
report = run_experiment(args.source, args.output, openmp_library=args.openmp_library)
print(
    json.dumps(
        {
            "model_version": report["model_version"],
            "horizons": report["supported_horizons"],
            "heldout_rows": report["heldout_predictions"]["rows"],
            "live_forecast_ready": False,
            "output": str(args.output),
        },
        allow_nan=False,
    )
)
