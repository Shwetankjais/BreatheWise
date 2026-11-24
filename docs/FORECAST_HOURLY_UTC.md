# Separate UTC-native full-hourly experiment

**Evaluation correction:** The target-split-only tables below include fixed-model boundary availability violations of up to24h. Use FORECAST_ISSUE_PURGED.md / FORECAST_ISSUE_PURGED_RESULTS.json for authoritative no-boundary-lookahead comparisons. The fitted models/protocol/prediction CSV are preserved unchanged; only the secondary evaluation removes pre-fit-boundary issues.

Version `delhi-openaq-pm25-hourly-v1` is a separate, retrospective-only experiment using verified OpenAQ location235/sensor12235610. It does not reinterpret the archive clock, replace the supplied diagnostic model, or enable public live forecasts.

## Actual provider history and clock

Source CSV SHA256: `90779cc9e54d54523af906ddc3d2c63c75a8e84d51d7ac7b1222d6192c09ef04`. The bounded cached provider dataset contains13,188 valid reported observations between19February2025 and31October2026; only9,509 complete measured hours are eligible. All3,679 partial/unknown-coverage rows remain in the source CSV but are excluded as both model inputs and targets. On the14,880-position grid they and absent hours become explicit NaN; no interpolation or zero fill occurs.

The sensor uses actual UTC hourly-mean interval bounds, interval end at UTC:30, original unitsµg/m³, providerCPCB and ownerDPCC. Its authoritative station identity is independent of the still-unresolved archive crosswalk. Historical measurement clocks are known; historical publication times are unknown. Actual24November first-seen-at-fetch timestamps are never substituted for historical availability. The retrospective assumption that an interval is known at its end remains unverified for real issue-time use.

All timestamp objects stay timezone-aware UTC. Calendar features use UTC target hour+minute/60 (including the half-hour phase), UTC day-of-year and UTC weekday. This definition is separate from the recorded-clock experiment. No timezone stripping, numerical shift selection, unit changes or hidden clipping is applied.

## Frozen protocol and measured outcomes

The protocol was persisted before fitting: train target times in2025, validation January–June2026, frozen test July2026 through24November2026 exclusive. The selected source ends1November2026 exclusive, so actual test targets cover July–October only. Every heldout target is constrained to its assigned split. Rolling folds score2025Q4 and2026Q1 after training only on earlier target times. Fixed inherited LightGBM parameters, maximum200rounds, validation-only early stopping20rounds; rolling folds use100rounds. No test-based tuning or model selection occurred.

The run saved24native models and116,292 heldout rows. All rows were verified for explicit UTC:end30 clocks, exact horizon delta, target-split bounds and finite observations/model/persistence. Native string/file reload parity was checked at every horizon; additional actual model-load metadata checks passed at+1h and+24h. Feature order, dataset/model/prediction/protocol hashes, splits, baseline metrics, high-target counts/bias and worst underprediction events are preserved in FORECAST_HOURLY_UTC_RESULTS.json.

The model **does not beat persistence at every horizon**. At+9,+10,+11,+13,+14,+15 and+16h common-cohort model MAE is higher than persistence; some also lose to the previous-day baseline. These measured failures are retained. Both baselines and missing-input behavior are first-class results.

## Paired frozen-test results

Unitsµg/m³. Each method comparison uses one common finite cohort per horizon. High-target bias is a separately counted descriptive subset with observed target≥150µg/m³, not an AQI category.

| Horizon | Samples | Model MAE | RMSE | Persistence MAE | Previous-day MAE | High-target model bias |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| +1h | 1325 | 11.177 | 16.603 | 11.647 | 27.514 | -30.697 |
| +2h | 1267 | 17.791 | 23.985 | 18.377 | 27.818 | -60.047 |
| +3h | 1225 | 20.678 | 27.169 | 21.718 | 27.466 | -70.349 |
| +4h | 1267 | 21.476 | 27.767 | 23.366 | 27.036 | -88.482 |
| +5h | 1220 | 23.046 | 29.845 | 24.501 | 26.477 | -89.729 |
| +6h | 1216 | 23.716 | 31.039 | 25.986 | 27.114 | -102.034 |
| +7h | 1177 | 25.424 | 33.718 | 26.788 | 27.546 | -94.025 |
| +8h | 1211 | 25.802 | 34.346 | 25.862 | 27.601 | -90.189 |
| +9h | 1198 | 26.140 | 34.939 | 24.990 | 27.146 | -90.868 |
| +10h | 1263 | 25.792 | 34.826 | 24.481 | 27.403 | -91.411 |
| +11h | 1198 | 27.093 | 35.859 | 26.297 | 27.699 | -95.762 |
| +12h | 1200 | 27.574 | 35.425 | 27.902 | 28.273 | -100.785 |
| +13h | 1199 | 29.751 | 38.188 | 28.972 | 27.905 | -100.230 |
| +14h | 1273 | 29.868 | 39.052 | 28.505 | 27.554 | -92.537 |
| +15h | 1213 | 30.216 | 38.999 | 28.260 | 26.958 | -98.782 |
| +16h | 1221 | 29.141 | 37.192 | 28.476 | 27.505 | -104.118 |
| +17h | 1166 | 27.123 | 34.334 | 28.537 | 27.780 | -99.358 |
| +18h | 1206 | 26.732 | 33.894 | 27.926 | 28.080 | -93.855 |
| +19h | 1193 | 24.429 | 30.980 | 25.878 | 27.532 | -89.686 |
| +20h | 1241 | 24.356 | 31.202 | 24.799 | 27.797 | -98.531 |
| +21h | 1200 | 24.285 | 31.147 | 25.662 | 27.833 | -99.995 |
| +22h | 1254 | 25.786 | 33.215 | 27.555 | 28.441 | -106.263 |
| +23h | 1308 | 26.034 | 32.521 | 27.521 | 28.040 | -106.707 |
| +24h | 1546 | 25.863 | 32.834 | 27.883 | 27.883 | -92.769 |

High-target underprediction is severe and this dataset has many excluded/absent intervals. Full hourly output is not sufficient for operational activity ranking. `continuous_trajectory=false` and `live_forecast_ready=false` remain explicit. Prospective availability, input completeness/staleness policy and shadow forecast-versus-observed evidence are still required.

## Reproduce and verify

```sh
UV_CACHE_DIR="$PWD/work/uv-cache" uv run --locked --project tools/forecast-experiment \
  python scripts/train_utc_forecast.py \
  --source work/utc-history/openaq-235/observations.csv \
  --openmp-library /opt/anaconda3/lib/libomp.dylib
```

Default ignored registry output: `work/forecast-experiment/delhi-openaq-pm25-hourly-v1`; existing nonempty evidence is refused. The same-directory dataset manifest must match the CSV hash, sensor/station/unit/clock and interval semantics. Training eligibility must be explicit0/1, with100% coverage for accepted rows.

Focused optional runtime suite:62 passed across recorded and UTC mechanics. It covers all24 baseline alignments, future-feature invariance, target-split assignment, missing current/target exclusion, aware UTC versus naive refusal, exact half-hour grid, source CSV hash verification, partial-hour exclusion and record-clock/UTC manifest separation. Ruff passed on all six owned code/test paths. These mechanics tests are distinct from the actual environmental backtests above.
