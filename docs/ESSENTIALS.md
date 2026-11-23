# Setup and operations

Run from /Users/shwetankjaiswal/Desktop/BreatheWise. Requires uv, Python 3.12 (uv-managed available), Node >=22, npm and Docker for PostgreSQL. Verified host: Python 3.12.16, Node 24.5.0, npm 11.5.1. Locked dependencies: uv.lock and package-lock.json.

`make setup` installs both environments from locks. Copy .env.example to .env and configure locally. `make db-up` starts PostgreSQL 17 on loopback 5432; Docker daemon must be running. `make migrate` applies the initial Alembic schema. No automatic migrations at API startup. `uv run --locked uvicorn breathewise.main:app --host 127.0.0.1 --port 8000` starts API; /docs and /api/v1/health are available. `make dev` starts both owned children only after frontend src/main.tsx exists and refuses occupied ports. Web proxy maps /api to API; display UTC timestamps in labeled IST in UI.

`make contracts` exports OpenAPI and generates packages/contracts/api.d.ts. `make check` runs Ruff, pytest and contract drift/type checks; web typecheck runs when Antigravity's entry exists and otherwise prints UNVERIFIED. `make audit-model` verifies artifact hashes only and explicitly reports runtime/parity unverified. It does not load pickle/joblib.

`make build` packages backend then builds frontend; frontend currently pending source. `make test-integration` selects configured integration tests; foundation has none yet. `make test-e2e` explicitly exits unavailable until Antigravity readiness and coordinated browser verification. `make ingest` and `make seed-demo` are explicit unavailable commands in foundation, implemented next slice. No ingestion/provider/browser success is implied.

Default DATA_MODE=live with no data/provider configured. /ready returns 503 while operational dependencies are missing, even if migrated DB is accessible. /capabilities distinguishes artifact-declared horizons from verified (currently empty) horizons. Missing model source/golden/data/evaluation inputs are in Codex handoff. SQLite can verify SQLAlchemy/migration behavior locally but is not evidence of PostgreSQL integration.

No live map/routing/provider selected yet; official attribution/terms review is due before configuration. No API secrets belong in web variables. SESSION auth will use persisted opaque tokens rather than user-ID headers.
