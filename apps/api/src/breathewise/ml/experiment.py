"""Independent recorded-clock PM2.5 research experiment; never the supplied 75-input model.

Optional numerical libraries are imported only inside experiment functions. Registry JSON
and artifact-integrity checks can be used by the API without installing LightGBM.
"""

import csv
import hashlib
import json
import math
from datetime import UTC, datetime, timedelta
from pathlib import Path

MODEL_VERSION = "delhi-recorded-pm25-v1"
HORIZONS = (1, 3, 6, 12, 24)
HOURLY_MODEL_VERSION = "delhi-recorded-pm25-hourly-v2"
HOURLY_HORIZONS = tuple(range(1, 25))
EXPERIMENT_VERSIONS = {MODEL_VERSION: HORIZONS, HOURLY_MODEL_VERSION: HOURLY_HORIZONS}
LAGS = (0, 1, 2, 3, 6, 12, 24, 48, 72, 168)
WINDOWS = (6, 24, 168)
# Frozen before any experiment fit; each split constrains target timestamps.
SPLITS = {
    "train": ("2017-01-01T00:00:00", "2024-01-01T00:00:00"),
    "validation": ("2024-01-01T00:00:00", "2025-01-01T00:00:00"),
    "test": ("2025-01-01T00:00:00", "2026-11-01T00:00:00"),
}
BACKTESTS = (
    {
        "name": "rolling_2022",
        "train_end": "2022-01-01T00:00:00",
        "score_end": "2023-01-01T00:00:00",
    },
    {
        "name": "rolling_2023",
        "train_end": "2023-01-01T00:00:00",
        "score_end": "2024-01-01T00:00:00",
    },
)
PARAMETERS = {
    "objective": "regression_l1",
    "metric": "l1",
    "learning_rate": 0.05,
    "num_leaves": 23,
    "min_data_in_leaf": 60,
    "feature_fraction": 1.0,
    "bagging_fraction": 1.0,
    "seed": 20261124,
    "num_threads": 2,
    "deterministic": True,
    "force_col_wise": True,
    "verbosity": -1,
}
LIMITATIONS = [
    "Retrospective recorded-clock experiment only; source timezone and interval meaning unresolved.",
    "Assumes the recorded current row is known at its recorded clock; historical publication times are unknown.",
    "No live/provider alignment, original 75-feature pipeline parity, clinical or spatial readiness.",
    "No prediction intervals, exceedance probabilities or untrained intermediate horizons.",
    "One candidate source station; official station registry crosswalk and generalization remain unverified.",
]


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def feature_definitions(horizon):
    if type(horizon) is not int or horizon not in HOURLY_HORIZONS:
        raise ValueError("Unsupported experiment horizon")
    result = []
    for lag in LAGS:
        result.append(
            {
                "name": f"pm25_lag_{lag}h",
                "unit": "µg/m³",
                "formula": f"exact observed PM2.5 at issue - {lag}h; missing remains NaN",
            }
        )
        result.append(
            {
                "name": f"pm25_lag_{lag}h_missing",
                "unit": "indicator",
                "formula": f"1 iff exact lag {lag}h is absent; never a substituted concentration",
            }
        )
    for window in WINDOWS:
        for statistic in ("mean", "std", "max", "count"):
            result.append(
                {
                    "name": f"pm25_trailing_{window}h_{statistic}",
                    "unit": "count" if statistic == "count" else "µg/m³",
                    "formula": f"observed-only {statistic} over [issue-{window - 1}h, issue]; mean/std/max require >=ceil(0.75*{window}) observed hours; std ddof=0",
                }
            )
    for lag in (3, 24):
        result.append(
            {
                "name": f"pm25_difference_{lag}h",
                "unit": "µg/m³",
                "formula": f"current observed PM2.5 minus exact lag {lag}h, NaN if either absent",
            }
        )
    for name, formula in [
        ("target_hour_sin", "sin(2*pi*recorded target hour/24)"),
        ("target_hour_cos", "cos(2*pi*recorded target hour/24)"),
        ("target_doy_sin", "sin(2*pi*(recorded target day-of-year-1)/365.25)"),
        ("target_doy_cos", "cos(2*pi*(recorded target day-of-year-1)/365.25)"),
        ("target_weekend", "1 iff recorded target weekday is Saturday or Sunday"),
    ]:
        result.append({"name": name, "unit": "dimensionless", "formula": formula})
    return result


