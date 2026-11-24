"""Inert v5 joblib inspection followed by isolated native-library verification.

This never calls pickle.load/joblib.load or executes a serialized Python global.
Native LightGBM/XGBoost loading occurs only after size, hash, opcode, bundle,
feature and native payload checks. Extracted models stay in ignored work/.
"""

import argparse
import ctypes
import hashlib
import io
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "apps/api/src"))

from breathewise.ml.state_reader import StateReader, Symbol  # noqa: E402

ARTIFACT_SHA256 = "473439721f93ed2b6890f916ba9532a62dadefb0e6289485fb8ae698a32f0e19"
ARTIFACT_BYTES = 151_950_058
VERSION = "supplied-horizon-ensemble-v5"
HORIZONS = [1, 3, 6, 12, 24]
SCHEMA = "prod_v5_horizon_specialized_lgb_xgb"


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_bundle(path: Path):
    if path.stat().st_size != ARTIFACT_BYTES:
        raise ValueError("v5 artifact size mismatch")
    data = path.read_bytes()
    if sha(data) != ARTIFACT_SHA256:
        raise ValueError("v5 artifact SHA256 mismatch")
    reader = StateReader(io.BytesIO(data))
    root = reader.read()
    if reader.stream.tell() != len(data) or reader.arrays:
        raise ValueError("v5 state incomplete or unexpected joblib array")
    symbols = {item.name for item in reader.symbols}
    if symbols != {
        "collections.OrderedDict",
        "collections.defaultdict",
        "lightgbm.basic.Booster",
        "numpy._core.multiarray.scalar",
        "numpy.dtype",
        "xgboost.core.Booster",
    }:
        raise ValueError("Unexpected serialized Python global")
    if not isinstance(root, dict) or set(root) != {
        "models_by_horizon",
        "features",
        "horizons",
        "target_transform",
        "schema_version",
    }:
        raise ValueError("Unexpected v5 root bundle")
    features = root["features"]
    if (
        root["schema_version"] != SCHEMA
        or root["target_transform"] != "none"
        or root["horizons"] != HORIZONS
        or not isinstance(features, list)
        or len(features) != 69
        or len(set(features)) != 69
        or any(not isinstance(name, str) or not name for name in features)
        or set(root["models_by_horizon"]) != set(HORIZONS)
    ):
        raise ValueError("v5 schema/features/horizons mismatch")
    for horizon in HORIZONS:
        models = root["models_by_horizon"][horizon]
        if not isinstance(models, dict) or set(models) != {"lgb_booster", "xgb_booster", "weights"}:
            raise ValueError(f"Invalid horizon {horizon} bundle")
        lightgbm, xgboost = models["lgb_booster"], models["xgb_booster"]
        if (
            not isinstance(lightgbm, Symbol)
            or lightgbm.name != "lightgbm.basic.Booster"
            or not isinstance(lightgbm.state, dict)
            or not isinstance(xgboost, Symbol)
            or xgboost.name != "xgboost.core.Booster"
            or not isinstance(xgboost.state, dict)
            or not isinstance(lightgbm.state.get("_handle"), str)
            or not isinstance(xgboost.state.get("handle"), bytes)
            or models["weights"] != [0.55, 0.45]
        ):
            raise ValueError(f"Invalid horizon {horizon} model descriptors")
        native = lightgbm.state["_handle"]
        names = next(
            (
                line.removeprefix("feature_names=").split()
                for line in native.splitlines()
                if line.startswith("feature_names=")
            ),
            None,
        )
        if (
            not native.startswith("tree\nversion=v4\n")
            or names != features
            or "max_feature_idx=68\n" not in native[:500]
        ):
            raise ValueError(f"Horizon {horizon} LightGBM feature order mismatch")
        snapshot = xgboost.state["handle"]
        version_marker = b"version[#L" + (3).to_bytes(8, "big") + b"i\x03i\x04i\x01"
        if not snapshot.startswith(b"{L") or version_marker not in snapshot[:10_000]:
            raise ValueError(f"Horizon {horizon} XGBoost snapshot framing mismatch")
    return root, reader


