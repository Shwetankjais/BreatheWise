# Active next milestone — 24 November 2026

Accepted baseline5cd7127. Allocation Codex55%/Antigravity45%; file ownership unchanged. Frontend may continue independently; no new dependency request is present in its latest handoff.

Existing implemented1.2.0 APIs already support model-version selection, per-horizon evaluation and bounded held-out playback via /models, /models/{version}/evaluation?horizon_h=N and /models/{version}/predictions?horizon_h=N&split=test&limit=100&offset=0. New hourly recorded-clock v2 will advertise all24 explicitly evaluated horizons only after artifacts pass integrity checks. Existing v1 remains unchanged. Recorded-clock playback never implies live forecasting or an activity trajectory.

Planned additive1.3.0 contract (not yet implemented at publication): read-only GET /forecast-runs?station_id=...&limit=... and GET /forecast-runs/{id}, exposing persisted experimental/shadow run status, UTC issue/cutoff/target times, model identity, baseline method, provenance, rejected-input reasons and observed matches. Generation is an administrator CLI, not a public mutation API. Public forecast/planning gates remain closed. Generated types will publish after implementation. No frontend install/config pause is needed for these additions.

Historical1.2.0 interface follows.

# Next milestone — additive contract1.2.0

Accepted baseline: be63911, existing1.1.0 routes remain compatible. Generated OpenAPI/TypeScript1.2.0 will publish typed new endpoints as each slice is implemented. Antigravity may build independent views from this interface now; source ownership unchanged. No frontend dependency/config rewrite required.

| Slice | Additive route | Data and bounds |
| --- | --- | --- |
| Map/catalogue | GET /api/v1/station-catalogue?city_id=delhi | Verified small provider cohort; station identity/coords and per-pollutant availability, latest measured/available times, unit, age/stale/coverage/quality. Unknown sensor/coverage distinct from zero/no reading. |
| Observed ranking | GET /api/v1/observed-rankings?city_id=delhi&pollutant=pm25&limit=20 | Actual cached concentrations only; include age, flags and original measurement context. Explicit observed ranking, never predicted hotspot. |
| Historical stations | GET /api/v1/archive/catalogue | Eligible source IDs kept separate; recorded-clock first/last, pollutants/units/coverage; quarantined duplicate folders excluded. |
| Explorer | GET /api/v1/archive/explore?station_id=site_301&pollutant=pm25&start=2026-01-01T00:00:00&end=2026-02-01T00:00:00&aggregation=daily | Daily/monthly chart buckets, valid/missing/expected coverage and distribution quantiles. Bounded range/points. Naive recorded-clock dates only, not UTC; end exclusive. |
| Comparison | GET /api/v1/archive/compare?station_ids=site_301&station_ids=site_113&clock_assumption=same_recorded_clock&pollutant=pm25&start=...&end=...&aggregation=daily | 2–4 compatible recorded-clock source series; exact matched observed times, no imputation; pair agreement is not forecast evaluation. |
| Model selection | GET /api/v1/models | Separate supplied native diagnostic and independently versioned recorded-clock experiment. Explicit readiness states/horizons/clock basis/live eligibility. |
| Evaluation | GET /api/v1/models/{model_version}/evaluation | Actual frozen split/baseline/per-horizon/high-pollution results only after training. /model-performance?model_version=... will delegate for compatible clients. |
| Held-out predictions | GET /api/v1/models/{model_version}/predictions?horizon_h=1&split=test&limit=100 | Bounded persisted issue/target recorded-clock rows, observed values and model/baseline predictions; retrospective only, no live forecast. |
| Route geometry | POST /api/v1/routes/geometry | WGS84 origin/destination, driving initially; actual alternatives, GeoJSON LineString [lon,lat], distance metres, estimated seconds/provider/profile. Exposure null/unavailable, no traffic-aware ETA. Existing /routes/compare stays gated for exposure. |

All endpoints use existing {meta,data}/{meta,error} envelopes. The environment's meta.data_mode remains live/replay/demo; archive/experiment data additionally declares dataset_mode=recorded_clock, timezone=null and publication_time_known=false. Do not send naive archive timestamps into live observation APIs or label them IST/UTC. Display the source-clock qualification persistently.

Capabilities will add station_catalogue, observed_rankings, archive_explorer, station_comparison, native_diagnostics, retrospective_evaluation and route_geometry. Existing model_forecast/continuous_hourly_trajectory/spatial_exposure remain false unless their separate prerequisites pass. Registry exposes experiment horizons1/3/6/12/24 independently of empty live-supported horizons. No arbitrary numeric hours, interpolated trajectories, prediction intervals or exceedance probabilities.

Original 75-input artifacts are unchanged and diagnostic-only. A new retrospective experiment uses observed targets, explicit causal concentration/time features, frozen chronological splits and rolling pre-test folds. A successful retrospective experiment does not certify alignment to live/provider clocks. Large models/predictions/raw data stay local ignored storage; compact manifests/metrics/provenance are shareable.
