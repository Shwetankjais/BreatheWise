# Fixed-model issue-boundary-purged evaluation

The original frozen protocols assigned rows by target timestamp. At split boundaries they permitted an issue before the last training/validation labels used to fit or select that fixed model. This is a fixed-model availability violation of up to24hours, even when every target is inside its intended split. The original target-only tables must not support a no-lookahead forecasting claim.

A mechanical timestamp purge was declared before calculating these results in ignored `work/forecast-issue-purge-protocol.json`; its full text/hash is in FORECAST_ISSUE_PURGED_RESULTS.json. No models, training parameters, original protocols, CSV predictions or v1 artifacts were changed. These purged results are the authoritative comparisons for absence of this boundary lookahead.

## Mechanical rule

- Validation: retain issue timestamp at or after the training-target split end.
- Test: retain issue timestamp at or after the validation-target split end.
- Rolling folds: retain issue timestamp at or after that fold’s training-target end.

Calendar comparisons retain each model’s established clock basis: naive recorded clock for recordedv2; explicit UTC:end30 for the UTC-provider model. No cross-source timestamp join or numerical shift is introduced. This purge resolves fixed-model boundary availability only. Historical input publication remains unknown and live readiness remains false.

## delhi-recorded-pm25-hourly-v2

Across validation, test and both rolling folds, 1,155 rows were removed. Sidecar SHA256: `30c4a4a05c40305cf0963e728a803e9e338891d9d004f5cba7a047d811275930`. Each sidecar verifies against the unchanged protocol/prediction hashes. Unitsµg/m³. Method comparison uses one common finite cohort per horizon; high-target bias uses its separately reported count.

| Horizon | Paired test N | Removed test rows | Model MAE | RMSE | Persistence MAE | Previous-day MAE | High-target bias | High-target N |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| +1h | 13977 | 1 | 18.913 | 30.125 | 20.870 | 47.922 | -8.874 | 3276 |
| +2h | 13891 | 2 | 26.332 | 40.326 | 31.620 | 48.092 | -20.931 | 3254 |
| +3h | 13863 | 3 | 30.223 | 46.393 | 38.900 | 48.012 | -29.713 | 3236 |
| +4h | 13920 | 4 | 32.396 | 50.135 | 44.306 | 47.658 | -36.952 | 3216 |
| +5h | 13835 | 5 | 33.771 | 52.609 | 48.803 | 47.546 | -40.662 | 3200 |
| +6h | 13789 | 6 | 34.810 | 54.165 | 51.881 | 47.688 | -42.584 | 3196 |
| +7h | 13772 | 7 | 35.041 | 54.846 | 53.771 | 47.750 | -43.999 | 3192 |
| +8h | 13769 | 8 | 35.142 | 55.607 | 54.842 | 47.723 | -46.629 | 3185 |
| +9h | 13783 | 9 | 34.721 | 55.713 | 55.079 | 47.390 | -47.074 | 3181 |
| +10h | 13843 | 10 | 35.271 | 56.780 | 55.037 | 47.469 | -49.718 | 3178 |
| +11h | 13755 | 11 | 36.538 | 57.944 | 57.568 | 47.681 | -49.369 | 3170 |
| +12h | 13734 | 12 | 37.741 | 58.978 | 59.518 | 47.700 | -51.710 | 3156 |
| +13h | 13755 | 13 | 38.039 | 59.297 | 60.663 | 47.740 | -52.172 | 3152 |
| +14h | 13841 | 14 | 37.722 | 59.319 | 60.874 | 47.384 | -54.782 | 3145 |
| +15h | 13774 | 15 | 37.691 | 59.658 | 60.865 | 47.308 | -53.699 | 3139 |
| +16h | 13755 | 15 | 38.201 | 60.422 | 60.124 | 47.550 | -55.863 | 3148 |
| +17h | 13762 | 15 | 38.306 | 60.551 | 58.706 | 47.705 | -56.648 | 3152 |
| +18h | 13775 | 15 | 38.362 | 60.757 | 56.510 | 47.719 | -57.882 | 3155 |
| +19h | 13816 | 15 | 38.206 | 60.728 | 53.222 | 47.398 | -58.412 | 3153 |
| +20h | 13899 | 15 | 37.999 | 60.575 | 50.003 | 47.531 | -56.788 | 3147 |
| +21h | 13844 | 15 | 38.628 | 61.082 | 49.153 | 47.970 | -59.877 | 3149 |
| +22h | 13870 | 15 | 39.117 | 61.690 | 48.403 | 48.125 | -60.686 | 3151 |
| +23h | 13957 | 15 | 39.256 | 61.653 | 47.618 | 48.047 | -56.384 | 3152 |
| +24h | 14291 | 15 | 39.575 | 62.182 | 47.822 | 47.822 | -59.907 | 3156 |

Purged model MAE is lower than both baselines at 24/24 horizons: 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24. No claim of significance, prospective validity or generalization follows from this comparison. High-target underprediction and missing-source coverage remain material.

