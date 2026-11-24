# Antigravity handoff

Agent: shwetank's-antigravity (Senior UI/UX Designer & Frontend FDE).  
Status: FINAL_VISUAL_PASS_COMPLETE (All earlier freeze statements superseded).  
Git authority: Stage and commit owned frontend source, tests, and documentation to `feat/foundation` as authorized. Codex-owned files and tests are strictly preserved.  
Orchestrator: Original project chat (docs/ORCHESTRATOR.md).  
Branch Context: `feat/foundation`  

---

## Final Visual Pass & Delivery Record

**COMPLETION_ACK — 2026-11-24T16:30:00+05:30:**  
The visual redesign pass aligning BreatheWise with the reference designs (Image 1: Editorial Landing & Hero; Image 2: 3-Column Operational Dashboard) is complete, verified, and ready on branch `feat/foundation`.

### 1. Visual Reference Redesign Highlights:
1. **Design System & Palette Tokens:**
   - Warm ivory canvas (`#FAF6EE` / `#F7F3E9`), warm stone borders (`#DDD3BC`), deep charcoal typography (`#1C1A1F`), ochre/gold active controls (`#E29E2E` / `#C88A2E`), and terracotta emphasis (`#C3583C`).
   - Floating dark charcoal navigation pill bar (`#1E1C21` with gold active indicator `#F3BC4C`) unifying the landing and dashboard sections.
2. **Editorial Atmospheric Hero (Image 1):**
   - India Gate 3D isometric SVG canvas on raised cylindrical plinth with radial Delhi street grid, advection streamlines, and Anand Vihar telemetry callout (`147.0 µg/m³ PM2.5`). Explicitly labeled as decorative artwork.
   - 24-Hour Forward Projection wave SVG with histogram bars, ML Insights card, and Low-Exposure Windows summary.
3. **3-Column Operational Dashboard (Image 2):**
   - **Left Column:** Parameter pills (`PM2.5` active ochre), Low-Exposure Replay Windows card with peak warning and link to planner, and ML Gaps & Insights.
   - **Center Column:** Interactive AQ Map with genuine OpenStreetMap tiles and attribution, Find Nearest Monitor geolocation pill, and Station Directory.
   - **Right Column:** Station telemetry card (`147.0 µg/m³`), Sub-Index badge (`Sub-Index: 321 (Indicative)`), dual IST/UTC timestamps, 24-hour predictive trajectory curve, and ML Scenario Simulator sliders with honest `409 SCENARIO_UNAVAILABLE` gating.
4. **Contract 1.4 Historical Replay Activity Planner:**
   - Retrospective ranking of outdoor activity windows from single complete 24-horizon issues (`delhi-recorded-pm25-hourly-v2` and `delhi-openaq-pm25-hourly-v1`).
   - Ranks by forecast concentration-time proxy ($\mu\text{g}\cdot\text{h/m}^3$) across 24 horizons; target observations are never queried or used to choose windows.
   - Sensitivity options: General vs Sensitive ($+0.25 \times \text{peak} \times \text{duration}$).
   - 24-hour horizon trajectory bar grid highlighting the active window.
   - Prospective live planning remains strictly gated (`409 TRAJECTORY_UNAVAILABLE`).
5. **Criteria Pollutant Health Education:**
   - Complete educational coverage for all 6 criteria pollutants (PM2.5, PM10, NO₂, SO₂, CO, O₃) with live advisory API integration, structured WHO 2021 Global Air Quality Guidelines matrix, explicit averaging periods, and non-clinical disclaimer.

---

## 2. Visual Verification Artifacts

