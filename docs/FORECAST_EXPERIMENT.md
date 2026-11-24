# Independent recorded-clock PM2.5 forecasting experiment v1

This is a new, fully specified one-station retrospective experiment. It is not the recovered teammate 75-feature model, does not establish its preprocessing, and does not enable live inference. Model version: `delhi-recorded-pm25-v1`. Actual measured results and artifact hashes are in FORECAST_RESULTS.json; complete local registry is under ignored `work/forecast-experiment/delhi-recorded-pm25-v1`.

## Observed dataset and clock convention

Read only the eligible `site_301` rows from `AirScope_India_final/data/cleaned/pollutants/Aanad Vihar.parquet`, 1 January 2017 through 31 October 2026. There are 74,705 observed PM2.5 values on an 86,184-hour grid. Source file SHA256: `43cb7d50000f3614657bfadc7f83f2954c879e561e790ccf13b5b75d247558df`. Original CSV headers and audited dictionary specify µg/m³. The cleaned observed layer, not its imputed sensitivity products, supplies targets. Quarantined sources are excluded. Duplicate clocks or invalid negative/nonfinite concentrations cause failure; plausible high values are preserved.

Times are **naive recorded source clocks**, without an asserted timezone or interval-start/end meaning. Hours describe differences on this recorded clock. The experiment hypothetically assumes each current observed row and earlier rows are available at that clock. Actual historical publication/availability timestamps are unknown. No alignment to UTC/live OpenAQ or official site registry is established. Missing grid positions become NaN, not zero; no interpolation is applied.

## Features and targets

One native LightGBM regression model is trained for each of +1/+3/+6/+12/+24 hours. Each target is the actual observed PM2.5 at `issue + horizon`; a missing target excludes that issue/horizon. Current PM2.5 must be observed, permitting an exact persistence comparison. Missing older lags remain native NaN with explicit missing indicators.

The 39 ordered features comprise exact lags 0/1/2/3/6/12/24/48/72/168 hours and their ten missing indicators; trailing observed-only mean/population-standard-deviation/maximum/count over 6/24/168 hours including current; current-minus-lag 3/24-hour differences; and known recorded target hour/day-of-year sine/cosine plus target weekend. A trailing mean/std/max requires at least ceil(75% × window) observed hours; counts are explicit. Features never access a source value after the issue. Time cycles use 24 hours and 365.25 days; weekend means Saturday/Sunday on the recorded clock. Full formulas/order/units are persisted per model.

No scaling, learned preprocessing or target transformation is fitted. The native learner handles NaN; no concentration default, clipping or zero-fill is used. Target units remain µg/m³ with identity transform. Exact persistence is `observed(issue)`; previous-day same-hour is `observed(issue + horizon - 24h)`, which is issue-time available for every supported horizon. If the latter value is absent its prediction stays missing. At +24 hours these two baselines coincide by definition.

## Frozen splits and rolling backtests

The protocol file was written before the first fit. All splits use **target timestamps**, with half-open bounds:

| Role | Target recorded-clock interval |
| --- | --- |
| Train | 2017-01-01 00:00 to 2024-01-01 00:00 |
| Validation | 2024-01-01 00:00 to 2025-01-01 00:00 |
| Frozen test | 2025-01-01 00:00 to 2026-11-01 00:00 |
| Rolling fold 2022 | Train before 2022; score targets in 2022 |
| Rolling fold 2023 | Train before 2023; score targets in 2023 |

The fixed LightGBM L1 parameter set uses 23 leaves, learning rate 0.05, min leaf 60, seed 20261124, two threads, deterministic column-wise learning. Main fits allow 200 rounds and validation early stopping after 20 non-improving rounds. Selected tree counts: 195/196/199/99/68 respectively. Fold models use a fixed 100-round budget, trained only before the fold's scoring period. The frozen test was never used for fitting, early stopping or choosing parameters. There was one fit/evaluation execution with this protocol; no tuning in response to test metrics.

This is rolling issue evaluation with actual earlier observations available to later test issues under the stated assumption; it is not a single-origin multi-year simulation. Source values are never moved between target splits.

## Measured frozen-test results

All table entries use the **same finite paired cohort across the model and both baselines** at each horizon. MAE/RMSE units: µg/m³. These are research errors on this one station and clock convention, not citywide or live-service accuracy claims.

