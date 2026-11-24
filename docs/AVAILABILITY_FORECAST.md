# Availability-aware UTC experiment and learned shadow service

Accepted experimental version: `delhi-openaq-pm25-delay3h-v2`. This is independently trained for an older-input regime. It does not change the freshness gate, input meanings or capabilities of the original supplied75-feature model, the earlier retrospective UTC model, or the persistence baseline. Public live forecasts and current activity planning remain disabled.

## Observed facts versus simulated availability

The input dataset contains9,509 complete observed PM2.5 hours from verified OpenAQ location235/sensor12235610,19February2025–31October2026, on exclusive interval ends at UTC:30; unitsµg/m³. DatasetSHA90779cc9e54d54523af906ddc3d2c63c75a8e84d51d7ac7b1222d6192c09ef04. Historical first publication times are unknown. Actual project first-seen samples show multi-hour retrieval lag and partial recent hours; those samples do not reconstruct historical availability.

The training experiment explicitly **simulates a fixed3-hour publication delay**. At nominal UTC issue `s`, it uses only complete measurements ending at/before `s−3h`. An issue is eligible if `s−3h` is observed, otherwise if `s−4h` is observed. No other age regime is accepted. A missing3h observation stays NaN in its feature, even when the4h value supplies the separately defined persistence comparator and age feature. No interpolation, target filling, clipping or unknown concentration default is used.

The40 features comprise the previously specified exact concentration lag/missing-indicator, rolling mean/std/max/count and difference transformations, evaluated at cutoff `s−3h`; five known target-time UTC calendar features; and latest-known age3or4hours. Full ordered definitions and formulas are stored per horizon. Older missing inputs remain native NaN with explicit indicators; insufficient rolling coverage produces NaN with its count. Targets are actual complete observations at `s+h`, independently modeled at every h1..24. Provider-incomplete or missing targets never become zeros or interpolated labels.

An earlier new availability-v1 draft is preserved locally but **not accepted or registered**. Before registration we identified that its fit/selection labels themselves become available3hours after their measurement under the declared scenario. V2 fixes this: validation/test/fold issues must be at/after their boundary **plus3h**, while target timestamps remain in their assigned split. The original draft's frozen files were not overwritten. This is a chronology correction, not parameter tuning based on test performance.

## Frozen protocol and measured results

Train targets:2025; validation targets:January–June2026; test targets:July–October2026 (the protocol end is24November but the selected data ends31October). Two rolling pre-test folds retain their recorded bounds. Both fitting-label publication delay and feature availability are respected. Every scoring issue is at/after its training/model-selection boundary plus3h. Fixed inherited LightGBM parameters, maximum200 rounds and validation-only early stopping were frozen before the v2 fit; folds use100rounds. Test labels never select parameters or early stopping. The test period had been inspected in previous experiments, so this is an exploratory new-regime experiment, not a virgin confirmatory holdout.

There are24 native models and136,092 held-out rows. Every row's horizon delta, issue/target split boundary, latest-input age3or4, and required finite fields was checked. Model file reload predictions agreed to1e−10 during training. Full protocol, source/native/prediction hashes, validation/test/backtest metrics, missing-input counts and test peak-underprediction events are in AVAILABILITY_FORECAST_RESULTS.json. Artifacts remain ignored under `work/forecast-experiment/delhi-openaq-pm25-delay3h-v2`.

Matched baselines are (1) latest complete issue−3h or issue−4h persistence, and (2) observed concentration at target−48h. The two-day same-hour baseline is issue-time available under the3h scenario at every forecast horizon; a previous-day baseline would use unavailable observations at longer horizons. All method-comparison rows below use the same finite cohort. High-target bias uses its separately reported subset count; target≥150 is descriptive, not a health category. Unitsµg/m³.

| Horizon | Paired N | Model MAE | Model RMSE | Persistence MAE | Two-day same-hour MAE | High-target bias | High-target N |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 1283 | 23.489 | 31.514 | 23.218 | 30.954 | -85.537 | 25 |
| 2 | 1282 | 24.684 | 33.215 | 24.724 | 30.765 | -91.169 | 22 |
| 3 | 1282 | 25.097 | 34.378 | 26.440 | 30.949 | -96.723 | 21 |
| 4 | 1312 | 25.597 | 35.128 | 26.647 | 31.117 | -90.001 | 23 |
| 5 | 1312 | 25.397 | 34.552 | 25.895 | 30.943 | -88.773 | 22 |
| 6 | 1326 | 25.477 | 34.388 | 24.229 | 30.882 | -92.119 | 23 |
| 7 | 1308 | 26.054 | 35.009 | 23.437 | 30.633 | -92.057 | 22 |
| 8 | 1279 | 26.846 | 34.965 | 25.990 | 30.542 | -92.251 | 23 |
| 9 | 1262 | 27.432 | 35.341 | 27.878 | 30.142 | -94.736 | 24 |
| 10 | 1273 | 28.727 | 37.642 | 28.231 | 30.353 | -96.365 | 23 |
| 11 | 1267 | 27.958 | 36.726 | 27.956 | 30.432 | -92.771 | 22 |
| 12 | 1271 | 28.682 | 38.031 | 28.330 | 30.583 | -101.633 | 24 |
| 13 | 1277 | 27.996 | 36.549 | 28.402 | 31.145 | -96.277 | 25 |
| 14 | 1308 | 27.251 | 35.301 | 27.987 | 31.628 | -96.064 | 25 |
| 15 | 1311 | 25.530 | 32.318 | 27.458 | 31.481 | -97.272 | 24 |
| 16 | 1304 | 26.646 | 35.101 | 24.891 | 31.250 | -92.849 | 25 |
| 17 | 1291 | 26.308 | 34.310 | 23.871 | 31.016 | -97.131 | 24 |
| 18 | 1266 | 27.212 | 34.991 | 25.805 | 31.320 | -103.497 | 23 |
| 19 | 1258 | 25.772 | 32.340 | 27.060 | 31.036 | -104.436 | 22 |
| 20 | 1293 | 26.367 | 33.394 | 26.962 | 31.104 | -102.761 | 19 |
| 21 | 1290 | 26.968 | 34.382 | 27.023 | 31.334 | -94.710 | 19 |
| 22 | 1268 | 28.037 | 35.976 | 28.034 | 30.904 | -108.253 | 23 |
| 23 | 1272 | 29.121 | 38.010 | 29.119 | 31.145 | -102.974 | 27 |
| 24 | 1305 | 29.474 | 39.074 | 28.981 | 31.018 | -103.020 | 27 |