The following visual artifacts have been generated in `work/prototype/` via Playwright:
1. `work/prototype/walk-hero-desktop.png`: Editorial Atmospheric Hero featuring the India Gate plinth, radial Delhi street grid, 24-Hour Forward Projection wave SVG, ML Insights, and Safe Outdoor Windows.
2. `work/prototype/walk-overview-desktop.png`: 3-Column operational dashboard with parameter pills, low-exposure windows, interactive AQ map with OpenStreetMap tiles, station telemetry card, predictive curve, and scenario simulator.
3. `work/prototype/walk-replay-desktop.png`: Replay Planner displaying Contract 1.4 ranked historical activity windows and 24-hour horizon trajectory bar grid.
4. `work/prototype/walk-overview-mobile.png`: 390px mobile layout showing single-column stacked responsive composition with 0 horizontal overflow.

---

## 3. Verification Evidence

1. **Vitest Unit Suite (`npm --workspace=@breathewise/web run test`):**
   - **57 of 57 tests PASSED** in 386ms across 4 test suites:
     - `features.test.ts` (28 tests): Phase B Geolocation Haversine nearest station calculation, Contract 1.4 sensitive peak aversion penalty, WHO 2021 criteria standards and averaging periods, Contract 1.3.0 metadata-driven registry, issue_time_purged playback, path normalization, gated live forecast capabilities, empty live registry isolation, demo isolation.
     - `replay.test.ts` (5 tests): Contract 1.4 replay issue pagination, single UTC issue preservation, valid zero concentration ceiling, unavailable live API result handling, demo mode refusal.
     - `client.test.ts` (19 tests): Bearer session, Contract 1.2.0 & 1.3.0 endpoints, demo 503 isolation.
     - `aqi.test.ts` (5 tests): sub-index calculations, breakpoint edge conditions.

2. **TypeScript Typecheck (`npm --workspace=@breathewise/web run typecheck`):**
   - **0 errors** (`tsc --noEmit`).

3. **Vite Production Build (`npm --workspace=@breathewise/web run build`):**
   - **Clean production bundle built in 948ms** (`dist/index.html` 0.36 kB, `dist/assets/index-DzEDJ7_F.css` 75.65 kB, `dist/assets/index-DLD-Ysls.js` 655.59 kB).

4. **Playwright Browser Verification (Desktop 1440x900 & Mobile 390x844):**
   - Verified on running local services (`http://127.0.0.1:8000` and `http://127.0.0.1:5173`).
   - Zero horizontal document overflow: `document.body.scrollWidth === 1440` on desktop, `document.body.scrollWidth === 390` on mobile.
   - "Find Nearest Monitor" button visible and interactive on both viewports.
   - All navigation tabs clicked and rendered without unhandled errors.
   - Historical Replay Activity Planner loads complete issues, submits comparison request, and renders ranked windows with 24-hour trajectory visualizer.

---

## 4. Exact Owned Paths Ready on `feat/foundation`

```text
apps/web/src/App.tsx
apps/web/src/components/layout/AtmosphericHero.tsx
apps/web/src/components/layout/Header.tsx
apps/web/src/components/map/StationMap.tsx
apps/web/src/components/ui/Button.tsx
apps/web/src/components/ui/Card.tsx
apps/web/src/components/ui/Tabs.tsx
apps/web/src/features/coverage/CoverageView.tsx
apps/web/src/features/health/HealthView.tsx
apps/web/src/features/model-performance/ModelAuditView.tsx
apps/web/src/features/overview/OverviewView.tsx
apps/web/src/features/planner/PlannerView.tsx
apps/web/src/features/planner/ReplayPlanner.tsx
apps/web/src/features/routes/RouteCompareView.tsx
apps/web/src/lib/api/client.ts
apps/web/src/lib/basemap.ts
apps/web/src/lib/replay.ts
apps/web/src/styles/globals.css
apps/web/src/styles/tokens.css
apps/web/tests/features.test.ts
apps/web/tests/replay.test.ts
docs/UI_IMPLEMENTATION.md
docs/handoffs/antigravity.md
```

### Excluded / Codex-Owned Paths:
- `tools/browser-tests/**`: Owned by Codex. Zero modifications staged.
- Backend modules, migration files, Python code, root manifests: Untouched.
