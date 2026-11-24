# BreatheWise UI/UX Implementation Record

**Owner:** shwetank's-antigravity (60% allocation, Senior UI/UX Designer & Frontend FDE)  
**Status:** FROZEN_FOR_CODEX_1_3_0_VERIFICATION — Contract 1.3.0 model integration complete and 100% metadata-driven; frozen for Codex verification.  
**Approved Repository:** https://github.com/Shwetankjais/BreatheWise  
**Branch Context:** `feat/foundation`  
**Git Authority:** Read-only inspection; NO Git writes performed. Codex reviews, commits, and pushes ready files.  

---

## 1. Expanded Website Delivery Batch Summary

| # | Priority Area | Component | Implementation & Scientific Controls |
|---|---|---|---|
| **A** | **Complete Model Playback (Contract 1.3.0)** | `ModelAuditView.tsx` | Dynamically consumes `GET /api/v1/models`, following each model's `evaluation_path` and `predictions_path`. Supports all 24 discrete horizons for `delhi-recorded-pm25-hourly-v2` and `delhi-openaq-pm25-hourly-v1`, and 5 horizons for `v1`. Separates UTC provider clocks (`openaq-235`, `UTC_hour_ending`) from naive station clocks (`site_301`, `recorded_clock`). Supports primary `fixed_model_issue_time_purged` cohort alongside preserved `target_only_horizons` historical evidence. Renders `issue_time_purge` breakdown with mechanical boundary purge explanations, sidecar checksums, and boundary row counts. Prominently displays discovered boundary-availability limitation for legacy v1. Bounded pagination, batch CSV export with dynamic clock column headers, and interactive dual-mode SVG sequence visualizer (Concentration Tracks and Residual Errors Δ) with hover tooltips and sequence token guards. |
| **B** | **Audited Archive & Live Explorer** | `ExplorerView.tsx` | Full workflow separation between Live CAAQMS Telemetry (UTC) and Audited Archive (Recorded Clock). Full two-way URL search parameter synchronization (`source`, `archive_station`, `pollutant`, `agg`). Dynamic criteria pollutant filtering per station coverage (preserving CO in `mg/m³`). Mandatory `clock_assumption=same_recorded_clock` on multi-station comparisons. Visual SVG bucket aggregation trend chart showing mean concentrations and coverage sufficiency. In-card "Retry" buttons on query errors. Request sequence tokens preventing race conditions. |
| **C** | **Geographic Station Map & Route Workspace** | `StationMap.tsx`, `OverviewView.tsx`, `RouteCompareView.tsx` | `StationMap` / `OverviewView`: React Leaflet with CartoDB Positron tiles, OpenStreetMap and CARTO attribution; searchable station directory; synchronized marker selection; mobile map/list switcher; station detail panel with concentration, age, freshness, and quality state; attached `ResetBoundsControl`. `RouteCompareView`: Coordinate inputs for Pin A (Origin) and Pin B (Destination) alongside map clicks; OSRM driving alternative corridors rendered with distinct colors and active corridor emphasis; road-network distance and duration; clear error handling with retry and "Reset to Delhi Preset" buttons; strictly gated exposure comparison (`409 ROUTE_COMPARISON_UNAVAILABLE`). |
| **D** | **Account, Health Preferences & Alert UX** | `SavedPlacesView.tsx`, `NotificationDrawer.tsx` | Bearer session auth (`Authorization: Bearer <token>`). User-owned places and alert rules with explicit threshold preservation (valid threshold of 0 preserved). Added **Health Profile & Sensitivity Preferences Card** (`apiClient.updatePreferences({ sensitivity })`) allowing users to toggle between General Population and Sensitive Cohort. Replaced disruptive `window.alert()` with in-card auto-dismissing feedback banners. Clean expired-session / 401 recovery notice. |
| **E** | **Shadow Forecasting & Prospective Audit** | `ModelAuditView.tsx` | Connected `GET /api/v1/forecast-runs` and `GET /api/v1/forecast-runs/{id}` with corrected `ForecastRunDetail` (`{ run, predictions }`) typing. In Tier 3, users can inspect persisted shadow runs and view run details. Renders rejection error codes (`SHADOW_INPUT_STALE`, `SCHEDULED_ISSUE_EXPIRED`) and 0 forecast rows as authentic real intake outcomes rather than artificial success. Renders `ShadowPoint` prediction tables when available. |
| **F** | **UI/UX Polish & Accessibility** | All UI Components | Consistent cards, hierarchy, and accessible touch targets (min 44px). Complete elimination of continuous decorative `animate-pulse` animations. Full ARIA semantics, visible focus rings, reduced-motion behavior, and 390px mobile responsiveness without horizontal document expansion. |

---

## 2. Delivery Traceability & Evidence Matrix