The learned model beats both matched baselines at11of24horizons. It loses to persistence at1h and24h; there is no blanket ML improvement claim. High-concentration underprediction and small high-target cohorts remain material. Simulated-delay metrics are not prospective accuracy, calibrated uncertainty, station generalization or public health readiness.

## Actual issue, first-seen cutoff and persistence

The existing run schema records nominal/model `issue_at` and actual wall-clock `generated_at` separately. Learned-model provenance additionally names `actual_issue_at` and `nominal_model_issue_at`; API points expose actual lead seconds. The nominal issue must be on the verified UTC:30 hourly phase. Learned generation may follow it by **less than60minutes**, with every target strictly later than actual generation. This scheduling latency never changes the model's measurement cutoff or allows later information. The input-to-target elapsed times remain the trained regime; actual lead times are shorter when generation is delayed. The older baseline retains its separate15-minute scheduling and120-minute input-age limits.

Real inputs must be complete canonical PM2.5 observations from the exact verified sensor/station/source and unit. They must satisfy `measured_at <= nominal_issue−3h`, `available_at <= input_cutoff <= nominal_issue`, with actual provider verification no more than24hours old. Latest eligible measurement must end exactly3or4hours before nominal issue. The service records the input observation IDs/hash, cutoff, selected latest observation, exclusion counts, provider identity and actual timing. Partial/unknown hours are excluded explicitly. Specific unresolved revision timestamps are excluded as missing under the trained missingness policy; a revision affecting both required latest hours makes the run unavailable. The old baseline's revision policy is unchanged.

`services/shadow.py` dispatches only this independently versioned learned model through a bounded JSON subprocess into the existing isolated LightGBM environment. No root/backend dependency installation is needed. The bridge validates complete ordered model metadata and all24 returned targets/finite nonnegative concentrations; no prediction clipping. Successful points carry `learned_model` and `shadow_only`, distinct from persistence baseline flags. Failed runs retain a concrete rejection and zero points, with duplicate-run protection. Exact future observations are collected later by the existing reconciliation command; no prospective accuracy exists merely because generation succeeded.

At the verified parent intake checkpoint, required recent Anand3h/4h hours were partial, while the latest complete hour was older than this trained regime. The appropriate actual result is `AVAILABILITY_REQUIRED_INPUT_UNAVAILABLE` with zero forecasts. Do not backdate generation, accept partial hours, or widen input age to manufacture a successful run. The precise external condition is a complete canonical sensor12235610 hour at nominal issue−3h or−4h, actually first-seen by the nominal issue cutoff, with current verified identity. The model/service/command are ready when that condition holds; no indefinite polling or prospective-skill claim is needed.

## Reproduction and local commands

```sh
# Existing isolated environment; preserve existing outputs. A repeated training output must be empty.
UV_CACHE_DIR="$PWD/work/uv-cache" uv run --locked --project tools/forecast-experiment \
  python scripts/train_availability_forecast.py \
  --openmp-library /opt/anaconda3/lib/libomp.dylib

# Use the ACTUAL current nominal UTC:30 issue and cutoff; never use old example dates as prospective issuance.
BREATHEWISE_OPENMP_LIBRARY=/opt/anaconda3/lib/libomp.dylib \
DATABASE_URL=sqlite:///work/delhi-live.db DATA_MODE=live \
UV_CACHE_DIR="$PWD/work/uv-cache" uv run --locked python scripts/shadow_forecasts.py \
  --station-id openaq-235 --model-version delhi-openaq-pm25-delay3h-v2 \
  --issue-at CURRENT_NOMINAL_UTC_ISSUE --input-cutoff CURRENT_NOMINAL_UTC_ISSUE
```

Linux may omit the explicit Mac OpenMP library. The LightGBM environment must already exist at `tools/forecast-experiment/.venv`; the serving subprocess never installs packages or fetches providers. The repeatable parent refresh/worker command handles intake separately. Native prediction bridge reads bounded JSON on stdin and writes bounded result JSON on stdout; it has no DB or network capability and never receives credentials.

Focused verification:25 isolated availability mechanics/integrity tests passed, covering all24horizons, postcutoff invariance, exact missing-age fallback, matching baseline availability, target/fit-label cutoffs and artifact/feature integrity.16 shadow tests passed, including the new learned-only age regime, actual first-seen and incomplete/out-of-regime rejection, old-baseline gate preservation and explicit24target persistence. Actual24native outputs were additionally checked with explicitly synthetic mechanics rows; these are not environmental forecasts or evaluation evidence. Parent CI/PostgreSQL and actual intake rejection evidence are recorded in the prototype checkpoint.
