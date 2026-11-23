"""Experimental, auditable observation candidates; never a production 75-input builder."""

import json
from datetime import timedelta

from breathewise.core.config import ROOT
from breathewise.core.time import utc
from breathewise.db.models import Observation
from breathewise.repositories.observations import observations, station


def observation_candidates(db, station_id, issue_at):
    station(db, station_id)
    issue_at = utc(issue_at)
    rows = db.scalars(
        observations(db, station_id, "pm25", issue_at).where(
            Observation.measured_at >= issue_at - timedelta(hours=48)
        )
    ).all()
    by_time = {utc(row.measured_at): row for row in rows}
    values = {}
    provenance = {}
    for name, hours in [
        ("pm25", 0),
        ("pm25_lag_1h", 1),
        ("pm25_lag_3h", 3),
        ("pm25_lag_6h", 6),
        ("pm25_lag_12h", 12),
        ("pm25_lag_24h", 24),
        ("pm25_lag_48h", 48),
    ]:
        row = by_time.get(issue_at - timedelta(hours=hours))
        if row:
            values[name] = row.value
            provenance[name] = {
                "observation_id": row.id,
                "measured_at": utc(row.measured_at).isoformat(),
                "available_at": utc(row.available_at).isoformat(),
                "unit": row.unit,
                "source": row.source,
                "status": "reconstructed_assumption",
                "formula": f"exact canonical concentration at issue - {hours}h; original model anchor policy unverified",
            }
    return {
        "status": "experimental_partial_frame",
        "station_id": station_id,
        "issue_at": issue_at.isoformat(),
        "candidate_features": values,
        "provenance": provenance,
        "production_model_compatible": False,
        "missing_features": [
            name
            for name in json.loads((ROOT / "docs/MODEL_STATIC_AUDIT.json").read_text())[
                "zero_input_aq_weather_model.joblib"
            ]["features"]
            if name not in values
        ],
        "missingness_policy": "absent exact/known row remains missing; no fill, nearest-time or interpolation",
        "limitations": [
            "Not the original feature builder; model preprocessing parity and issue anchor semantics remain unverified",
            "Only exact PM2.5 current/lag candidates are constructed; other feature semantics remain in FEATURE_PROVENANCE.json",
        ],
    }
