import hashlib
import math
from datetime import UTC, datetime

from breathewise.core.config import get_settings
from breathewise.core.time import utc
from breathewise.db.models import Observation, Station
from breathewise.schemas.ingestion import ImportBatch
from sqlalchemy import select
from sqlalchemy.orm import Session


def import_batch(db: Session, batch: ImportBatch) -> dict:
    if batch.data_mode != get_settings().data_mode:
        raise ValueError("Import data_mode must equal configured DATA_MODE")
    if db.scalar(select(Station.id).where(Station.data_mode != batch.data_mode).limit(1)):
        raise ValueError("Use an isolated database per data_mode; mixed-mode imports are refused")
    inserted = 0
    now = datetime.now(UTC)
    for row in batch.stations:
        values = row.model_dump(exclude={"forecast_eligible"})
        existing = db.get(Station, row.id)
        if existing:
            if any(getattr(existing, key) != value for key, value in values.items()):
                raise ValueError(
                    "Station metadata conflict; explicit registry reconciliation required"
                )
        else:
            db.add(Station(**values))
    db.flush()
    phases = {}
    for row in batch.observations:
        phase_key = (row.station_id, row.pollutant)
        if phase_key not in phases:
            prior = db.scalar(
                select(Observation)
                .where(
                    Observation.station_id == row.station_id, Observation.pollutant == row.pollutant
                )
                .limit(1)
            )
            phases[phase_key] = prior.measured_at.minute if prior else row.measured_at.minute
        if row.measured_at.minute != phases[phase_key]:
            raise ValueError(
                "Mixed hourly phases require explicit upstream interval reconciliation"
            )
        if utc(row.available_at) > now:
            raise ValueError("An observation cannot be available in the future")
        value = row.value * (1000 if row.unit == "mg/m3" else 1)
        if not math.isfinite(value):
            raise ValueError("Unit normalization produced a nonfinite concentration")
        values = dict(
            station_id=row.station_id,
            pollutant=row.pollutant.value,
            measured_at=utc(row.measured_at),
            available_at=utc(row.available_at),
            value=value,
            unit="µg/m³",
            original_value=row.value,
            original_unit=row.unit,
            source=row.source,
            quality_flags=sorted(
                set(row.quality_flags + (["unit_converted"] if row.unit == "mg/m3" else []))
            ),
        )
        existing = db.scalar(
            select(Observation).where(
                Observation.station_id == row.station_id,
                Observation.pollutant == row.pollutant,
                Observation.measured_at == utc(row.measured_at),
            )
        )
        if existing:
            if (
                existing.source != row.source
                or existing.value != value
                or utc(existing.available_at) != utc(row.available_at)
            ):
                raise ValueError(
                    "Observation conflict: reconcile duplicate providers/revisions explicitly"
                )
        else:
            db.add(Observation(**values))
            inserted += 1
    db.flush()
    return {
        "inserted": inserted,
        "stations": len(batch.stations),
        "data_mode": batch.data_mode,
        "content_sha256": hashlib.sha256(batch.model_dump_json().encode()).hexdigest(),
    }
