"""V5 schema, issue-time gate and native mechanics; no city forecast evidence."""

import copy
import json
from pathlib import Path

import pytest
from breathewise.ml.v5 import (
    V5InputError,
    checked_manifest,
    predict_explicit,
    validate_row,
    verify_teammate_golden,
)

ROOT = Path(__file__).resolve().parents[3]
MANIFEST = ROOT / "docs/MODEL_V5_MANIFEST.json"
NATIVE = ROOT / "work/model-v5/extracted"


@pytest.fixture(scope="module")
def manifest():
    return checked_manifest(MANIFEST)


@pytest.fixture
def synthetic_row(manifest):
    issue = "2026-11-24T12:00:00Z"
    target = "2026-11-24T13:00:00Z"
    names = manifest["features"]
    return {
        "model_version": manifest["model_version"],
        "horizon_h": 1,
        "issue_at": issue,
        "input_cutoff_at": issue,
        "feature_names": names.copy(),
        "values": [1.0] * len(names),
        "provenance": [
            {
                "feature_name": name,
                "source_id": "synthetic_mechanics_only",
                "kind": "derived",
                "available_at": issue,
                "valid_at": target
                if name.startswith("target_") or name.endswith("_delta_h")
                else issue,
            }
            for name in names
        ],
        "allow_nan_diagnostic": False,
    }


def test_all_five_horizons_and_order_are_recovered(manifest):
    assert manifest["horizons"] == [1, 3, 6, 12, 24]
    assert len(manifest["features"]) == 69
    assert manifest["features"][0] == "lat"
    assert manifest["features"][-1] == "target_hour_cos"
    assert len(set(manifest["features"])) == 69
    assert all(
        item["weights_serialized"] == [0.55, 0.45] for item in manifest["horizon_models"].values()
    )


def test_reordered_or_missing_inputs_rejected(synthetic_row, manifest):
    row = copy.deepcopy(synthetic_row)
    row["feature_names"][0], row["feature_names"][1] = (
        row["feature_names"][1],
        row["feature_names"][0],
    )
    with pytest.raises(V5InputError, match="names/order"):
        validate_row(row, manifest)
    row = copy.deepcopy(synthetic_row)
    row["values"].pop()
    with pytest.raises(V5InputError, match="Exactly 69"):
        validate_row(row, manifest)
    row = copy.deepcopy(synthetic_row)
    row["horizon_h"] = 2
    with pytest.raises(V5InputError, match="Unsupported"):
        validate_row(row, manifest)


def test_nan_is_explicit_diagnostic_only(synthetic_row, manifest):
    row = copy.deepcopy(synthetic_row)
    row["values"][4] = None
    with pytest.raises(V5InputError, match="null requires"):
        validate_row(row, manifest)
    row["allow_nan_diagnostic"] = True
    assert len(validate_row(row, manifest)) == 69
    row["values"][4] = float("inf")
    with pytest.raises(V5InputError, match="finite numeric"):
        validate_row(row, manifest)


def test_future_or_realized_target_inputs_rejected(synthetic_row, manifest):
    row = copy.deepcopy(synthetic_row)
    row["provenance"][4]["available_at"] = "2026-11-24T12:01:00Z"
    with pytest.raises(V5InputError, match="unavailable at input cutoff"):
        validate_row(row, manifest)
    row = copy.deepcopy(synthetic_row)
    index = manifest["features"].index("target_temperature_2m")
    row["provenance"][index]["kind"] = "observation"
    with pytest.raises(V5InputError, match="observation"):
        validate_row(row, manifest)
    row = copy.deepcopy(synthetic_row)
    row["provenance"][index]["valid_at"] = "2026-11-24T14:00:00Z"
    with pytest.raises(V5InputError, match="target time"):
        validate_row(row, manifest)
    row = copy.deepcopy(synthetic_row)
    row["input_cutoff_at"] = "2026-11-24T12:01:00Z"
    with pytest.raises(V5InputError, match="exceeds issue"):
        validate_row(row, manifest)
    row = copy.deepcopy(synthetic_row)
    row["provenance"][4]["valid_at"] = "2026-11-24T13:00:00Z"
    with pytest.raises(V5InputError, match="after cutoff"):
        validate_row(row, manifest)
    row = copy.deepcopy(synthetic_row)
    index = manifest["features"].index("cams_pm25_delta_h")
    row["provenance"][index]["kind"] = "observation"
    with pytest.raises(V5InputError, match="realized observation"):
        validate_row(row, manifest)


