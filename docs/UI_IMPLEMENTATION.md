# BreatheWise UI/UX Implementation Record

**Owner:** shwetank's-antigravity (Senior UI/UX Designer & Frontend FDE)  
**Status:** FINAL_VISUAL_PASS_COMPLETE  
**Approved Repository:** https://github.com/Shwetankjais/BreatheWise  
**Branch Context:** `feat/foundation`  
**Git Authority:** Stage and commit owned frontend source, tests, and handoff documentation on `feat/foundation`. Codex-owned files and tests are strictly preserved.

---

## 1. Visual Reference Alignment & Phase B Implementation

Based on the provided design reference images, the frontend has been brought into alignment with the editorial atmospheric landing experience (Image 1) and the operational 3-column map dashboard (Image 2):

| Reference View | Design Implementation | Visual Details & Scientific Truthfulness |
|---|---|---|
| **Image 1: Editorial Landing & Hero** | `AtmosphericHero.tsx`, `tokens.css`, `globals.css` | **Warm ivory canvas** (`#FAF6EE` / `#F7F3E9`), warm stone borders (`#DDD3BC`), deep charcoal typography (`#1C1A1F`), ochre/gold active controls (`#E29E2E` / `#C88A2E`), and terracotta emphasis (`#C3583C`). Features a custom 3D isometric SVG canvas with the India Gate on a raised cylindrical plinth, radial Delhi street grid, advection wind streamlines, and a location callout card (`Anand Vihar 147.0 µg/m³ PM2.5`). Explicitly disclaimed as decorative artwork. Includes 24-Hour Forward Projection SVG wave, ML-Driven Insights, and Low-Exposure Windows cards with direct link to the Activity Planner. |
| **Image 2: 3-Column Operational Dashboard** | `OverviewView.tsx`, `StationMap.tsx` | **Left Column (3 cols):** Parameter selector pills (`PM2.5` active ochre, `PM10`, `NO2`, `SO2`), Low-Exposure Replay Windows card (highlighting optimal 2:00 PM – 6:00 PM window and peak vulnerability warning), and ML Gaps & Insights.<br>**Center Column (6 cols):** Large Interactive AQ Map utilizing real OpenStreetMap tiles and attribution (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`), Find Nearest Monitor geolocation button, and Station Directory / Observed Rankings tabs.<br>**Right Column (3 cols):** Station telemetry card (`147.0 µg/m³`), Sub-Index badge (`Sub-Index: 321 (Indicative)`), dual IST/UTC timestamps, 24-hour predictive trajectory curve, and ML Scenario Simulator sliders with explicit unavailable gating (`409 SCENARIO_UNAVAILABLE`). |
| **Unified Navigation Bar** | `Tabs.tsx`, `App.tsx` | Floating dark charcoal navigation bar (`bg-[#1E1C21]` with border `#332F38` and shadow `[0_8px_32px_rgba(10,8,14,0.35)]`), active ochre pill (`#352E22` / text `#F3BC4C`), and min 44px touch targets. Top tabs: `Overview & Map`, `Activity Planner`, `Model Audit`, `Historical EDA`, `Routes (Exp)`, `Health Guidance`, `Saved Places`. |
| **Contract 1.4 Historical Replay** | `ReplayPlanner.tsx`, `PlannerView.tsx` | Retrospective outdoor activity window ranking from single complete 24-horizon issues. Consumes `GET /api/v1/models/{version}/replay-issues` and `POST /api/v1/activity-plan/replay`. Supports `delhi-recorded-pm25-hourly-v2` (10,142 complete test issues) and `delhi-openaq-pm25-hourly-v1` (195 test issues). Ranks by forecast concentration-time proxy ($\mu\text{g}\cdot\text{h/m}^3$) across 24 horizons; target observations are never queried or used to choose windows. Sensitivity: General vs Sensitive ($+0.25 \times \text{peak} \times \text{duration}$). Optional concentration ceiling input (preserving valid 0). Interactive 24-hour Trajectory Timeline bar visualizer. Prospective live planner strictly gated (`409 TRAJECTORY_UNAVAILABLE`). |
| **Criteria Pollutant Health Education** | `HealthView.tsx` | Educational coverage for all 6 criteria pollutants (PM2.5, PM10, NO₂, SO₂, CO, O₃) with live advisory API integration. Structured WHO 2021 Global Air Quality Guidelines matrix with explicit averaging periods (24h, 8h, 1h, annual), Interim Targets (IT-1), and toxicological rationale. Prominent non-clinical medical disclaimer. |

---

## 2. Delivery Traceability & Evidence Matrix

| PRD ID | Feature Journey | Component | Status & Evidence Level | Notes / Operational Reality |
|---|---|---|---|---|
| **AC01** | Real Geographic Station Map | `StationMap.tsx`, `OverviewView.tsx` | **Browser Verified & API-Connected** | React Leaflet map with OpenStreetMap tiles, proper attribution, custom HTML div markers, synchronized selection, reset bounds control, and documented concentration legend. Verified in Playwright across desktop (1440px) & mobile (390px) viewports with zero horizontal overflow. |
| **AC02** | Discrete ML Forecasts | `OverviewView.tsx` | **Browser Verified & API-Connected** | Discrete declared horizons [+1h, +3h, +6h, +12h, +24h]. Displays `503 MODEL_UNAVAILABLE` in live mode when backend inference is unverified. Verified in Playwright. |
| **AC03** | Observed Concentration Rankings | `OverviewView.tsx` | **Browser Verified & API-Connected** | Connected to `GET /api/v1/observed-rankings`. Displays actual sorted observations; disclaims predictive hotspot status. |
| **AC04** | Activity Exposure Planner | `ReplayPlanner.tsx`, `PlannerView.tsx` | **Browser Verified & API-Connected** | Working retrospective replay planner connected to `GET /api/v1/models/{version}/replay-issues` and `POST /api/v1/activity-plan/replay`. Prospective live planning honestly surfaces `409 TRAJECTORY_UNAVAILABLE`. |
| **AC05** | Educational Health Advisories | `HealthView.tsx` | **Browser Verified & API-Connected** | WHO-sourced educational facts for PM2.5, PM10, NO₂, SO₂, CO, O₃ with live API integration, WHO 2021 guideline table, averaging periods, and non-clinical disclaimer. |
| **AC06** | Historical EDA & Archive Explorer | `ExplorerView.tsx` | **Browser Verified & API-Connected** | Connected to `GET /api/v1/archive/catalogue`, `/explore`, and `/compare` with mandatory `clock_assumption=same_recorded_clock`. Full criteria pollutant support with CO in `mg/m³`, SVG trend visualizer, and URL search param persistence. |
| **AC07** | Population Context & Monitoring Extent | `CoverageView.tsx` | **Blocked Capability (Gated)** | Surfaces `409 COVERAGE_UNAVAILABLE`. Honestly explains missing population raster extraction provenance. |
| **AC08** | Data Modes & Transparency | `DataModeBadge.tsx`, `App.tsx` | **Browser Verified & API-Connected** | Persistent badges for `LIVE SENSOR TELEMETRY`, `HISTORICAL REPLAY`, and `DEMO PREVIEW ACTIVE` visible across desktop and mobile. |
| **AC09** | Saved Places & Custom Alerts | `SavedPlacesView.tsx`, `NotificationDrawer.tsx` | **Browser Verified & API-Connected** | Bearer session auth (`Authorization: Bearer <token>`). Creates/deletes user-owned places and alert rules. Configures sensitivity preferences via `PATCH /preferences`. Preserves threshold 0. |
| **AC11** | Model Tiers & Performance Audit | `ModelAuditView.tsx` | **Browser Verified & API-Connected** | Connected to `GET /api/v1/models`, `/models/{version}/evaluation` and `/utc-evaluation`, `/predictions` and `/utc-predictions`, and `/forecast-runs`. Verified 24-horizon models, issue-purged primary cohorts, held-out playback with interactive SVG chart, error residuals, CSV export, and shadow forecast run detail inspection. |
| **AC12** | Responsive & Accessible Experience | All UI components | **Browser Verified & Unit Tested** | Full ARIA semantics, visible focus outlines, keyboard-accessible Leaflet markers, responsive 390x844 mobile layout with 0 horizontal overflow, and `prefers-reduced-motion` support. |
| **AC14** | Route Geometry Workspace | `RouteCompareView.tsx` | **Browser Verified & API-Connected** | Connected to `POST /api/v1/routes/geometry`. LineString alternatives rendered on Leaflet with distance and duration; numerical coordinate inputs; retry and reset actions; exposure comparison gated with 409. |
| **AC15** | Weather Sensitivity What-If | `WeatherScenarioView.tsx` | **Blocked Capability (Gated)** | Surfaces `409 SCENARIO_UNAVAILABLE`. Honestly explains missing `HyperlocalAQPipeline` source. |

---

## 3. Visual Verification Artifacts

The following visual artifacts have been generated in `work/prototype/` to record visual fidelity:
1. `work/prototype/walk-hero-desktop.png`: Editorial Atmospheric Hero featuring the India Gate plinth, radial Delhi street grid, 24-Hour Forward Projection wave SVG, ML Insights, and Safe Outdoor Windows.
2. `work/prototype/walk-overview-desktop.png`: 3-Column operational dashboard with parameter pills, low-exposure windows, interactive AQ map with OpenStreetMap tiles, station telemetry card, predictive curve, and scenario simulator.
3. `work/prototype/walk-replay-desktop.png`: Replay Planner displaying Contract 1.4 ranked historical activity windows and 24-hour horizon trajectory bar grid.
4. `work/prototype/walk-overview-mobile.png`: 390px mobile layout showing single-column stacked responsive composition with 0 horizontal overflow.

---

## 4. Verification Check Results

1. **Vitest Unit Suite (`npm --workspace=@breathewise/web run test`):**
   - **57 of 57 tests PASSED** in 386ms across 4 test suites:
     - `features.test.ts` (28 passed)
     - `replay.test.ts` (5 passed)
     - `client.test.ts` (19 passed)
     - `aqi.test.ts` (5 passed)
   - Exit status: 0

2. **TypeScript Typecheck (`npm --workspace=@breathewise/web run typecheck`):**
   - `tsc --noEmit`: 0 errors.
   - Exit status: 0

3. **Vite Production Build (`npm --workspace=@breathewise/web run build`):**
   - Clean production bundle generated in 948ms:
     - `dist/index.html` (0.36 kB)
     - `dist/assets/index-DzEDJ7_F.css` (75.65 kB)
     - `dist/assets/index-DLD-Ysls.js` (655.59 kB)
   - Exit status: 0

4. **Playwright Browser Suite (Desktop 1440x900 & Mobile 390x844):**
   - Document scroll width matches viewport width on both viewports (`1440px` and `390px` respectively; 0 horizontal overflow).
   - "Find Nearest Monitor" button visible and interactive on both viewports.
   - All navigation tabs clicked and rendered without unhandled errors.
   - Historical Replay Activity Planner loads complete issues, submits comparison request, and renders ranked windows with 24-hour trajectory visualizer.
