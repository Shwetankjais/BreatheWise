"""Independent UTC-native research path; historical publication times remain unknown."""

import csv
import json
import math
from datetime import UTC, datetime, timedelta
from pathlib import Path

from breathewise.ml.experiment import (
    HOURLY_HORIZONS,
    LAGS,
    PARAMETERS,
    WINDOWS,
    _validate_scores,
    checked_artifact,
    feature_definitions,
    score_group,
    sha256,
)

UTC_MODEL_VERSION = "delhi-openaq-pm25-hourly-v1"
UTC_SPLITS = {
    "train": ("2025-01-01T00:00:00+00:00", "2026-01-01T00:00:00+00:00"),
    "validation": ("2026-01-01T00:00:00+00:00", "2026-07-01T00:00:00+00:00"),
    "test": ("2026-07-01T00:00:00+00:00", "2026-11-24T00:00:00+00:00"),
}
UTC_BACKTESTS = (
    {
        "name": "rolling_2025_q4",
        "train_end": "2025-10-01T00:00:00+00:00",
        "score_end": "2026-01-01T00:00:00+00:00",
    },
    {
        "name": "rolling_2026_q1",
        "train_end": "2026-01-01T00:00:00+00:00",
        "score_end": "2026-04-01T00:00:00+00:00",
    },
)
UTC_LIMITATIONS = [
    "UTC-native single-sensor retrospective experiment, not an operational forecast service.",
    "Historical measurement interval bounds are known; historical publication/first-availability times remain unknown.",
    "Current/past input intervals are hypothetically available at issue in retrospective evaluation; this is not verified issue-time availability.",
    "No calibrated intervals/probabilities, spatial generalization, activity-planning or public-live readiness.",
    "A full hourly target set is not evidence of prospective trajectory skill.",
]


def utc_time(value):
    stamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if stamp.tzinfo is None or stamp.utcoffset() != timedelta(0):
        raise ValueError("Explicit UTC timestamps required; no naive-source promotion")
    return stamp.astimezone(UTC)


def utc_features(horizon):
    definitions = feature_definitions(horizon)
    for item in definitions:
        item["formula"] = (
            item["formula"]
            .replace("recorded target hour/24", "UTC target (hour+minute/60)/24")
            .replace("recorded target day-of-year", "UTC target day-of-year")
            .replace("recorded target weekday", "UTC target weekday")
        )
    return definitions


def make_utc_frame(times, values, horizon):
    """All time arithmetic stays timezone-aware UTC; exact hourly end:30 grid."""
    import numpy as np

    if type(horizon) is not int or horizon not in HOURLY_HORIZONS:
        raise ValueError("Unsupported UTC experiment horizon")
    if len(times) != len(values) or not times:
        raise ValueError("UTC time/value lengths invalid")
    if any(
        t.tzinfo is None
        or t.utcoffset() != timedelta(0)
        or t.minute != 30
        or t.second
        or t.microsecond
        for t in times
    ):
        raise ValueError("Expected explicit UTC hourly interval-end :30 grid")
    if any(b - a != timedelta(hours=1) for a, b in zip(times, times[1:], strict=False)):
        raise ValueError("Pass an explicit UTC hourly grid with NaN at gaps")
    if any(not math.isnan(float(v)) and (not math.isfinite(float(v)) or v < 0) for v in values):
        raise ValueError("Nonnegative finite observations or explicit NaN required")
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
        diff = np.full(len(values), np.nan)
        if lag < len(values):
            diff[lag:] = values[lag:] - values[:-lag]
        columns.append(diff)
    targets = [t + timedelta(hours=horizon) for t in times]
    columns.extend(
        [
            np.array([math.sin(2 * math.pi * (t.hour + t.minute / 60) / 24) for t in targets]),
            np.array([math.cos(2 * math.pi * (t.hour + t.minute / 60) / 24) for t in targets]),
            np.array(
                [math.sin(2 * math.pi * (t.timetuple().tm_yday - 1) / 365.25) for t in targets]
            ),
            np.array(
                [math.cos(2 * math.pi * (t.timetuple().tm_yday - 1) / 365.25) for t in targets]
            ),
            np.array([float(t.weekday() >= 5) for t in targets]),
        ]
    )
    y = np.full(len(values), np.nan)
    if horizon < len(values):
        y[:-horizon] = values[horizon:]
    previous_day = np.full(len(values), np.nan)
    lag = 24 - horizon
    if lag == 0:
        previous_day[:] = values
    elif lag < len(values):
        previous_day[lag:] = values[:-lag]
    return {
        "x": np.column_stack(columns),
        "y": y,
        "issue_times": times,
        "target_times": targets,
        "persistence": np.array(values, copy=True),
        "previous_day": previous_day,
        "feature_names": [x["name"] for x in utc_features(horizon)],
    }


