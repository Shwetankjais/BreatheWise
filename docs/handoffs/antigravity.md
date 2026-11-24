# Antigravity handoff

Agent: shwetank's-antigravity (60% allocation, Senior UI/UX Designer & Frontend FDE).  
Status: FROZEN_FOR_CODEX_1_3_0_VERIFICATION (All earlier freeze and OPEN statements superseded).  
Git authority: Read-only inspection; NO Git writes performed. Codex reviews, commits, and pushes ready files.  
Orchestrator: Original project chat (docs/ORCHESTRATOR.md).  
Branch Context: `feat/foundation`  

---

## Contract 1.3.0 Acceptance Verification Freeze

**FROZEN_FOR_CODEX_1_3_0_VERIFICATION:** All earlier freeze and OPEN statements (including 12:55 and 12:59 IST) are explicitly superseded. The 36 listed ready paths below are saved, tested, and frozen for Codex's focused desktop/mobile API verification. I will not modify them or run commands that regenerate them until Codex publishes the verification results and explicitly reopens editing.

FREEZE_ACK — 2026-11-24T13:17:00+05:30:
The exact 36 ready paths listed below are saved and frozen for Codex's contract 1.3.0
browser and desktop/mobile acceptance:
1. Supported Horizons: Removed model-name inference AND all hardcoded fallback arrays
   [1, 3, 6, 12, 24] from ModelAuditView.tsx. Uses registry and evaluation metadata only.
   When missing, shows an honest unavailable state and disables all dependent controls
   (picker chips, split switcher, purged toggle, CSV export, and pagination buttons).
2. Live Registry & Error Preservation:
   - Removed experimentalModels -> DEMO_MODELS fallback in live mode.
   - Successful empty registry renders a clean empty state with a Refresh button.
   - Failed requests (HTTP 503, network errors) preserve and surface the exact error code
     (e.g. REGISTRY_DOWN, HTTP_503) and render an actionable, retryable error state.
   - Demo fixtures are strictly isolated to explicit demo mode (apiClient.getDemoMode()).
3. Sensitivity Copy: SavedPlaces text corrected. Explicitly documents that sensitivity
   preferences are persisted to the user account, alert thresholds are explicitly
   user-set, and health guidance is educational (no claims of altering alert thresholds
   or WHO definitions). Duplicate preferences card removed.
4. Regression Tests: Added integrated regression tests exercising the actual
   model-selection and error-handling state machine (all 49/49 pass).
Source mutations are paused until Codex completes verification and reopens the editing window.

---

## Contract 1.3.0 Final Review Resolutions

1. **100% Metadata-Driven Registry & Horizon Selection:**
   - Completely eliminated model-name string matching (`.includes('utc')`, `.includes('openaq')`, `.includes('v2')`, `.includes('hourly')`).
   - `supported_horizons`: Derived strictly from `ModelSummary.supported_horizons` (or `ModelEvaluation.supported_horizons`), resolving all 24 horizons for `delhi-recorded-pm25-hourly-v2` and `delhi-openaq-pm25-hourly-v1`, and 5 horizons for legacy `v1`. If metadata is absent or empty, the UI displays an honest "Horizons metadata unavailable for this model" message and disables all dependent playback and export controls.
   - `clock_basis` & `dataset_mode`: Derived strictly from `ModelSummary.dataset_mode` (`"utc_provider_history"` vs `"recorded_clock"`) and `ModelSummary.clock_basis` (`"UTC_hour_ending"` vs `"source_naive_clock_unverified"`).
   - Routes: Derived strictly from `ModelSummary.evaluation_path` and `ModelSummary.predictions_path`. Client normalizes path prefixes without duplicating `/api/v1`.

2. **Registry States, 503 Error Preservation & Demo Isolation:**
   - `experimentalModels` does not fall back to `DEMO_MODELS` in live mode.
   - Live loading, failed requests (`catalogueError` with exact code like `HTTP_503` / `REGISTRY_DOWN` and Retry action), and empty registry results (with Refresh action) have distinct, dedicated cards.
   - Demo fixtures are strictly gated behind `apiClient.getDemoMode()`.

3. **Truthful Sensitivity Profile Copy:**
   - SavedPlaces copy clarifies that sensitivity cohort preferences are stored in the user profile, concentration alert rules are evaluated strictly against user-set numerical thresholds, and WHO health guidance provides general educational reference.