def test_manifest_hash_and_readiness_are_strict(manifest, tmp_path):
    invalid = copy.deepcopy(manifest)
    invalid["features"][0] = "other"
    path = tmp_path / "manifest.json"
    path.write_text(json.dumps(invalid))
    with pytest.raises(V5InputError, match="order hash"):
        checked_manifest(path)
    invalid = copy.deepcopy(manifest)
    invalid["public_live_forecast_ready"] = True
    path.write_text(json.dumps(invalid))
    with pytest.raises(V5InputError, match="readiness"):
        checked_manifest(path)


def test_native_export_tampering_is_rejected(synthetic_row, tmp_path):
    (tmp_path / "h1.lgb.txt").write_text("tampered")
    (tmp_path / "h1.xgb.ubj").write_bytes(b"tampered")
    with pytest.raises(V5InputError, match="Native model integrity failed"):
        predict_explicit(synthetic_row, MANIFEST, tmp_path)


@pytest.mark.parametrize("horizon", [1, 3, 6, 12, 24])
def test_native_adapter_returns_raw_weighted_diagnostic_only(synthetic_row, manifest, horizon):
    row = copy.deepcopy(synthetic_row)
    row["horizon_h"] = horizon
    target = f"2026-11-{24 + (12 + horizon) // 24:02d}T{(12 + horizon) % 24:02d}:00:00Z"
    for source in row["provenance"]:
        if source["feature_name"].startswith("target_") or source["feature_name"].endswith(
            "_delta_h"
        ):
            source["valid_at"] = target
    result = predict_explicit(row, MANIFEST, NATIVE)
    assert result["diagnostic_only"] is True
    assert result["public_live_forecast_ready"] is False
    assert result["target_unit"] is None
    assert result["golden_parity_verified"] is False
    assert result["weighted_raw"] == pytest.approx(
        0.55 * result["lightgbm_raw"] + 0.45 * result["xgboost_raw"], rel=1e-12
    )


def test_synthetic_row_cannot_be_promoted_to_golden(synthetic_row, manifest):
    expected = {
        "source": "original_pipeline",
        "artifact_sha256": manifest["artifact_sha256"],
        "feature_order_sha256": manifest["feature_order_sha256"],
        "horizon_h": 1,
        "lightgbm_raw": 1.0,
        "xgboost_raw": 1.0,
        "wrapper_final": 1.0,
        "wrapper_formula": "serialized_weighted_raw_no_transform",
        "target_unit": "teammate_must_supply",
        "absolute_tolerance": 1e-9,
        "relative_tolerance": 1e-9,
    }
    with pytest.raises(V5InputError, match="Synthetic"):
        verify_teammate_golden(synthetic_row, expected, MANIFEST, NATIVE)


def test_original_wrapper_golden_parity_when_supplied():
    path = ROOT / "work/model-v5/golden-input.json"
    expected_path = ROOT / "work/model-v5/golden-expected.json"
    if not path.is_file() or not expected_path.is_file():
        pytest.skip("Original pipeline golden input/output not supplied; parity unverified")
    payload = json.loads(path.read_text())
    expected = json.loads(expected_path.read_text())
    verified = verify_teammate_golden(payload, expected, MANIFEST, NATIVE)
    assert verified["golden_parity_verified"] is True
