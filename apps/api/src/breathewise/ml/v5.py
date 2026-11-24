"""Offline, hash-checked diagnostic adapter for the supplied v5 native models.

No raw-data feature builder or service inference is implied by this module.
"""

import hashlib
import json
import math
from datetime import UTC, datetime, timedelta
from pathlib import Path

VERSION = "supplied-horizon-ensemble-v5"
HORIZONS = (1, 3, 6, 12, 24)


class V5InputError(ValueError):
    """An explicit feature row fails the diagnostic contract."""


def _utc(value: str, field: str) -> datetime:
    if not isinstance(value, str):
        raise V5InputError(f"{field} must be an ISO 8601 UTC timestamp")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise V5InputError(f"{field} must be an ISO 8601 UTC timestamp") from exc
    if parsed.tzinfo is None or parsed.utcoffset() != timedelta(0):
        raise V5InputError(f"{field} must be timezone-aware UTC")
    return parsed.astimezone(UTC)


def checked_manifest(path: Path) -> dict:
    manifest = json.loads(path.read_text())
    if (
        manifest.get("model_version") != VERSION
        or manifest.get("artifact_sha256")
        != "473439721f93ed2b6890f916ba9532a62dadefb0e6289485fb8ae698a32f0e19"
        or manifest.get("feature_count") != 69
        or manifest.get("horizons") != list(HORIZONS)
        or manifest.get("serialized_target_transform") != "none"
        or manifest.get("target_unit") is not None
        or manifest.get("public_live_forecast_ready") is not False
    ):
        raise V5InputError("v5 manifest identity/readiness mismatch")
    features = manifest.get("features")
    if not isinstance(features, list) or len(features) != 69 or len(set(features)) != 69:
        raise V5InputError("v5 manifest feature schema invalid")
    expected = hashlib.sha256(json.dumps(features, separators=(",", ":")).encode()).hexdigest()
    if manifest.get("feature_order_sha256") != expected:
        raise V5InputError("v5 manifest feature order hash mismatch")
    provenance = manifest.get("feature_provenance")
    if not isinstance(provenance, list) or len(provenance) != 69:
        raise V5InputError("v5 per-feature provenance matrix missing")
    for index, (name, entry) in enumerate(zip(features, provenance, strict=True)):
        if (
            not isinstance(entry, dict)
            or entry.get("order") != index
            or entry.get("name") != name
            or entry.get("recovered_from_artifact") is not True
            or entry.get("unit") is not None
            or entry.get("formula_verified") is not False
            or entry.get("issue_time_availability_verified") is not False
        ):
            raise V5InputError("v5 per-feature provenance matrix mismatch")
    return manifest


def validate_row(payload: dict, manifest: dict) -> list[float]:
    """Require an explicit ordered 69-feature row with claimed issue-time provenance.

    This checks the caller's timestamps. It cannot verify original feature formulas,
    acquisition time, provider units or XGBoost positional training parity.
    """
    if not isinstance(payload, dict) or set(payload) != {
        "model_version",
        "horizon_h",
        "issue_at",
        "input_cutoff_at",
        "feature_names",
        "values",
        "provenance",
        "allow_nan_diagnostic",
    }:
        raise V5InputError("Expected exact v5 diagnostic input fields")
    if payload["model_version"] != VERSION:
        raise V5InputError("Wrong model version")
    horizon = payload["horizon_h"]
    if type(horizon) is not int or horizon not in HORIZONS:
        raise V5InputError("Unsupported v5 horizon")
    if payload["feature_names"] != manifest["features"]:
        raise V5InputError("Feature names/order differ from recovered v5 schema")
    values, provenance = payload["values"], payload["provenance"]
    if not isinstance(values, list) or not isinstance(provenance, list):
        raise V5InputError("Values and provenance must be ordered arrays")
    if len(values) != 69 or len(provenance) != 69:
        raise V5InputError("Exactly 69 values and provenance entries are required")
    allow_nan = payload["allow_nan_diagnostic"]
    if type(allow_nan) is not bool:
        raise V5InputError("allow_nan_diagnostic must be boolean")
    issue = _utc(payload["issue_at"], "issue_at")
    cutoff = _utc(payload["input_cutoff_at"], "input_cutoff_at")
    if cutoff > issue:
        raise V5InputError("input_cutoff_at exceeds issue_at")
    target = issue + timedelta(hours=horizon)
    ordered = []
    for name, value, source in zip(manifest["features"], values, provenance, strict=True):
        if value is None:
            if not allow_nan:
                raise V5InputError(f"{name}: null requires explicit diagnostic NaN mode")
            ordered.append(math.nan)
        elif type(value) in (int, float) and math.isfinite(value):
            ordered.append(float(value))
        else:
            raise V5InputError(f"{name}: expected finite numeric value or explicit null")
        if not isinstance(source, dict) or set(source) != {
            "feature_name",
            "source_id",
            "kind",
            "available_at",
            "valid_at",
        }:
            raise V5InputError(f"{name}: complete provenance entry required")
        if (
            source["feature_name"] != name
            or not isinstance(source["source_id"], str)
            or not source["source_id"].strip()
        ):
            raise V5InputError(f"{name}: source identity/name mismatch")
        kind = source["kind"]
        if kind not in {"observation", "forecast", "static", "derived"}:
            raise V5InputError(f"{name}: unsupported provenance kind")
        available = _utc(source["available_at"], f"{name}.available_at")
        valid = _utc(source["valid_at"], f"{name}.valid_at")
        if available > cutoff:
            raise V5InputError(f"{name}: unavailable at input cutoff")
        future_driver = name.startswith("target_") or name.endswith("_delta_h")
        if future_driver:
            if kind == "observation":
                raise V5InputError(f"{name}: future driver cannot be a realized observation")
            if valid != target:
                raise V5InputError(f"{name}: future driver must be valid at target time")
        elif kind in {"observation", "derived"} and valid > cutoff:
            raise V5InputError(f"{name}: observed/derived input is after cutoff")
        elif kind == "forecast" and valid > issue:
            raise V5InputError(f"{name}: future forecast driver needs target/delta schema")
    return ordered