## delhi-openaq-pm25-hourly-v1

Across validation, test and both rolling folds, 592 rows were removed. Sidecar SHA256: `e129c23a6a01f26e1757c43a4649fdc778fe9d666196541cb213808085d7cbc5`. Each sidecar verifies against the unchanged protocol/prediction hashes. Unitsµg/m³. Method comparison uses one common finite cohort per horizon; high-target bias uses its separately reported count.

| Horizon | Paired test N | Removed test rows | Model MAE | RMSE | Persistence MAE | Previous-day MAE | High-target bias | High-target N |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| +1h | 1324 | 1 | 11.173 | 16.603 | 11.650 | 27.501 | -30.697 | 29 |
| +2h | 1267 | 0 | 17.791 | 23.985 | 18.377 | 27.818 | -60.047 | 29 |
| +3h | 1224 | 1 | 20.668 | 27.164 | 21.695 | 27.446 | -70.349 | 27 |
| +4h | 1266 | 1 | 21.444 | 27.722 | 23.313 | 26.992 | -88.482 | 23 |
| +5h | 1219 | 1 | 23.044 | 29.848 | 24.483 | 26.465 | -89.729 | 19 |
| +6h | 1216 | 0 | 23.716 | 31.039 | 25.986 | 27.114 | -102.034 | 18 |
| +7h | 1175 | 2 | 25.429 | 33.721 | 26.735 | 27.512 | -94.025 | 20 |
| +8h | 1209 | 2 | 25.793 | 34.349 | 25.852 | 27.529 | -90.189 | 21 |
| +9h | 1196 | 2 | 26.150 | 34.955 | 24.992 | 27.082 | -90.868 | 20 |
| +10h | 1259 | 4 | 25.763 | 34.815 | 24.509 | 27.291 | -91.411 | 21 |
| +11h | 1194 | 4 | 27.076 | 35.855 | 26.282 | 27.611 | -95.762 | 17 |
| +12h | 1197 | 3 | 27.608 | 35.463 | 27.937 | 28.231 | -100.785 | 21 |
| +13h | 1195 | 5 | 29.750 | 38.197 | 28.904 | 27.806 | -100.230 | 18 |
| +14h | 1268 | 5 | 29.871 | 39.071 | 28.429 | 27.414 | -92.537 | 20 |
| +15h | 1207 | 6 | 30.229 | 39.034 | 28.163 | 26.814 | -98.782 | 17 |
| +16h | 1215 | 7 | 29.113 | 37.190 | 28.374 | 27.329 | -104.118 | 22 |
| +17h | 1157 | 9 | 27.116 | 34.349 | 28.408 | 27.551 | -99.358 | 18 |
| +18h | 1197 | 9 | 26.726 | 33.909 | 27.823 | 27.832 | -93.855 | 21 |
| +19h | 1185 | 9 | 24.383 | 30.947 | 25.797 | 27.328 | -89.686 | 19 |
| +20h | 1233 | 9 | 24.307 | 31.169 | 24.775 | 27.581 | -98.531 | 22 |
| +21h | 1190 | 11 | 24.247 | 31.133 | 25.605 | 27.597 | -99.995 | 18 |
| +22h | 1244 | 13 | 25.768 | 33.228 | 27.476 | 28.202 | -106.263 | 20 |
| +23h | 1298 | 13 | 25.985 | 32.503 | 27.316 | 27.799 | -106.707 | 15 |
| +24h | 1532 | 14 | 25.800 | 32.790 | 27.607 | 27.607 | -92.769 | 16 |

Purged model MAE is lower than both baselines at 17/24 horizons: 1,2,3,4,5,6,7,8,12,17,18,19,20,21,22,23,24. No claim of significance, prospective validity or generalization follows from this comparison. High-target underprediction and missing-source coverage remain material.

## Integrity and limitations

Compact JSON includes every validation/test/backtest cohort metric, sample counts, removed-row counts, high-pollution bias and worst peak-underprediction events after purging. Loader `ml/issue_purged.py` accepts an expected committed sidecar hash, checks bounded JSON size, exact24horizon metadata, protocol/prediction identity, path/hash integrity and metric structure. All original fit artifacts remain unchanged.

The two new models remain retrospective-only. Full hourly outputs do not enable activity planning or public live inference. A shadow service must separately enforce input cutoff, actual first-seen availability, staleness and completeness, and collect prospective forecast-versus-observation evidence.

Reproduce without changing frozen artifacts: `UV_CACHE_DIR="$PWD/work/uv-cache" uv run --locked python scripts/evaluate_issue_purge.py`. The default empty ignored output is `work/forecast-issue-purge-reproduction`; choose a different empty `--output` for later runs. An actual reproduction matched all per-horizon evaluation/backtest metrics, row counts and peak events exactly for both models. The precomputation timestamp/hash differs for a new declaration; no fit evidence changes.
