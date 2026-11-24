# BreatheWise UI/UX Implementation Record

**Owner:** shwetank's-antigravity (35% allocation, Senior UI/UX Designer & Frontend FDE)  
**Status:** FRONTEND_1_2_0_INTEGRATION_READY — Additive Contract 1.2.0 endpoints wired, verified with full unit, typecheck, build, and browser suites.  
**Approved Repository:** https://github.com/Shwetankjais/BreatheWise  
**Branch Context:** `feat/foundation`  
**Git Authority:** Read-only inspection; NO Git writes performed. Codex reviews, commits, and pushes ready files.  

---

## 1. Contract 1.2.0 Delivery & Targeted Fixes Summary

| # | Priority Area | Component | Implementation & Scientific Controls |
|---|---|---|---|
| **1** | **Geographic Station Map & Observed Rankings** | `StationMap.tsx`, `OverviewView.tsx` | Replaced schematic SVG map with React Leaflet (`MapContainer`, `TileLayer`, `Marker`, `Popup`, `useMap`). Uses CartoDB Positron / Voyager raster tiles with mandatory OpenStreetMap and CARTO attribution. Station markers use accessible `L.divIcon` displaying actual observed concentrations, CPCB-aligned color bands, amber dashed border for stale data (>2h), grey for missing data, and teal ring for selection. Added safe HTML attribute escaping (`escapeHtmlAttr`) preventing attribute breakout or XSS from provider-controlled names. Attached `ResetBoundsControl` directly inside the visible `MapContainer`, completely eliminating secondary hidden map containers. Connected `GET /api/v1/station-catalogue` for intake audit and `GET /api/v1/observed-rankings` displaying ranked rows with concentration, freshness, and quality state. Prominently disclaims: *Observed rankings sort monitors strictly by latest reported concentration; these are NOT predicted hotspots, forecasts, or common-time averages.* Zero wind overlays, 5km circles, or fake heatmaps. |
| **2** | **Audited Recorded-Clock Archive Explorer** | `ExplorerView.tsx` | Added distinct top-level workflows separating **Live CAAQMS Intake (UTC)** from **Audited Archive (Recorded Clock)**. Connected `GET /api/v1/archive/catalogue`, `GET /api/v1/archive/explore`, and `GET /api/v1/archive/compare`. Enforces mandatory `clock_assumption: 'same_recorded_clock'` on all multi-station comparisons. Displays persistent provenance disclaimer: `dataset_mode: recorded_clock • timezone: null • interval_semantics: unverified • publication_time_known: false`. Renders distribution quantiles (min, p05, p25, median, mean, p75, p95, max, stddev), bucket sequence table, and matched-clock pair agreement table with explicit interpretation. Preserves actual source units, including CO `mg/m³`. |
| **3** | **Model Registry & Evaluation Audit** | `ModelAuditView.tsx` | Connected `GET /api/v1/models` to dynamically populate model registry statuses. **Tier 1 (Recovered LightGBM-75):** Diagnostic only, verified booster SHA256 (`2891830c...`), 75 features, log1p/expm1 target transform, declared horizons (+1h, +3h, +6h, +12h, +24h), operational inference gated pending class source. **Tier 2 (delhi-recorded-pm25-v1):** Connected `GET /api/v1/models/{version}/evaluation` and `GET /api/v1/models/{version}/predictions`. Retrospective experiment on source `site_301` with 39 causal features, frozen chronological splits (train 2017–2023, validation 2024, test 2025–Oct 2026), and common-baseline cohort metrics comparing LightGBM vs persistence vs same-hour previous day baseline. Strict demo isolation: demo mode returns explicit `503 EVALUATION_UNAVAILABLE` and `PREDICTIONS_UNAVAILABLE` rather than attaching fake evaluation fixtures to the real model identity. **Tier 3 (Operational Model):** Gated by capabilities. |
| **4** | **Route Geometry Workspace** | `RouteCompareView.tsx` | Connected `POST /api/v1/routes/geometry` sending WGS84 origin/destination coordinates (`{ origin, destination, mode: 'driving', alternatives: 3 }`). Renders returned GeoJSON `LineString` alternatives dynamically on React Leaflet with distinct colors. Displays alternative corridor cards with road-network distance in metres/km, estimated duration in seconds/min, and OSRM attribution. Retains strict exposure gating with `409 ROUTE_COMPARISON_UNAVAILABLE` (`exposure_ready: false`, `traffic_aware: false`). Demo geometry fixture explicitly disclaims actual provider execution. |
| **5** | **Account & Persistence Workflows** | `SavedPlacesView.tsx`, `NotificationDrawer.tsx` | Connected to backend session/auth mechanism (`Authorization: Bearer <token>`). User-isolated places and alert rules with explicit threshold preservation (valid threshold of 0 preserved; no truthiness replacement). Verified across reload and ownership isolation in Playwright. |

---

## 2. Delivery Traceability & Evidence Matrix

