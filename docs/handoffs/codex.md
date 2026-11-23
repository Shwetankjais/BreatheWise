# Codex handoff

Agent: shwetank's-codex, 65%, integration owner and only Git writer.
Milestone: FOUNDATION_READY (API/contracts/tooling); AC08/AC13 partial infrastructure evidence only. No full PRD journey or frontend completion claimed.
Workspace: /Users/shwetankjaiswal/Desktop/BreatheWise. Remote verified empty before initialization. Initial branch feat/foundation; no existing branch switched.

## Available interface
Contract 1.0.0, generated packages/contracts/openapi.json and api.d.ts. All available routes use /api/v1. JSON success is {meta,data}; failure is {meta,error}. Actual generated schema is authoritative.
API: uv run --locked uvicorn breathewise.main:app --host 127.0.0.1 --port 8000; documentation /docs. Web config: npm run dev --workspace apps/web, port 5173, /api proxy to 8000. Antigravity owns src/main.tsx and all src/public/tests; no frontend source has been created or overwritten by Codex.
Dependencies installed into root .venv and node_modules, locks uv.lock/package-lock.json. Python 3.12.16; Node 24.5.0; npm 11.5.1. Frontend packages include React 19, Vite 6, Tailwind 4, TanStack Query, React Router, Leaflet, Recharts, Motion and Lucide. Additive manifests only; no pre-existing frontend processes/source were present at setup.

## Checks and limits
- pytest foundation: 6 passed (deterministic API tests, no live data).
- Both supplied model SHA256 hashes match static audit; no deserialization/inference/parity claimed.
- Ruff and contract generation performed; final consolidated command results recorded in SUBMISSION.
- Docker CLI exists but daemon socket absent. PostgreSQL migration/integration NOT verified; SQLite migration check is supplementary only.
- make build awaits Antigravity-owned src/main.tsx; e2e intentionally exits unavailable until coordinated browser checks exist.
- make seed-demo/ingest currently fail explicitly; canonical ingestion is next independent slice.
- Data mode default live, integrations unavailable. No fixtures masquerade as actual readings/predictions.

## Gate B: precise missing inputs
User confirmed on 24 November 2026 that teammate supporting materials have not arrived. Do not ask again until supplied. Needed: (1) original HyperlocalAQPipeline class and exact feature/inference builder with helpers; (2) compatible requirements/lockfile and runnable inference example; (3) complete station/issue-time/horizon feature rows with expected final predictions, target inversion, units and tolerance; (4) accessible observation/driver forecast archives, station registry and evaluation predictions/metrics with split dates. Both binaries are already present. Model inference stays explicitly unavailable.

## Coordination and next work
Antigravity handoff still NOT_STARTED when inspected; no direct communication or external-agent launch claimed. Independent frontend source may proceed immediately. Consume generated contracts and report exact ready paths and dependency requests. No pause inferred. No branch switch/merge/shared-source rewrite until acknowledged scoped pause.
Next independent task: canonical observation import, stations/latest/history with cutoff/unit QA; opaque session auth and tested ownership, then alert worker.
Git status: initial foundation commit/push in progress; exact verified SHA will be reported after sync.

## Active slice 2 / frontend integration notice
Foundation remote verified at 4e7baa758316da482938b2b6ccda1534ad1224dc on feat/foundation. Antigravity source is appearing; it is preserved and remains unstaged until exact ready paths/checks are published. No pause inferred.
Additive contract 1.1.0 is being generated: stations/latest/history, account places/preferences and in-app observation alerts. Original 1.0.0 is frozen in commit 4e7baa7. Consume actual generated Envelope types ({meta,data}); error envelope is {meta,error}; capabilities use named feature objects with supported/method/requirements_missing/supported_scope. No verified model horizons/pollutants.
Integration review request for Antigravity: replace provisional API types with generated contracts; default to actual API unavailable/empty states, make demo explicit; do not imply example forecasts are validated/evaluated, derive sensitivity factors from invented model splits, or display arbitrary AQI without averaging/completeness. Final owner-ready paths will be reviewed before commit. This is a dependency/content note, not a source-edit handoff or pause.
15 backend tests currently pass on isolated synthetic SQLite data. PostgreSQL daemon unavailable; open -a Docker failed to locate app despite CLI path. No PostgreSQL success claimed. Canonical import/demo commands under verification; model remains disabled per user's explicit confirmation.

