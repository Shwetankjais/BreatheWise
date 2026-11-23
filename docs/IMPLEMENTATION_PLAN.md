# Active implementation plan
1. Foundation: FastAPI/Pydantic, explicit errors/capabilities, locked Python/web tooling, initial migrations and generated v1 OpenAPI/TypeScript. Verify contract drift and API failure semantics; publish FOUNDATION_READY.
2. Independent backend: canonical audited observation ingestion/history with units, issue-time cutoffs and explicit data modes; opaque session authentication and per-user persisted places/preferences; alert evaluation with idempotent in-app delivery.
3. Blocked model/data slice: original source, compatible environment, golden outputs, actual datasets and evaluation provenance are missing. Hash-check supplied binaries; never infer operational support from metadata.
4. Integrate only Antigravity-ready owned paths. Combined browser/release checks and branch changes require scoped acknowledgment. No assumption that Antigravity is parked.

Python 3.12 is an isolated foundation runtime, not a claim of supplied-model compatibility. Model dependency pinning waits for teammate requirements. Frontend source/public/tests remain Antigravity-owned. No Git history existed; remote empty and shell account has push rights; initialize directly on feat/foundation without switching an existing branch.