def predict_explicit(payload: dict, manifest_path: Path, extracted_dir: Path) -> dict:
    """Return raw component and weighted scores; units/parity stay unverified."""
    manifest = checked_manifest(manifest_path)
    values = validate_row(payload, manifest)
    horizon = payload["horizon_h"]
    metadata = manifest["horizon_models"][str(horizon)]
    lgb_path = extracted_dir / f"h{horizon}.lgb.txt"
    xgb_path = extracted_dir / f"h{horizon}.xgb.ubj"
    for path, key in ((lgb_path, "lgb_export_sha256"), (xgb_path, "xgb_export_sha256")):
        if (
            not path.is_file()
            or hashlib.file_digest(path.open("rb"), "sha256").hexdigest() != metadata[key]
        ):
            raise V5InputError(f"Native model integrity failed: {path.name}")

    import lightgbm as lgb
    import numpy as np
    import xgboost as xgb

    lightgbm_model = lgb.Booster(model_file=str(lgb_path))
    xgboost_model = xgb.Booster(model_file=str(xgb_path))
    if (
        lightgbm_model.feature_name() != manifest["features"]
        or lightgbm_model.num_trees() != metadata["lgb_num_trees"]
        or xgboost_model.num_features() != 69
        or xgboost_model.num_boosted_rounds() != metadata["xgb_num_trees"]
    ):
        raise V5InputError("Native model feature/tree metadata mismatch")
    row = np.asarray(values, dtype=np.float64).reshape(1, 69)
    lgb_value = float(
        lightgbm_model.predict(
            row, num_iteration=metadata["lgb_stored_best_iteration"], num_threads=1
        )[0]
    )
    xgb_value = float(
        xgboost_model.predict(
            xgb.DMatrix(row),
            iteration_range=(0, metadata["xgb_stored_best_iteration_zero_based"] + 1),
        )[0]
    )
    weight_lgb, weight_xgb = metadata["weights_serialized"]
    blended = weight_lgb * lgb_value + weight_xgb * xgb_value
    if not all(math.isfinite(item) for item in (lgb_value, xgb_value, blended)):
        raise V5InputError("Native output is nonfinite")
    return {
        "model_version": VERSION,
        "horizon_h": horizon,
        "issue_at": payload["issue_at"],
        "input_cutoff_at": payload["input_cutoff_at"],
        "lightgbm_raw": lgb_value,
        "xgboost_raw": xgb_value,
        "weighted_raw": blended,
        "weights": [weight_lgb, weight_xgb],
        "diagnostic_iteration_policy": "stored_best_iteration",
        "diagnostic_input_dtype": "float64",
        "serialized_target_transform": "none",
        "target_unit": None,
        "diagnostic_only": True,
        "input_provenance_self_reported": True,
        "golden_parity_verified": False,
        "public_live_forecast_ready": False,
        "unavailable_reasons": manifest["unavailable_reasons"],
    }


def verify_teammate_golden(payload: dict, expected: dict, manifest_path: Path, extracted_dir: Path):
    """Check an original-pipeline golden example; no synthetic example can pass."""
    manifest = checked_manifest(manifest_path)
    required = {
        "source",
        "artifact_sha256",
        "feature_order_sha256",
        "horizon_h",
        "lightgbm_raw",
        "xgboost_raw",
        "wrapper_final",
        "wrapper_formula",
        "target_unit",
        "absolute_tolerance",
        "relative_tolerance",
    }
    if not isinstance(expected, dict) or set(expected) != required:
        raise V5InputError("Complete original-wrapper golden output fields required")
    if expected["source"] != "original_pipeline" or any(
        item.get("source_id") == "synthetic_mechanics_only"
        for item in payload.get("provenance", [])
    ):
        raise V5InputError("Synthetic or unproven golden input cannot establish parity")
    if (
        expected["artifact_sha256"] != manifest["artifact_sha256"]
        or expected["feature_order_sha256"] != manifest["feature_order_sha256"]
        or expected["horizon_h"] != payload.get("horizon_h")
        or expected["wrapper_formula"] != "serialized_weighted_raw_no_transform"
        or not isinstance(expected["target_unit"], str)
        or not expected["target_unit"].strip()
    ):
        raise V5InputError("Golden artifact/schema/formula/unit mismatch")
    absolute, relative = expected["absolute_tolerance"], expected["relative_tolerance"]
    if any(
        type(item) not in (int, float) or not math.isfinite(item) or item < 0
        for item in (absolute, relative)
    ):
        raise V5InputError("Golden tolerances must be finite and nonnegative")
    result = predict_explicit(payload, manifest_path, extracted_dir)
    for actual_key, expected_key in (
        ("lightgbm_raw", "lightgbm_raw"),
        ("xgboost_raw", "xgboost_raw"),
        ("weighted_raw", "wrapper_final"),
    ):
        value = expected[expected_key]
        if (
            type(value) not in (int, float)
            or not math.isfinite(value)
            or not math.isclose(result[actual_key], value, abs_tol=absolute, rel_tol=relative)
        ):
            raise V5InputError(f"Golden parity mismatch: {expected_key}")
    return {
        "golden_parity_verified": True,
        "target_unit": expected["target_unit"],
        "result": result,
    }
