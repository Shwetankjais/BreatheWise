"""Dataset commands; canonical importer follows the foundation checkpoint."""

import argparse

parser = argparse.ArgumentParser()
parser.add_argument("command", choices=["ingest", "seed-demo"])
parser.parse_args()
raise SystemExit(
    "UNAVAILABLE: canonical ingestion/demo setup is not implemented in the foundation slice"
)
