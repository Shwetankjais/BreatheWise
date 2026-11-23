# Setup and operations

Run from /Users/shwetankjaiswal/Desktop/BreatheWise. Requires uv, Python 3.12, Node >=22 and npm. PostgreSQL 17 is the production target; Docker daemon must run for `make db-up`. Verified host: Python 3.12.16, Node 24.5.0, npm 11.5.1. Dependencies are locked in uv.lock and package-lock.json. This Python runtime is not a claim of model compatibility.

`make setup` installs from locks. Copy .env.example to .env for local configuration. `make db-up` starts loopback PostgreSQL 5432; `make migrate` applies Alembic through 0002. API startup never creates/migrates tables. `uv run --locked uvicorn breathewise.main:app --host 127.0.0.1 --port 8000` starts API with /docs and /api/v1/health. `make dev` starts API and web only when frontend entry exists and both ports 8000/5173 are free; Ctrl-C stops only its child processes. Vite proxies /api to 8000. UTC internally; UI must label IST display.

`make contracts` exports authoritative OpenAPI and TypeScript types. Contract 1.0.0 is frozen at Git commit 4e7baa7; current additive contract 1.1.0 adds stations/latest/history, account persistence, in-app rules/alerts and sourced education. No runtime model horizons verified. `make check` runs Python lint/format/tests, generated-contract drift/type checks and frontend typecheck when source exists. `make test-integration` runs migrated SQLite fixture/API tests; this does not verify PostgreSQL or providers. `make build` packages backend and builds frontend. `npm run test --workspace apps/web` runs owner's web unit tests. `make test-e2e` exits unavailable pending corrected frontend/coordination; no browser success is claimed. Deprecation warning from Starlette's httpx TestClient is known; no check is disabled.

## Canonical data and explicit demo

`make ingest ARGS='--input /absolute/path/to/canonical.json'` validates a canonical JSON batch and persists stations/observations atomically. See schemas/ingestion.py and packages/contracts/fixtures/demo-import.json for shape. A batch declares schema_version 1.0, data_mode, timestamp_semantics hour_ending_utc, source provenance, station registry and observations with original units, explicit measured_at/available_at and 60-minute averaging period. Half-hour/ambiguous time series must be audited upstream; no timestamp shifting is guessed. Negative/nonfinite values, future availability, duplicate/provider conflicts and unaudited forecast eligibility are rejected. Zero and plausible extreme values are preserved. mg/m3 normalizes to µg/m³ with original fields retained. Conflicting revisions require explicit reconciliation; repeated identical imports insert zero new rows. Content-addressed normalized source JSON and original-unit Parquet are archived under ignored data/raw/<mode> and data/processed/<mode>. Files archived before failed DB transactions are unaccepted staging inputs, not proof of ingestion success. Never import secrets.

No real dataset/provider is configured. Use a separate database for demo:
```
DATABASE_URL=sqlite:///work/demo.db DATA_MODE=demo make migrate
DATABASE_URL=sqlite:///work/demo.db DATA_MODE=demo make seed-demo
```
Demo seed creates one deliberately synthetic station and observation, no forecasts. Live defaults never load fixtures. History is station-level raw hourly only, maximum 31 days, [start,end); valid/missing counts derive from expected hourly endings, and values after issue-time availability are excluded. Replay latest/history require issue_at and return replay_issue_at in metadata. Observation freshness policy: stale above 120 minutes; stale data never triggers alerts. Station counts do not imply model eligibility. City-aggregated EDA, original dataset/unit/time audits and actual data sample verification remain unfinished.

## Accounts and alerts

Opaque bearer sessions are provisioned by a trusted local administrator, not from browser-supplied user IDs:
```
DATABASE_URL=sqlite:///work/demo.db DATA_MODE=demo uv run --locked python scripts/provision_session.py --output work/demo-session.txt
```
Output file is created exclusively with mode 0600; token is not logged and only SHA256 is persisted. Sessions expire after seven days. --user-id can provision another session for an existing user. Use Authorization: Bearer TOKEN over HTTPS outside loopback. This is an administrator-provisioned session flow, not public signup/OIDC; frontend authenticated onboarding remains pending. Keep token files in ignored work/; never commit them.

