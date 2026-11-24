# Supplied v5 model: verified diagnostic scope

Artifact inspected: `/Users/shwetankjaiswal/Downloads/production_horizon_specialized_v5.joblib`; 151,950,058 bytes; SHA256 `473439721f93ed2b6890f916ba9532a62dadefb0e6289485fb8ae698a32f0e19`. The original file was not modified or committed. `tools/model-v5/audit.py` checks size/hash and traverses all 973 pickle opcodes as inert data. No pickle/joblib constructor or teammate wrapper is executed. Only after static validation does the isolated runtime load the extracted native LightGBM text and XGBoost memory snapshots. Reproducible extracted native files remain ignored under `work/model-v5/extracted`; their hashes and full ordered schema are in `MODEL_V5_MANIFEST.json`.

## Facts recovered from this artifact

| Question | Artifact evidence |
| --- | --- |
| Bundle | `models_by_horizon`, `features`, `horizons`, `target_transform`, `schema_version` |
| Version marker | `prod_v5_horizon_specialized_lgb_xgb` |
| Horizons | Exactly 1, 3, 6, 12, 24 hours, each with separate LightGBM and XGBoost boosters |
| Features | **69** ordered names. Name-based groups are four geography, 12 live-observation-derived, 17 meteorology, 18 CAMS, five calendar, and 13 target/delta drivers; these labels do not prove formulas or units. The claimed 63 is inconsistent with both bundle list and LightGBM `max_feature_idx=68`; XGBoost says `num_feature=69`. |
| Weights | Each horizon stores `[0.55, 0.45]`; the adapter uses those serialized weights, without asserting the teammate wrapper's final formula/parity. |
| Targets | Serialized `target_transform="none"`; LightGBM objective `regression`, XGBoost objective `reg:squarederror`. **Target physical unit, training label and any external postprocessing are absent**. A raw score cannot be labeled a PM2.5 concentration yet. |
| Native runtime | LightGBM v4 native text loads with isolated LightGBM 4.7.0; XGBoost memory snapshots report 3.4.1 and load with isolated XGBoost 3.4.1. Python 3.12.16, NumPy 2.5.5. These are compatible diagnostic versions, not recovered training requirements. XGBoost 3.4.1 snapshots require its native unserialize path; ordinary `load_model` rejected the snapshot. The inspector exports canonical UBJ for later isolated loading. |
| Feature names | All five LightGBM native models match the bundle's exact 69-name order. XGBoost snapshots have **no stored feature names**, although native feature count is 69. Its positional training order needs teammate code/golden parity. |
| Missingness | Both native components return finite values for one explicitly synthetic finite row and 69 one-feature-NaN rows at each of five horizons. This establishes numerical handling only; training imputation/missingness semantics are **unknown**. The offline adapter refuses implicit missingness and requires an explicit diagnostic NaN flag. |

LightGBM stored best iterations: 1521, 1755, 1602, 1800, 885 for horizons 1/3/6/12/24. XGBoost stored best iterations are zero-based 966, 1496, 1484, 1499, 970; the adapter uses ranges ending at index+1, not all trees when extra trees are present. Native artifact SHA256s, model tree counts, parameters and availability flags are in the manifest.

## Offline adapter and issue-time gate

`apps/api/src/breathewise/ml/v5.py` validates exact model version/horizon, the 69 ordered names and values, numeric finiteness, explicit null/NaN diagnostic mode, and one provenance entry per feature. It rejects observations after the input cutoff, sources not available by the cutoff, realized target drivers and future target drivers at the wrong target time. It returns LightGBM raw, XGBoost raw and serialized-weight raw blend, with `target_unit=null`, `diagnostic_only=true`, `golden_parity_verified=false`, and `public_live_forecast_ready=false`. The provenance check validates caller assertions; it cannot prove original formulas, provider publication timestamps or physical units. No raw/provider feature builder or public forecast route uses v5.

Install/inspect separately without altering the API environment:

```sh
UV_CACHE_DIR="$PWD/work/uv-cache" uv sync --locked --project tools/model-v5 --group dev
tools/model-v5/.venv/bin/python tools/model-v5/audit.py \
  --artifact /Users/shwetankjaiswal/Downloads/production_horizon_specialized_v5.joblib \
  --openmp-library /opt/anaconda3/lib/libomp.dylib
tools/model-v5/.venv/bin/python tools/model-v5/predict.py \
  --input /path/to/complete-69-feature-row.json \
  --openmp-library /opt/anaconda3/lib/libomp.dylib
```

The OpenMP path is verified only for this Mac. `predict.py` requires caller-supplied feature values, UTC issue/cutoff, supported horizon, and per-feature source/available/valid timestamps. No zeros, current provider values or fabricated features are silently supplied. Synthetic test scores are mechanics evidence only, never Delhi forecasts or evaluation metrics.

