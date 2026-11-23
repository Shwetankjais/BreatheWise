"""Canonical JSON import; never fetch, infer units or silently substitute demo."""

import argparse
import hashlib
import json
from pathlib import Path

import duckdb
from breathewise.core.config import get_settings
from breathewise.db.session import engine
from breathewise.schemas.ingestion import ImportBatch
from breathewise.services.ingestion import import_batch
from sqlalchemy.orm import Session

parser = argparse.ArgumentParser()
parser.add_argument("command", choices=["ingest", "seed-demo"])
parser.add_argument("--input", type=Path)
args = parser.parse_args()
if args.command == "ingest" and args.input is None:
    parser.error("ingest requires --input PATH to an audited canonical JSON batch")
if args.command == "seed-demo":
    if get_settings().data_mode != "demo":
        raise SystemExit("Refusing demo seed unless DATA_MODE=demo; use a separate demo database")
    batch = ImportBatch.model_validate_json(
        Path("packages/contracts/fixtures/demo-import.json").read_text()
    )
else:
    batch = ImportBatch.model_validate_json(args.input.read_text())
content = batch.model_dump_json()
digest = hashlib.sha256(content.encode()).hexdigest()
root = get_settings().data_root
archive = root / "raw" / batch.data_mode / f"{digest}.json"
archive.parent.mkdir(parents=True, exist_ok=True)
# Content-addressed files preserve normalized source inputs and originals/provenance.
if not archive.exists():
    archive.write_text(content + "\n")
parquet = root / "processed" / batch.data_mode / f"{digest}.parquet"
parquet.parent.mkdir(parents=True, exist_ok=True)
# Parquet stores original fields and explicit units; canonical normalized queries use DB.
with duckdb.connect() as analytics:
    analytics.execute(
        "CREATE TABLE imported AS SELECT unnest(observations, recursive := true) FROM read_json(?)",
        [str(archive)],
    )
    analytics.execute("COPY imported TO ? (FORMAT PARQUET)", [str(parquet)])
with Session(engine()) as db, db.begin():
    report = import_batch(db, batch)
print(
    json.dumps(
        report | {"archive": str(archive), "parquet": str(parquet), "provenance": batch.provenance}
    )
)
