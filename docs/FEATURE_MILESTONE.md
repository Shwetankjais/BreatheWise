# BreatheWise feature milestone — verified backend scope

Contract 1.2.0 frontend snapshot accepted for the tested workflows on 24 November 2026: dated FREEZE_ACK 10:47 IST verified; 34 runtime paths fingerprinted before/after actual desktop (1440px) and mobile (390px) API/browser checks; 11 checks per profile passed, no runtime paths changed. Evidence: FRONTEND_FEATURE_VERIFICATION.json. Four stale Delhi markers matched actual concentrations; fresh-only observed rankings correctly stayed empty. October archive source301 had 740/744 valid hours, 31 buckets and mean56.434; CO mg/m³ survived display; comparison source301/113 matched732 hours under same_recorded_clock. Common-cohort model metrics and actual heldout predictions matched screens. Two actual OSRM alternatives matched displayed distance/duration and geometry; no traffic or exposure claimed. Supplied model diagnostic-only; new model retrospective-only, no live forecast/trajectory/spatial acceptance. Verification ended; Antigravity editing window explicitly OPEN. No branch switch or main merge.

| Feature | Verified scope |
| --- | --- |
| Observations | Four Delhi DPCC PM2.5 stations; 297 cached actual hourly records (281 initial +16 resumed refresh); stale/partial/revision flags preserved |
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

The earlier failures in FRONTEND_FEATURE_REVIEW.json are historical. Contract 1.2.0 frontend snapshot accepted for the tested workflows on 24 November 2026: dated FREEZE_ACK 10:47 IST verified; 34 runtime paths fingerprinted before/after actual desktop (1440px) and mobile (390px) API/browser checks; 11 checks per profile passed, no runtime paths changed. Evidence: FRONTEND_FEATURE_VERIFICATION.json. Four stale Delhi markers matched actual concentrations; fresh-only observed rankings correctly stayed empty. October archive source301 had 740/744 valid hours, 31 buckets and mean56.434; CO mg/m³ survived display; comparison source301/113 matched732 hours under same_recorded_clock. Common-cohort model metrics and actual heldout predictions matched screens. Two actual OSRM alternatives matched displayed distance/duration and geometry; no traffic or exposure claimed. Supplied model diagnostic-only; new model retrospective-only, no live forecast/trajectory/spatial acceptance. Verification ended; Antigravity editing window explicitly OPEN. No branch switch or main merge.

Final local verification: make check passed (Ruff,74 backend tests+1 default PostgreSQL-only skip, generated contract drift/types, frontend typecheck); frontend34 unit tests and production build passed; reconciled isolated synthetic browser journeys8/8 passed. Actual asset feature checks22/22 passed across desktop/mobile. Vite reports a nonfatal582.59kB bundle warning. Baseline synthetic browser stack now explicitly isolates archive/model roots and disables routing to avoid inheriting local real datasets/provider settings.

GitHub verified checkpoint: implementation db1ef9f + integrated frontend/tooling ff0f95f6674ff3e5cc6fd473d84c68184e57d1ca on feat/foundation; ls-remote matches local HEAD. CI https://github.com/Shwetankjais/BreatheWise/actions/runs/45333637605 completed SUCCESS; actual logs inspected:74 standard passed+1 default PostgreSQL-only skip,30 PostgreSQL passed,13 new-forecast mechanics passed,2 native mechanics passed, wheel built. No main merge/deployment. Untracked artifacts/models/.gitkeep preserved and excluded from commits.
