# API contracts — proposed v1 foundation
Codex must turn this plan into Pydantic/OpenAPI schemas and generate TypeScript contracts. Antigravity starts immediately against this documented interface and may keep a small provisional client/type adapter in its owned apps/web/src/lib/api area; fixtures must be explicitly labeled. Replace provisional definitions with generated client/types when Codex publishes them; do not maintain competing contracts or invent server behavior. Freeze generated version 1 during the concurrent foundation checkpoint; record additive/breaking changes and notify both owners. The schemas in source/OpenAPI become authoritative once implemented.

## Semantics
Prefix `/api/v1`. UTC ISO8601 timestamps with offset; display in IST. Coordinates WGS84 with explicit latitude/longitude fields; GeoJSON uses [longitude, latitude]. Pollutant identifiers: pm25, pm10, no2, so2, o3, co. Every measurement has a unit; internal normalized concentration is µg/m³ unless explicitly declared otherwise. Preserve source units/provenance.

Common result metadata: request_id, generated_at, data_mode (live/historical_replay/demo), source, quality flags, contract_version. Replay responses include replay issue time prominently. Validation errors 422, unknown entity 404, auth errors 401/403, provider/model unavailable 503 with stable error code and retryability, unsupported capabilities 409. Never success-empty fabricated predictions. An empty successful search is distinct from unavailable integration. Pagination/filter limits on large lists/history. No silent fallback to fixtures or public sample values.

| Method / path | Input / purpose | Owner and response |
|---|---|---|
| GET /health | Process liveness | Codex; no secrets |
| GET /ready | DB/model/provider dependency readiness | Codex; explicit partial readiness |
| GET /capabilities | Current data/model feature support | Codex; pollutant/horizon support, intervals, trajectory, routes/scenarios/coverage and reasons |
| GET /cities | Supported cities and aliases | Codex; eligible station counts and availability |
| GET /stations | city_id, pollutant, optional bbox, pagination | Codex; canonical IDs, coordinates, freshness |
| GET /stations/{id} | Station metadata | Codex; provider aliases, provenance, support |
| GET /stations/{id}/latest | pollutant | Codex; measured_at, available_at, value, unit, quality |
| GET /stations/{id}/forecast | pollutant, requested supported horizons | Codex; forecast envelope below |
| GET /hotspots | city_id, pollutant, horizon_h, threshold, limit | Codex; score/rule/units/coverage; probability nullable |
| GET /history | station_id/city_id, pollutant, start, end, aggregation | Codex; values, valid/missing counts, aggregation rule |
| GET /coverage | city_id, population_epoch, method | Codex; station support/population context, supported extent |
| GET /advisories | pollutant, applicable metric/category, sensitivity | Codex; reviewed guidance, source, version |
| POST /activity-plan | station/place, activity, duration_minutes, start/end, sensitivity | Codex; eligible ranked windows, method/units, unsupported/no-suitable reason |
| POST /routes/compare | origin/destination coords, mode, departure, tradeoff | Codex; provider alternatives, geometry, duration/distance, exposure method/coverage and comparability |
| POST /scenarios/weather | station_id, issue/run, supported perturbations | Codex; baseline/scenario, affected features, out-of-domain flags |
| GET /model-performance | model_version, city, horizon | Codex; metric definitions, evaluation dates, baseline and sample count |
| GET /me | Authenticated identity and minimal preferences | Codex; verified session, no arbitrary user identity trust |
| GET, POST /saved-places | List/create owned places | Codex; validated entity/coordinates, persistence |
| PATCH, DELETE /saved-places/{id} | Owned record updates | Codex; ownership enforced |
| GET, PATCH /preferences | Optional sensitivity and display settings | Codex; minimal private data |
| GET, POST /alert-rules | Owned alert rules and channels | Codex; thresholds, averaging, cooldown |
| PATCH, DELETE /alert-rules/{id} | Owned rule changes | Codex; validation and ownership |
| GET /alerts | Owned generated notifications | Codex; event and delivery states |
| POST /alerts/{id}/read | Mark owned notification read | Codex; idempotent |

## Forecast envelope fields
station_id; pollutant; unit; model_version; model_artifact_sha256; issued_at; input_cutoff_at; data_mode; supported_horizons; points[{horizon_h, valid_at, predicted_concentration, lower:null|number, upper:null|number, interval_level:null|number}]; quality{observation_age_minutes, missing_features, fallbacks}; optional derived_index{scheme, averaging_period, pollutants_available, completeness, value}; unsupported_reason when relevant. No arbitrary confidence percentage.

## Capabilities
For every gated feature return supported true/false, method, requirements_missing and supported_scope. In particular: forecast horizons [1,3,6,12,24] until verified otherwise; continuous_hourly_trajectory false initially; calibrated_intervals false until proved; calibrated_exceedance_probability false until proved; spatial_exposure false until validated; traffic_live false absent a real provider. API adapters must not accept unsupported hours just because the pooled model accepts a numeric horizon input.

## Routing policy
Traffic data is NOT required for basic routing: a real routing engine can supply geometry and estimated duration. Traffic-aware ETAs need an additional provider. Pollution comparison does require a spatial estimator. A coarse station/CAMS proxy can be an explicitly experimental estimate with distance/coverage flags; do not claim validated street differences. If alternatives are indistinguishable within spatial support/uncertainty, say so rather than manufacture a cleaner route or a reduction percentage. Use the same sampled distance/time method for all alternatives; handle paths outside supported extent.