def load_observed(path, station_id="site_301"):
    import duckdb
    import numpy as np

    with duckdb.connect() as connection:
        rows = connection.execute(
            """SELECT timestamp,pm25 FROM read_parquet(?)
            WHERE site_id=? AND analysis_eligible
            AND timestamp>=TIMESTAMP '2017-01-01' AND timestamp<TIMESTAMP '2026-11-01'
            ORDER BY timestamp""",
            [str(path), station_id],
        ).fetchall()
    if not rows:
        raise ValueError("No eligible observed station rows")
    if any(time.tzinfo or time.minute or time.second or time.microsecond for time, _ in rows):
        raise ValueError("Experiment requires naive recorded-clock exact hourly source rows")
    if len({time for time, _ in rows}) != len(rows):
        raise ValueError("Duplicate recorded clock rows require explicit reconciliation")
    if any(value is not None and (not math.isfinite(value) or value < 0) for _, value in rows):
        raise ValueError("Invalid source PM2.5; do not silently replace or clip")
    start, end = rows[0][0], rows[-1][0]
    times = [
        start + timedelta(hours=i) for i in range(int((end - start).total_seconds() / 3600) + 1)
    ]
    values = np.full(len(times), np.nan)
    for time, value in rows:
        if value is not None:
            values[int((time - start).total_seconds() / 3600)] = value
    return times, values


def make_frame(times, values, horizon):
    """Exact causal features; row target is observed at issue+h. No preprocessing fit."""
    import numpy as np

    definitions = feature_definitions(horizon)
    if len(times) != len(values) or any(t.tzinfo for t in times):
        raise ValueError("Recorded clock time/value lengths or timezone invalid")
    if any(b - a != timedelta(hours=1) for a, b in zip(times, times[1:], strict=False)):
        raise ValueError("Pass an explicit hourly grid with NaN at gaps")
    if any(not math.isnan(float(v)) and (not math.isfinite(float(v)) or v < 0) for v in values):
        raise ValueError("Concentrations must be nonnegative finite observations or NaN")
    columns = []
    for lag in LAGS:
        x = np.full(len(values), np.nan)
        if lag == 0:
            x[:] = values
        elif lag < len(values):
            x[lag:] = values[:-lag]
        columns.extend([x, np.isnan(x).astype(float)])
    for window in WINDOWS:
        stats = [np.full(len(values), np.nan) for _ in range(3)]
        count = np.zeros(len(values))
        for i in range(len(values)):
            observed = values[max(0, i - window + 1) : i + 1]
            observed = observed[np.isfinite(observed)]
            count[i] = len(observed)
            if len(observed) >= math.ceil(0.75 * window):
                stats[0][i], stats[1][i], stats[2][i] = (
                    observed.mean(),
                    observed.std(ddof=0),
                    observed.max(),
                )
        columns.extend([*stats, count])
    for lag in (3, 24):
        difference = np.full(len(values), np.nan)
        if lag < len(values):
            difference[lag:] = values[lag:] - values[:-lag]
        columns.append(difference)
    targets = [time + timedelta(hours=horizon) for time in times]
    columns.extend(
        [
            np.array([math.sin(2 * math.pi * t.hour / 24) for t in targets]),
            np.array([math.cos(2 * math.pi * t.hour / 24) for t in targets]),
            np.array(
                [math.sin(2 * math.pi * (t.timetuple().tm_yday - 1) / 365.25) for t in targets]
            ),
            np.array(
                [math.cos(2 * math.pi * (t.timetuple().tm_yday - 1) / 365.25) for t in targets]
            ),
            np.array([float(t.weekday() >= 5) for t in targets]),
        ]
    )
    x = np.column_stack(columns)
    y = np.full(len(values), np.nan)
    previous_day = np.full(len(values), np.nan)
    if horizon < len(values):
        y[:-horizon] = values[horizon:]
    # target - 24h is <= issue for every supported horizon, including h24=current.
    previous_lag = 24 - horizon
    if previous_lag == 0:
        previous_day[:] = values
    elif previous_lag < len(values):
        previous_day[previous_lag:] = values[:-previous_lag]
    assert x.shape[1] == len(definitions)
    return {
        "x": x,
        "y": y,
        "issue_times": times,
        "target_times": targets,
        "persistence": np.array(values, copy=True),
        "previous_day": previous_day,
        "feature_names": [item["name"] for item in definitions],
    }


def split_mask(frame, start, end):
    import numpy as np

    start, end = datetime.fromisoformat(start), datetime.fromisoformat(end)
    if start.tzinfo or end.tzinfo or start >= end:
        raise ValueError("Use increasing naive recorded-clock split bounds")
    return (
        np.array([start <= t < end for t in frame["target_times"]])
        & np.isfinite(frame["y"])
        & np.isfinite(frame["persistence"])
    )