| Horizon | Paired targets | LightGBM MAE | Persistence MAE | Previous-day MAE | LightGBM RMSE |
| --- | ---: | ---: | ---: | ---: | ---: |
| +1h | 13,977 | 18.913 | 20.870 | 47.922 | 30.125 |
| +3h | 13,863 | 30.223 | 38.900 | 48.012 | 46.393 |
| +6h | 13,789 | 34.810 | 51.881 | 47.688 | 54.165 |
| +12h | 13,737 | 37.737 | 59.534 | 47.694 | 58.972 |
| +24h | 14,306 | 39.563 | 47.829 | 47.829 | 62.160 |

The model reduced paired MAE against both baselines at each tested horizon. The two earlier rolling folds also show lower paired MAE at all five horizons; their exact results and validation results are in FORECAST_RESULTS.json. This does not establish significance, broad station generalization or live forecast compatibility.

High-pollution periods are defined descriptively as an **observed target ≥150 µg/m³**. They are not a derived health/AQI category. For the cohort where model and persistence both exist:

| Horizon | High targets | Model MAE | Persistence MAE | Model bias |
| --- | ---: | ---: | ---: | ---: |
| +1h | 3,277 | 33.946 | 37.394 | -8.858 |
| +3h | 3,239 | 58.177 | 73.405 | -29.648 |
| +6h | 3,202 | 71.031 | 103.314 | -42.393 |
| +12h | 3,168 | 77.047 | 123.509 | -51.359 |
| +24h | 3,171 | 80.923 | 92.084 | -59.556 |

Errors are materially larger in high-pollution targets and the model underpredicts them on average, particularly at longer horizons. Previous-day high-period results have their own explicit finite counts and must not be presented as an identical cohort without filtering. No calibrated interval, probability or extreme-event reliability claim is made.

## Persistence, integrity and service boundary

Local output contains five native LightGBM text files, a pre-fit protocol, manifest and 186,839 held-out CSV rows across both folds/validation/test. Every row retains station ID, split, horizon, issue/target recorded clock, observation and each model/baseline prediction. SHA256 hashes are persisted for native model and prediction artifacts; the registry loader rejects path escape, altered bytes, unsupported horizons, inconsistent feature order and wrong saved iteration count. Actual model string/file reload scores agreed to absolute tolerance 1e-10 during the run.

Only compact derived metrics, definitions, protocol and artifact hashes enter Git. Raw environmental/model/prediction files remain ignored. Public service interfaces may expose versioned retrospective evaluation and bounded held-out predictions. They must keep live forecasting false, timezone null and recorded-clock/publication assumptions visible. +2h or other untrained hours are unsupported; five sampled horizons do not establish continuous trajectory, predicted hotspots or duration-based activity planning.

## Reproduce in the isolated environment

```sh
UV_CACHE_DIR="$PWD/work/uv-cache" uv sync --locked --project tools/forecast-experiment
UV_CACHE_DIR="$PWD/work/uv-cache" uv run --locked --project tools/forecast-experiment \
  python scripts/train_forecast.py \
  --source '/Users/shwetankjaiswal/Desktop/NIErnaya_data/AirScope_India_final/data/cleaned/pollutants/Aanad Vihar.parquet' \
  --openmp-library /opt/anaconda3/lib/libomp.dylib
```

The Mac flag preloads an existing local OpenMP library explicitly; Linux can omit it. The output must be empty: existing run artifacts are preserved, not overwritten. Dependencies/lock/venv live under tools/forecast-experiment and do not modify API/web environments. Native model library identity recorded: LightGBM 4.7.0, NumPy 2.5.5.

```sh
BREATHEWISE_OPENMP_LIBRARY=/opt/anaconda3/lib/libomp.dylib \
UV_CACHE_DIR="$PWD/work/uv-cache" uv run --locked --project tools/forecast-experiment \
  pytest -q tools/forecast-experiment/tests
```

Thirteen focused mechanics tests passed: future-feature invariance, exact missing lags/minimum rolling counts, target-split boundaries and missing-target exclusion, all five baseline alignments, unsupported horizons/clocks, explicit comparison counts, artifact byte/path integrity actual native reload/iteration checks, and malformed manifest rejection. Synthetic mechanics tests are distinct from the measured environmental experiment above. The original supplied artifacts remain unchanged and diagnostic-only.
