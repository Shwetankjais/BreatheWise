"""Independent UTC forecasting under an explicit simulated three-hour publication delay.

Historical first publication is unknown. Real serving separately enforces actual first-seen
cutoffs. Older model freshness/compatibility rules remain unchanged.
"""

import csv
import json
import math
import re
from datetime import UTC, datetime, timedelta
from pathlib import Path

from breathewise.ml.experiment import (
    HOURLY_HORIZONS,
    PARAMETERS,
    _validate_scores,
    checked_artifact,
    score_group,
    sha256,
)
from breathewise.ml.utc_experiment import (
    UTC_BACKTESTS,
    UTC_SPLITS,
    load_utc_observed,
    make_utc_frame,
    utc_features,
    utc_time,
)

MODEL_VERSION = "delhi-openaq-pm25-delay3h-v2"
DELAY_H = 3
MAX_AGE_H = 4
FEATURE_HISTORY_H = 171
SPLIT_RULE = "issue >= assigned split start +3h simulated label-publication delay; target stays within split; model fit/selection availability respected"
SCENARIO = {
    "name": "simulated_fixed_3h_publication_delay",
    "historical_availability_observed": False,
    "minimum_input_age_hours": DELAY_H,
    "maximum_latest_input_age_hours": MAX_AGE_H,
    "latest_input_policy": "latest complete observation at issue-3h, or issue-4h if issue-3h missing",
    "older_missing_policy": "native NaN with missing indicators; no interpolation or concentration defaults",
    "first_seen_serving_rule": "actual available_at <= nominal issue; measured_at <= nominal issue-3h",
}
LIMITATIONS = [
    "Training uses a declared simulated publication-delay scenario; historical first-seen times are unknown.",
    "Single verified OpenAQ sensor12235610 only; serving additionally requires actual first-seen availability and complete hours.",
    "Known input age3..4h is this independently trained regime, not a relaxed gate on older models.",
    "Generation may follow nominal issue by less than60minutes; all targets remain future and actual lead seconds are retained.",
    "Experimental learned shadow output is not public health advice, prospective accuracy, calibrated uncertainty or live planning readiness.",
]


def feature_definitions(horizon):
    result = utc_features(horizon)
    for item in result:
        match = re.match(r"pm25_lag_(\d+)h(_missing)?$", item["name"])
        if match:
            lag, suffix = int(match[1]) + DELAY_H, match[2] or ""
            item["name"] = f"pm25_lag_{lag}h{suffix}"
            item["formula"] = (
                f"Exact complete observation at nominal UTC issue-{lag}h; missing remains NaN"
                if not suffix
                else f"1 iff exact nominal issue-{lag}h observation absent"
            )
        elif not item["name"].startswith("target_"):
            item["name"] += "_cutoff3h"
            item["formula"] = "Evaluate at cutoff = nominal issue-3h. " + item["formula"].replace(
                "issue", "cutoff"
            )
    result.append(
        {
            "name": "latest_known_age_h",
            "unit": "hours",
            "formula": "3 if issue-3h complete observation exists, otherwise4 if issue-4h exists; otherwise issue excluded",
        }
    )
    return result


def make_frame(times, values, horizon):
    import numpy as np

    delayed = np.full(len(values), np.nan)
    if len(values) > DELAY_H:
        delayed[DELAY_H:] = values[:-DELAY_H]
    frame = make_utc_frame(times, delayed, horizon)
    previous = np.full(len(values), np.nan)
    previous[1:] = delayed[:-1]
    frame["persistence"] = np.where(np.isfinite(delayed), delayed, previous)
    age = np.where(np.isfinite(delayed), 3.0, np.where(np.isfinite(previous), 4.0, np.nan))
    frame["x"] = np.column_stack([frame["x"], age])
    frame["feature_names"] = [x["name"] for x in feature_definitions(horizon)]
    frame["latest_known_age_h"] = age
    frame["y"] = np.full(len(values), np.nan)
    if horizon < len(values):
        frame["y"][:-horizon] = values[horizon:]
    # Two-day same-hour comparator remains available under delay3 at every horizon.
    lag = 48 - horizon
    frame["previous_day"] = np.full(len(values), np.nan)
    if lag < len(values):
        frame["previous_day"][lag:] = values[:-lag]
    return frame


def split_mask(frame, start, end):
    import numpy as np

    start, end = utc_time(start), utc_time(end)
    if start >= end:
        raise ValueError("Increasing UTC split bounds required")
    return (
        np.array(
            [
                start <= target < end and issue >= start + timedelta(hours=DELAY_H)
                for target, issue in zip(frame["target_times"], frame["issue_times"], strict=True)
            ]
        )
        & np.isfinite(frame["y"])
        & np.isfinite(frame["persistence"])
    )