def metrics(actual, prediction):
    import numpy as np

    actual, prediction = np.asarray(actual), np.asarray(prediction)
    mask = np.isfinite(actual) & np.isfinite(prediction)
    if not mask.any():
        return {"count": 0, "mae": None, "rmse": None, "bias": None}
    difference = prediction[mask] - actual[mask]
    return {
        "count": int(mask.sum()),
        "mae": float(np.abs(difference).mean()),
        "rmse": float(np.sqrt((difference**2).mean())),
        "bias": float(difference.mean()),
    }


def score_group(actual, model, persistence, previous_day):
    import numpy as np

    common = (
        np.isfinite(actual)
        & np.isfinite(model)
        & np.isfinite(persistence)
        & np.isfinite(previous_day)
    )
    high = np.isfinite(actual) & (actual >= 150)
    names = {"lightgbm": model, "persistence": persistence, "previous_day_same_hour": previous_day}
    return {
        "all_available": {name: metrics(actual, values) for name, values in names.items()},
        "common_baseline_cohort": {
            name: metrics(actual[common], values[common]) for name, values in names.items()
        },
        "high_pollution_observed_target_ge_150": {
            name: metrics(actual[high], values[high]) for name, values in names.items()
        },
        "high_pollution_threshold_ugm3": 150,
        "high_pollution_definition": "observed target >=150 µg/m³, descriptive retrospective subset, not a health category",
    }


def checked_artifact(folder, descriptor):
    folder = Path(folder).resolve()
    path = (folder / descriptor["path"]).resolve()
    if (
        not path.is_relative_to(folder)
        or not path.is_file()
        or sha256(path) != descriptor["sha256"]
    ):
        raise ValueError("Experiment artifact path/SHA256 verification failed")
    return path


def _validate_scores(scores):
    for cohort in (
        "all_available",
        "common_baseline_cohort",
        "high_pollution_observed_target_ge_150",
    ):
        for method in ("lightgbm", "persistence", "previous_day_same_hour"):
            result = scores[cohort][method]
            if type(result["count"]) is not int or result["count"] < 0:
                raise ValueError("Invalid evaluation count")
            for field in ("mae", "rmse", "bias"):
                value = result[field]
                if result["count"] == 0 and value is None:
                    continue
                if type(value) not in (int, float) or not math.isfinite(value):
                    raise ValueError("Invalid evaluation metric")
                if field != "bias" and value < 0:
                    raise ValueError("Invalid evaluation error")


def load_manifest(folder):
    folder = Path(folder)
    manifest = json.loads((folder / "manifest.json").read_text())
    try:
        required = {
            "model_version",
            "supported_horizons",
            "dataset_mode",
            "live_forecast_ready",
            "retrospective_evaluation_ready",
            "source_station_ids",
            "target_unit",
            "target_transform",
            "dataset_sha256",
            "protocol",
            "models",
            "heldout_predictions",
            "evaluation",
            "rolling_backtests",
            "preprocessing",
            "input_availability_assumption",
            "limitations",
        }
        if not isinstance(manifest, dict) or not required.issubset(manifest):
            raise ValueError("Incomplete experiment manifest")
        horizons = EXPERIMENT_VERSIONS.get(manifest["model_version"])
        if horizons is None or manifest["supported_horizons"] != list(horizons):
            raise ValueError("Unknown experiment version/horizons")
        if (
            manifest["dataset_mode"] != "recorded_clock"
            or manifest["live_forecast_ready"] is not False
        ):
            raise ValueError("Experiment must remain retrospective recorded-clock only")
        if manifest["retrospective_evaluation_ready"] is not True:
            raise ValueError("Retrospective evaluation is not ready")
        if (
            manifest["source_station_ids"] != ["site_301"]
            or manifest["target_unit"] != "µg/m³"
            or manifest["target_transform"] != "identity"
        ):
            raise ValueError("Experiment station/target semantics mismatch")
        if manifest["protocol"]["splits"] != {key: list(value) for key, value in SPLITS.items()}:
            raise ValueError("Frozen target splits mismatch")
        if not isinstance(manifest["limitations"], list) or not all(
            isinstance(x, str) for x in manifest["limitations"]
        ):
            raise ValueError("Invalid limitation metadata")
        if set(manifest["models"]) != {str(h) for h in horizons}:
            raise ValueError("Manifest must declare exactly the trained experiment horizons")
        for horizon, descriptor in manifest["models"].items():
            expected = [item["name"] for item in feature_definitions(int(horizon))]
            if descriptor.get("feature_names") != expected:
                raise ValueError("Experiment feature order metadata mismatch")
            checked_artifact(folder, descriptor)
            for split in ("validation", "test"):
                _validate_scores(manifest["evaluation"][horizon][split])
        if set(manifest["rolling_backtests"]) != {fold["name"] for fold in BACKTESTS}:
            raise ValueError("Rolling backtest metadata mismatch")
        for fold in manifest["rolling_backtests"].values():
            for horizon in horizons:
                _validate_scores(fold[str(horizon)])
        checked_artifact(folder, manifest["heldout_predictions"])
        protocol_path = folder / "protocol.json"
        if protocol_path.exists() and json.loads(protocol_path.read_text()) != manifest["protocol"]:
            raise ValueError("Persisted pre-fit protocol mismatch")
        if manifest.get("protocol_sha256") and sha256(protocol_path) != manifest["protocol_sha256"]:
            raise ValueError("Persisted pre-fit protocol SHA256 mismatch")
        return manifest
    except (KeyError, TypeError, AttributeError) as exc:
        raise ValueError("Malformed experiment manifest") from exc


