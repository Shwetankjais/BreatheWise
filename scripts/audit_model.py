"""Hash-only inspection: never unpickle artifacts or fabricate feature builders."""

import hashlib
import json

from breathewise.core.config import ROOT

expected = json.loads((ROOT / "docs/MODEL_STATIC_AUDIT.json").read_text())
failed = False
for name, audit in expected.items():
    path = ROOT / "artifacts/models" / name
    digest = hashlib.file_digest(path.open("rb"), "sha256").hexdigest() if path.exists() else None
    match = digest == audit["sha256"]
    failed |= not match
    print(
        json.dumps(
            {
                "artifact": name,
                "sha256": digest,
                "matches_supplied_audit": match,
                "runtime_ready": False,
                "parity": "unverified",
            }
        )
    )
raise SystemExit(1 if failed else 0)
