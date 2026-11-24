# BreatheWise UI/UX Implementation Record

**Owner:** shwetank's-antigravity (35% allocation, Senior UI/UX Designer & Frontend FDE)  
**Status:** FRONTEND_MOBILE_FIXES_READY — All targeted mobile and review issues resolved; all 8 Chromium browser journeys, 22 unit tests, and production build pass.  
**Approved Repository:** https://github.com/Shwetankjais/BreatheWise  
**Branch Context:** `feat/foundation`  
**Git Authority:** Read-only inspection; NO Git writes performed. Codex commits and pushes ready files.  

---

## 1. Resolution of Targeted Review Issues

| # | Targeted Review Item | Action Taken & Implementation Details |
|---|---|---|
| **1** | **390 px Mobile Viewport Defect & Header Layout** | Redesigned `Header.tsx` to prevent horizontal overflow in 390 px viewports (document width was previously expanding to 560 px). On mobile screens (`< sm`), city selection adapts into a dedicated full-width bar below the top brand and action controls row, eliminating width collision. Constrained root container in `App.tsx` with `w-full max-w-full overflow-x-hidden`. "Demo Preview" button is now cleanly positioned within the top right mobile viewport (x ≈ 250 px, width ≈ 80 px) with zero horizontal scroll and zero pointer interception. |
| **2** | **Saved-Place Dialog Mobile Interaction & Persistence** | In `SavedPlacesView.tsx`, added `useEffect` listeners so `newPlaceStationId` and `newRuleStationId` automatically sync to `stations[0].id` when station lists load asynchronously. In `handleCreatePlace` and `handleCreateRule`, added fallback `stations.find(...) || stations[0]` so submitting the dialog never aborts silently on mobile emulation timing delays. Enhanced `Dialog.tsx` with responsive padding (`p-3 sm:p-4`), backdrop-click dismissal, scrollable content (`overflow-y-auto`, `max-h-[90vh]`), and touch-friendly target sizes. |
| **3** | **DataModeBadge Mode Title & Mobile Display** | Removed the unsupported `title="Real-time validated CAAQMS telemetry"` title attribute in `DataModeBadge.tsx`. Replaced with truthful `title="Live CAAQMS telemetry intake feed"` (mode represents data intake source, not data validation/freshness). Added responsive badge labels: compact `LIVE` / `DEMO` on mobile (`< sm`), expanding to `LIVE SENSOR TELEMETRY` / `DEMO TEST FIXTURE (PREVIEW)` on desktop. |
| **4** | **Hourly AQI Category Suppression & Averaging Disclaimer** | Suppressed prominent overall AQI category badges ("Good", "Satisfactory", "Poor", etc.) from single-hour observations in `OverviewView.tsx`. Prominently displays raw concentration values with units (`{val} µg/m³`), accompanied by `Indicative Sub-Index: {subIndex}`. Corrected CPCB averaging disclaimer to reflect exact official standard: 24-hour averaging for PM2.5, PM10, NO2, SO2, NH3, Pb; 8-hour for CO and O3; minimum 3 monitored pollutants with at least 1 particulate parameter; data sufficiency requirement (minimum 16 hours of 24h period); stating clearly that single-hour sub-indices are indicative raw breakpoint evaluations and do not constitute official CPCB NAQI. |
| **5** | **Map Claims & Schematic Integrity** | Removed unsupported wind overlay ('Wind NW Advection' checkbox and hardcoded vector arrows), fixed-radius 52px buffer circles claiming 5km coverage, and OpenStreetMap attribution. Hand-drawn arbitrary boundary path eliminated. Schematic coordinate grid explicitly labeled: *"Schematic coordinate grid; not a calibrated GIS dispersion model"*. Attribution truthfully declared: *"Schematic CAAQMS Monitor Grid (Relative Coordinates) \| Telemetry: CAAQMS / DPCC / SPCB"*. Station SVG markers made fully keyboard accessible with `tabIndex={0}`, `role="button"`, `aria-label`, and `onKeyDown` handlers. Hover card displays pollutant name dynamically rather than hardcoding PM2.5. |
| **6** | **Zero Alert Threshold Validation** | Replaced `parseFloat(newRuleThreshold) || 250` with explicit finite non-negative validation (`Number(trimmed) >= 0`). A threshold of `0` is strictly preserved and transmitted to the server. Form displays actionable validation messages if empty or negative. Added dedicated regression test verifying rule creation with `threshold: 0` is preserved as `0` and not replaced by defaults. |
| **7** | **Selected Pollutant Consistency & Race Condition Guards** | Connected parameter switcher tabs (`PM2.5`, `PM10`, `NO2`, `SO2`, `O3`, `CO`) in Overview. Observations, units, labels, and timestamps correspond strictly to `selectedPollutant`. If measurement for a selected pollutant is missing, UI renders an explicit unavailable state (`No {pollutant} observation reported`) instead of falling back to another pollutant. Implemented request sequence counters (`latestRequestId` and `forecastRequestId`) in `App.tsx` so rapid parameter changes discard out-of-order responses. In `demoData.ts`, measurements are uniquely keyed by `${stationId}:${pollutant}` with distinct physical values; `getLatest` strictly returns 404 `MEASUREMENT_NOT_FOUND` if a pollutant is absent, rather than relabeling PM2.5 numbers. |
| **8** | **Sub-Index Breakpoint Continuity & CO Units** | Fixed `calculateSubIndex` in `aqi.ts` to use continuous intervals so fractional values (e.g. `30.5`, `90.5`) interpolate smoothly between breakpoint bands instead of returning 0. Evaluates CO in canonical `µg/m³` (CPCB 0–1000, 1000–2000, 2000–10000, etc.) matching API contracts. |

