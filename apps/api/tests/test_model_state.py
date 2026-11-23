"""Non-executing state recovery and diagnostic input boundaries; no model fixtures."""

import json
import pickle
import struct
from types import SimpleNamespace

import pytest
from breathewise.ml.diagnostics import validate_input
from breathewise.ml.recovery import recover_artifact
from breathewise.ml.state_reader import StateReadError, Symbol, inspect_state


def test_serialized_reduce_is_recorded_without_execution(tmp_path):
    marker = tmp_path / "must-not-exist"

    class MaliciousPayload:
        def __reduce__(self):
            return eval, (f"__import__('pathlib').Path({str(marker)!r}).write_text('executed')",)

    root, _ = inspect_state(pickle.dumps({"payload": MaliciousPayload()}, protocol=4))
    assert isinstance(root["payload"], Symbol)
    assert root["payload"].name == "builtins.eval"
    assert not marker.exists()


def test_shared_references_are_preserved_without_loading_classes():
    shared = ["lat", "lon"]
    root, _ = inspect_state(pickle.dumps({"a": shared, "b": shared}, protocol=4))
    assert root["a"] is root["b"]


def test_reader_rejects_truncated_and_trailing_bytes():
    encoded = pickle.dumps({"feature": 1}, protocol=4)
    with pytest.raises(StateReadError):
        inspect_state(encoded[:-1])
    with pytest.raises(StateReadError, match="trailing"):
        inspect_state(encoded + b"unexpected")


def test_joblib_numeric_alignment_is_parsed_and_truncation_rejected():
    def text(value):
        encoded = value.encode()
        return b"\x8c" + bytes([len(encoded)]) + encoded

    prefix = (
        b"\x80\x04cjoblib.numpy_pickle\nNumpyArrayWrapper\n)\x81}("
        + text("shape")
        + b"K\x02\x85"
        + text("dtype")
        + b"cnumpy\ndtype\n"
        + text("f8")
        + b"\x85R"
        + text("numpy_array_alignment_bytes")
        + b"K\x10ub"
    )
    padding = 16 - ((len(prefix) + 1) % 16)
    numeric = struct.pack("<dd", 4.0, 9.0)
    encoded = prefix + bytes([padding]) + b"\xff" * padding + numeric + b"."
    root, reader = inspect_state(encoded)
    assert root.array_bytes == numeric
    assert len(reader.arrays) == 1
    with pytest.raises(StateReadError):
        inspect_state(encoded[:-5])


def test_hash_identity_is_required_before_state_inspection(tmp_path):
    path = tmp_path / "artifact.joblib"
    path.write_bytes(b"not a pickle")
    audit = tmp_path / "audit.json"
    audit.write_text(json.dumps({path.name: {"bytes": path.stat().st_size, "sha256": "0" * 64}}))
    with pytest.raises(StateReadError, match="SHA256"):
        recover_artifact(path, audit)


@pytest.fixture
def input_schema():
    features = ["pm25", "forecast_horizon_h"]
    model = SimpleNamespace(features=features, horizons=[1, 3, 6, 12, 24])
    payload = {
        "input_kind": "caller_supplied_complete_features",
        "provenance": "schema unit fixture, not environmental validation",
        "feature_names": features.copy(),
        "rows": [[50.0, 1]],
    }
    return model, payload


def test_diagnostics_refuse_feature_reordering_and_imputation(input_schema):
    model, payload = input_schema
    payload["feature_names"].reverse()
    with pytest.raises(ValueError, match="order"):
        validate_input(payload, model)
    payload["feature_names"] = model.features
    payload["rows"] = [[1]]
    with pytest.raises(ValueError, match="no imputation"):
        validate_input(payload, model)


@pytest.mark.parametrize("value", [None, True, "50", float("nan"), float("inf"), 10**1000])
def test_diagnostics_refuse_missing_and_nonfinite_values(input_schema, value):
    model, payload = input_schema
    payload["rows"][0][0] = value
    with pytest.raises(ValueError, match="finite numeric"):
        validate_input(payload, model)


def test_diagnostics_refuse_unsupported_horizons_and_unknown_fields(input_schema):
    model, payload = input_schema
    payload["rows"][0][1] = 2
    with pytest.raises(ValueError, match="horizon"):
        validate_input(payload, model)
    payload["rows"][0][1] = 1
    payload["pretend_forecast_validated"] = True
    with pytest.raises(ValueError, match="exactly"):
        validate_input(payload, model)
