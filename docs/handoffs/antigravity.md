# Antigravity handoff

Agent: shwetank's-antigravity (35%, Senior UI/UX Designer & Frontend FDE).  
Status: FRONTEND_MOBILE_FIXES_READY.  
Git authority: Read-only inspection; NO Git writes performed. Codex reviews, commits, and pushes ready files.  
Orchestrator: Original project chat (docs/ORCHESTRATOR.md).  
Branch Context: `feat/foundation`  

---

## Ready Paths for Codex Review, Commit & Push

The following coherent frontend files are fully implemented, verified, corrected, and ready for Codex to review, stage, commit, and push from this stable snapshot:
```text
apps/web/public/india-gate-silhouette.svg
apps/web/src/styles/tokens.css
apps/web/src/styles/globals.css
apps/web/src/lib/aqi.ts
apps/web/src/lib/api/types.ts
apps/web/src/lib/api/demoData.ts
apps/web/src/lib/api/client.ts
apps/web/src/components/ui/Badge.tsx
apps/web/src/components/ui/DataModeBadge.tsx
apps/web/src/components/ui/Button.tsx
apps/web/src/components/ui/Card.tsx
apps/web/src/components/ui/Tabs.tsx
apps/web/src/components/ui/Dialog.tsx
apps/web/src/components/ui/Select.tsx
apps/web/src/components/ui/Tooltip.tsx
apps/web/src/components/layout/Header.tsx
apps/web/src/components/layout/AtmosphericHero.tsx
apps/web/src/components/layout/NotificationDrawer.tsx
apps/web/src/components/map/StationMap.tsx
apps/web/src/features/overview/OverviewView.tsx
apps/web/src/features/hotspots/HotspotsView.tsx
apps/web/src/features/planner/PlannerView.tsx
apps/web/src/features/health/HealthView.tsx
apps/web/src/features/explorer/ExplorerView.tsx
apps/web/src/features/coverage/CoverageView.tsx
apps/web/src/features/saved-places/SavedPlacesView.tsx
apps/web/src/features/model-performance/ModelAuditView.tsx
apps/web/src/features/routes/RouteCompareView.tsx
apps/web/src/features/scenarios/WeatherScenarioView.tsx
apps/web/src/App.tsx
apps/web/src/main.tsx
apps/web/tests/aqi.test.ts
apps/web/tests/client.test.ts
apps/web/tests/features.test.ts
docs/UI_IMPLEMENTATION.md
docs/handoffs/antigravity.md
```

*(Note: `apps/web/src/lib/api/fixtures.ts` remains deleted to prevent conflicting fixtures).*

---

## Targeted Mobile & Review Corrections Summary

All issues raised in Codex's latest review (`docs/handoffs/codex.md` lines 106-116) have been resolved and verified across local Chromium runs:

1. **Responsive Header Layout (390 px Mobile Viewport Defect & Pointer Interception):**
   - In `apps/web/src/components/layout/Header.tsx`, restructured layout to prevent horizontal overflow in 390 px mobile viewports. On mobile screens (`< sm`), city selection adapts into a dedicated full-width bar below the top brand and action controls row, eliminating width collision.
   - In `apps/web/src/App.tsx`, constrained the root container with `w-full max-w-full overflow-x-hidden`.
   - "Demo Preview" button is now cleanly positioned within the top right mobile viewport (x ≈ 250 px, width ≈ 80 px) with zero horizontal scroll and zero pointer interception.

2. **Saved-Place Dialog Mobile Interaction & Persistence:**
   - In `apps/web/src/features/saved-places/SavedPlacesView.tsx`, added `useEffect` listeners so `newPlaceStationId` and `newRuleStationId` automatically sync to `stations[0].id` when station lists load asynchronously.
   - In `handleCreatePlace` and `handleCreateRule`, added fallback `stations.find(...) || stations[0]` so submitting the dialog never aborts silently on mobile emulation timing delays.
   - Enhanced `apps/web/src/components/ui/Dialog.tsx` with responsive padding (`p-3 sm:p-4`), backdrop-click dismissal, scrollable content (`overflow-y-auto`, `max-h-[90vh]`), and touch-friendly target sizes.

3. **DataModeBadge Mode Title & Mobile Display:**
   - In `apps/web/src/components/ui/DataModeBadge.tsx`, removed the unsupported `title="Real-time validated CAAQMS telemetry"` title attribute.
   - Replaced with truthful `title="Live CAAQMS telemetry intake feed"` (mode represents data intake source, not data validation/freshness).
   - Added responsive badge labels: compact `LIVE` / `DEMO` on mobile (`< sm`), expanding to `LIVE SENSOR TELEMETRY` / `DEMO TEST FIXTURE (PREVIEW)` on desktop.

4. **Hourly AQI Category Suppression & Averaging Disclaimer:**
   - Suppressed prominent overall AQI category badges ("Good", "Satisfactory", "Poor", etc.) from single-hour observations in `OverviewView.tsx`.
   - Prominently displays raw concentration values with units (`{val} µg/m³`), accompanied by `Indicative Sub-Index: {subIndex}`.
   - Corrected CPCB averaging disclaimer in `OverviewView.tsx` to reflect exact official standard (per CPCB publication indexed text):
     - 24-hour averaging for PM2.5, PM10, NO2, SO2, NH3, Pb
     - 8-hour averaging for CO and O3 (with 1-hour peak for O3)
     - Minimum 3 monitored pollutants including at least 1 particulate parameter
     - Data sufficiency requirement (minimum 16 hours of 24h period)
     - Stating clearly that single-hour sub-indices are indicative raw breakpoint evaluations and do not constitute official CPCB NAQI.

5. **Previous Targeted Fixes Preserved:**
   - Map wind/radius/OSM removal, truthful schematic attribution.
   - Explicit zero alert threshold preservation (`Number(trimmed) >= 0`).
   - Pollutant-specific latest/demo handling and request sequence guards (`latestRequestId`, `forecastRequestId`).
   - Demo-hotspot `503 MODEL_UNAVAILABLE` retention.

---

## Verification Evidence

1. **Chromium Local Playwright Suite (`npm --prefix tools/browser-tests test`):**
   - **8 of 8 tests PASSED** in 6.8s across `desktop` (1440x1000) and `mobile-reduced-motion` (390x844, isMobile: true, reducedMotion: reduce).
   - Specifically verified passing the two previously failing mobile journeys:
     - `journeys.spec.ts:31:1 › authenticated place persists across reload and isolates owners`: PASSED (526ms)
     - `journeys.spec.ts:52:1 › explicit demo opt-in stays labeled and separate`: PASSED (324ms)
2. **TypeScript Typecheck (`npm --workspace=@breathewise/web run typecheck`):**
   - **0 errors** (`tsc --noEmit`).
3. **Vitest Unit Suite (`npm --workspace=@breathewise/web run test`):**
   - **22 passed across 3 test suites** (`aqi.test.ts`, `client.test.ts`, `features.test.ts`).
4. **Vite Production Build (`npm --workspace=@breathewise/web run build`):**
   - **Production bundle built in 593ms** (`dist/index.html`, `dist/assets/index-4KBtAjzP.css`, `dist/assets/index-D3ouipbn.js`).
5. **Whole Repository Check (`make check`):**
   - **PASSED** (Ruff check/format, 46 Python tests + 1 skip, OpenAPI contract sync, contract types check, web typecheck).
