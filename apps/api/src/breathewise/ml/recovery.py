"""Hash-verified recovery of data/state, without running serialized Python code."""

import hashlib
import json
import math
from dataclasses import dataclass
from pathlib import Path

from breathewise.ml.state_reader import StateReadError, Symbol, inspect_state


@dataclass
class RecoveredModel:
    artifact_name: str
    artifact_sha256: str
    native_sha256: str
    native_text: str
    features: list[str]
    horizons: list[int]
    target_transform: str
    best_iteration: int
    state: dict
    reader: object

    def summary(self):
        lookup = self.state.get("stations_lookup")
        registry = None
        if isinstance(lookup, list) and lookup:
            registry = {
                "count": len(lookup),
                "fields": list(lookup[0]),
                "duplicate_location_ids": len(lookup) - len({row["location_id"] for row in lookup}),
                "city_equals_station_name": sum(
                    row["city"] == row["station_name"] for row in lookup
                ),
                "nonfinite_values_per_field": {
                    key: sum(
                        isinstance(row[key], float) and not math.isfinite(row[key])
                        for row in lookup
                    )
                    for key in lookup[0]
                },
                "live_station_eligibility": "unverified",
                "population_epoch": "not present in recovered registry fields",
            }
        return {
            "artifact": self.artifact_name,
            "artifact_sha256": self.artifact_sha256,
            "native_booster_sha256": self.native_sha256,
            "state_keys": list(self.state),
            "python_constructors_executed": False,
            "state_read_complete": True,
            "state_read_semantics": "Complete serialized data/descriptor traversal; no reconstructed Python runtime objects or methods",
            "feature_count": len(self.features),
            "features": self.features,
            "declared_horizons": self.horizons,
            "declared_target_transform": self.target_transform,
            "stored_best_iteration": self.best_iteration,
            "stored_training_parameters": self.state["booster"].state.get("params"),
            "stored_training_scores_present": "best_score" in self.state["booster"].state,
            "stored_training_scores_validated": False,
            "serialized_symbol_names": sorted({symbol.name for symbol in self.reader.symbols}),
            "joblib_array_descriptors": [
                {"shape": list(array.state["shape"]), "dtype": array.state["dtype"].args[0]}
                for array in self.reader.arrays
            ],
            "station_registry": registry,
            "operational_forecast_ready": False,
            "preprocessing_recovered": False,
            "golden_output_parity_verified": False,
            "target_units_verified": False,
            "training_python_package_versions": "not recovered",
        }


def recover_artifact(path: Path, audit_path: Path) -> RecoveredModel:
    expected = json.loads(audit_path.read_text())
    if path.name not in expected:
        raise StateReadError("Artifact is absent from the supplied hash manifest")
    audit = expected[path.name]
    if path.stat().st_size != audit["bytes"]:
        raise StateReadError("Artifact size differs from supplied manifest")
    data = path.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if digest != audit["sha256"]:
        raise StateReadError("Artifact SHA256 differs from supplied manifest")
    root, reader = inspect_state(data)
    if isinstance(root, Symbol):
        if root.name != "__main__.HyperlocalAQPipeline":
            raise StateReadError("Unexpected serialized root descriptor")
        state = root.state
    else:
        state = root
    if not isinstance(state, dict) or not isinstance(state.get("booster"), Symbol):
        raise StateReadError("Missing serialized booster state")
    booster = state["booster"]
    if booster.name != "lightgbm.basic.Booster" or not isinstance(booster.state, dict):
        raise StateReadError("Unexpected booster descriptor")
    native = booster.state.get("_handle")
    if not isinstance(native, str) or not native.startswith("tree\nversion=v4\n"):
        raise StateReadError("Expected native v4 LightGBM model text")
    native_digest = hashlib.sha256(native.encode()).hexdigest()
    if native_digest != audit["embedded_booster_sha256"]:
        raise StateReadError("Embedded native booster differs from supplied audit")
    features = state.get("features")
    native_features = next(
        (
            line.removeprefix("feature_names=").split()
            for line in native.splitlines()
            if line.startswith("feature_names=")
        ),
        None,
    )
    if features != audit["features"] or features != native_features:
        raise StateReadError("Feature order differs between state, native model and audit")
    if (
        state.get("horizons") != audit["declared_horizons"]
        or state.get("target_transform") != audit["target_transform"]
    ):
        raise StateReadError("Horizon/transform metadata differs from audit")
    best = booster.state.get("best_iteration")
    if type(best) is not int or best <= 0:
        raise StateReadError("Missing valid serialized best_iteration; do not guess tree selection")
    return RecoveredModel(
        path.name,
        digest,
        native_digest,
        native,
        features,
        state["horizons"],
        state["target_transform"],
        best,
        state,
        reader,
    )