def score(actual, model, persistence, seasonal):
    result = score_group(actual, model, persistence, seasonal)
    for group in [
        "all_available",
        "common_baseline_cohort",
        "high_pollution_observed_target_ge_150",
    ]:
        result[group]["previous_two_day_same_hour"] = result[group].pop("previous_day_same_hour")
    return result


def load_manifest(folder):
    folder = Path(folder)
    m = json.loads((folder / "manifest.json").read_text())
    if m["model_version"] != MODEL_VERSION or m["supported_horizons"] != list(HOURLY_HORIZONS):
        raise ValueError("Availability version/horizons mismatch")
    if (
        m["dataset_mode"] != "utc_availability_scenario"
        or m["target_transform"] != "identity"
        or m["availability_scenario"] != SCENARIO
        or m["timezone"] != "UTC"
        or m["source_station_ids"] != ["openaq-235"]
        or m["sensor_ids"] != [12235610]
        or m["target_unit"] != "µg/m³"
        or m["live_forecast_ready"] is not False
    ):
        raise ValueError("Availability semantics mismatch")
    if (
        m["protocol"]["splits"] != {k: list(v) for k, v in UTC_SPLITS.items()}
        or m["protocol"]["availability_scenario"] != SCENARIO
        or m["protocol"]["parameters"] != PARAMETERS
        or m["protocol"]["issue_time_split_rule"] != SPLIT_RULE
        or sha256(folder / "protocol.json") != m["protocol_sha256"]
        or json.loads((folder / "protocol.json").read_text()) != m["protocol"]
    ):
        raise ValueError("Availability frozen protocol mismatch")
    if set(m["models"]) != {str(h) for h in HOURLY_HORIZONS}:
        raise ValueError("Availability models incomplete")
    for key, item in m["models"].items():
        checked_artifact(folder, item)
        if item["feature_names"] != [x["name"] for x in feature_definitions(int(key))] or item[
            "features"
        ] != feature_definitions(int(key)):
            raise ValueError("Availability feature order mismatch")
    checked_artifact(folder, m["heldout_predictions"])
    if set(m["rolling_backtests"]) != {fold["name"] for fold in UTC_BACKTESTS}:
        raise ValueError("Availability backtest set incomplete")
    for horizon in HOURLY_HORIZONS:
        groups = list(m["evaluation"][str(horizon)].values()) + [
            fold[str(horizon)] for fold in m["rolling_backtests"].values()
        ]
        for group in groups:
            normalized = {
                key: {**value, "previous_day_same_hour": value["previous_two_day_same_hour"]}
                if isinstance(value, dict) and "previous_two_day_same_hour" in value
                else value
                for key, value in group.items()
            }
            _validate_scores(normalized)
    return m


