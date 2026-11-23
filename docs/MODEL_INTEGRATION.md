# Model integration and prerequisite audit

## Static findings, 24 November 2026
Both supplied binaries were accessible and copied unchanged into ignored artifacts/models/. Original files remain in Downloads. See MODEL_STATIC_AUDIT.json for SHA256, sizes and exact 75 feature names. Inspection used pickle opcodes only; no joblib deserialization, pipeline execution or prediction was performed. The full pipeline parser stops at a joblib NumPy payload, which is a parser limitation, not evidence of model corruption.

- full_aq_pipeline.joblib references `__main__.HyperlocalAQPipeline`. Reliable deserialization needs the original class/module and dependencies. Do not create an empty compatibility class and claim the pipeline works.
- zero_input_aq_weather_model.joblib appears to be a dictionary containing a LightGBM booster, feature metadata, station lookup, horizons and target transform. 'Zero input' in its name is not evidence that live feature generation is included.
- Both artifacts contain an identical serialized LightGBM booster (SHA256 2891830caddcb09e651ba382caca4e957569de165c323942be8f04492777fef8). They are two packages of the same embedded booster, not evidence of two independently trained models.
- max_feature_idx=74 and 75 named inputs, including current pollution, history through 48h, weather, CAMS, FIRMS, population, forecast_horizon_h and target-hour drivers.
- Declared horizons [1,3,6,12,24], target_transform log1p. Metadata suggests one pooled horizon-conditioned regressor rather than separate models at each horizon; confirm using original training code.
- PM2.5 feature names and report suggest PM2.5 output, but target semantics and inversion must be confirmed. No evidence supplied for forecasts of all pollutants, calibrated intervals/probabilities, validated 24-point trajectory or spatial predictions.
- Station lookup city strings appear to include station labels; verify city assignment rather than assuming usable city labels.

## Ask teammate at Gate B — concise required list
1. Original pipeline class and exact feature-generation/inference source, including helper modules and how features are fetched.
2. Training environment requirements/lockfile and a runnable inference example.
3. One station + issue time + complete input feature row + expected final prediction for supported horizons, plus transform/units and tolerance.
4. Accessible source/processed data location (the PDF's Windows path is not this Mac), station registry and forecast-archive provenance; evaluation predictions/metrics and exact split dates.
Provider keys are requested only for selected integrations that require them; store locally via environment. Routes require a configured routing endpoint; email requires delivery configuration. Keep these requests scoped and continue independent work.

## Integration sequence
Inventory source/dependencies before loading supplied Python serialized artifacts. Create isolated compatible environment. Load teammate class through its real module; avoid global monkeypatches in application code. Inspect actual object fields, output shape and model version. Establish feature builder and parity test against golden example. Verify target_transform application exactly once; confirm whether the booster returns log values or wrapper already inverts them. Preserve units and clipping semantics. Produce a model manifest with target, horizons, feature schema/order, missingness policy, transforms, training/split provenance and supported input ranges. Load once per worker; batch predictions; avoid loading a 20MB model per request. No manual dict edits to silently extend capabilities.

If wrapper source is unavailable, Codex may investigate a documented native-booster adapter using supplied metadata, but it is NOT a substitute for exact preprocessing. Keep runtime readiness false until feature parity and golden output are verified. Do not retrain or alter the model to make UI features look supported without a separate recorded experiment.

## Corrections carried forward from PDF review
- Observation/fire cutoffs follow issue time and known availability, not target hour. Treat missing satellite acquisition/coverage as missing rather than zero. Deduplicate overlapping archives and handle sensor/product differences. Detection counts are not unique fires or crop-burning attribution.
- Historical realized/reanalysis weather is not operational future weather. Target-weather/CAMS inputs must be forecasts available at issue time. Verify exact source product: Open-Meteo global CAMS is documented as forecast output; hourly returned rows can be interpolated from native temporal resolution.
- Timezone-aware conversion, hour interval meaning and IST half-hour alignment require explicit handling; no subtracting the offset twice.
- Replace universal <=0 masking and pollutant-independent clipping with documented source/unit-aware QA. Preserve plausible extremes and transformation flags. CO mg/m3 vs µg/m3 conversion must be confirmed.
- Backfill needed missing grids; bound fallback distance and retain provenance. Do not infer maximum station distance as half a cell width, since diagonal geometry matters.
- Population extraction must preserve counts; record epoch/projection and overlapping buffers. Buffers are population context, not personal health risk or unique city exposed population.
- 5 horizons do not establish 24-hourly trajectory. Planner may expose explicit supported sampled-time comparisons initially, but a duration-integrated activity recommendation needs adequate temporal coverage; mark that requirement unfinished until resolved.
- A single regression output provides no calibrated uncertainty. Evaluate against baselines with chronological train/calibration/test and multiple backtests. Do not fabricate numbers for the UI.

## Existing data inventory reported, not re-verified
Report: 782 national stations, 1,798 files about 2.80 GiB; 1,186 pollution files; weather 315/407 grids; CAMS 219/309 grids; ~4.24M FIRMS detections; GHSL rasters/buffers. Aligned endpoint count of 13,626 hours is arithmetically consistent. Actual files, preprocessing, training quality and coverage remain to be audited when accessible. Preserve the existing corpus rather than re-fetch all of it.

## Parallel collaboration
Both agents begin immediately under the original-chat orchestrator; follow ORCHESTRATOR.md and ARCHITECTURE.md ownership. Codex handles shared/backend/model work and Git writes, Antigravity handles owned frontend source and UI evidence. Readiness checkpoints enable dependent integration; they do not block independent work. Record progress and scoped requests in each owner's handoff.