---

## 2. Visual Design & Atmospheric Art Direction

- **India Gate Silhouette & Atmospheric Depth (`AtmosphericHero.tsx`):** Layered SVG artwork (`apps/web/public/india-gate-silhouette.svg`) with drifting warm haze overlay (`animate-haze`), `motion-reduce:animate-none` support, and explicit decorative disclaimer: *"Background silhouette and haze are decorative atmospheric artwork; not a spatial particle distribution visualization."*
- **Schematic Map & Marker Focus (`StationMap.tsx`):** Manual smooth zoom (+ / - / reset) preventing jumpy automated recentering. Selected marker emphasis uses a spinning teal dashed accent ring, while unselected markers remain calm and static.
- **Design Tokens (`apps/web/src/styles/tokens.css`):** Official CPCB 6-tier breakpoints palette (`Good`, `Satisfactory`, `Moderate`, `Poor`, `Very Poor`, `Severe`), accessible contrast ratios (WCAG AAA for text, AA for UI controls).

---

## 3. Delivery Traceability & Evidence Matrix

| PRD ID | Feature Journey | Component | Status & Evidence Level | Notes / Operational Reality |
|---|---|---|---|---|
| **AC01** | City Switcher & Station Detail | `Header.tsx`, `OverviewView.tsx`, `StationMap.tsx` | **Browser Verified & API-Connected** | 16 Indian cities selectable. Displays raw concentration (`µg/m³`), observation age, provider, coordinates. Verified in Playwright across desktop & mobile viewports. |
| **AC02** | Discrete ML Forecasts | `OverviewView.tsx` | **Browser Verified & API-Connected** | Discrete declared horizons [+1h, +3h, +6h, +12h, +24h]. Displays `503 MODEL_UNAVAILABLE` in live mode when backend inference is unverified. Verified in Playwright. |
| **AC03** | Emerging Hotspot Ranking | `HotspotsView.tsx` | **API-Connected (Live Gated / Demo 503)** | Gated with `503 MODEL_UNAVAILABLE` in live and demo modes per orchestrator instruction (no fabricated city forecasts). |
| **AC04** | Activity Exposure Planner | `PlannerView.tsx` | **Browser Verified & Blocked Capability** | Surfaces `409 TRAJECTORY_UNAVAILABLE`. Honestly discloses lack of verified continuous 24h trajectory. Verified in Playwright. |
| **AC05** | Educational Health Advisories | `HealthView.tsx` | **API-Connected & Implemented Screen** | WHO-sourced educational facts for PM2.5, PM10, NO2, SO2, O3, CO. Cites `engineering source review; no clinical review`. |
| **AC06** | Historical EDA Explorer | `ExplorerView.tsx` | **API-Connected & Implemented Screen** | Queries 48-hour ISO window (`start`, `end`, `pollutant`). Computes valid/missing point counts and provides CSV export. |
| **AC07** | Population Context & Monitoring Extent | `CoverageView.tsx` | **Blocked Capability (Gated)** | Surfaces `409 COVERAGE_UNAVAILABLE`. Disclaims distance buffers as validated safe-air boundaries. |
| **AC08** | Data Modes & Transparency | `DataModeBadge.tsx`, `App.tsx` | **Browser Verified & API-Connected** | Persistent badges for `LIVE SENSOR TELEMETRY`, `HISTORICAL REPLAY`, and `DEMO PREVIEW ACTIVE` visible across desktop and mobile. Verified in Playwright. |
| **AC09** | Saved Places & Custom Alerts | `SavedPlacesView.tsx`, `NotificationDrawer.tsx` | **Browser Verified & API-Connected** | Bearer session auth (`Authorization: Bearer <token>`). Creates/deletes user-owned places and alert rules (`averaging_period_minutes: 60`, `channel: 'in_app'`). Verified across reload and ownership isolation in Playwright (desktop & mobile). |
| **AC11** | Model Performance & Verification Audit | `ModelAuditView.tsx` | **Blocked Capability (Gated) / Static Audit** | Runtime evaluation surfaces `503 EVALUATION_UNAVAILABLE`. Displays verified static booster facts (SHA256 `2891830c...`, 75 features). |
| **AC12** | Responsive & Accessible Experience | All UI components (`Badge`, `Button`, `Card`, `Tabs`, `Dialog`, `Select`, `Tooltip`) | **Browser Verified & Unit Tested** | Full ARIA semantics, visible focus outlines, keyboard-accessible SVG map markers, and `motion-reduce` support. Verified across 390x844 mobile viewport. |
| **AC14** | Route Exposure Comparison | `RouteCompareView.tsx` | **Experimental Prototype (Implemented Screen)** | Displays spatial modeling transparency notice: samples station monitors along line; disclaims micro-dispersion. |
| **AC15** | Weather Sensitivity What-If | `WeatherScenarioView.tsx` | **Blocked Capability (Gated)** | Surfaces `409 SCENARIO_UNAVAILABLE`. Honestly explains missing `HyperlocalAQPipeline` source. |