| PRD ID | Feature Journey | Component | Status & Evidence Level | Notes / Operational Reality |
|---|---|---|---|---|
| **AC01** | Real Geographic Station Map | `StationMap.tsx`, `OverviewView.tsx` | **Browser Verified & API-Connected** | React Leaflet map with CartoDB Positron tiles, OpenStreetMap attribution, custom HTML div markers, synchronized selection, reset bounds control, and documented concentration legend. Verified in Playwright across desktop & mobile viewports. |
| **AC02** | Discrete ML Forecasts | `OverviewView.tsx` | **Browser Verified & API-Connected** | Discrete declared horizons [+1h, +3h, +6h, +12h, +24h]. Displays `503 MODEL_UNAVAILABLE` in live mode when backend inference is unverified. Verified in Playwright. |
| **AC03** | Observed Concentration Rankings | `OverviewView.tsx` | **Browser Verified & API-Connected** | Connected to `GET /api/v1/observed-rankings`. Displays actual sorted observations; disclaims predictive hotspot status. |
| **AC04** | Activity Exposure Planner | `PlannerView.tsx` | **Browser Verified & Blocked Capability** | Surfaces `409 TRAJECTORY_UNAVAILABLE`. Honestly discloses lack of verified continuous 24h trajectory. Verified in Playwright. |
| **AC05** | Educational Health Advisories | `HealthView.tsx` | **API-Connected & Implemented Screen** | WHO-sourced educational facts for PM2.5, PM10, NO2, SO2, O3, CO. Cites `engineering source review; no clinical review`. |
| **AC06** | Historical EDA & Archive Explorer | `ExplorerView.tsx` | **Browser Verified & API-Connected** | Connected to `GET /api/v1/archive/catalogue`, `/explore`, and `/compare` with mandatory `clock_assumption=same_recorded_clock`. Distinct from live UTC intake. |
| **AC07** | Population Context & Monitoring Extent | `CoverageView.tsx` | **Blocked Capability (Gated)** | Surfaces `409 COVERAGE_UNAVAILABLE`. Disclaims distance buffers as validated safe-air boundaries. |
| **AC08** | Data Modes & Transparency | `DataModeBadge.tsx`, `App.tsx` | **Browser Verified & API-Connected** | Persistent badges for `LIVE SENSOR TELEMETRY`, `HISTORICAL REPLAY`, and `DEMO PREVIEW ACTIVE` visible across desktop and mobile. Verified in Playwright. |
| **AC09** | Saved Places & Custom Alerts | `SavedPlacesView.tsx`, `NotificationDrawer.tsx` | **Browser Verified & API-Connected** | Bearer session auth (`Authorization: Bearer <token>`). Creates/deletes user-owned places and alert rules (`averaging_period_minutes: 60`, `channel: 'in_app'`). Preserves threshold 0. Verified across reload and ownership isolation in Playwright (desktop & mobile). |
| **AC11** | Model Tiers & Performance Audit | `ModelAuditView.tsx` | **Browser Verified & API-Connected** | Connected to `GET /api/v1/models`, `/models/{version}/evaluation`, and `/models/{version}/predictions`. Verified frozen splits and baseline comparisons. Gated demo evaluation. |
| **AC12** | Responsive & Accessible Experience | All UI components | **Browser Verified & Unit Tested** | Full ARIA semantics, visible focus outlines, keyboard-accessible Leaflet markers, responsive 390x844 mobile layout, and `prefers-reduced-motion` support. |
| **AC14** | Route Geometry Workspace | `RouteCompareView.tsx` | **Browser Verified & API-Connected** | Connected to `POST /api/v1/routes/geometry`. LineString alternatives rendered on Leaflet with distance and duration; exposure comparison gated with 409. |
| **AC15** | Weather Sensitivity What-If | `WeatherScenarioView.tsx` | **Blocked Capability (Gated)** | Surfaces `409 SCENARIO_UNAVAILABLE`. Honestly explains missing `HyperlocalAQPipeline` source. |

---

## 3. Verification Check Results

1. **Vitest Unit Suite (`npm --workspace=@breathewise/web run test`):**
   ```text
   Test Files: 3 passed (3)
   Tests:      34 passed (34)
   - client.test.ts: 19 passed (Contract 1.2.0 endpoints, Bearer session, demo 503 EVALUATION_UNAVAILABLE isolation)
   - features.test.ts: 10 passed (escapeHtmlAttr regression, zero alert threshold, honest capabilities, CPCB breakpoints)
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
   ✓ 99 modules transformed.
   dist/index.html                   0.36 kB │ gzip:   0.26 kB
   dist/assets/index-BGdEac3G.css   68.94 kB │ gzip:  16.36 kB
   dist/assets/index-BIQqGoIu.js   582.59 kB │ gzip: 162.16 kB
   ✓ built in 881ms
   Exit status: 0
   ```
4. **Chromium Local Playwright Suite (`npm --prefix tools/browser-tests test`):**
   - **8 of 8 passed** in 6.4s across `desktop` (1440x1000) and `mobile-reduced-motion` (390x844).
   - *Note on Ownership:* `tools/browser-tests/**` is owned by Codex. All frontend tests pass against on-disk source.