def audit(path: Path, output: Path, openmp_library: Path | None = None):
    root, reader = read_bundle(path)
    if not output.resolve().is_relative_to(ROOT / "work"):
        raise ValueError("Native files must remain under repository work/")
    output.mkdir(parents=True, exist_ok=True)
    if openmp_library:
        ctypes.CDLL(str(openmp_library.resolve(strict=True)), mode=ctypes.RTLD_GLOBAL)
    import lightgbm as lgb
    import numpy as np
    import xgboost as xgb

    features = root["features"]
    results = {}
    for horizon in HORIZONS:
        bundle = root["models_by_horizon"][horizon]
        lgb_state = bundle["lgb_booster"].state
        xgb_snapshot = bundle["xgb_booster"].state["handle"]
        native_text = lgb_state["_handle"]
        lgb_model = lgb.Booster(model_str=native_text)
        if lgb_model.num_feature() != 69 or lgb_model.feature_name() != features:
            raise ValueError(f"Horizon {horizon} native LightGBM mismatch")
        xgb_model = xgb.Booster()
        # The pickle state stores an XGBoost memory snapshot, not save_model UBJ.
        # Only the known native XGBoost __setstate__ path is used, never pickle.
        xgb_model.__setstate__({"handle": bytearray(xgb_snapshot)})
        if xgb_model.num_features() != 69 or xgb_model.feature_names is not None:
            raise ValueError(f"Horizon {horizon} native XGBoost feature metadata changed")
        xgb_config = json.loads(xgb_model.save_config())
        if xgb_config.get("version") != [3, 4, 1]:
            raise ValueError(f"Horizon {horizon} XGBoost snapshot version changed")
        best_lgb = lgb_state["best_iteration"]
        best_xgb = xgb_model.attr("best_iteration")
        if not isinstance(best_lgb, int) or not best_xgb or int(best_xgb) < 0:
            raise ValueError(f"Horizon {horizon} best-iteration metadata absent")
        lgb_path = output / f"h{horizon}.lgb.txt"
        xgb_path = output / f"h{horizon}.xgb.ubj"
        lgb_path.write_text(native_text)
        xgb_model.save_model(xgb_path)

        # Synthetic mechanics only: one finite row and each single-feature NaN.
        # These rows have no city, physical unit, training or issue-time provenance.
        probes = np.zeros((len(features) + 1, len(features)), dtype=np.float64)
        probes[np.arange(1, len(features) + 1), np.arange(len(features))] = np.nan
        lgb_values = lgb_model.predict(probes, num_threads=1)
        xgb_values = xgb_model.predict(xgb.DMatrix(probes), iteration_range=(0, int(best_xgb) + 1))
        if (
            lgb_values.shape != (len(features) + 1,)
            or xgb_values.shape != (len(features) + 1,)
            or not np.isfinite(lgb_values).all()
            or not np.isfinite(xgb_values).all()
        ):
            raise ValueError(f"Horizon {horizon} native NaN probes failed")
        results[str(horizon)] = {
            "weights_serialized": bundle["weights"],
            "lgb_native_sha256": sha(native_text.encode()),
            "xgb_snapshot_sha256": sha(xgb_snapshot),
            "lgb_export_sha256": sha(lgb_path.read_bytes()),
            "xgb_export_sha256": sha(xgb_path.read_bytes()),
            "lgb_num_trees": lgb_model.num_trees(),
            "lgb_stored_best_iteration": best_lgb,
            "lgb_stored_training_params": lgb_state.get("params"),
            "xgb_num_trees": xgb_model.num_boosted_rounds(),
            "xgb_stored_best_iteration_zero_based": int(best_xgb),
            "xgb_snapshot_version": xgb_config["version"],
            "xgb_objective": xgb_config["learner"]["objective"]["name"],
            "xgb_booster_kind": xgb_config["learner"]["gradient_booster"]["name"],
            "xgb_feature_names_serialized": False,
            "nan_mechanics": {
                "finite_row": "both_native_components_finite",
                "single_feature_nan_rows_tested": len(features),
                "all_native_outputs_finite": True,
                "training_missingness_policy_verified": False,
            },
        }
    return {
        "model_version": VERSION,
        "artifact_sha256": ARTIFACT_SHA256,
        "artifact_bytes": ARTIFACT_BYTES,
        "state_read_complete": True,
        "serialized_python_constructors_executed": False,
        "serialized_schema_version": SCHEMA,
        "bundle_keys": list(root),
        "horizons": HORIZONS,
        "feature_count": len(features),
        "features": features,
        "feature_provenance": [
            {
                "order": index,
                "name": name,
                "recovered_from_artifact": True,
                "unit": None,
                "formula_verified": False,
                "issue_time_availability_verified": False,
            }
            for index, name in enumerate(features)
        ],
        "feature_order_sha256": sha(json.dumps(features, separators=(",", ":")).encode()),
        "serialized_target_transform": root["target_transform"],
        "target_unit": None,
        "target_scale_verified": False,
        "serialized_xgboost_snapshot_version": "3.4.1",
        "isolated_runtime_versions": {
            "python": ".".join(map(str, sys.version_info[:3])),
            "lightgbm": lgb.__version__,
            "xgboost": xgb.__version__,
            "numpy": np.__version__,
        },
        "training_dependency_versions_verified": False,
        "xgboost_feature_order_verified_from_artifact": False,
        "feature_formulas_verified": False,
        "golden_output_parity_verified": False,
        "operational_issue_time_inputs_verified": False,
        "public_live_forecast_ready": False,
        "status": "diagnostic_only",
        "unavailable_reasons": [
            "V5_GOLDEN_PARITY_MISSING",
            "V5_FEATURE_FORMULAS_AND_UNITS_MISSING",
            "V5_XGBOOST_FEATURE_ORDER_UNVERIFIED",
            "V5_ISSUE_TIME_INPUTS_UNVERIFIED",
            "V5_TARGET_UNIT_UNVERIFIED",
            "V5_TRAINING_ENVIRONMENT_UNVERIFIED",
        ],
        "static_opcode_count": reader.opcode_count,
        "serialized_symbol_names": sorted({symbol.name for symbol in reader.symbols}),
        "horizon_models": results,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifact", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "work/model-v5/extracted")
    parser.add_argument("--manifest", type=Path, default=ROOT / "docs/MODEL_V5_MANIFEST.json")
    parser.add_argument("--openmp-library", type=Path)
    args = parser.parse_args()
    report = audit(args.artifact, args.output_dir, args.openmp_library)
    args.manifest.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
    print(
        json.dumps(
            {
                "version": VERSION,
                "features": report["feature_count"],
                "horizons": report["horizons"],
                "status": report["status"],
                "manifest": str(args.manifest),
                "native_output_dir": str(args.output_dir),
            }
        )
    )


if __name__ == "__main__":
    main()
