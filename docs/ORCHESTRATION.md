# Two-agent execution plan

## Allocation
The split is a planning allocation of engineering responsibility, not a guarantee of elapsed time or lines of code. Active allocation is Codex40%/Antigravity60%; all existing file ownership and sole Codex Git-write authority remain unchanged.

| Work package | Owner | Weight |
|---|---|---:|
| Repository foundation, architecture, contracts and CI | Codex | 5 |
| Data ingestion, database, geographic coverage | Codex | 10 |
| Existing-model loading, feature parity, forecasts, evaluation | Codex | 10 |
| Planner, routes, advisories, alerts and domain APIs | Codex | 10 |
| Combined integration, operational checks and release | Codex | 5 |
| Research-informed visual system, layouts and motion | Antigravity | 15 |
| Map, forecasts, planning, exploration and settings UI | Antigravity | 30 |
| Responsive/accessibility/browser refinement | Antigravity | 15 |

## Parallel workstreams and evidence checkpoints
Both agents start immediately. The checkpoints below track integration readiness; they are not sequential permission gates for entire workstreams. The orchestrator guides priorities and resolves dependencies under ORCHESTRATOR.md.
### Gate A — Concurrent foundation and frontend implementation
Codex: inspect local/remote state and preserve this packet; initialize appropriate Git history without overwriting parallel edits; create API/database/tooling foundations and minimal web manifests/build configuration. Prioritize publishing generated contracts, development commands, local URLs and capability/error fixtures. Do not scaffold or overwrite Antigravity-owned source. Publish `FOUNDATION_READY` only with verified facts; it means shared tooling is usable, not that frontend work was forbidden before it.

Antigravity: start immediately with references, design tokens, feature components, owned app entry points, layouts and map/chart interfaces in apps/web/src, apps/web/public and web-owned tests. Use API_CONTRACTS.md as the provisional interface; labeled fixtures may support development. Request missing packages/configuration from Codex and continue unaffected source work. Do not run package installation/build until required manifests are ready, or create competing lockfiles/contracts.

Both: read the shared handoffs at milestones, exchange scoped dependency requests, keep owned paths disjoint and report checkpoints to the orchestrator through the user when direct messaging is absent.

### Gate B — Model onboarding alongside continued frontend work
Codex audits models, checks teammate source/runtime, proves parity against a golden example, configures data providers and records supported horizons/output. Ask for missing teammate materials here with checkpoint prompt B; use already copied binaries. Continue non-model APIs and labeled fixtures while blocked. Antigravity continues its owned frontend against documented schemas and consumes generated types as they become available; connect live endpoints progressively. API/contract generation must not block independent frontend source work. Never infer feature support from model filenames.

### Gate C — First real vertical slice
One verified station -> latest actual observation -> real model prediction at a supported horizon -> browser card/chart with units, time and provenance. Refresh and provider failure paths must work. Codex verifies backend/model; Antigravity verifies browser/mobile and publishes paths. No universal station or city promise before eligibility audit.

### Gate D — Required workflows
Complete forecast-supported hotspot ranking, history/EDA, planner where trajectory exists, advisories, population context/coverage, confidence, saved places and alert delivery. Experimental route comparison and scenarios have explicit capability gates. Required but externally blocked features stay recorded as unfinished; continue to resolve dependencies rather than call placeholders complete.

### Gate E — Coordinated integration and release
Antigravity publishes `FRONTEND_READY` and parks (no file mutations). Codex stages exact ready paths, resolves integration, verifies migrations, browser journeys, model regression, provider failures and production builds. Merge tested feature branch to main when checks and repository protections permit; push and verify remote SHA. Antigravity may resume only after Codex announces a stable branch and new editing window. No production deployment or paid account creation is implied by source delivery.

## Same folder, two agents
There is one Git branch/HEAD/index in the shared checkout. Both owners edit disjoint files concurrently; do not use different branches simultaneously in this checkout. Codex is the single Git writer; both may inspect Git read-only. Codex commits its own files and Antigravity's explicitly ready files only. Normal checkpoint commits do not require pausing unrelated edits when exact staged paths are stable and reviewed.

Branch switches/merges and any operation rewriting co-agent files require a recorded pause acknowledgment. A request alone is not an acknowledgment. Dependency/lockfile changes require affected installs/builds/tests to pause; unrelated source edits may continue if safe. Coordinate dev-server ownership and avoid conflicting migrations/tests. Do not run automatic scaffolders against Antigravity source or install concurrently into the same environment. Combined integration tests use an agreed stable snapshot. Antigravity resumes after the integration owner records the reopened editing window.

## Status record per milestone
Owner; milestone; acceptance IDs; files changed; contract version; exact checks/results; real/demo/unavailable data mode; dependencies needed; next step. Codex adds branch/local SHA/remote SHA/sync status. No unexplained 80% completion estimates.

## Access audit at preparation
Local starter kit, both binaries, both images and PDF were accessible. Local project directory was empty. GitHub repository was readable and empty; this connector had read-only permissions. The Windows dataset path in the PDF is not established on this Mac. Teammate source, requirements, golden predictions and evaluation files were not supplied. Shell Git push access has not been checked; Codex must test its own session rather than assume denial or success.