def run_experiment(source, output, *, openmp_library=None):
    if openmp_library:
        import ctypes

        ctypes.CDLL(str(Path(openmp_library).resolve(strict=True)), mode=ctypes.RTLD_GLOBAL)
    import lightgbm as lgb
    import numpy as np

    source, output = Path(source).resolve(strict=True), Path(output).resolve()
    if output.exists() and any(output.iterdir()):
        raise ValueError("UTC output must be empty; preserve existing evidence")
    payload, times, values = load_utc_observed(source)
    # Refuse a fabricated/insufficient split before freezing or fitting anything.
    for start, end in UTC_SPLITS.values():
        if (
            sum(
                utc_time(start) <= t < utc_time(end) and math.isfinite(v)
                for t, v in zip(times, values, strict=True)
            )
            < 500
        ):
            raise ValueError("At least 500 observed hours in every frozen UTC split required")
    output.mkdir(parents=True, exist_ok=True)
    protocol = {
        "model_version": MODEL_VERSION,
        "source_sha256": sha256(source),
        "station_id": "openaq-235",
        "sensor_id": 12235610,
        "splits": UTC_SPLITS,
        "rolling_backtests": UTC_BACKTESTS,
        "supported_horizons": list(HOURLY_HORIZONS),
        "parameters": PARAMETERS,
        "max_boost_round": 200,
        "early_stopping_rounds": 20,
        "target_transform": "identity",
        "dataset_mode": "utc_availability_scenario",
        "clock_basis": "UTC",
        "availability_scenario": SCENARIO,
        "measurement_clock": "hourly mean, interval end at UTC :30; explicit start/end retained",
        "frozen_before_fit_at": datetime.now(UTC).isoformat(),
        "issue_time_split_rule": SPLIT_RULE,
        "selection_policy": "Inherited fixed recorded-v1 hyperparameters without tuning; validation-only early stopping; frozen test never used for selection",
    }
    (output / "protocol.json").write_text(json.dumps(protocol, indent=2) + "\n")
    report = {
        "model_version": MODEL_VERSION,
        "dataset_mode": "utc_availability_scenario",
        "clock_basis": "UTC",
        "availability_scenario": SCENARIO,
        "timezone": "UTC",
        "source_station_ids": ["openaq-235"],
        "sensor_ids": [12235610],
        "pollutant": "pm25",
        "target_unit": "µg/m³",
        "target_transform": "identity",
        "supported_horizons": list(HOURLY_HORIZONS),
        "continuous_trajectory": False,
        "live_forecast_ready": False,
        "experimental_shadow_ready": True,
        "evaluation_cohort": "issue_time_purged_availability_scenario",
        "retrospective_evaluation_ready": True,
        "historical_publication_time_known": False,
        "protocol": protocol,
        "dataset_sha256": protocol["source_sha256"],
        "source_file_name": source.name,
        "observed_count": int(np.isfinite(values).sum()),
        "grid_count": len(times),
        "preprocessing": "no fit/scaling/imputation; native NaN and lag missing indicators",
        "input_availability_assumption": "Simulated fixed3h publication delay; current input age3..4h required; historical first publication unknown; real serving additionally enforces actual first-seen cutoff",
        "missing_input_behavior": {
            "missing_current": "issue excluded",
            "missing_target": "target excluded, never interpolated",
            "older_lags": "native NaN plus explicit indicators",
            "rolling_statistics": "NaN below 75 percent observed window",
        },
        "libraries": {"lightgbm": lgb.__version__, "numpy": np.__version__},
        "limitations": LIMITATIONS,
        "models": {},
        "evaluation": {},
        "rolling_backtests": {},
        "source_provenance": payload,
    }
    fields = [
        "model_version",
        "station_id",
        "pollutant",
        "split",
        "horizon_h",
        "issue_at_utc",
        "target_at_utc",
        "observed",
        "lightgbm",
        "persistence",
        "previous_two_day_same_hour",
        "latest_known_age_h",
    ]
    path = output / "heldout_predictions.csv"
    count = 0
    with path.open("w", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        for horizon in HOURLY_HORIZONS:
            frame = make_frame(times, values, horizon)
            names = frame["feature_names"]
            masks = {k: split_mask(frame, *v) for k, v in UTC_SPLITS.items()}
            train = lgb.Dataset(
                frame["x"][masks["train"]], label=frame["y"][masks["train"]], feature_name=names
            )
            validation = lgb.Dataset(
                frame["x"][masks["validation"]],
                label=frame["y"][masks["validation"]],
                reference=train,
                feature_name=names,
            )
            model = lgb.train(
                PARAMETERS,
                train,
                num_boost_round=200,
                valid_sets=[validation],
                callbacks=[lgb.early_stopping(20, verbose=False)],
            )
            model_path = output / f"horizon_{horizon}h.txt"
            model.save_model(str(model_path), num_iteration=model.best_iteration)
            reloaded = lgb.Booster(model_file=str(model_path))
            report["models"][str(horizon)] = {
                "path": model_path.name,
                "sha256": sha256(model_path),
                "best_iteration": model.best_iteration,
                "feature_names": names,
                "features": feature_definitions(horizon),
                "training_sample_count": int(masks["train"].sum()),
                "input_coverage": {
                    "issue_rows_with_missing_current": int(
                        (~np.isfinite(frame["persistence"])).sum()
                    ),
                    "target_rows_missing": int((~np.isfinite(frame["y"])).sum()),
                    "eligible_test_rows_with_any_missing_feature": int(
                        np.isnan(frame["x"][masks["test"]]).any(axis=1).sum()
                    ),
                },
            }
            report["evaluation"][str(horizon)] = {}
            scoring = []
            for split in ("validation", "test"):
                mask = masks[split]
                pred = model.predict(frame["x"][mask], num_iteration=model.best_iteration)
                if not np.allclose(pred, reloaded.predict(frame["x"][mask]), rtol=0, atol=1e-10):
                    raise ValueError("UTC native reload mismatch")
                report["evaluation"][str(horizon)][split] = score(
                    frame["y"][mask], pred, frame["persistence"][mask], frame["previous_day"][mask]
                )
                scoring.append((split, mask, pred))
            for fold in UTC_BACKTESTS:
                tm = split_mask(frame, UTC_SPLITS["train"][0], fold["train_end"])
                mask = split_mask(frame, fold["train_end"], fold["score_end"])
                fold_train = lgb.Dataset(frame["x"][tm], label=frame["y"][tm], feature_name=names)
                fm = lgb.train(PARAMETERS, fold_train, num_boost_round=100)
                pred = fm.predict(frame["x"][mask])
                report["rolling_backtests"].setdefault(fold["name"], {})[str(horizon)] = score(
                    frame["y"][mask],
                    pred,
                    frame["persistence"][mask],
                    frame["previous_day"][mask],
                )
                scoring.append((fold["name"], mask, pred))
            for split, mask, pred in scoring:
                for index, prediction in zip(np.flatnonzero(mask), pred, strict=True):
                    writer.writerow(
                        {
                            "model_version": MODEL_VERSION,
                            "station_id": "openaq-235",
                            "pollutant": "pm25",
                            "split": split,
                            "horizon_h": horizon,
                            "issue_at_utc": times[index].isoformat(),
                            "target_at_utc": frame["target_times"][index].isoformat(),
                            "observed": float(frame["y"][index]),
                            "lightgbm": float(prediction),
                            "persistence": float(frame["persistence"][index]),
                            "latest_known_age_h": float(frame["latest_known_age_h"][index]),
                            "previous_two_day_same_hour": float(frame["previous_day"][index])
                            if np.isfinite(frame["previous_day"][index])
                            else None,
                        }
                    )
                    count += 1
    report["heldout_predictions"] = {
        "path": path.name,
        "sha256": sha256(path),
        "rows": count,
        "columns": fields,
    }
    report["protocol_sha256"] = sha256(output / "protocol.json")
    report["completed_at"] = datetime.now(UTC).isoformat()
    (output / "manifest.json").write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
    load_manifest(output)
    return report


def predict(folder, issue, observations, *, openmp_library=None):
    """Explicit complete input rows with actual first-seen cutoff; no provider/network access."""
    if openmp_library:
        import ctypes

        ctypes.CDLL(str(Path(openmp_library).resolve(strict=True)), mode=ctypes.RTLD_GLOBAL)
    import lightgbm as lgb
    import numpy as np

    issue = utc_time(issue)
    if issue.minute != 30 or issue.second or issue.microsecond:
        raise ValueError("Nominal issue requires exact UTC:end30 phase")
    m = load_manifest(folder)
    end = issue - timedelta(hours=DELAY_H)
    ordered = {}
    for row in observations:
        measured, available = utc_time(row["measured_at"]), utc_time(row["available_at"])
        if measured > end or available > issue:
            raise ValueError("Input exceeds measurement/actual first-seen cutoff")
        if measured.minute != 30 or measured.second or measured.microsecond:
            raise ValueError("Wrong observation interval phase")
        if (
            row["station_id"] != "openaq-235"
            or row["unit"] != "µg/m³"
            or any(
                flag in row.get("quality_flags", [])
                for flag in [
                    "provider_partial_hour",
                    "provider_coverage_unknown",
                    "provider_revision_pending",
                    "provider_verification_failed",
                ]
            )
        ):
            raise ValueError("Incompatible input identity/unit/quality")
        value = float(row["value"])
        if not math.isfinite(value) or value < 0:
            raise ValueError("Invalid observed concentration")
        if measured in ordered:
            raise ValueError("Duplicate interval")
        ordered[measured] = value
    candidates = [
        stamp for stamp in ordered if issue - stamp in [timedelta(hours=3), timedelta(hours=4)]
    ]
    if not candidates:
        raise ValueError("No complete actual-known input age3..4h")
    first = issue - timedelta(hours=FEATURE_HISTORY_H + 1)
    times = [first + timedelta(hours=i) for i in range(FEATURE_HISTORY_H + 2)]
    values = np.array([ordered.get(stamp, np.nan) for stamp in times])
    points = []
    for horizon in HOURLY_HORIZONS:
        frame = make_frame(times, values, horizon)
        item = m["models"][str(horizon)]
        model = lgb.Booster(model_file=str(checked_artifact(folder, item)))
        if (
            model.feature_name() != item["feature_names"]
            or model.num_trees() != item["best_iteration"]
        ):
            raise ValueError("Availability native feature/iteration mismatch")
        value = float(model.predict(frame["x"][-1:])[0])
        if not math.isfinite(value) or value < 0:
            raise ValueError("Model returned unsupported concentration")
        points.append(
            {
                "horizon_h": horizon,
                "target_at": (issue + timedelta(hours=horizon)).isoformat(),
                "concentration": value,
                "unit": "µg/m³",
            }
        )
    return {
        "model_version": MODEL_VERSION,
        "availability_scenario": SCENARIO,
        "nominal_issue_at": issue.isoformat(),
        "feature_cutoff": end.isoformat(),
        "latest_known_age_h": (issue - max(candidates)).total_seconds() / 3600,
        "points": points,
    }