def utc_split_mask(frame, start, end):
    import numpy as np

    start, end = utc_time(start), utc_time(end)
    if start >= end:
        raise ValueError("Increasing UTC split bounds required")
    return (
        np.array([start <= t < end for t in frame["target_times"]])
        & np.isfinite(frame["y"])
        & np.isfinite(frame["persistence"])
    )


def load_utc_observed(source):
    """Read the hash-audited provider CSV; partial/unknown hours remain missing."""
    import numpy as np

    source = Path(source)
    payload = json.loads((source.parent / "manifest.json").read_text())
    if (
        payload["station_id"] != "openaq-235"
        or payload["sensor_id"] != 12235610
        or payload["unit"] != "µg/m³"
        or payload["timezone"] != "UTC"
        or payload["interval_semantics"] != "exclusive_hour_ending"
        or payload["dataset_sha256"] != sha256(source)
    ):
        raise ValueError("UTC experiment station/sensor/unit/clock/hash mismatch")
    ordered = {}
    with source.open(newline="") as stream:
        for row in csv.DictReader(stream):
            if (
                row["station_id"] != "openaq-235"
                or row["sensor_id"] != "12235610"
                or row["unit"] != "µg/m³"
            ):
                raise ValueError("UTC observation identity/unit mismatch")
            start, end = utc_time(row["interval_start_utc"]), utc_time(row["measured_at_utc"])
            if (
                end - start != timedelta(hours=1)
                or end.minute != 30
                or end.second
                or end.microsecond
            ):
                raise ValueError("Verified exact 1h interval-end :30 means required")
            if end in ordered:
                raise ValueError("Duplicate UTC intervals require explicit reconciliation")
            value = float(row["value"])
            if not math.isfinite(value) or value < 0:
                raise ValueError("Invalid observed concentration")
            if row["training_eligible"] not in {"0", "1"}:
                raise ValueError("Training eligibility must be explicit 0 or 1")
            eligible = row["training_eligible"] == "1"
            if eligible and float(row["percent_coverage"]) != 100:
                raise ValueError("Training row requires complete measured coverage")
            ordered[end] = value if eligible else np.nan
    if not ordered:
        raise ValueError("No UTC observations")
    first, last = min(ordered), max(ordered)
    times = [
        first + timedelta(hours=i) for i in range(int((last - first).total_seconds() / 3600) + 1)
    ]
    values = np.array([ordered.get(t, np.nan) for t in times], dtype=float)
    return payload, times, values


def load_utc_manifest(folder):
    folder = Path(folder)
    try:
        m = json.loads((folder / "manifest.json").read_text())
        if m["model_version"] != UTC_MODEL_VERSION or m["supported_horizons"] != list(
            HOURLY_HORIZONS
        ):
            raise ValueError("Unknown UTC model/horizons")
        if (
            m["dataset_mode"] != "utc_provider_history"
            or m["timezone"] != "UTC"
            or m["live_forecast_ready"] is not False
            or m["source_station_ids"] != ["openaq-235"]
            or m["target_unit"] != "µg/m³"
            or m["target_transform"] != "identity"
        ):
            raise ValueError("UTC model semantics mismatch")
        if (
            m["protocol"]["splits"] != {k: list(v) for k, v in UTC_SPLITS.items()}
            or m["retrospective_evaluation_ready"] is not True
        ):
            raise ValueError("UTC frozen protocol mismatch")
        if set(m["models"]) != {str(h) for h in HOURLY_HORIZONS}:
            raise ValueError("UTC models incomplete")
        for h, d in m["models"].items():
            checked_artifact(folder, d)
            if d["feature_names"] != [f["name"] for f in utc_features(int(h))]:
                raise ValueError("UTC feature order mismatch")
            for split in ("validation", "test"):
                _validate_scores(m["evaluation"][h][split])
        for fold in UTC_BACKTESTS:
            for h in HOURLY_HORIZONS:
                _validate_scores(m["rolling_backtests"][fold["name"]][str(h)])
        checked_artifact(folder, m["heldout_predictions"])
        if (
            sha256(folder / "protocol.json") != m["protocol_sha256"]
            or json.loads((folder / "protocol.json").read_text()) != m["protocol"]
        ):
            raise ValueError("UTC frozen protocol integrity mismatch")
        return m
    except (KeyError, TypeError, AttributeError) as exc:
        raise ValueError("Malformed UTC manifest") from exc