---

## 4. Verification Check Results

1. **Chromium Local Playwright Suite (`npm --prefix tools/browser-tests test`):**
   ```text
   Running 8 tests using 1 worker
   ✓ 1 desktop: API observations and disabled forecast remain explicit (589ms)
   ✓ 2 desktop: 503 remains a failure and empty station searches remain empty (239ms)
   ✓ 3 desktop: authenticated place persists across reload and isolates owners (598ms)
   ✓ 4 desktop: explicit demo opt-in stays labeled and separate (338ms)
   ✓ 5 mobile-reduced-motion: API observations and disabled forecast remain explicit (334ms)
   ✓ 6 mobile-reduced-motion: 503 remains a failure and empty station searches remain empty (223ms)
   ✓ 7 mobile-reduced-motion: authenticated place persists across reload and isolates owners (526ms)
   ✓ 8 mobile-reduced-motion: explicit demo opt-in stays labeled and separate (324ms)
   8 passed (6.8s)
   ```
2. **TypeScript Typecheck (`npm --workspace=@breathewise/web run typecheck`):**
   ```text
   > tsc --noEmit
   Exit status: 0 (0 errors)
   ```
3. **Vitest Regression Suite (`npm --workspace=@breathewise/web run test`):**
   ```text
   ✓ tests/features.test.ts (7 tests)
   ✓ tests/client.test.ts (10 tests)
   ✓ tests/aqi.test.ts (5 tests)

   Test Files: 3 passed (3)
   Tests: 22 passed (22)
   Duration: 253ms
   Exit status: 0
   ```
4. **Vite Production Build (`npm --workspace=@breathewise/web run build`):**
   ```text
   dist/index.html                   0.36 kB │ gzip:  0.27 kB
   dist/assets/index-4KBtAjzP.css   50.14 kB │ gzip:  9.41 kB
   dist/assets/index-D3ouipbn.js   345.42 kB │ gzip: 98.42 kB
   ✓ built in 593ms
   Exit status: 0
   ```
5. **Repository-Wide Check (`make check`):**
   ```text
   Ruff: All checks passed! 57 files already formatted.
   Pytest: 46 passed, 1 skipped in 0.83s.
   OpenAPI contract sync: ✨ openapi-typescript 7.13.0.
   Contract types check: 0 errors.
   Web typecheck: 0 errors.
   Exit status: 0
   ```