## FRONTEND_SLICE_READY review — changes requested (not accepted)
Read Antigravity's published ready paths. This is NOT a merge/integration pause acknowledgment. Keep source ownership with Antigravity; no frontend source edited by Codex.
1. apps/web/src/lib/api/client.ts automatically substitutes fixtures on fetch errors, 503 and empty results, strips metadata, generates arbitrary readings/forecasts/history/planner windows and uses localStorage accounts. Remove default fallback. Show live errors/empty states. Demo must be deliberate opt-in and persistently labeled, with separate account data. Use generated 1.1.0 types; latest is one pollutant measurement, history requires start/end, hotspot threshold required, capabilities are feature objects. Implement bearer calls for actual saved places/preferences/rules/alerts.
2. apps/web/src/features/scenarios/WeatherScenarioView.tsx computes fabricated sensitivity coefficients and baseline concentrations, claimed as derived from model splits. Remove computation; capability-gate scenario output and show missing verified feature builder/parity. No source to support coefficients was supplied.
3. client.ts planActivity generates duration windows despite trajectory_supported=false. Remove recommendations/integrated claims and surface TRAJECTORY_UNAVAILABLE.
4. fixtures.ts invents actual-looking evaluation metrics, population raster counts/epochs and artifact forecasts. Remove claims of actual evidence; do not use real model identity to imply inference happened. Model-performance and coverage screens must show unavailable until supplied.
5. aqi.ts and latest/forecast UI cannot derive overall CPCB NAQI from instantaneous/hourly PM2.5 or invent completeness=1. Show concentration and units; reviewed averaging/completeness prerequisites are absent.
6. docs/UI_IMPLEMENTATION.md and Antigravity handoff acceptance claims AC01–AC15 are UI-only/demo and do not establish actual model/data/clinical/browser evidence. Correct traceability to distinguish implemented views from accepted workflows. No reviewed clinical guidance, full trajectory or model split/evaluation was provided.
Request Antigravity to implement these owned corrections, then republish exact ready paths/checks for integration. Codex will continue safe backend work. User/orchestrator relay is required if Antigravity is no longer actively reading handoffs; no automatic messaging assumed.

## Backend slice 2 verified checkpoint
AC01/05/06/08/09/10/13 partial backend evidence; no full product acceptance claimed. Contract 1.1.0 generated. Implemented paths: apps/api canonical ingestion/repositories/routes/auth/alerts/schemas, Alembic 0002, scripts/data_cli.py/provision_session.py/evaluate_alerts.py, generated packages/contracts (including one synthetic demo import), Makefile test-postgres and .github/workflows/backend.yml, shared run/evidence docs.
Checks: make check passed (16 Python tests, Ruff lint/format, contract drift/TS and frontend typecheck); make test-integration passed 9 synthetic migrated SQLite cases; both model hashes match; demo migrations/check match schema; seed repeated inserted 1 then 0 and generated source JSON/Parquet; backend wheel builds; owner-ready frontend build and 12 unit tests pass but review remains rejected for the six concrete items above. No browser/real model/provider/PostgreSQL verification claimed yet. In-app alerts only; trusted administrator bearer provisioning only, no public signup or email.
Added make test-postgres and CI PostgreSQL 17 service to run the same 9 integration cases in isolated schemas; result pending actual remote run. Next steps: inspect CI and fix backend failures, integrate corrected frontend once owner republishes readiness, and resume Gate B only when teammate materials arrive. Still no branch switches/shared frontend writes performed.


## Latest remote evidence and hardening
4fd6105837a9b1863773cf7eb354fe96377c786c pushed and remote verified. GitHub Actions https://github.com/Shwetankjais/BreatheWise/actions/runs/45250165492 completed SUCCESS: locked setup/checks, 9 PostgreSQL 17 schema/API persistence cases and backend wheel. Local Docker still unavailable; remote verification is actual PostgreSQL evidence, distinct from fixture data/provider evidence.
Actual HTTP smoke also passed on the isolated synthetic demo DB: process health/readiness, capability scope, disabled forecast, bearer authentication, persisted place create/delete, session file mode 0600. Child process shut down. No real monitoring/model/provider/browser claim.
Hardening checkpoint adds mixed-mode database refusal, post-conversion overflow validation, a true new-observation cooldown test and a PostgreSQL-only concurrent-worker test. Local make check: 18 passed, 1 PostgreSQL-only race test skipped; lint/format/generated contracts/frontend TS passed. Expanded PostgreSQL CI pending push/run. No user/co-agent source edits staged. Exact six frontend changes requested remain unresolved; Antigravity has not republished readiness.
