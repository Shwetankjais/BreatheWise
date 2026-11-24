"""Offline v5 diagnostic prediction from a complete caller-supplied JSON row.

Run with tools/model-v5/.venv/bin/python. This never loads joblib into the API.
"""

import argparse
import ctypes
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "apps/api/src"))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, default=ROOT / "docs/MODEL_V5_MANIFEST.json")
    parser.add_argument("--native-dir", type=Path, default=ROOT / "work/model-v5/extracted")
    parser.add_argument("--openmp-library", type=Path)
    args = parser.parse_args()
    if args.openmp_library:
        ctypes.CDLL(str(args.openmp_library.resolve(strict=True)), mode=ctypes.RTLD_GLOBAL)
    from breathewise.ml.v5 import predict_explicit

    result = predict_explicit(json.loads(args.input.read_text()), args.manifest, args.native_dir)
    print(json.dumps(result, indent=2, allow_nan=False))


if __name__ == "__main__":
    main()
