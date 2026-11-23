"""Strict native-score diagnostics; never builds environmental features or forecasts."""

import hashlib
import json
import math
from datetime import UTC, datetime
from pathlib import Path

from breathewise.ml.recovery import RecoveredModel

LIMITATIONS = [
    "Diagnostic native-booster execution only; not an operational pollution forecast.",
    "No environmental preprocessing, source availability, target units or golden outputs verified.",
    "The metadata-declared expm1 transform is shown explicitly; wrapper inversion semantics remain unverified.",
    "Native reload agreement is a numerical implementation check, not model accuracy or feature parity.",
]


def finite_number(value):
    if type(value) not in {float, int}:
        return False
    try:
        return math.isfinite(value)
    except OverflowError:
        return False


def validate_input(payload, model: RecoveredModel):
    required = {"input_kind", "provenance", "feature_names", "rows"}
    if (
        not isinstance(payload, dict)
        or not required.issubset(payload)
        or set(payload) - required - {"feature_units"}
    ):
        raise ValueError(f"Diagnostic input must contain exactly {sorted(required)}")
    if payload["input_kind"] not in {
        "caller_supplied_complete_features",
        "synthetic_numeric_probe",
    }:
        raise ValueError("Declare caller-supplied complete features or synthetic_numeric_probe")
    if not isinstance(payload["provenance"], str) or not payload["provenance"].strip():
        raise ValueError("Explicit input provenance is required")
    if payload["feature_names"] != model.features:
        raise ValueError("Feature names and order must exactly match the recovered 75-input schema")
    units = payload.get("feature_units")
    if units is not None:
        if (
            not isinstance(units, dict)
            or set(units) - set(model.features)
            or any(not isinstance(v, str) or not v.strip() for v in units.values())
        ):
            raise ValueError(
                "Feature unit labels must refer to named features and contain explicit strings"
            )
        nominal = {"forecast_horizon_h": {"h", "hours"}, "co_ugm3": {"µg/m³", "ug/m3", "μg/m³"}}
        for feature, accepted in nominal.items():
            if feature in units and units[feature] not in accepted:
                raise ValueError(
                    "Nominal feature unit mismatch; no automatic conversion or model compatibility assumed"
                )
    rows = payload["rows"]
    if not isinstance(rows, list) or not 1 <= len(rows) <= 1000:
        raise ValueError("Diagnostic batch must contain 1..1000 complete rows")
    horizon_index = model.features.index("forecast_horizon_h")
    for row in rows:
        if not isinstance(row, list) or len(row) != len(model.features):
            raise ValueError("Every row must supply every feature; no imputation or padding")
        if any(not finite_number(value) for value in row):
            raise ValueError(
                "Every diagnostic feature must be a finite numeric value; booleans/nulls refused"
            )
        if row[horizon_index] not in model.horizons:
            raise ValueError("Diagnostic horizon must be one of the artifact-declared horizons")
    return rows


def numeric_probe(model: RecoveredModel):
    # Technical load/reload tensor only. These midpoints are NOT environmental
    # preprocessing and do NOT preserve cross-feature or issue-time consistency.
    line = next(
        line for line in model.native_text.splitlines() if line.startswith("feature_infos=")
    )
    ranges = line.removeprefix("feature_infos=").split()
    if len(ranges) != len(model.features):
        raise ValueError("Native numeric ranges absent; cannot construct technical probe")
    row = []
    for interval in ranges:
        if not interval.startswith("[") or not interval.endswith("]"):
            raise ValueError("Non-numeric native range; no probe fallback")
        low, high = map(float, interval[1:-1].split(":"))
        midpoint = low / 2 + high / 2
        if not all(math.isfinite(value) for value in [low, high, midpoint]):
            raise ValueError("Nonfinite native range; no probe fallback")
        row.append(midpoint)
    index = model.features.index("forecast_horizon_h")
    rows = []
    for horizon in model.horizons:
        probe = row.copy()
        probe[index] = horizon
        rows.append(probe)
    return {
        "input_kind": "synthetic_numeric_probe",
        "provenance": "Technical tensor from native model-header range midpoints and declared horizon values; no station, environmental consistency, forecast driver availability or issue time. Not real feature inputs.",
        "feature_names": model.features,
        "rows": rows,
    }


def load_native(model: RecoveredModel):
    from lightgbm import Booster

    booster = Booster(model_str=model.native_text)
    if booster.feature_name() != model.features or booster.num_feature() != len(model.features):
        raise ValueError("Native library feature schema differs from recovered metadata")
    if not 0 < model.best_iteration <= booster.current_iteration():
        raise ValueError("Stored best iteration is outside recovered native tree range")
    return booster


def run_diagnostics(model: RecoveredModel, payload, native_path: Path):
    import lightgbm
    import numpy as np

    rows = validate_input(payload, model)
    booster = load_native(model)
    if hashlib.sha256(native_path.read_bytes()).hexdigest() != model.native_sha256:
        raise ValueError("Recovered native file SHA256 mismatch")
    reloaded = lightgbm.Booster(model_file=str(native_path))
    matrix = np.asarray(rows, dtype=np.float64)
    # Do not trust a rehydrated Booster.best_iteration default (often -1).
    # Use the positive value recovered from actual serialized state explicitly.
    raw = booster.predict(
        matrix, start_iteration=0, num_iteration=model.best_iteration, num_threads=1
    )
    file_raw = reloaded.predict(
        matrix, start_iteration=0, num_iteration=model.best_iteration, num_threads=1
    )
    difference = float(np.max(np.abs(raw - file_raw)))
    if not np.all(np.isfinite(raw)) or not np.allclose(raw, file_raw, rtol=0, atol=1e-12):
        raise ValueError("Native string/file load numerical agreement failed")
    if model.target_transform != "log1p":
        raise ValueError("Declared target transform is unsupported; refusing to guess inversion")
    transformed = np.expm1(raw)
    if not np.all(np.isfinite(transformed)):
        raise ValueError("Declared inverse transform produced nonfinite diagnostic scores")
    return {
        "status": "diagnostic_only",
        "generated_at": datetime.now(UTC).isoformat(),
        "input_sha256": hashlib.sha256(
            json.dumps(payload, sort_keys=True, allow_nan=False, separators=(",", ":")).encode()
        ).hexdigest(),
        "input_environmental_consistency_verified": False,
        "supplied_feature_units": payload.get("feature_units"),
        "unit_validation_scope": "Explicit nominal horizon/CO identifier labels only; other original model units remain unverified",
        "input_kind": payload["input_kind"],
        "input_provenance": payload["provenance"],
        "artifact_sha256": model.artifact_sha256,
        "native_booster_sha256": model.native_sha256,
        "lightgbm_version": lightgbm.__version__,
        "numpy_version": np.__version__,
        "native_feature_count": booster.num_feature(),
        "native_tree_count": booster.num_trees(),
        "native_iterations": booster.current_iteration(),
        "selected_iteration_count": model.best_iteration,
        "declared_transform": model.target_transform,
        "inverse_transform_applied": "expm1(raw_native_score), once",
        "native_string_file_max_abs_difference": difference,
        "rows": [
            {"native_score": float(value), "declared_transform_score": float(inverted)}
            for value, inverted in zip(raw, transformed, strict=True)
        ],
        "claimed_concentration_unit": None,
        "operational_forecast_ready": False,
        "preprocessing_parity_verified": False,
        "golden_output_parity_verified": False,
        "limitations": LIMITATIONS,
    }