def load_native_model(folder, horizon, *, openmp_library=None):
    """Verified optional offline native loading; never exposes live inference."""
    manifest = load_manifest(folder)
    if type(horizon) is not int or horizon not in manifest["supported_horizons"]:
        raise ValueError("Unsupported experiment horizon")
    if openmp_library:
        import ctypes

        ctypes.CDLL(str(Path(openmp_library).resolve(strict=True)), mode=ctypes.RTLD_GLOBAL)
    import lightgbm as lgb

    descriptor = manifest["models"][str(horizon)]
    model = lgb.Booster(model_file=str(checked_artifact(folder, descriptor)))
    if model.feature_name() != descriptor["feature_names"]:
        raise ValueError("Native model feature order mismatch")
    if model.num_trees() != descriptor["best_iteration"]:
        raise ValueError("Native model iteration count mismatch")
    return model


def run_experiment(source, output, *, openmp_library=None, model_version=MODEL_VERSION):
    import ctypes

    if openmp_library:
        ctypes.CDLL(str(Path(openmp_library).resolve(strict=True)), mode=ctypes.RTLD_GLOBAL)
    import lightgbm as lgb
    import numpy as np

    if model_version not in EXPERIMENT_VERSIONS:
        raise ValueError("Unknown experiment version")
    horizons = EXPERIMENT_VERSIONS[model_version]
    source, output = Path(source).resolve(strict=True), Path(output).resolve()
    if output.exists() and any(output.iterdir()):
        raise ValueError("Experiment output must be empty; preserve previous evidence/version")
    output.mkdir(parents=True, exist_ok=True)
    protocol = {
        "model_version": model_version,
        "source_sha256": sha256(source),
        "station_id": "site_301",
        "splits": SPLITS,
        "rolling_backtests": BACKTESTS,
        "supported_horizons": list(horizons),
        "parameters": PARAMETERS,
        "max_boost_round": 200,
        "early_stopping_rounds": 20,
        "target_transform": "identity",
        "dataset_mode": "recorded_clock",
        "frozen_before_fit_at": datetime.now(UTC).isoformat(),
        "selection_policy": "Inherited v1 fixed parameters; validation early stopping only; no test tuning",
        "prior_evidence": "v1 five-horizon test metrics already observed before hourly extension; v2 is a preregistered extension, not an untouched confirmatory test",
    }
    (output / "protocol.json").write_text(json.dumps(protocol, indent=2) + "\n")
    times, values = load_observed(source)
    report = {
        "model_version": model_version,
        "dataset_mode": "recorded_clock",
        "timezone": None,
        "source_station_ids": ["site_301"],
        "station_name": "Anand Vihar (archive source folder Aanad Vihar)",
        "pollutant": "pm25",
        "target_unit": "µg/m³",
        "target_transform": "identity",
        "supported_horizons": list(horizons),
        "continuous_trajectory": False,
        "live_forecast_ready": False,
        "retrospective_evaluation_ready": True,
        "historical_publication_time_known": False,
        "protocol": protocol,
        "dataset_sha256": protocol["source_sha256"],
        "source_file_name": source.name,
        "observed_count": int(np.isfinite(values).sum()),
        "grid_count": len(times),
        "preprocessing": "no fit/scaling/imputation; native NaN plus explicit lag missing indicators",
        "input_availability_assumption": "recorded current and past rows hypothetically available at issue; actual publication unknown",
        "libraries": {"lightgbm": lgb.__version__, "numpy": np.__version__},
        "limitations": [
            *LIMITATIONS,
            "Full hourly retrospective outputs do not establish a live operational trajectory.",
        ],
        "missing_input_behavior": {
            "missing_current": "issue excluded; no persistence or model forecast",
            "missing_target": "excluded from evaluation; never imputed",
            "older_lags": "native NaN plus missing indicators",
            "rolling_statistics": "NaN below 75 percent observed window; count retained",
            "previous_day_baseline": "missing prediction if exact comparison row absent",
        },
        "models": {},
        "evaluation": {},
        "rolling_backtests": {},
    }
    predictions_path = output / "heldout_predictions.csv"
    fields = [
        "model_version",
        "station_id",
        "pollutant",
        "split",
        "horizon_h",
        "issue_at_recorded",
        "target_at_recorded",
        "observed",
        "lightgbm",
        "persistence",
        "previous_day_same_hour",
    ]
    prediction_count = 0
    with predictions_path.open("w", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        for horizon in horizons:
            frame = make_frame(times, values, horizon)
            names = frame["feature_names"]
            masks = {key: split_mask(frame, *bounds) for key, bounds in SPLITS.items()}
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
            path = output / f"horizon_{horizon}h.txt"
            model.save_model(str(path), num_iteration=model.best_iteration)
            reloaded = lgb.Booster(model_file=str(path))
            report["models"][str(horizon)] = {
                "path": path.name,
                "sha256": sha256(path),
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
            for split in ["validation", "test"]:
                mask = masks[split]
                predicted = model.predict(frame["x"][mask], num_iteration=model.best_iteration)
                reload_values = reloaded.predict(frame["x"][mask])
                if not np.allclose(predicted, reload_values, rtol=0, atol=1e-10):
                    raise ValueError("Native model reload prediction mismatch")
                report["evaluation"][str(horizon)][split] = score_group(
                    frame["y"][mask],
                    predicted,
                    frame["persistence"][mask],
                    frame["previous_day"][mask],
                )
                for index, prediction in zip(np.flatnonzero(mask), predicted, strict=True):
                    row = {
                        "model_version": model_version,
                        "station_id": "site_301",
                        "pollutant": "pm25",
                        "split": split,
                        "horizon_h": horizon,
                        "issue_at_recorded": times[index].isoformat(),
                        "target_at_recorded": frame["target_times"][index].isoformat(),
                        "observed": float(frame["y"][index]),
                        "lightgbm": float(prediction),
                        "persistence": float(frame["persistence"][index]),
                        "previous_day_same_hour": float(frame["previous_day"][index])
                        if np.isfinite(frame["previous_day"][index])
                        else None,
                    }
                    writer.writerow(row)
                    prediction_count += 1
            for fold in BACKTESTS:
                train_mask = split_mask(frame, SPLITS["train"][0], fold["train_end"])
                score_mask = split_mask(frame, fold["train_end"], fold["score_end"])
                # Fixed round budget chosen before test; folds are never trained on their score targets.
                fold_train = lgb.Dataset(
                    frame["x"][train_mask], label=frame["y"][train_mask], feature_name=names
                )
                fold_model = lgb.train(PARAMETERS, fold_train, num_boost_round=100)
                predicted = fold_model.predict(frame["x"][score_mask])
                report["rolling_backtests"].setdefault(fold["name"], {})[str(horizon)] = (
                    score_group(
                        frame["y"][score_mask],
                        predicted,
                        frame["persistence"][score_mask],
                        frame["previous_day"][score_mask],
                    )
                )
                for index, prediction in zip(np.flatnonzero(score_mask), predicted, strict=True):
                    writer.writerow(
                        {
                            "model_version": model_version,
                            "station_id": "site_301",
                            "pollutant": "pm25",
                            "split": fold["name"],
                            "horizon_h": horizon,
                            "issue_at_recorded": times[index].isoformat(),
                            "target_at_recorded": frame["target_times"][index].isoformat(),
                            "observed": float(frame["y"][index]),
                            "lightgbm": float(prediction),
                            "persistence": float(frame["persistence"][index]),
                            "previous_day_same_hour": float(frame["previous_day"][index])
                            if np.isfinite(frame["previous_day"][index])
                            else None,
                        }
                    )
                    prediction_count += 1
    report["heldout_predictions"] = {
        "path": predictions_path.name,
        "sha256": sha256(predictions_path),
        "rows": prediction_count,
        "columns": fields,
    }
    report["protocol_sha256"] = sha256(output / "protocol.json")
    report["completed_at"] = datetime.now(UTC).isoformat()
    (output / "manifest.json").write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
    load_manifest(output)
    return report
