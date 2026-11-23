"""Trusted local administrator command; token written once to a private file."""

import argparse
import os
from pathlib import Path

from breathewise.core.auth import provision_session
from breathewise.db.session import engine
from sqlalchemy.orm import Session

parser = argparse.ArgumentParser()
parser.add_argument("--output", type=Path, required=True)
parser.add_argument("--user-id")
args = parser.parse_args()
# Create exclusively with restrictive permissions before any secrets are generated.
fd = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
try:
    with os.fdopen(fd, "w") as out, Session(engine()) as db, db.begin():
        user_id, token = provision_session(db, args.user_id)
        out.write(token + "\n")
    print(f"Provisioned user {user_id}; session saved to private output file. Expires in 7 days.")
except BaseException:
    args.output.unlink(missing_ok=True)
    raise
