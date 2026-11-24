"""Integrity checks for issue-boundary-purged evaluation sidecars."""

import json

import pytest
from breathewise.ml.experiment import HOURLY_HORIZONS, sha256
from breathewise.ml.issue_purged import load_issue_purged


def test_purged_sidecar_rejects_altered_report_or_source_bytes(tmp_path):
    protocol = tmp_path / "protocol.json"
    protocol.write_text("{}")
    predictions = tmp_path / "heldout_predictions.csv"
    predictions.write_text("synthetic mechanics only\n")
    version = "synthetic-utc-version"
    manifest = {
        "model_version": version,
        "heldout_predictions": {"path": predictions.name, "sha256": sha256(predictions)},
    }
    (tmp_path / "manifest.json").write_text(json.dumps(manifest))
    score = {
        cohort: {
            method: {"count": 1, "mae": 1.0, "rmse": 1.0, "bias": -1.0}
            for method in ("lightgbm", "persistence", "previous_day_same_hour")
        }
        for cohort in (
            "all_available",
            "common_baseline_cohort",
            "high_pollution_observed_target_ge_150",
        )
    }
    report = {
        "model_version": version,
        "supported_horizons": list(HOURLY_HORIZONS),
        "source_protocol_sha256": sha256(protocol),
        "source_predictions_sha256": sha256(predictions),
        "evaluation": {str(h): {"validation": score, "test": score} for h in HOURLY_HORIZONS},
        "rolling_backtests": {"fold": {str(h): score for h in HOURLY_HORIZONS}},
    }
    path = tmp_path / "issue_purged_evaluation.json"
    path.write_text(json.dumps(report))
    expected = sha256(path)
    assert (
        load_issue_purged(tmp_path, expected)["evaluation"]["24"]["test"]["all_available"][
            "lightgbm"
        ]["bias"]
        == -1
    )
    path.write_text(path.read_text() + " ")
    with pytest.raises(ValueError, match="SHA256"):
        load_issue_purged(tmp_path, expected)
    expected = sha256(path)
    predictions.write_text("tampered")
    with pytest.raises(ValueError, match="SHA256|integrity"):
        load_issue_purged(tmp_path, expected)


def test_purged_sidecar_does_not_accept_a_partial_hourly_set(tmp_path):
    path = tmp_path / "issue_purged_evaluation.json"
    path.write_text(json.dumps({"model_version": "v", "supported_horizons": [1, 3, 6, 12, 24]}))
    (tmp_path / "manifest.json").write_text(json.dumps({"model_version": "v"}))
    with pytest.raises(ValueError, match="horizon mismatch"):
        load_issue_purged(tmp_path, sha256(path))
