"""Read-only Delhi archive audit and bounded OpenAQ agreement check; no model inference."""

import argparse
import csv
import hashlib
import json
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path

import duckdb
import httpx
from breathewise.adapters.openaq import OpenAQ
from breathewise.core.config import ROOT, get_settings

POLLUTANTS = ["pm25", "pm10", "no", "no2", "nox", "nh3", "so2", "co", "o3"]


def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def records(connection, query, params=None):
    result = connection.execute(query, params or [])
    names = [x[0] for x in result.description]
    return [dict(zip(names, row, strict=True)) for row in result.fetchall()]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", required=True, type=Path)
    parser.add_argument("--raw-pollutants", required=True, type=Path)
    parser.add_argument("--output", type=Path, default=ROOT / "work/data-source-audit")
    parser.add_argument("--fetch-openaq", action="store_true")
    args = parser.parse_args()
    root = args.archive.resolve(strict=True)
    out = args.output.resolve()
    if not out.is_relative_to(ROOT / "work"):
        parser.error("Detailed audit output must remain in ignored project work/")
    out.mkdir(parents=True, exist_ok=True)
    c = duckdb.connect()
    c.execute("SET TimeZone='UTC'")
    began = time.perf_counter()
    files = sorted((root / "data/cleaned/pollutants").glob("*.parquet"))
    c.read_parquet([str(p) for p in files], union_by_name=True).create_view("pollutants")
    stations = records(
        c,
        """SELECT source_folder,site_id,analysis_eligible,exclusion_reason,count(*) AS rows,
        min(timestamp)::VARCHAR AS first_record,max(timestamp)::VARCHAR AS last_record,
        count(DISTINCT timestamp) AS distinct_hours,count(pm25) AS pm25_present,
        count(pm10) AS pm10_present,count(no2) AS no2_present,count(co) AS co_present,
        count(*) FILTER(WHERE pm25<0 OR NOT isfinite(pm25)) AS pm25_invalid
        FROM pollutants GROUP BY ALL ORDER BY source_folder,site_id""",
    )
    with (out / "station_coverage.csv").open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(stations[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(stations)
    parameter = []
    for field in POLLUTANTS:
        parameter += records(
            c,
            f"""SELECT '{field}' AS parameter,count(*) AS eligible_grid_rows,
            count({field}) AS present_rows,
            count(*) FILTER(WHERE {field}<0 OR NOT isfinite({field})) AS invalid_rows,
            min(timestamp) FILTER(WHERE {field} IS NOT NULL)::VARCHAR AS first_value,
            max(timestamp) FILTER(WHERE {field} IS NOT NULL)::VARCHAR AS last_value
            FROM pollutants WHERE analysis_eligible""",
        )
    totals = records(
        c,
        """SELECT count(*) AS grid_rows,count(DISTINCT source_folder) AS folders,
        count(DISTINCT site_id) AS source_site_ids,
        count(DISTINCT source_folder) FILTER(WHERE analysis_eligible) AS retained_folders,
        count(DISTINCT site_id) FILTER(WHERE analysis_eligible) AS retained_site_ids,
        count(*) FILTER(WHERE NOT analysis_eligible) AS quarantined_rows,
        min(timestamp)::VARCHAR AS first_record,max(timestamp)::VARCHAR AS last_record
        FROM pollutants""",
    )[0]
    report = {
        "verified_at_utc": datetime.now(UTC).isoformat(),
        "archive_name": root.name,
        "read_only_source": True,
        "pollutant_totals": totals,
        "pollutant_parameters": parameter,
        "station_profiles": stations,
        "input_manifest": [
            {"path": str(p.relative_to(root)), "bytes": p.stat().st_size, "sha256": digest(p)}
            for p in files
        ],
        "clock_status": "naive recorded clock; timezone and period start/end unverified",
        "historical_publication_times": "missing; never replaced by measured timestamps",
        "model_pipeline_parity": False,
    }
    weather = str(root / "data/cleaned/weather/*.parquet")
    report["weather"] = records(
        c,
        """SELECT count(*) AS grid_rows,count(DISTINCT location) AS locations,
        min(timestamp)::VARCHAR AS first_record,max(timestamp)::VARCHAR AS last_record,
        count(temperature_c) AS temperature_present,count(smog_pm25) AS smog_pm25_present,
        min(timestamp) FILTER(WHERE smog_pm25 IS NOT NULL)::VARCHAR AS first_smog_pm25
        FROM read_parquet(?)""",
        [weather],
    )[0]
    report["weather"]["model_field_interpretation"] = (
        "supplementary model data, not measured station weather; smog units/algorithm, "
        "forecast initialization/lead time and original model parity unverified"
    )
    report["fire_months_utc"] = records(
        c,
        """SELECT strftime(timestamp_utc,'%Y-%m') AS month,count(*) AS detections
        FROM read_parquet(?) GROUP BY ALL ORDER BY month""",
        [str(root / "data/cleaned/firms_detections.parquet")],
    )
    report["population_epochs"] = records(
        c,
        """SELECT epoch,count(*) AS cells,min(Population) AS minimum_value,
        max(Population) AS maximum_value FROM read_parquet(?) GROUP BY ALL ORDER BY epoch""",
        [str(root / "data/cleaned/population_*.parquet")],
    )
    # Convert only the focal station, preserving source clocks, missing cells and lineage.
    focal = root / "data/cleaned/pollutants/Aanad Vihar.parquet"
    c.read_parquet(str(focal)).to_csv(str(out / "anand_vihar_observed.csv"), header=True)
    report["focal_csv_export"] = {
        "file": "anand_vihar_observed.csv",
        "rows": sum(x["rows"] for x in stations if x["source_folder"] == "Aanad Vihar"),
        "sha256": digest(out / "anand_vihar_observed.csv"),
        "raw_clock_and_nulls_preserved": True,
        "source_parquet_bytes": focal.stat().st_size,
        "csv_bytes": (out / "anand_vihar_observed.csv").stat().st_size,
    }
    raw = sorted(args.raw_pollutants.glob("Aanad Vihar/*2026*.csv"))
    if len(raw) != 1:
        raise ValueError(
            "Expected exactly one focal 2026 original CSV; resolve ambiguity explicitly"
        )
    c.sql("SELECT * FROM read_csv(?, header=true, nullstr='NA')", params=[str(raw[0])]).create_view(
        "raw_focal"
    )
    report["raw_focal_verification"] = records(
        c,
        """SELECT count(*) AS rows,count("PM2.5 (µg/m³)") AS pm25_present,
        count(*) FILTER(WHERE r."PM2.5 (µg/m³)" IS DISTINCT FROM p.pm25) AS mismatches,
        count(*) FILTER(WHERE p.timestamp IS NULL) AS unmatched_rows
        FROM raw_focal r LEFT JOIN pollutants p
        ON r.Timestamp=p.timestamp AND p.site_id='site_301' """,
    )[0]
    report["raw_focal_verification"].update(
        file=raw[0].name, sha256=digest(raw[0]), match_scope="2026 PM2.5 values and nulls only"
    )
    notebook = json.loads((root / "notebooks/Complete_EDA.ipynb").read_text())
    source = "\n".join(
        "".join(cell["source"]) for cell in notebook["cells"] if cell["cell_type"] == "code"
    )
    report["notebook_static_search"] = {
        "executed": False,
        "occurrences": {
            term: source.count(term)
            for term in ["HyperlocalAQPipeline", "lightgbm", "forecast_horizon", "cams_"]
        },
        "standalone_src_path_present": (root / "src/airscope_pipeline.py").exists(),
        "original_copy_path_present": (root / "data/original").exists(),
    }
    report["local_audit_elapsed_seconds"] = round(time.perf_counter() - began, 3)
    if args.fetch_openaq:
        with httpx.Client() as client:
            provider = OpenAQ(get_settings().openaq_api_key.get_secret_value(), client)
            started = time.perf_counter()
            batch, details = provider.fetch_hourly(
                location_id=235,
                sensor_id=12235610,
                start=datetime(2026, 10, 29, tzinfo=UTC),
                end=datetime(2026, 11, 1, tzinfo=UTC),
                mode="historical_replay",
            )
            now = datetime.now(UTC)
            current = provider.get("/v3/sensors/12235610")["results"][0]
            report["openaq"] = {
                "scope": "one Anand Vihar PM2.5 sensor; not a Delhi-wide quality ranking",
                "details": details,
                "fetched_rows": len(batch.observations),
                "elapsed_seconds": round(time.perf_counter() - started, 3),
                "requests": len(provider.raw_responses),
                "sensor_datetime_last": current.get("datetimeLast"),
                "checked_at": now.isoformat(),
                "alignment_hypotheses": [],
            }
            for clock, offset in [
                ("recorded_clock_assumed_IST", 330),
                ("recorded_clock_assumed_UTC", 0),
            ]:
                for period_shift in [0, 60]:
                    # An explicitly hypothetical interval-start clock needs +60m to compare ends.
                    pairs = []
                    for row in batch.observations:
                        local_time = (
                            row.measured_at + timedelta(minutes=offset - period_shift)
                        ).replace(tzinfo=None)
                        values = c.execute(
                            "SELECT pm25 FROM pollutants WHERE site_id='site_301' AND timestamp=?",
                            [local_time],
                        ).fetchall()
                        if len(values) == 1 and values[0][0] is not None:
                            pairs.append((float(values[0][0]), row.value))
                    report["openaq"]["alignment_hypotheses"].append(
                        {
                            "clock": clock,
                            "period": "recorded_as_end"
                            if period_shift == 0
                            else "recorded_as_start_plus_1h",
                            "matched_nonnull_pairs": len(pairs),
                            "mean_absolute_difference_ugm3": sum(abs(a - b) for a, b in pairs)
                            / len(pairs)
                            if pairs
                            else None,
                            "exact_value_matches": sum(abs(a - b) < 1e-9 for a, b in pairs),
                            "scientific_clock_verification": False,
                            "interpretation": "agreement between two candidate records, not forecast error or independent calibration",
                        }
                    )
            body = json.dumps(provider.raw_responses, sort_keys=True, default=str).encode()
            (out / "openaq_comparison_raw.json").write_bytes(body)
            report["openaq"]["raw_response_sha256"] = hashlib.sha256(body).hexdigest()
    (out / "audit.json").write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
    print(
        json.dumps(
            {
                "status": "audited",
                "output": str(out),
                "totals": totals,
                "openaq": report.get("openaq"),
            },
            allow_nan=False,
        )
    )


if __name__ == "__main__":
    main()
