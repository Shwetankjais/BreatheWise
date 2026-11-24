# Final localhost browser review — 24 November 2026

Branch: `feat/foundation`. Review scope: running API on port 8000 and Vite web app on port 5173, real cached Delhi data, desktop 1440 px and mobile 390 px. This review does not certify public live forecasting.

## Changes after the Phase B visual commit

- Rebalanced the landing page to match the supplied isometric-map reference: compact headline, larger original India Gate scene, dark violet frame and pink/violet atmospheric accents. The scene is labeled as decorative. Its station callout uses the selected station's actual reported value; hard-coded replay times were removed.
- Added a single browser geolocation request per session. Nearby device coordinates select the nearest available station; a 50 km UI proximity guard refuses a distant station without claiming that 50 km is calibrated pollution coverage. Denied location permissions retain manual city/station selection. Coordinates are not sent to the backend or saved. No reverse geocoder or IP-based fallback is configured, so city/region/country are not inferred from GPS coordinates.
- Skipped public forecast and hotspot requests when their capability is disabled, avoiding predictable 503 requests on page load. Live forecast, predicted hotspots, exposure routing and weather scenarios remain gated.
- Kept health advisory API content matched to the selected pollutant. Removed fallback to another pollutant's advisory and linked the WHO guideline source.
- Added a visible retry/error state for unavailable advisory responses and made primary buttons/select focus states consistent with the violet design system.
- Kept the quick-save dialog open with the actual API error on failure. Historical replay window cards now support keyboard selection, and the 24-hour sequence scrolls horizontally on narrow screens.

## Verification

- `npm --workspace=@breathewise/web run test`: 57 passed across four suites.
- `npm --workspace=@breathewise/web run build`: passed, including TypeScript compilation. Vite notes a nonfatal bundle-size warning.
- Browser page sweep: all ten tabs reached at 1440 px and 390 px, no document overflow and no uncaught page errors. Disabled forecast/hotspot endpoints were no longer requested at load.
- Focused actual API journeys: eight checks per viewport passed: actual hero reading, quick-save 401 handling, replay ranking and zero-ceiling no-window result, model registry, archive data, route geometry, matched NO2 advisory, and all-page navigation/width.
- Geolocation: granted Delhi coordinates selected a monitor 0.7 km away; granted Mumbai coordinates correctly refused a Delhi monitor 1,145 km away.
- The existing Codex browser walk passed 12 checks per viewport with unchanged source fingerprints. Its replay step is still coded as `pending` in the unfinished harness; the focused replay journey above verifies that flow separately. This is not a claim that the unfinished harness passed acceptance.

## Remaining capability and data limits

The supplied 75-feature joblib binaries are present locally but lack the original custom preprocessing class, feature builder and golden input/output. Independent 24-hour models have retrospective evaluations and replay; availability-aware live attempts currently reject partial required inputs with zero predictions. The newly described 1,798-file CPCB/weather/CAMS/FIRMS/GHSL corpus was not found under the currently accessible Desktop or Downloads paths. Its counts, timezone assumptions, CO units, physical filters and fire availability must be checked against the actual source files before a new training build. Fire features must be known at forecast issue time. No current Open-Meteo baseline, reverse geocoder, public multivariate live forecast, automatic health diagnosis, or validated spatial exposure surface has been implemented.
