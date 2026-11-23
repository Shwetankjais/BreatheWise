"""Canonical JSON import; never fetch, infer units or silently substitute demo."""

import argparse
import json
from pathlib import Path

from breathewise.core.config import get_settings
from breathewise.db.session import engine
from breathewise.schemas.ingestion import ImportBatch
from breathewise.services.imports import archive_and_import
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
with Session(engine()) as db, db.begin():
    report = archive_and_import(db, batch)
print(json.dumps(report | {"provenance": batch.provenance}))
