"""Reproduce timestamp-rule evaluation; never retrain or replace frozen artifacts."""

import argparse
import csv
import json
import math
import sys
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/api/src"))
from breathewise.ml.experiment import sha256  # noqa:E402

parser = argparse.ArgumentParser(
    description="Reproduce fixed-model boundary-purged metrics without changing fit artifacts"
)
parser.add_argument("--registry", type=Path, default=ROOT / "work/forecast-experiment")
parser.add_argument("--output", type=Path, default=ROOT / "work/forecast-issue-purge-reproduction")
args = parser.parse_args()
reportroot = args.output.resolve()
if not reportroot.is_relative_to(ROOT / "work") or (
    reportroot.exists() and any(reportroot.iterdir())
):
    parser.error("Use an empty output under ignored work; preserve existing evidence")
reportroot.mkdir(parents=True, exist_ok=True)
versions = ["delhi-recorded-pm25-hourly-v2", "delhi-openaq-pm25-hourly-v1"]
registry = args.registry.resolve(strict=True)
protocol = {
    "name": "fixed_model_issue_time_boundary_purge_v1",
    "declared_before_computation_at": datetime.now(UTC).isoformat(),
    "rule": {
        "validation": "issue timestamp >= training target split end",
        "test": "issue timestamp >= validation target split end (test target split start)",
        "rolling_backtests": "issue timestamp >= fold train_end",
    },
    "selection": "Pure timestamp rule fixed before computing purged metrics; no retraining, parameter tuning, feature or target modification",
    "versions": {
        v: {
            "protocol_sha256": sha256(registry / v / "protocol.json"),
            "predictions_sha256": sha256(registry / v / "heldout_predictions.csv"),
            "models": {p.name: sha256(p) for p in (registry / v).glob("horizon*txt")},
        }
        for v in versions
    },
}
protocolpath = reportroot / "purge_protocol.json"
assert not protocolpath.exists(), "Preserve predeclared purge protocol"
protocolpath.write_text(json.dumps(protocol, indent=2) + "\n")
summary = {
    "purge_protocol": protocol,
    "purge_protocol_sha256": sha256(protocolpath),
    "versions": {},
}
for version in versions:
    folder = registry / version
    m = json.loads((folder / "manifest.json").read_text())
    aware = m["dataset_mode"] == "utc_provider_history"
    suffix = "utc" if aware else "recorded"
    counts = {}
    acc = {}
    peaks = {}
    for row in csv.DictReader((folder / "heldout_predictions.csv").open()):
        h = row["horizon_h"]
        split = row["split"]
        key = (h, split)
        c = counts.setdefault(
            key, {"original_rows": 0, "retained_rows": 0, "removed_boundary_rows": 0}
        )
        c["original_rows"] += 1
        if split == "validation":
            cutoff = m["protocol"]["splits"]["train"][1]
        elif split == "test":
            cutoff = m["protocol"]["splits"]["validation"][1]
        else:
            cutoff = next(
                f["train_end"] for f in m["protocol"]["rolling_backtests"] if f["name"] == split
            )
        issue = datetime.fromisoformat(row["issue_at_" + suffix])
        limit = datetime.fromisoformat(cutoff)
        if issue < limit:
            c["removed_boundary_rows"] += 1
            continue
        c["retained_rows"] += 1
        observed = float(row["observed"])
        predictions = {
            "lightgbm": float(row["lightgbm"]),
            "persistence": float(row["persistence"]),
            "previous_day_same_hour": float(row["previous_day_same_hour"])
            if row["previous_day_same_hour"]
            else math.nan,
        }
        common = all(math.isfinite(v) for v in predictions.values())
        high = observed >= 150
        groups = acc.setdefault(
            key,
            {
                g: {n: [0, 0.0, 0.0, 0.0] for n in predictions}
                for g in (
                    "all_available",
                    "common_baseline_cohort",
                    "high_pollution_observed_target_ge_150",
                )
            },
        )
        for name, value in predictions.items():
            if not math.isfinite(value):
                continue
            difference = value - observed
            for cohort, selected in [
                ("all_available", True),
                ("common_baseline_cohort", common),
                ("high_pollution_observed_target_ge_150", high),
            ]:
                if selected:
                    a = groups[cohort][name]
                    a[0] += 1
                    a[1] += abs(difference)
                    a[2] += difference * difference
                    a[3] += difference
        if split == "test":
            event = {
                "target_at_" + suffix: row["target_at_" + suffix],
                "observed": observed,
                "prediction": predictions["lightgbm"],
                "underprediction": observed - predictions["lightgbm"],
            }
            peak = peaks.setdefault(
                h, {"maximum_underprediction": event, "maximum_observed_target": event}
            )
            if event["underprediction"] > peak["maximum_underprediction"]["underprediction"]:
                peak["maximum_underprediction"] = event
            if observed > peak["maximum_observed_target"]["observed"]:
                peak["maximum_observed_target"] = event

    def scores(key, accumulator):
        result = {
            g: {
                n: {
                    "count": a[0],
                    "mae": a[1] / a[0] if a[0] else None,
                    "rmse": math.sqrt(a[2] / a[0]) if a[0] else None,
                    "bias": a[3] / a[0] if a[0] else None,
                }
                for n, a in methods.items()
            }
            for g, methods in accumulator[key].items()
        }
        result["high_pollution_threshold_ugm3"] = 150
        result["high_pollution_definition"] = (
            "Observed target >=150µg/m³ descriptive subset; not a health category"
        )
        return result

    report = {
        "schema_version": "1.0",
        "model_version": version,
        "dataset_mode": m["dataset_mode"],
        "clock_basis": "UTC" if aware else "source_naive_clock_unverified",
        "supported_horizons": m["supported_horizons"],
        "authoritative_for_no_boundary_lookahead_comparison": True,
        "source_protocol_sha256": sha256(folder / "protocol.json"),
        "source_predictions_sha256": sha256(folder / "heldout_predictions.csv"),
        "purge_protocol_sha256": sha256(protocolpath),
        "rule": protocol["rule"],
        "evaluation": {
            str(h): {split: scores((str(h), split), acc) for split in ("validation", "test")}
            for h in m["supported_horizons"]
        },
        "rolling_backtests": {
            f["name"]: {str(h): scores((str(h), f["name"]), acc) for h in m["supported_horizons"]}
            for f in m["protocol"]["rolling_backtests"]
        },
        "row_counts": {
            str(h): {
                split: counts[(str(h), split)]
                for split in (
                    "validation",
                    "test",
                    *[f["name"] for f in m["protocol"]["rolling_backtests"]],
                )
            }
            for h in m["supported_horizons"]
        },
        "peak_underprediction_test": peaks,
        "limitations": m["limitations"]
        + [
            "Original target-split-only metrics include fixed-model fit/selection availability boundary violations up to24h; use this issue-purged comparison for no-boundary-lookahead skill claims.",
            "Purging split boundaries does not resolve historical input publication times or confer live readiness.",
        ],
        "completed_at": datetime.now(UTC).isoformat(),
    }
    destination = reportroot / version
    destination.mkdir()
    path = destination / "issue_purged_evaluation.json"
    assert not path.exists()
    path.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
    summary["versions"][version] = {
        "sidecar_file": path.name,
        "sidecar_sha256": sha256(path),
        "report": report,
    }
    for name, expected in protocol["versions"][version]["models"].items():
        assert sha256(folder / name) == expected
    assert sha256(folder / "protocol.json") == protocol["versions"][version]["protocol_sha256"]
    assert (
        sha256(folder / "heldout_predictions.csv")
        == protocol["versions"][version]["predictions_sha256"]
    )
    print(
        version,
        "boundary removed",
        sum(c["removed_boundary_rows"] for c in counts.values()),
        "h1purgedMAE",
        report["evaluation"]["1"]["test"]["common_baseline_cohort"]["lightgbm"]["mae"],
    )
(reportroot / "summary.json").write_text(json.dumps(summary, indent=2, allow_nan=False) + "\n")