Places/preferences/rules/notifications enforce server-side ownership. Preferences PATCH merges explicitly supplied fields; place/rule PATCH use the complete generated input shape. `uv run --locked python scripts/evaluate_alerts.py` evaluates latest known hourly observations strictly above each threshold, with cooldown and deduplication per rule/observation. Delivery means persisted and available in-app only; no email send is claimed. Deleted rules are hidden tombstones preserving prior events. PostgreSQL row locks serialize per-rule evaluation; unique event keys add a duplicate guard. Actual PostgreSQL concurrency remains unverified. Schedule this command using the deployment environment's scheduler only when configured; no automatic scheduler is installed.

`make audit-model` checks supplied binary hashes and reports runtime/parity unverified; it never loads Python pickles. Gate B missing inputs are recorded in Codex handoff; no fabricated feature/prediction/metric fallback exists in backend. Provider routing/weather/population/evaluation and full activity planning remain explicit unavailable responses. /ready stays 503 while operational dependencies are missing; /capabilities exposes imported scopes and precise missing requirements. Health facts are WHO-sourced general education with engineering source review, no clinical or AQI-category advice.

No external map/routing service is configured by backend; official terms/attribution must be checked before selection. Frontend slice has unresolved API fallback/scientific-content review issues; passing compilation/unit tests do not establish live integration.

## PostgreSQL verification and CI
`make test-postgres` requires BREATHEWISE_TEST_POSTGRES_URL pointing to a disposable PostgreSQL database with schema-create rights. It runs the persistence/API tests (now 12 cases, including a PostgreSQL-only concurrency case) in an isolated randomly named schema per test and drops that schema afterward. Do not point it at a production database. GitHub workflow Backend and contracts provisions PostgreSQL 17, runs locked setup/checks, these PostgreSQL tests, and wheel packaging. Local PostgreSQL remains unavailable. CI run 45250542048 passed all 12 PostgreSQL cases including simultaneous workers (f7e4a9c); actual logs were inspected.

Imports refuse mixing data modes in one database and reject nonfinite results after unit conversion. `make check` currently passes 18 Python tests and skips 1 PostgreSQL row-lock case locally.


## Offline model recovery and diagnostics
These commands extend the hash-only make audit-model. They never change public forecast readiness or load serialized Python classes. Source binaries are still ignored by Git, so recovery/probes require the supplied local artifacts and are not run against production models in CI.

- `make recover-model` verifies the supplied artifact/native hashes and reads metadata/state without optional ML dependencies. `ARGS='--artifact full_aq_pipeline.joblib'` selects the other artifact.
- `make setup-model-diagnostics` installs the separate tools/model-diagnostics/uv.lock runtime. Root/API and web dependencies are unchanged.
- `make diagnose-model ARGS='--input /absolute/path/to/complete-features.json'` runs native-only diagnostics on complete inputs. JSON contains exactly input_kind, provenance, feature_names, rows. input_kind is caller_supplied_complete_features (or synthetic_numeric_probe when deliberately testing); feature_names exactly matches all 75 ordered names in MODEL_RECOVERY.json; rows are arrays of exactly 75 finite numbers, with forecast_horizon_h among [1,3,6,12,24]. Null, boolean, nonfinite, reordered/missing features and unsupported horizons are refused. No source fetching/preprocessing/imputation occurs.
- `make probe-model` explicitly constructs synthetic numeric tensors from native-header ranges for numerical load/reload testing, without station/time/environment consistency. These are not forecasts or validation examples.
- `make check-model-diagnostics` runs two hand-authored native-format fixture tests without the ignored production artifacts. Backend make check includes non-executing recovery/input guard tests. CI tests both environments separately.

On this Mac the installed wheel needs an OpenMP runtime. Add `ARGS='--openmp-library /opt/anaconda3/lib/libomp.dylib'` to probe/check commands (or append that option alongside --input for diagnose). This explicitly preloads an existing local arm64 library for this process; it is not a portable training requirement or a global configuration. Other systems should use their compatible runtime; no loader path is guessed or silently downloaded. All recovered native text, artifact registry copies, input probes and diagnostic result JSON are confined to ignored work/model-recovery. Outputs explicitly say diagnostic_only, claim no concentration units and retain operational_forecast_ready=false, preprocessing_parity_verified=false and golden_output_parity_verified=false.

Verification for offline diagnostics: code commit 0f44ba0 passed CI run 45285296772, including 31 backend cases, 12 PostgreSQL cases and 2 native-format mechanics cases in the isolated Linux runtime. Actual supplied-artifact recovery/native probes were verified locally on this Mac; neither golden feature parity nor production forecast support is implied. The uncommitted frontend currently has type migration in progress; frontend readiness must be republished before combined acceptance.
