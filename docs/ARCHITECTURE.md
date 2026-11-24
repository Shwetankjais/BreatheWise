# Architecture and file ownership

## Selected stack
React + TypeScript + Vite; Tailwind + shadcn/ui for accessible primitives; TanStack Query for remote state; React Leaflet for map; Plotly or a single appropriate chart library; Motion for restrained animation. Use React Three Fiber only for the optional lazy-loaded decorative hero when it adds value and stays within measured performance limits.

Python FastAPI + Pydantic; SQLAlchemy + Alembic; PostgreSQL (PostGIS when actual spatial queries need it). Parquet + DuckDB for analytical environmental data. Python LightGBM/joblib behind a model adapter. pytest/Ruff for Python; TypeScript/ESLint/Vitest and Playwright for web. Pin runtime/dependency versions after model compatibility inspection; commit lockfiles. Do not replace a model-required runtime merely to use the newest dependency.

No browser calls secret-bearing provider endpoints. Cache external data and batch predictions. A scheduled worker updates ingestion, forecasts and alert jobs. Start with simple scheduled commands; add Redis/Celery only if justified. Do not train during page requests.

## Target topology (create only populated paths)
```text
BreatheWise/
  AGENTS.md
  README.md
  Makefile
  compose.yaml
  .env.example
  apps/
    api/
      pyproject.toml
      src/breathewise/
        main.py
        core/               # config, logs, auth, errors
        api/v1/             # thin routers and request dependencies
        schemas/            # Pydantic requests/responses
        services/           # forecasts, planner, routes, advisories, alerts
        repositories/       # persistence/query access
        db/                 # sessions, models
        adapters/           # OpenAQ, weather, CAMS, FIRMS, routing
        ml/                 # loader, exact features, inference, capabilities
        jobs/               # ingestion, batch inference, notifications
      migrations/
      tests/
    web/
      package.json
      src/
        app/                # shell, routing, providers
        features/
          overview/
          stations/
          forecasts/
          hotspots/
          planner/
          routes/
          explorer/
          coverage/
          saved-places/
          settings/
        components/ui/
        components/map/
        lib/api/
        styles/
      public/
      tests/
  packages/contracts/       # OpenAPI export, generated TS and contract fixtures
  scripts/                  # root-level integration/data/model commands
  tests/e2e/
  docs/
  artifacts/models/         # ignored binaries; tracked manifest elsewhere
  data/                     # raw/processed/cache ignored
```

## Ownership boundaries
Both agents work concurrently from the start under the original-chat orchestrator. There is no global frontend-start gate. Codex publishes foundation/configuration early while Antigravity creates owned source and feature UI independently. See ORCHESTRATOR.md for guidance and scoped pause acknowledgment.

Active allocation: Codex55%, Antigravity45%; existing path ownership and sole Codex Git-write authority unchanged. Codex owns root files, apps/api/**, packages/contracts/**, scripts/**, tests/e2e/**, data/artifact manifests, shared docs and CI. Antigravity owns apps/web/src/**, apps/web/public/**, apps/web/tests/**, docs/UI_IMPLEMENTATION.md, docs/handoffs/antigravity.md. Codex creates and owns apps/web manifests, lockfile, index.html and build/test configs, with dependency requests from Antigravity. Antigravity owns source entry points from the start. Codex must create configuration additively and never run a scaffolder that writes or replaces apps/web/src or public files. Antigravity can write source before tooling exists but waits only for the actual manifest/dependency needed to run a particular check. Antigravity may not edit shared API schemas or generated contracts. It requests changes; Codex publishes a new contract version. Codex does not overwrite Antigravity implementation to scaffold an already created file.

## Core data flow
Provider adapters -> validation/UTC normalization -> immutable raw cache -> canonical station/observation tables and Parquet -> exact model feature builder -> batch inference -> persisted forecasts -> domain services -> API -> typed web client -> feature UI. Keep domain rules out of routers and UI components.

## Database entities
cities and boundary provenance; stations and provider aliases; ingestion_runs and quality_flags; observations; weather_forecasts and cams_forecasts (run/issue/valid/available times); model_versions and model_capabilities; forecast_runs and forecast_values; evaluation_runs/metrics; population_context (epoch/CRS/method); users/sessions or a verified auth-provider subject mapping; saved_places; sensitivity_preferences (minimal optional data); alert_rules; notification_outbox/delivery_attempts. Persist route/scenario runs only if needed for reproducibility. Large historical raw series stay in Parquet where appropriate. Use migrations and indexes on actual query patterns.

## Identity and alert delivery
Choose and document one straightforward session/auth implementation; enforce user ownership on saved places/preferences/alerts. Public observations and forecasts do not require accounts. Tests must prove one user cannot access another user's records. Email needs configured delivery credentials; in-app alerts can work without email but must not falsely claim sent email. Use idempotent outbox processing, timezone-aware schedules and cooldowns. Avoid mandatory sensitive medical information.


## Implemented backend decisions (24 November 2026)
Opaque random bearer sessions are provisioned by local administrator CLI with seven-day expiry, token hash persistence and private token file output. No user-ID header identity. All owned resource queries filter authenticated user, with tombstoned alert rules preserving event history. Notifications are transactionally delivered in-app; no external outbox/email provider or automatic scheduler is configured.
Canonical data import validates explicit hour-ending UTC/units/availability and conflicts before committing. Original-unit normalized JSON/Parquet archives accompany SQL station/observation tables; no model feature fabrication or automatic upstream timestamp repair. SQLite fixture tests are supplementary to the selected PostgreSQL target. No model dependencies are installed until teammate requirements arrive. Source-level model audit is still blocked.