4. **Primary Cohort Playback vs Qualified Evidence:**
   - Playback query requests `issue_time_purged=true` by default when `evaluation_cohort === 'fixed_model_issue_time_purged'`, matching primary issue-purged benchmarks without split-boundary lookahead leakage.
   - Dual-mode SVG visualizer (Tracks and Residuals $\Delta$) renders the primary common-baseline cohort ($N=13,977$ at +1h for v2, $N=1,324$ for UTC-v1).
   - Historical `target_only_horizons` are kept separate, viewable via a dedicated cohort toggle.
   - Discovered split-boundary limitation for legacy `v1` is displayed prominently in an advisory banner.

5. **Forecast Run Detail Typing & Real Rejections:**
   - `getForecastRun(runId)` strictly returns `ApiResult<ForecastRunDetail>` (`{ run: ForecastRunView, predictions: ShadowPoint[] }`), aligning with generated schemas in `packages/contracts/api.d.ts`.
   - Tier 3 interactive run detail viewer renders authentic intake outcomes: rejected error codes (`SHADOW_INPUT_STALE`, `SCHEDULED_ISSUE_EXPIRED`) and 0 forecast rows are clearly explained as real intake rejection outcomes rather than artificial synthetic success.

6. **Accurate Capability Gating Preserved:**
   - Public live forecasting (`model_forecast: false`) and continuous activity planning (`continuous_hourly_trajectory: false`) gates remain strictly closed (`503 MODEL_UNAVAILABLE` and `409 TRAJECTORY_UNAVAILABLE`).

---

## Endpoints Connected

- `GET /api/v1/models` (versioned registry with `evaluation_path`, `predictions_path`, `dataset_mode`, `clock_basis`, `evaluation_cohort`)
- `GET /api/v1/models/{model_version}/evaluation` (recorded-clock evaluation, with `horizon_h`)
- `GET /api/v1/models/{model_version}/utc-evaluation` (UTC-native evaluation, with `horizon_h`)
- `GET /api/v1/models/{model_version}/predictions` (recorded-clock held-out playback with `horizon_h`, `split`, `issue_time_purged`, pagination)
- `GET /api/v1/models/{model_version}/utc-predictions` (UTC-native held-out playback with `horizon_h`, `split`, `issue_time_purged`, pagination)
- `GET /api/v1/forecast-runs` (experimental shadow runs list with limit and offset)
- `GET /api/v1/forecast-runs/{id}` (experimental shadow run detail with `ForecastRunDetail` envelope)
- `POST /api/v1/routes/geometry` (driving alternatives, GeoJSON line geometry, road distance, provider duration)
- `GET /api/v1/station-catalogue`, `GET /api/v1/observed-rankings` (real-time telemetry metadata, rankings)
- `GET /api/v1/archive/catalogue`, `/explore`, `/compare` (audited DuckDB Parquet archive with `clock_assumption=same_recorded_clock`)
- `GET /api/v1/stations`, `/latest`, `/history` (live observation telemetry)
- `GET /api/v1/me`, `/saved-places`, `/alert-rules`, `/alerts`, `PATCH /api/v1/preferences` (Bearer session auth, sensitivity preferences)

---

## Exact Ready Paths (Frozen)

The following 36 coherent frontend files are frozen for Codex review and verification:
```text
apps/web/src/main.tsx
apps/web/src/styles/globals.css
apps/web/src/styles/tokens.css
apps/web/src/components/map/StationMap.tsx
apps/web/src/features/overview/OverviewView.tsx
apps/web/src/features/explorer/ExplorerView.tsx
apps/web/src/features/model-performance/ModelAuditView.tsx
apps/web/src/features/routes/RouteCompareView.tsx
apps/web/src/features/saved-places/SavedPlacesView.tsx
apps/web/src/components/ui/Badge.tsx
apps/web/src/components/ui/Button.tsx
apps/web/src/components/ui/Card.tsx
apps/web/src/components/ui/DataModeBadge.tsx
apps/web/src/components/ui/Dialog.tsx
apps/web/src/components/ui/Select.tsx
apps/web/src/components/ui/Tabs.tsx
apps/web/src/components/ui/Tooltip.tsx
apps/web/src/components/layout/Header.tsx
apps/web/src/components/layout/AtmosphericHero.tsx
apps/web/src/components/layout/NotificationDrawer.tsx
apps/web/src/features/health/HealthView.tsx
apps/web/src/features/hotspots/HotspotsView.tsx
apps/web/src/features/planner/PlannerView.tsx
apps/web/src/features/coverage/CoverageView.tsx
apps/web/src/features/scenarios/WeatherScenarioView.tsx
apps/web/src/lib/aqi.ts
apps/web/src/lib/sanitize.ts
apps/web/src/lib/api/types.ts
apps/web/src/lib/api/demoData.ts
apps/web/src/lib/api/client.ts
apps/web/src/App.tsx
apps/web/tests/aqi.test.ts
apps/web/tests/client.test.ts
apps/web/tests/features.test.ts
docs/UI_IMPLEMENTATION.md
docs/handoffs/antigravity.md
```

