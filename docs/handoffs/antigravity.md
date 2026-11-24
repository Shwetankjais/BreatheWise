# Antigravity handoff

Agent: shwetank's-antigravity (Senior UI/UX Designer & Frontend FDE).  
Status: DEPLOYMENT_READINESS_AND_TEAM_RELEASE_COMPLETE (All earlier freeze statements superseded).  
Git authority: User explicitly authorized commit and push to `feat/foundation` for this milestone, overriding the prior sole-Codex-Git-writer arrangement for this serialized release window. Codex-owned files and tests are strictly preserved.  
Orchestrator: Original project chat (docs/ORCHESTRATOR.md).  
Branch Context: `feat/foundation`  

---

## Team Release & Deployment Readiness Record

**COMPLETION_ACK — 2026-11-24T17:40:00+05:30:**  
Portable team release, clean-copy verification, and multi-platform deployment readiness configurations are complete and verified on branch `feat/foundation`.

### 1. Clean-Copy Test Results & Exact Failure Points
Tested in `/tmp/breathewise-clean-test` from a raw Git archive (`git archive HEAD | tar -x`) outside the shared working tree with zero local `.env`, `work/`, or preinstalled dependencies:
1. **Recorded Clean-Copy Failure Points (Real-Data Path):**
   - **Archive Source:** `scripts/local_prototype.py prepare` fails with `RuntimeError: Configured audited archive source is missing; set ARCHIVE_ROOT locally` because historical CPCB parquet files are intentionally excluded from Git.
   - **Model Registry:** Models (`delhi-recorded-pm25-hourly-v2`, `delhi-openaq-pm25-hourly-v1`, `delhi-openaq-pm25-delay3h-v2`) reside in `work/forecast-experiment` which is gitignored.
   - **Database & Identity:** Pre-existing SQLite database `work/delhi-live.db` and private session token `work/prototype/session.token` are gitignored.
2. **Reproducible Demo-Preview Path (Verified Working):**
   - Clean-copy commands succeed out of the box with zero private assets:
     ```bash
     npm ci
     uv sync
     DATABASE_URL=sqlite:///demo.db DATA_MODE=demo uv run alembic upgrade head
     DATABASE_URL=sqlite:///demo.db DATA_MODE=demo uv run python scripts/data_cli.py seed-demo
     DATABASE_URL=sqlite:///demo.db DATA_MODE=demo uv run uvicorn breathewise.main:create_app --factory --port 8000
     npm run dev --workspace apps/web
     ```
   - Automatically provisions verified developer fixtures (`packages/contracts/fixtures/demo-import.json`) with explicit metadata: `source="audited canonical import"`, `quality_flags=["synthetic_demo"]`, `data_mode="demo"`.
   - Visibly labels fixtures with persistent **`DEMO PREVIEW ACTIVE`** banner; never silently substitutes them for real data in live mode.

---

## 2. Multi-Platform Deployment Configurations

1. **Docker & Docker Compose (`compose.yaml`, `Dockerfile.api`, `apps/web/Dockerfile`):**
   - Production multi-stage `Dockerfile.api` using `python:3.12-slim` and `uv`, non-root user `breathewise`, health check (`curl -f http://127.0.0.1:8000/api/v1/health`), and automated entrypoint script (`scripts/docker_entrypoint.sh`) that applies migrations and seeds demo fixtures.
   - Verified with actual local Docker build: `docker build -t breathewise-api:test -f Dockerfile.api .` (built and tested; container returned 200 OK on healthcheck).
   - Production `apps/web/Dockerfile` using `node:20-slim` builder and `nginx:alpine` runtime with custom SPA routing and reverse proxy fallback in `apps/web/nginx.conf`.
   - Updated `compose.yaml` orchestrating PostgreSQL 17 (`db`), API (`api`), and Web (`web`) with container health checks (`pg_isready`, `curl`, `wget`), persistent volumes (`postgres_data`, `api_data`), and service dependencies.
   - Backward compatibility: `make db-up` (`docker compose up -d --wait db`) verified and operational.

