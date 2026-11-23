"""Immutable local canonical archives and atomic database ingestion."""

import hashlib
import json

import duckdb
from breathewise.core.config import get_settings
from breathewise.core.time import utc
from breathewise.db.models import Observation
from breathewise.schemas.ingestion import ImportBatch
from breathewise.services.ingestion import import_batch
from sqlalchemy import select


def retain_first_seen(db, batch: ImportBatch):
    # A repeated unchanged OpenAQ fetch cannot move known availability forward
    # or backwards. Conflicting source revisions remain rejected by import_batch.
    for row in batch.observations:
        existing = db.scalar(
            select(Observation).where(
                Observation.station_id == row.station_id,
                Observation.pollutant == row.pollutant,
                Observation.measured_at == row.measured_at,
            )
        )
        normalized = row.value * (1000 if row.unit == "mg/m3" else 1)
        if existing is not None and existing.value == normalized and existing.source == row.source:
            row.available_at = utc(existing.available_at)
    return batch


def archive_and_import(db, batch):
    content = batch.model_dump_json()
    digest = hashlib.sha256(content.encode()).hexdigest()
    root = get_settings().data_root
    archive = root / "raw" / batch.data_mode / f"{digest}.json"
    archive.parent.mkdir(parents=True, exist_ok=True)
    if not archive.exists():
        archive.write_text(content + "\n")
    parquet = None
    if batch.observations:
        parquet = root / "processed" / batch.data_mode / f"{digest}.parquet"
        parquet.parent.mkdir(parents=True, exist_ok=True)
        if not parquet.exists():
            with duckdb.connect() as analytics:
                analytics.execute(
                    "CREATE TABLE imported AS SELECT unnest(observations, recursive := true) FROM read_json(?)",
                    [str(archive)],
                )
                analytics.execute("COPY imported TO ? (FORMAT PARQUET)", [str(parquet)])
    report = import_batch(db, batch)
    return report | {"archive": str(archive), "parquet": str(parquet) if parquet else None}


def archive_provider(responses):
    content = json.dumps(responses, sort_keys=True, allow_nan=False)
    digest = hashlib.sha256(content.encode()).hexdigest()
    path = get_settings().data_root / "raw" / "openaq" / f"{digest}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        path.write_text(content + "\n")
    return digest
