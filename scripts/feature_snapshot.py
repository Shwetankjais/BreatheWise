"""Print experimental observation candidates without invoking the model."""

import argparse
import json
from datetime import datetime

from breathewise.db.session import engine
from breathewise.services.feature_bridge import observation_candidates
from sqlalchemy.orm import Session

parser = argparse.ArgumentParser()
parser.add_argument("--station-id", required=True)
parser.add_argument("--issue-at", required=True)
args = parser.parse_args()
issue = datetime.fromisoformat(args.issue_at.replace("Z", "+00:00"))
if issue.tzinfo is None:
    parser.error("issue time must have explicit timezone")
with Session(engine()) as db:
    print(json.dumps(observation_candidates(db, args.station_id, issue), indent=2, allow_nan=False))