def load_utc_native_model(folder, horizon, *, openmp_library=None):
    m = load_utc_manifest(folder)
    if type(horizon) is not int or horizon not in m["supported_horizons"]:
        raise ValueError("Unsupported UTC experiment horizon")
    if openmp_library:
        import ctypes

        ctypes.CDLL(str(Path(openmp_library).resolve(strict=True)), mode=ctypes.RTLD_GLOBAL)
    import lightgbm as lgb

    d = m["models"][str(horizon)]
    model = lgb.Booster(model_file=str(checked_artifact(folder, d)))
    if model.feature_name() != d["feature_names"] or model.num_trees() != d["best_iteration"]:
        raise ValueError("UTC native feature order/iteration mismatch")
    return model


def run_utc_experiment(source, output, *, openmp_library=None):
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
        "model_version": UTC_MODEL_VERSION,
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
        "dataset_mode": "utc_provider_history",
        "clock_basis": "UTC",
        "measurement_clock": "hourly mean, interval end at UTC :30; explicit start/end retained",
        "frozen_before_fit_at": datetime.now(UTC).isoformat(),
        "selection_policy": "Inherited fixed recorded-v1 hyperparameters without tuning; validation-only early stopping; frozen test never used for selection",
    }
    (output / "protocol.json").write_text(json.dumps(protocol, indent=2) + "\n")
    report = {
        "model_version": UTC_MODEL_VERSION,
        "dataset_mode": "utc_provider_history",
        "clock_basis": "UTC",
        "timezone": "UTC",
        "source_station_ids": ["openaq-235"],
        "sensor_ids": [12235610],
        "pollutant": "pm25",
        "target_unit": "µg/m³",
        "target_transform": "identity",
        "supported_horizons": list(HOURLY_HORIZONS),
        "continuous_trajectory": False,
        "live_forecast_ready": False,
        "retrospective_evaluation_ready": True,
        "historical_publication_time_known": False,
        "protocol": protocol,
        "dataset_sha256": protocol["source_sha256"],
        "source_file_name": source.name,
        "observed_count": int(np.isfinite(values).sum()),
        "grid_count": len(times),
        "preprocessing": "no fit/scaling/imputation; native NaN and lag missing indicators",
        "input_availability_assumption": "Current and past interval means hypothetically available at issue; actual historical publication times unknown",
        "missing_input_behavior": {
            "missing_current": "issue excluded",
            "missing_target": "target excluded, never interpolated",
            "older_lags": "native NaN plus explicit indicators",
            "rolling_statistics": "NaN below 75 percent observed window",
        },
        "libraries": {"lightgbm": lgb.__version__, "numpy": np.__version__},
        "limitations": UTC_LIMITATIONS,
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
        "previous_day_same_hour",
    ]
    path = output / "heldout_predictions.csv"
    count = 0
    with path.open("w", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        for horizon in HOURLY_HORIZONS:
            frame = make_utc_frame(times, values, horizon)
            names = frame["feature_names"]
            masks = {k: utc_split_mask(frame, *v) for k, v in UTC_SPLITS.items()}
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
                "features": utc_features(horizon),
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
                report["evaluation"][str(horizon)][split] = score_group(
                    frame["y"][mask], pred, frame["persistence"][mask], frame["previous_day"][mask]
                )
                scoring.append((split, mask, pred))
            for fold in UTC_BACKTESTS:
                tm = utc_split_mask(frame, UTC_SPLITS["train"][0], fold["train_end"])
                mask = utc_split_mask(frame, fold["train_end"], fold["score_end"])
                fold_train = lgb.Dataset(frame["x"][tm], label=frame["y"][tm], feature_name=names)
                fm = lgb.train(PARAMETERS, fold_train, num_boost_round=100)
                pred = fm.predict(frame["x"][mask])
                report["rolling_backtests"].setdefault(fold["name"], {})[str(horizon)] = (
                    score_group(
                        frame["y"][mask],
                        pred,
                        frame["persistence"][mask],
                        frame["previous_day"][mask],
                    )
                )
                scoring.append((fold["name"], mask, pred))
            for split, mask, pred in scoring:
                for index, prediction in zip(np.flatnonzero(mask), pred, strict=True):
                    writer.writerow(
                        {
                            "model_version": UTC_MODEL_VERSION,
                            "station_id": "openaq-235",
                            "pollutant": "pm25",
                            "split": split,
                            "horizon_h": horizon,
                            "issue_at_utc": times[index].isoformat(),
                            "target_at_utc": frame["target_times"][index].isoformat(),
                            "observed": float(frame["y"][index]),
                            "lightgbm": float(prediction),
                            "persistence": float(frame["persistence"][index]),
                            "previous_day_same_hour": float(frame["previous_day"][index])
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
    load_utc_manifest(output)
    return report