2. **Vercel Frontend Deployment (`vercel.json`, `apps/web/vercel.json`):**
   - Root and workspace `vercel.json` configured for Vite monorepo with `buildCommand: "npm run build --workspace apps/web"`, `outputDirectory: "apps/web/dist"`, and SPA rewrites (`"source": "/(.*)", "destination": "/index.html"`).
   - Configurable API URL via `VITE_API_BASE_URL` baked into the bundle at build time.

3. **Render Cloud Deployment (`render.yaml`):**
   - Official Render Blueprint specification defining:
     - `breathewise-db`: Managed PostgreSQL 16/17 database.
     - `breathewise-api`: Docker Web Service using `./Dockerfile.api`, health check path `/api/v1/health`, and automatic database connection string injection.
   - Multi-origin CORS support in `apps/api/src/breathewise/core/config.py` parsing comma-separated origins from `WEB_ORIGIN`.

4. **Configurable Frontend Client (`client.ts`):**
   - Evaluates `import.meta.env.VITE_API_BASE_URL` with clean path normalization.
   - Prevents duplicate `/api/v1` prefixes and ensures seamless transitions between local proxy and remote production URLs.

---

## 3. Verification Evidence

1. **Vitest Unit Suite (`npm --workspace=@breathewise/web run test`):**
   - **58 of 58 tests PASSED** in 365ms across 4 test suites:
     - `client.test.ts` (20 passed): Added test for `VITE_API_BASE_URL` configurability and path normalization.
     - `features.test.ts` (28 passed)
     - `replay.test.ts` (5 passed)
     - `aqi.test.ts` (5 passed)
   - Exit status: 0

2. **Backend Pytest Suite (`uv run pytest -q`):**
   - **127 passed, 1 skipped** in 4.33s.
   - Exit status: 0

3. **TypeScript Typecheck (`npm --workspace=@breathewise/web run typecheck`):**
   - `tsc --noEmit`: 0 errors.

4. **Vite Production Build (`npm --workspace=@breathewise/web run build`):**
   - Production bundle compiled cleanly in 994ms.

5. **Docker Build & Runtime Verification:**
   - `breathewise-api:test` built successfully.
   - Ran container with `DATA_MODE=demo` and `DATABASE_URL=sqlite:////app/data/demo.db`:
     - Health check `GET /api/v1/health`: 200 OK.
     - Station listing `GET /api/v1/stations?city_id=delhi`: 200 OK with `synthetic_demo` flag.

6. **Playwright Browser Sweep (Desktop 1440x900 & Mobile 390x844):**
   - Zero horizontal overflow (`document.body.scrollWidth === 1440` and `390`).
   - Verified Overview & Map, Replay Planner (`Compare historical windows` submission, ranked cards, 24h trajectory bar), Model Audit (retrospective tags), Historical EDA, Routes (409 exposure gated), Health Guidance (WHO 2021 table, disclaimer), Saved Places & Alerts, and Gated views (Hotspots, Coverage, Scenarios).
   - Zero unhandled page errors.

---

## 4. Exact Staged & Ready Paths

```text
.env.example
Dockerfile.api
README.md
apps/api/Dockerfile
apps/api/src/breathewise/core/config.py
apps/api/src/breathewise/main.py
apps/web/Dockerfile
apps/web/nginx.conf
apps/web/src/lib/api/client.ts
apps/web/tests/client.test.ts
apps/web/vercel.json
compose.yaml
docs/LOCALHOST_PROTOTYPE.md
docs/handoffs/antigravity.md
render.yaml
scripts/docker_entrypoint.sh
vercel.json
```

### Preserved Untracked Files:
- `artifacts/` (preserved)
- `docs/handoffs/orchestrator-localhost-review.md` (preserved)
- `tools/browser-tests/live/prototype_walk.mjs` (preserved)
