"""Train a separate availability-aware UTC experiment without replacing existing models."""

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/api/src"))
from breathewise.ml.availability_experiment import MODEL_VERSION, run_experiment  # noqa:E402

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument(
    "--source", type=Path, default=ROOT / "work/utc-history/openaq-235/observations.csv"
)
parser.add_argument(
    "--output", type=Path, default=ROOT / "work/forecast-experiment" / MODEL_VERSION
)
parser.add_argument("--openmp-library", type=Path)
args = parser.parse_args()
if not args.output.resolve().is_relative_to(ROOT / "work/forecast-experiment"):
    parser.error("Artifacts must remain in ignored work/forecast-experiment")
m = run_experiment(args.source, args.output, openmp_library=args.openmp_library)
print(
    json.dumps(
        {
            "model_version": MODEL_VERSION,
            "heldout_rows": m["heldout_predictions"]["rows"],
            "scenario": "simulated3h_not_observed_publication",
            "live_forecast_ready": False,
        }
    )
)
