# BreatheWise feature milestone — verified backend scope

The accepted frontend baseline remains be63911. Contract 1.2.0 adds implemented backend workflows; the new frontend snapshot is under owner correction and is not accepted.

| Feature | Verified scope |
| --- | --- |
| Observations | Four Delhi DPCC PM2.5 stations; 281 cached actual hourly records; stale/partial/revision flags preserved |
| Archive | 54 eligible source IDs; recorded-clock daily/monthly aggregates, distributions, coverage and conditional matched-hour comparison |
| New model |delhi-recorded-pm25-v1; source 301, 39 causal features; target horizons 1/3/6/12/24h; retrospective only |
| Evaluation |Frozen chronological splits, two rolling folds, 186,839 persisted heldout rows, model/prediction hash checks |
| Routing |Actual OSRM driving alternatives, GeoJSON, metres/estimated seconds; exposure unavailable and no traffic adjustment |

## Held-out common-cohort MAE (µg/m³)

| Horizon | Samples | LightGBM | Persistence | Previous-day same hour |
| --- | ---: | ---: | ---: | ---: |
| +1h | 13977 | 18.913 | 20.870 | 47.922 |
| +3h | 13863 | 30.223 | 38.900 | 48.012 |
| +6h | 13789 | 34.810 | 51.881 | 47.688 |
| +12h | 13737 | 37.737 | 59.534 | 47.694 |
| +24h | 14306 | 39.563 | 47.829 | 47.829 |

These measured results concern one archive source, not city-wide forecasting accuracy. Targets remain observed; no interpolation/zero filling. Train 2017–2023, validation 2024, frozen test 2025–October2026; target timestamps stay in their assigned splits. Source timezone/interval and historical publication times remain unresolved. The retrospective assumption that current/past rows are known at issue is explicit. High-target underprediction remains substantial, and high-subset baseline counts differ. See FORECAST_EXPERIMENT.md and FORECAST_RESULTS.json for full per-horizon/backtest/subset metrics, source hashes, feature definitions and protocol.

## Actual endpoint examples

```text
GET /api/v1/station-catalogue?city_id=delhi
GET /api/v1/observed-rankings?city_id=delhi&pollutant=pm25&include_stale=true
GET /api/v1/archive/explore?station_id=site_301&pollutant=pm25&start=2026-10-01T00:00:00&end=2026-11-01T00:00:00&aggregation=daily
GET /api/v1/archive/compare?station_ids=site_301&station_ids=site_113&pollutant=pm25&start=2026-10-01T00:00:00&end=2026-11-01T00:00:00&clock_assumption=same_recorded_clock
GET /api/v1/models/delhi-recorded-pm25-v1/evaluation
GET /api/v1/models/delhi-recorded-pm25-v1/predictions?horizon_h=6&split=test&limit=2
POST /api/v1/routes/geometry
```

Archive endpoints return dataset_mode=recorded_clock, timezone=null, unknown publication times and original units (including CO mg/m³). Live provider data stays UTC with IST display. Archive comparison pairs exact recorded hours only under the explicit same-clock assumption; it does not certify absolute-time alignment. Actual October source 301 exploration has 740/744 valid hours and 31 daily buckets; source 301/source113 comparison matches 732 hours.

Route request example uses public Delhi waypoints: origin latitude 28.6129/longitude 77.2295, destination28.6315/77.2167, mode=driving. Actual alternatives returned 2,822.5m / 206.7 estimated seconds and 2,712.6m / 231.6 seconds; exposure=null and traffic_aware=false. These are a cached checkpoint, not traffic-aware ETAs. Configure a production routing service before deployment; the selected public OSRM demo is development-only with no SLA.

## Readiness and frontend integration

Public live forecasts remain unavailable; selecting the new retrospective version returns 409 MODEL_RETROSPECTIVE_ONLY. Continuous trajectory, activity planning, spatial exposure, calibrated intervals and probabilities remain unavailable. Supplied native75 artifacts remain diagnostic-only with no original preprocessing parity claim.

The earlier snapshot review (FRONTEND_FEATURE_REVIEW.json) found missing API wiring and incorrect metrics; it is historical. Antigravity has now republished FRONTEND_1_2_0_INTEGRATION_READY with source-level archive/model/route calls and escaping/reset corrections. Its new UI is not accepted yet: ExplorerView and ModelAuditView changed after runtime fingerprinting, and ModelAuditView fails JSX preflight around lines370–372. The scoped test window has ended and editing is explicitly reopened. Further targeted review asks for common-baseline cohort counts, the actual native registry model ID and all supported archive pollutant selectors. A fresh explicit freeze acknowledgment and actual desktop/mobile response-to-screen comparison are pending.

Backend verification:72 tests passed with1 default PostgreSQL-only skip; Ruff and generated contract checks pass. The isolated forecasting runtime has13 passing tests. CI45302715024 atf6f30c2 succeeded with68 standard+1 default skip,25 PostgreSQL tests,13 new forecasting mechanics,2 supplied-native mechanics and packaging. Pending hardening preserves metadata/revision warnings on failed identity re-verification and skips rejected sensor ingestion; new failure-path tests pass. Current frontend unit libraries had34 passing cases, but build/typecheck is blocked by the moving JSX snapshot. Neither old green CI nor unit tests substitute for that pending integration check. No branch switch, main merge or deployment.

Large native models, heldout predictions and raw data stay in ignored local storage. Credentials remain local. A clone alone will not contain the local archive or trained artifacts; ESSENTIALS.md documents setup/reproduction.
