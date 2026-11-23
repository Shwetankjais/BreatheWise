import argparse
import json
from pathlib import Path

from breathewise.main import app

parser = argparse.ArgumentParser()
parser.add_argument("--check", action="store_true")
args = parser.parse_args()
path = Path("packages/contracts/openapi.json")
content = json.dumps(app.openapi(), indent=2, sort_keys=True) + "\n"
if args.check:
    if not path.exists() or path.read_text() != content:
        raise SystemExit("OpenAPI contract drift: run make contracts")
else:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)
