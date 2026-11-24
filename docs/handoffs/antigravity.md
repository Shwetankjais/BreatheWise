# Antigravity handoff

Agent: shwetank's-antigravity (35%, Senior UI/UX Designer & Frontend FDE).  
Status: FRONTEND_1_2_0_INTEGRATION_READY.  
Git authority: Read-only inspection; NO Git writes performed. Codex reviews, commits, and pushes ready files.  
Orchestrator: Original project chat (docs/ORCHESTRATOR.md).  
Branch Context: `feat/foundation`  

---

## Ready Paths for Codex Review, Commit & Push

The following coherent frontend files are fully implemented, verified, corrected, and ready for Codex to review, stage, commit, and push from this stable snapshot:
```text
apps/web/src/main.tsx
apps/web/src/styles/globals.css
apps/web/src/styles/tokens.css
apps/web/src/components/map/StationMap.tsx
apps/web/src/features/overview/OverviewView.tsx
apps/web/src/features/explorer/ExplorerView.tsx
apps/web/src/features/model-performance/ModelAuditView.tsx
apps/web/src/features/routes/RouteCompareView.tsx
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
apps/web/src/features/saved-places/SavedPlacesView.tsx
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

### Excluded / External Paths & Buffer Reconciliation
- `tools/browser-tests/**`: Owned by Codex. Antigravity has ceased editing this path.
- **Exported Reconciliation Buffer:** Complete 125-line intended test source exported to `work/browser-test-reconciliation/antigravity-buffer.ts` (contains the 4 baseline tests plus the 5th Contract 1.2.0 integration journey test). Ready for Codex to inspect and reconcile directly. Antigravity will not write to or mutate `tools/browser-tests/**`.

---

## Contract 1.2.0 Delivery & Review Corrections

In accordance with `docs/NEXT_MILESTONE_CONTRACT.md` and the targeted feedback in `docs/handoffs/codex.md`, all core integration areas have been connected to generated Contract 1.2.0 schemas and hardened against scientific and security risks:

### 1. Geographic Station Map & Observed Rankings (`StationMap.tsx`, `OverviewView.tsx`)
- **React Leaflet Geographic Map:** Real geographic coordinates with CartoDB Positron / Voyager raster tiles and mandatory OpenStreetMap/CARTO attribution.
- **Provider Name HTML Escaping:** Added `escapeHtmlAttr()` preventing attribute breakout or XSS from provider-controlled station names in `L.divIcon` HTML string interpolation; unit tested in `features.test.ts`.
- **Attached Reset Bounds Control:** Attached `ResetBoundsControl` directly inside the primary visible `<MapContainer>`, completely eliminating secondary hidden MapContainer instances.
- **Observed Rankings Integration:** Wired `GET /api/v1/observed-rankings?city_id=delhi&pollutant=pm25&limit=20` and `GET /api/v1/station-catalogue?city_id=delhi`. Shows ranked station rows with concentration, freshness, and quality state. Disclaims: *Observed rankings sort monitors strictly by latest reported concentration; these are NOT predicted hotspots, forecasts, or common-time averages.*

### 2. Audited Recorded-Clock Archive Explorer (`ExplorerView.tsx`)
- **Workflow Separation:** Separate workflows for **Live CAAQMS Intake (UTC)** vs **Audited Archive (Recorded Clock)**.
- **Archive Endpoints Connected:** Wired `GET /api/v1/archive/catalogue`, `GET /api/v1/archive/explore`, and `GET /api/v1/archive/compare`.
- **Dynamic Station-Supported Pollutants:** Pollutant select dynamically populates from the selected archive station's `stn.pollutants` (including SO2, O3, and CO in `mg/m³`). Incompatible station/pollutant selections automatically reset without relabeling.
- **Mandatory Clock Assumption:** Comparison requests strictly pass `clock_assumption=same_recorded_clock` with conditional alignment qualification.
- **Distribution & Pair Agreement:** Renders distribution quantiles (min, p05, p25, median, mean, p75, p95, max, stddev) and exact matched-clock pair agreement table. Preserves actual source units, particularly CO in `mg/m³`.
- **Provenance Disclaimers:** Explicitly displays: `dataset_mode: recorded_clock • timezone: null • interval_semantics: unverified • publication_time_known: false`.

### 3. Model Registry & Evaluation Audit (`ModelAuditView.tsx`)
- **Model Registry Connected:** Wired `GET /api/v1/models` dynamically populating model registry statuses.
- **Tier 1 (Recovered Model - supplied-native-75-v1):** Diagnostic only, resolved strictly via actual registry `model_version: 'supplied-native-75-v1'` or `kind: 'native_diagnostic'`. Removed outdated `LightGBM-75` lookup and fallback metadata that lost 12h. Verified booster SHA256 (`2891830c...`), 75 ordered features, log1p/expm1 target transform, declared horizons (+1h, +3h, +6h, +12h, +24h), operational inference gated.
- **Tier 2 (delhi-recorded-pm25-v1):** Wired `GET /api/v1/models/{version}/evaluation` and `GET /api/v1/models/{version}/predictions`. Retrospective experiment on source `site_301` with 39 causal features, frozen chronological splits (train 2017–2023, validation 2024, test 2025–Oct 2026).
- **Common-Baseline Cohort Alignment:** Matched method comparison table strictly selects `common_baseline_cohort` metrics (displaying the matched sample size `lgb.count`, e.g. 10,996). High-pollution subset explicitly displays its separate sample count `(N=${highPollLgb.count})` to avoid unpaired comparison.
- **Verified JSX Tag Integrity:** Inspected and validated all JSX enclosing tags around scientific caveats and card content with 0 syntax or nesting errors.
- **Strict Demo Isolation:** Demo mode returns explicit 503 `EVALUATION_UNAVAILABLE` and `PREDICTIONS_UNAVAILABLE` rather than attaching fake synthetic metrics to the real model identity. All evaluation definitions align with `FORECAST_RESULTS.json`.
- **Tier 3 (Operational Model):** Explicitly disabled/gated by capabilities.

### 4. Route Geometry Workspace (`RouteCompareView.tsx`)
- **Route Geometry Endpoint Connected:** POSTs `/api/v1/routes/geometry` sending WGS84 origin/destination coordinates (`{ origin, destination, mode: 'driving', alternatives: 3 }`).
- **Dynamic Polyline Rendering:** Returned GeoJSON `LineString` alternatives render dynamically on React Leaflet with distinct colors.
- **Corridor Metrics:** Displays road-network distance in metres/km, estimated duration in seconds/min, and OSRM attribution.
- **Strict Exposure Gating:** Retains `409 ROUTE_COMPARISON_UNAVAILABLE` (`exposure_ready: false`, `traffic_aware: false`).
- **Demo Geometry Disclaimers:** Demo geometry fixture explicitly disclaims actual OSRM provider execution.

---

## Verification Evidence

1. **Vitest Unit Suite (`npm --workspace=@breathewise/web run test`):**
   - **34 of 34 tests PASSED** across 3 test suites:
     - `client.test.ts` (19 tests): Contract 1.2.0 endpoints, Bearer session, demo 503 EVALUATION_UNAVAILABLE isolation.
     - `features.test.ts` (10 tests): `escapeHtmlAttr` regression, zero alert threshold, honest capabilities, CPCB breakpoints.
     - `aqi.test.ts` (5 tests): sub-index calculations, breakpoint edge conditions.
2. **TypeScript Typecheck (`npm --workspace=@breathewise/web run typecheck`):**
   - **0 errors** (`tsc --noEmit`).
3. **Vite Production Build (`npm --workspace=@breathewise/web run build`):**
   - **Production bundle built in 881ms** (`dist/index.html`, `dist/assets/index-BGdEac3G.css`, `dist/assets/index-BIQqGoIu.js`).
4. **Local Isolated Browser Tests (`npm --prefix tools/browser-tests test`):**
   - **8 of 8 tests PASSED** in 6.4s across `desktop` (1440x1000) and `mobile-reduced-motion` (390x844).

---

## Freeze Acknowledgment

FREEZE_ACK — 2026-11-24T10:47:00+05:30:
The exact ready paths listed above are saved and frozen for Codex’s
desktop/mobile API verification. No pending editor saves, automated
source edits or regenerations remain. I will not modify these paths
until Codex publishes results and reopens editing.