Focused verification: 12 tests pass; one original-wrapper parity test is explicitly skipped until ignored `work/model-v5/golden-input.json` and `work/model-v5/golden-expected.json` arrive. The expected file must identify the original-pipeline source, artifact/feature hashes, horizon, raw component outputs, final wrapper output/formula, physical unit and tolerances. The parity check rejects known synthetic mechanics rows and compares all three outputs. A passing example alone still does not validate future provider availability, feature formulas over all stations or retrospective accuracy.

## Exact teammate request and public readiness

Please supply the original v5 feature-building/inference source and pinned training environment, plus **one complete golden example**: station and UTC issue time, horizon, ordered 69 values with units/missingness and each source's first availability, LightGBM component output, XGBoost component output, final wrapper output, target transformation/postprocessing and physical unit. A runnable command and expected tolerance are needed to establish parity. Supply training dataset/splits/evaluation evidence separately before any performance claim. The proposed notebook is available at the user-supplied attachment path and was compared as a specification, not training provenance. The artifact's 69 ordered names are authoritative for the diagnostic adapter, but feature formulas remain unverified.

Contract for Antigravity: v5 is a **diagnostic-only** model version with recovered horizons `[1,3,6,12,24]` and 69 inputs, `target_unit=null`, no evaluation/playback endpoint and no live forecast capability. Render these as artifact-declared diagnostic horizons, never as selectable public forecast horizons. Required-input/parity/unit/clock blockers stay visible. Preserve existing retrospective models and the actual rejected availability-run with zero rows. Implemented GET /api/v1/models publishes this diagnostic row through existing contract1.4.0, with additive optional declared_target_transform/golden_parity_verified fields and unavailable_reasons. native_diagnostics_ready=false refers to the API process: the verified offline native runtime is deliberately isolated. The generated types contain these fields; no public prediction endpoint was added.


## Proposed notebook comparison

Reviewed `/Users/shwetankjaiswal/.codex/attachments/86db28c7-1d06-4229-b71f-1a75628c135c/Pasted text.txt`. Its implementation instructions do not expand this model-only task. Correct its feature count to **69**. Its five horizons, component types, stored weights and no log inverse agree with artifact metadata. The claimed raw PM2.5 physical scale cannot be established from objectives or feature thresholds.

| Proposed behavior | Evidence and unresolved difference |
| --- | --- |
| float32 feature tensor | Notebook casts to float32; initial diagnostic mechanics used float64. Diagnostic conversion and component differences must be compared with the golden row; dtype is part of parity. |
| XGBoost `predict(DMatrix)` | Notebook uses every tree by default. Stored `best_iteration` is earlier than total trees for most horizons. The adapter explicitly exposes its selected best-iteration policy; that policy is **not notebook parity**. Golden component outputs/code must settle it. |
| Final clipping 1..1500 and rounding to 0.1 | Notebook applies external postprocessing absent from bundle. Diagnostic output preserves raw components/blend; no clipping is assumed as a production rule. |
| OpenAQ UTC interval end floored to hour | This loses the verified Delhi :30 UTC phase and can join the wrong weather hour. The training station/interval alignment is absent; no timestamp shift was implemented. |
| Current row selected nearest current hour | Nearest-time selection can select a future row; target row is silently clamped at dataset end. The diagnostic adapter requires explicit UTC issue/cutoff and exact target validity, without clamping. |
| OpenAQ 1..1500 filter, two-row forward fill | These proposed filters/filled values are not recovered training rules. Missing histories, reporting delay and revision first-seen times need explicit policy; NaN mechanics alone cannot validate it. |
| Row-based lags/rolling mean (minimum6), precipitation sum (minimum1) | Equivalent to hour windows only on a verified regular hourly index. Gaps/duplicate intervals and fill-before-roll change meaning. No original feature builder establishes training equivalence. |
| wind/ventilation | Notebook divides wind speed by3.6 for wind components and ventilation but retains provider wind units for raw/lag/target wind columns. Provider returned unit metadata must establish km/h; training units remain absent. Surface pressure, CAMS CO and precipitation interval conventions also need verification. |
| derived meteorology/CAMS | `(100-RH)/5` dewpoint approximation, RH/(ventilation+10), dust/(PM10+1), PM2.5/(PM10+1), biases and deltas are proposed formulas only. Native names/thresholds cannot prove constants, signs or units. |
| IST calendar | Notebook adds5h30 then uses integer hour, discarding minutes; day-of-year uses365.25. Original training calendar/timezone handling is unknown. |
| Future weather/CAMS | `past_days` plus forecast response does not establish historical forecast vintages/publication time. Target drivers must come from a forecast actually available by issue cutoff. Realized/reanalysis target values cannot be substituted. |
| spatial/population fallback | Six illustrative city density values and unconstrained nearest-sensor extrapolation are not model evidence. Population is not among the69 features. No spatial exposure or national operational coverage is enabled. |

All69 manifest provenance entries mark only names/order recovered; formula, unit and operational availability remain unverified. The existing provider adapters, map and application behavior are Antigravity-owned and were not changed by this audit.
