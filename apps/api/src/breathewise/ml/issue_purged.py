"""Hash-verified secondary evaluation with fixed-model issue availability cutoffs."""

import json
from pathlib import Path

from breathewise.ml.experiment import HOURLY_HORIZONS, _validate_scores, checked_artifact, sha256

SIDECAR_NAME = "issue_purged_evaluation.json"
EXPECTED_SIDECAR_SHA256 = {
    "delhi-recorded-pm25-hourly-v2": "30c4a4a05c40305cf0963e728a803e9e338891d9d004f5cba7a047d811275930",
    "delhi-openaq-pm25-hourly-v1": "e129c23a6a01f26e1757c43a4649fdc778fe9d666196541cb213808085d7cbc5",
}


def load_issue_purged(folder, expected_sha256):
    folder = Path(folder)
    path = folder / SIDECAR_NAME
    if not path.is_file() or path.stat().st_size > 1_000_000 or sha256(path) != expected_sha256:
        raise ValueError("Issue-purged evaluation SHA256/size mismatch")
    try:
        report = json.loads(path.read_text())
        manifest = json.loads((folder / "manifest.json").read_text())
        if report["model_version"] != manifest["model_version"] or report[
            "supported_horizons"
        ] != list(HOURLY_HORIZONS):
            raise ValueError("Issue-purged model/horizon mismatch")
        if (
            report["source_protocol_sha256"] != sha256(folder / "protocol.json")
            or report["source_predictions_sha256"]
            != sha256(checked_artifact(folder, manifest["heldout_predictions"]))
            or report["source_predictions_sha256"] != manifest["heldout_predictions"]["sha256"]
        ):
            raise ValueError("Issue-purged source artifact integrity mismatch")
        for h in HOURLY_HORIZONS:
            for split in ("validation", "test"):
                _validate_scores(report["evaluation"][str(h)][split])
            for fold in report["rolling_backtests"].values():
                _validate_scores(fold[str(h)])
        return report
    except (KeyError, TypeError, AttributeError) as exc:
        raise ValueError("Malformed issue-purged evaluation") from exc
