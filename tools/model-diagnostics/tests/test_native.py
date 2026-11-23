"""Hand-authored one-leaf format fixture: library mechanics, no environmental model."""

import hashlib
import math
from types import SimpleNamespace

import pytest
from breathewise.ml.diagnostics import run_diagnostics


@pytest.fixture
def native_fixture(tmp_path):
    # Constant log(2) => expm1 exactly once gives 1, applying twice would differ.
    tree = "\n".join(
        [
            "Tree=0",
            "num_leaves=1",
            "num_cat=0",
            "split_feature=",
            "split_gain=",
            "threshold=",
            "decision_type=",
            "left_child=",
            "right_child=",
            f"leaf_value={math.log(2):.17g}",
            "leaf_weight=1",
            "leaf_count=1",
            "internal_value=",
            "internal_weight=",
            "internal_count=",
            "is_linear=0",
            "shrinkage=1",
            "",
            "",
        ]
    )
    second_tree = tree.replace("Tree=0", "Tree=1").replace(
        f"leaf_value={math.log(2):.17g}", f"leaf_value={math.log(3):.17g}"
    )
    native = "\n".join(
        [
            "tree",
            "version=v4",
            "num_class=1",
            "num_tree_per_iteration=1",
            "label_index=0",
            "max_feature_idx=0",
            "objective=regression",
            "feature_names=forecast_horizon_h",
            "feature_infos=[1:24]",
            f"tree_sizes={len(tree.encode())} {len(second_tree.encode())}",
            "",
            tree + second_tree,
            "end of trees",
            "",
            "",
        ]
    )
    digest = hashlib.sha256(native.encode()).hexdigest()
    path = tmp_path / "unit-fixture.txt"
    path.write_text(native)
    model = SimpleNamespace(
        native_text=native,
        native_sha256=digest,
        artifact_sha256="synthetic_format_fixture",
        features=["forecast_horizon_h"],
        horizons=[1, 3, 6, 12, 24],
        best_iteration=1,
        target_transform="log1p",
    )
    payload = {
        "input_kind": "synthetic_numeric_probe",
        "provenance": "hand-authored constant-tree unit fixture",
        "feature_names": model.features,
        "rows": [[1], [3]],
    }
    return model, payload, path


def test_native_prediction_transform_and_file_agreement(native_fixture):
    result = run_diagnostics(*native_fixture)
    assert result["native_string_file_max_abs_difference"] == 0
    assert result["selected_iteration_count"] == 1
    assert result["native_tree_count"] == 2  # Must select stored best iteration, not all trees.
    assert result["rows"][0]["native_score"] == pytest.approx(math.log(2))
    assert result["rows"][0]["declared_transform_score"] == pytest.approx(1)
    assert result["claimed_concentration_unit"] is None
    assert not result["operational_forecast_ready"]
    assert not result["golden_output_parity_verified"]


def test_native_file_tampering_is_rejected(native_fixture):
    model, payload, path = native_fixture
    path.write_text(path.read_text() + "tampered")
    with pytest.raises(ValueError, match="SHA256"):
        run_diagnostics(model, payload, path)