### Excluded Paths & Buffer Reconciliation
- `tools/browser-tests/**`: Owned by Codex. Zero edits made to this directory or its package manifests.
- Exported test buffer preserved in `work/browser-test-reconciliation/antigravity-buffer.ts` (7,942 bytes, SHA256 `fd570b14...`).

---

## Verification Evidence

1. **Vitest Unit Suite (`npm --workspace=@breathewise/web run test`):**
   - **49 of 49 tests PASSED** in 307ms across 3 test suites:
     - `client.test.ts` (19 tests): Contract 1.2.0 & 1.3.0 endpoints, Bearer session, demo 503 EVALUATION_UNAVAILABLE isolation.
     - `features.test.ts` (25 tests): `escapeHtmlAttr` regression, zero alert threshold, honest capabilities, CPCB breakpoints, criteria pollutants, Tier 1 model summary, shadow forecast runs, evaluation cohort, route geometry, preferences update, Contract 1.3.0 24h model registry, forecast run detail typing, issue_time_purged parameter, client path normalization without `/api/v1` doubling, gated live forecast capabilities, missing horizon metadata handling, empty live registry isolation, registry failure handling, and explicit demo isolation.
     - `aqi.test.ts` (5 tests): sub-index calculations, breakpoint edge conditions.
2. **TypeScript Typecheck (`npm --workspace=@breathewise/web run typecheck`):**
   - **0 errors** (`tsc --noEmit`).
3. **Vite Production Build (`npm --workspace=@breathewise/web run build`):**
   - **Production bundle built cleanly in 886ms** (`dist/index.html`, `dist/assets/index-xhVIxBu9.css` 72.10 kB, `dist/assets/index-CMoa8Ohv.js` 631.84 kB).
4. **Browser Testing Note:**
   - Isolated Playwright baseline previously passed 8/8 journeys in 7.4s; per orchestrator instructions, no new browser acceptance is claimed for this snapshot until Codex coordinates verification.

---

## Read-Only Next-Slice Notes (Phase B Preparation: Historical Replay Planning)

While Phase A is frozen for Codex verification, the Phase B contract (`packages/contracts/api.d.ts` and `docs/PROTOTYPE_CONTRACT.md`) has been reviewed:

- **Planned Endpoints:**
  - `GET /api/v1/models/{version}/replay-issues?split=test&limit=25`: Returns available complete single-issue trajectories (`ReplayIssueListResponse` containing `issues: ReplayIssueSummary[]`).
  - `POST /api/v1/activity-plan/replay`: Submits `ActivityReplayRequest` (`model_version`, `issue_time_iso`, `clock_basis`, `duration_minutes` [60..1440], `window_start_iso`, `window_end_iso`, `sensitivity_multiplier` [0.5..2.0]).
  - Returns `ActivityReplayResponse` (`status`, `rankings: ReplayWindowEvaluation[]`, `method`, `units: "µg·h/m³"`, `model_version`, `issue_time_iso`, `clock_basis`).
- **Phase B Implementation Plan (for execution as soon as Codex reopens editing):**
  - Connect `apiClient.getReplayIssues(version, split, limit)` and `apiClient.postActivityPlanReplay(payload)`.
  - In `PlannerView.tsx`, add dedicated "Historical Replay Activity Planner" tab/mode separate from the live gated planner.
  - Model and issue-time selection dropdown driven by actual available complete issues from `GET /replay-issues`.
  - Duration picker (60 to 1440 mins) and sensitivity multiplier slider.
  - Interactive ranking cards showing window start/end, total exposure ($\mu\text{g}\cdot\text{h/m}^3$), average concentration, and peak concentration.
  - Explicit prominent labeling: *"Historical Replay Comparison: Evaluated retrospectively on recorded single-issue forecast; not an operational live forecast for tomorrow."*
  - Dedicated handling for no-suitable-window, incomplete issues, and API error states.
