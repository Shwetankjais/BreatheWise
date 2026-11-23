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
