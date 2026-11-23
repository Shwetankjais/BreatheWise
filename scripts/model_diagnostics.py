"""Offline CLI only. Optional native runtime is isolated from the running API."""

import argparse
import ctypes
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/api/src"))

from breathewise.ml.diagnostics import numeric_probe, run_diagnostics  # noqa: E402
from breathewise.ml.recovery import recover_artifact  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["recover", "predict", "probe", "check"])
    parser.add_argument(
        "--artifact",
        choices=["zero_input_aq_weather_model.joblib", "full_aq_pipeline.joblib"],
        default="zero_input_aq_weather_model.joblib",
    )
    parser.add_argument("--input", type=Path)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "work/model-recovery")
    parser.add_argument(
        "--openmp-library",
        type=Path,
        help="Explicit existing libomp.dylib for macOS; no global installation or patching",
    )
    args = parser.parse_args()
    if args.command == "check":
        if args.openmp_library:
            ctypes.CDLL(str(args.openmp_library.resolve(strict=True)), mode=ctypes.RTLD_GLOBAL)
        import pytest

        raise SystemExit(
            pytest.main(
                [
                    "-q",
                    "-c",
                    str(ROOT / "tools/model-diagnostics/pytest.ini"),
                    str(ROOT / "tools/model-diagnostics/tests"),
                ]
            )
        )
    model = recover_artifact(
        ROOT / "artifacts/models" / args.artifact, ROOT / "docs/MODEL_STATIC_AUDIT.json"
    )
    output_dir = args.output_dir.resolve()
    # Keep recovered model/state and probe rows in ignored scratch, never ordinary Git paths.
    if not output_dir.is_relative_to(ROOT / "work"):
        parser.error("Model/state outputs must stay under repository work/")
    output_dir.mkdir(parents=True, exist_ok=True)
    native_path = output_dir / f"{model.native_sha256}.txt"
    native_path.write_bytes(model.native_text.encode())
    summary = model.summary()
    (output_dir / f"{Path(args.artifact).stem}.summary.json").write_text(
        json.dumps(summary, indent=2, allow_nan=False) + "\n"
    )
    if args.command == "recover":
        print(json.dumps(summary, indent=2, allow_nan=False))
        return
    if args.openmp_library:
        library = args.openmp_library.resolve(strict=True)
        ctypes.CDLL(str(library), mode=ctypes.RTLD_GLOBAL)
        summary["openmp_library_sha256"] = hashlib.sha256(library.read_bytes()).hexdigest()
    if args.command == "probe":
        if args.input:
            parser.error(
                "probe creates explicitly synthetic numerical tensors; use predict for supplied inputs"
            )
        payload = numeric_probe(model)
        (output_dir / "synthetic-numeric-probe.json").write_text(
            json.dumps(payload, indent=2, allow_nan=False) + "\n"
        )
    else:
        if not args.input:
            parser.error("predict requires --input with complete ordered features and provenance")
        payload = json.loads(args.input.read_text())
    result = run_diagnostics(model, payload, native_path)
    if args.openmp_library:
        result["openmp_library_sha256"] = summary["openmp_library_sha256"]
    (output_dir / f"{Path(args.artifact).stem}.diagnostic.json").write_text(
        json.dumps(result, indent=2, allow_nan=False) + "\n"
    )
    print(json.dumps(result, indent=2, allow_nan=False))


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, ImportError) as exc:
        raise SystemExit(f"Diagnostic unavailable: {exc}") from exc
