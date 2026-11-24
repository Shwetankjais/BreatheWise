"""Train the separate UTC-native, retrospective-only OpenAQ PM2.5 experiment."""

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/api/src"))
from breathewise.ml.utc_experiment import UTC_MODEL_VERSION, run_utc_experiment  # noqa:E402

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--source", required=True, type=Path)
parser.add_argument(
    "--output", type=Path, default=ROOT / "work/forecast-experiment" / UTC_MODEL_VERSION
)
parser.add_argument("--openmp-library", type=Path)
args = parser.parse_args()
if not args.output.resolve().is_relative_to(ROOT / "work/forecast-experiment"):
    parser.error("UTC model artifacts must remain in ignored work/forecast-experiment")
m = run_utc_experiment(args.source, args.output, openmp_library=args.openmp_library)
print(
    json.dumps(
        {
            "model_version": m["model_version"],
            "horizons": m["supported_horizons"],
            "heldout_rows": m["heldout_predictions"]["rows"],
            "live_forecast_ready": False,
        }
    )
)