| PRD ID | Feature Journey | Component | Status & Evidence Level | Notes / Operational Reality |
|---|---|---|---|---|
| **AC01** | Real Geographic Station Map | `StationMap.tsx`, `OverviewView.tsx` | **Browser Verified & API-Connected** | React Leaflet map with CartoDB Positron tiles, OpenStreetMap attribution, custom HTML div markers, synchronized selection, reset bounds control, and documented concentration legend. Verified in Playwright across desktop & mobile viewports. |
| **AC02** | Discrete ML Forecasts | `OverviewView.tsx` | **Browser Verified & API-Connected** | Discrete declared horizons [+1h, +3h, +6h, +12h, +24h]. Displays `503 MODEL_UNAVAILABLE` in live mode when backend inference is unverified. Verified in Playwright. |
| **AC03** | Observed Concentration Rankings | `OverviewView.tsx` | **Browser Verified & API-Connected** | Connected to `GET /api/v1/observed-rankings`. Displays actual sorted observations; disclaims predictive hotspot status. |
| **AC04** | Activity Exposure Planner | `PlannerView.tsx` | **Browser Verified & Blocked Capability** | Surfaces `409 TRAJECTORY_UNAVAILABLE`. Honestly discloses lack of verified continuous 24h trajectory. Verified in Playwright. |
| **AC05** | Educational Health Advisories | `HealthView.tsx` | **API-Connected & Implemented Screen** | WHO-sourced educational facts for PM2.5, PM10, NO2, SO2, O3, CO. Cites `engineering source review; no clinical review`. |
| **AC06** | Historical EDA & Archive Explorer | `ExplorerView.tsx` | **Browser Verified & API-Connected** | Connected to `GET /api/v1/archive/catalogue`, `/explore`, and `/compare` with mandatory `clock_assumption=same_recorded_clock`. Full criteria pollutant support with CO in `mg/m³`, SVG trend visualizer, and URL search param persistence. |
| **AC07** | Population Context & Monitoring Extent | `CoverageView.tsx` | **Blocked Capability (Gated)** | Surfaces `409 COVERAGE_UNAVAILABLE`. Disclaims distance buffers as validated safe-air boundaries. |
| **AC08** | Data Modes & Transparency | `DataModeBadge.tsx`, `App.tsx` | **Browser Verified & API-Connected** | Persistent badges for `LIVE SENSOR TELEMETRY`, `HISTORICAL REPLAY`, and `DEMO PREVIEW ACTIVE` visible across desktop and mobile. Verified in Playwright. |
| **AC09** | Saved Places & Custom Alerts | `SavedPlacesView.tsx`, `NotificationDrawer.tsx` | **Browser Verified & API-Connected** | Bearer session auth (`Authorization: Bearer <token>`). Creates/deletes user-owned places and alert rules. Configures sensitivity preferences via `PATCH /preferences`. Preserves threshold 0. Verified across reload and ownership isolation in Playwright. |
| **AC11** | Model Tiers & Performance Audit | `ModelAuditView.tsx` | **Browser Verified & API-Connected** | Connected to `GET /api/v1/models`, `/models/{version}/evaluation` and `/utc-evaluation`, `/predictions` and `/utc-predictions`, and `/forecast-runs`. Verified 24-horizon models, issue-purged primary cohorts, held-out playback with interactive SVG chart, error residuals, CSV export, and shadow forecast run detail inspection. |
| **AC12** | Responsive & Accessible Experience | All UI components | **Browser Verified & Unit Tested** | Full ARIA semantics, visible focus outlines, keyboard-accessible Leaflet markers, responsive 390x844 mobile layout, and `prefers-reduced-motion` support. Continuous pulses eliminated. |
| **AC14** | Route Geometry Workspace | `RouteCompareView.tsx` | **Browser Verified & API-Connected** | Connected to `POST /api/v1/routes/geometry`. LineString alternatives rendered on Leaflet with distance and duration; numerical coordinate inputs; retry and reset actions; exposure comparison gated with 409. |
| **AC15** | Weather Sensitivity What-If | `WeatherScenarioView.tsx` | **Blocked Capability (Gated)** | Surfaces `409 SCENARIO_UNAVAILABLE`. Honestly explains missing `HyperlocalAQPipeline` source. |

---

## 3. Verification Check Results

1. **Vitest Unit Suite (`npm --workspace=@breathewise/web run test`):**
   ```text
   Test Files: 3 passed (3)
   Tests:      49 passed (49)
   - client.test.ts: 19 passed (Contract 1.2.0 & 1.3.0 endpoints, Bearer session, demo 503 EVALUATION_UNAVAILABLE isolation)
   - features.test.ts: 25 passed (escapeHtmlAttr regression, zero alert threshold, honest capabilities, CPCB breakpoints, criteria pollutants, Tier 1 model summary, shadow forecast runs, evaluation cohort, route geometry, preferences update, Contract 1.3.0 24h model registry, forecast run detail typing, issue_time_purged parameter, client path normalization without /api/v1 doubling, gated live forecast capabilities, missing horizon metadata handling, empty live registry isolation, registry failure handling, and explicit demo isolation)
   - aqi.test.ts: 5 passed (sub-index calculations, breakpoint edge conditions)
   Exit status: 0
   ```
2. **TypeScript Typecheck (`npm --workspace=@breathewise/web run typecheck`):**
   ```text
   > tsc --noEmit
   Exit status: 0 (0 errors)
   ```
3. **Vite Production Build (`npm --workspace=@breathewise/web run build`):**
   ```text
   > tsc --noEmit && vite build
   ✓ built in 886ms (dist/index.html, dist/assets/index-xhVIxBu9.css 72.10 kB, dist/assets/index-CMoa8Ohv.js 631.84 kB)
   Exit status: 0
   ```
4. **Local Isolated Browser Suite (`npm --prefix tools/browser-tests test`):**
   - **8 of 8 passed** in 7.4s across `desktop` (1440x1000) and `mobile-reduced-motion` (390x844).
   - Zero test assertions weakened; all journeys pass against real application code.
5. **Browser-tool TypeScript Check (`npm run typecheck --prefix tools/browser-tests`):**
   ```text
   tsc -p tsconfig.json -> 0 errors.
   ```
