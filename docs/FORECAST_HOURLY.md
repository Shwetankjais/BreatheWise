# Full hourly recorded-clock experiment — v2

**Evaluation correction:** The target-split-only tables below include fixed-model boundary availability violations of up to24h. Use FORECAST_ISSUE_PURGED.md / FORECAST_ISSUE_PURGED_RESULTS.json for authoritative no-boundary-lookahead comparisons. The fitted models/protocol/prediction CSV are preserved unchanged; only the secondary evaluation removes pre-fit-boundary issues.

Version `delhi-recorded-pm25-hourly-v2` independently fits all +1 through +24 hour native models. It preserves the five-horizon v1 run and all eight original artifact hashes. This is a retrospective recorded-clock experiment, with no promotion to UTC and no operational trajectory readiness.

## Frozen extension protocol

The source, 39 causal feature definitions, observed targets, split bounds, two rolling folds, fixed LightGBM parameters, 200-round maximum and validation-only 20-round early stopping follow v1. The v2 protocol was written before the first v2 fit. Its protocol hash, library versions, artifact hashes and results are in FORECAST_HOURLY_RESULTS.json. v1 test results were already known when this extension was authorized: v2 is a fixed-parameter extension, not a newly untouched confirmatory test. No parameter or feature changes were selected using the v2 test results.

Source `site_301` has 74,705 observed values on 86,184 recorded hours. Train targets: 2017–2023; validation:2024; frozen test:2025–October2026. Rolling scoring folds remain2022 and2023, trained strictly before their score targets. Source timezone, interval semantics, official station crosswalk and historical publication times remain unresolved. The hypothetical issue-time availability assumption is explicit.

There are 890,917 saved heldout rows. All rows were checked for exact horizon delta, assigned target-split bounds and finite observation/model/persistence values. Every native model passed string/file prediction reload parity at absolute tolerance1e-10. Shared v1 horizons reproduce the same measured metrics; no original artifact was overwritten.

## Paired frozen-test errors

Each row compares exactly the common finite cohort across LightGBM, persistence and previous-day-same-hour. Units are µg/m³; counts differ by horizon.

| Horizon | Samples | Model MAE | Model RMSE | Persistence MAE | Previous-day MAE | High-target model bias |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| +1h | 13977 | 18.913 | 30.125 | 20.870 | 47.922 | -8.858 |
| +2h | 13891 | 26.332 | 40.326 | 31.620 | 48.092 | -20.888 |
| +3h | 13863 | 30.223 | 46.393 | 38.900 | 48.012 | -29.648 |
| +4h | 13920 | 32.396 | 50.135 | 44.306 | 47.658 | -36.843 |
| +5h | 13835 | 33.771 | 52.609 | 48.803 | 47.546 | -40.557 |
| +6h | 13789 | 34.810 | 54.165 | 51.881 | 47.688 | -42.393 |
| +7h | 13772 | 35.041 | 54.846 | 53.771 | 47.750 | -43.775 |
| +8h | 13769 | 35.142 | 55.607 | 54.842 | 47.723 | -46.390 |
| +9h | 13783 | 34.721 | 55.713 | 55.079 | 47.390 | -46.754 |
| +10h | 13844 | 35.273 | 56.781 | 55.043 | 47.466 | -49.389 |
| +11h | 13757 | 36.545 | 57.949 | 57.581 | 47.676 | -48.917 |
| +12h | 13737 | 37.737 | 58.972 | 59.534 | 47.694 | -51.359 |
| +13h | 13759 | 38.042 | 59.297 | 60.684 | 47.731 | -51.759 |
| +14h | 13846 | 37.722 | 59.315 | 60.895 | 47.376 | -54.403 |
| +15h | 13780 | 37.712 | 59.672 | 60.887 | 47.299 | -53.197 |
| +16h | 13762 | 38.217 | 60.429 | 60.146 | 47.542 | -55.413 |
| +17h | 13770 | 38.309 | 60.544 | 58.730 | 47.700 | -56.274 |
| +18h | 13784 | 38.357 | 60.743 | 56.536 | 47.714 | -57.529 |
| +19h | 13826 | 38.195 | 60.710 | 53.247 | 47.393 | -58.088 |
| +20h | 13910 | 37.985 | 60.555 | 50.024 | 47.522 | -56.440 |
| +21h | 13856 | 38.612 | 61.060 | 49.169 | 47.964 | -59.510 |
| +22h | 13883 | 39.096 | 61.665 | 48.416 | 48.122 | -60.379 |
| +23h | 13971 | 39.237 | 61.627 | 47.626 | 48.048 | -56.072 |
| +24h | 14306 | 39.563 | 62.160 | 47.829 | 47.829 | -59.556 |

The model has lower common-cohort MAE than both baselines at all24 horizons in this source. This is not a significance, station-generalization or live-service claim. High targets mean observed target≥150µg/m³, a descriptive subset rather than an AQI/health category. Its displayed bias uses the separately recorded high-target sample counts, not the common-baseline cohort. Long-horizon high-target underprediction remains substantial. The JSON report also retains the worst underprediction and the prediction at the maximum observed target for each horizon, with actual target clocks.

## Missing inputs and readiness

A missing current observation excludes that issue. Missing targets are excluded, never interpolated. Older missing lags stay native NaN plus missing indicators; rolling statistics require75% observed hours and retain explicit counts. Per-horizon training counts, excluded-current/missing-target counts, test rows with missing features and per-cohort counts are persisted. An absent previous-day input leaves that baseline absent. No concentration default or clipping is introduced.

All24 outputs establish retrospective horizon coverage only. The registry keeps `live_forecast_ready=false` and `continuous_trajectory=false`. Live input compatibility, first-availability evidence, prospective validation and a separate activity-planning policy remain required. The supplied75-input model stays diagnostic-only.

## Reproduce

```sh
UV_CACHE_DIR="$PWD/work/uv-cache" uv run --locked --project tools/forecast-experiment \
  python scripts/train_forecast.py \
  --source /Users/shwetankjaiswal/Desktop/NIErnaya_data/AirScope_India_final/data/cleaned/pollutants/"Aanad Vihar.parquet" \
  --model-version delhi-recorded-pm25-hourly-v2 \
  --openmp-library /opt/anaconda3/lib/libomp.dylib
```

The default output is ignored `work/forecast-experiment/delhi-recorded-pm25-hourly-v2`. The command refuses a nonempty output; use a separate empty output under the same ignored registry for a new reproduction and preserve this run. Omit the Mac OpenMP flag on a compatible Linux environment.
