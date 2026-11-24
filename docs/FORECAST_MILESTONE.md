# Hourly experiments, clocks and shadow logging — 24 November 2026

Continued from5cd7127. Active allocation is Codex55%/Antigravity45%; existing path ownership and sole Codex Git-write authority remain unchanged. No branch change, main merge or deployment.

## Delivered

- Authoritative OpenAQ UTC/local and exclusive-hour-end metadata investigated; actual station235/sensor12235610 verified. Archive source301 remains a candidate association with approximate supplied coordinates; no authoritative crosswalk/timezone/interval proof, no numerical timestamp shift or source join. Details and primary links: CLOCK_READINESS.md/json.
- Bounded UTC-native history:13,188 observed hourly rows,9,509 provider-complete eligible rows,19February2025–31October2026;25 actual API requests cached, replay0requests/sameSHA90779cc9e54d54523af906ddc3d2c63c75a8e84d51d7ac7b1222d6192c09ef04. Raw data stays ignored. Missing/partial targets are excluded, never interpolated or zero-filled. UTC:end30 and µg/m³ retained; historical publication times unknown.
- Separate recorded-clock hourly model `delhi-recorded-pm25-hourly-v2`:24 native models,39 features,890,917 held-out rows. All8 original v1 artifact hashes unchanged.
- Separate UTC-native hourly model `delhi-openaq-pm25-hourly-v1`:24 native models,39 features,116,292 held-out rows; verified provider clock/sensor, complete-hour targets. Frozen chronological UTC train2025/validationJanuary–June2026/testJuly–October2026, plus two rolling folds. Fixed inherited parameters, validation-only stopping; no test tuning. Full clock-specific definitions/hashes/errors/missingness: FORECAST_HOURLY*.md/json.
- Fixed-model split-boundary availability violations were discovered in original target-only evaluation. Predeclared mechanical issue-time purging removed1,155 recorded/592UTC rows across validation/test/folds without changing frozen models/protocols/CSV. Hash-pinned sidecars supply new primary API comparisons. Original target-only results remain explicitly qualified and preserved. No claim that purging establishes historical input availability. FORECAST_ISSUE_PURGED.md/json.
- Migration0004 persists shadow runs, input hashes/cutoffs/provenance, distinct target times, failures and observed matches. Scheduled once-command supports an explicitly labeled24h persistence baseline with fresh complete verified UTC input only; no public mutation endpoint. Actual generation time is separate from nominal issue, targets strictly future, overlap/idempotency and later exact observed matching enforced. Learned models remain shadow-gated; retrospective readiness alone is insufficient. SHADOW_FORECASTS.md.
- Contract1.3.0 generated; model catalogue paths/clock/cohort, purged evaluation and playback filters, separate UTC endpoints and read-only run/status endpoints implemented. Browser-tool Node/import.meta diagnostics fixed with scoped strict NodeNext configuration and pinned Node24 types; no application dependency upgrade or source overwrite.

## Measured issue-purged common-cohort test errors

Unitsµg/m³. These sources/cohorts differ and must not be compared as a model contest.

| Experiment | Horizon | Paired N | Model MAE | Persistence MAE |
| --- | ---: | ---: | ---: | ---: |
| Recorded v2 | 1 | 13977 | 18.913 | 20.870 |
| Recorded v2 | 24 | 14291 | 39.575 | 47.822 |
| UTC-native | 1 | 1324 | 11.173 | 11.650 |
| UTC-native | 24 | 1532 | 25.800 | 27.607 |

UTC model beats both baselines at17/24 horizons, not all24;9–11 and13–16 have relevant baseline losses. High-target samples are small (29 at1h,16 at24h), with severe underprediction. Full per-horizon counts, errors, bias and peak events are published. No calibrated intervals/probabilities, extreme reliability, broad-station or prospective skill claim.

## Actual prospective intake/status

A bounded refresh inserted7 new records; cache now304 across the existing4 stations. Provider revisions remain quarantined. Latest Anand03:30UTC was actually first seen06:00:57UTC,108µg/m³ and partial.150.96-minute first-seen lag is an upper bound on publication delay, affected by our polling; no precise provider delay is invented.

Actual shadow log contains retained rejections: stale input (`SHADOW_INPUT_STALE`, input hash preserved, zero forecasts), expired nominal issue (`SCHEDULED_ISSUE_EXPIRED`), unsupported learned UTC shadow version, and recorded-clock incompatibility. Repeating the actual stale run returned the same run ID and created no duplicate. No successful real shadow forecasts or prospective accuracy evidence are claimed;0 observed matches so far. Successful24-target generation/matching is verified with explicit synthetic mechanics fixtures only.

The learned UTC experiment requires its current measured interval to be available at its issue clock under the retrospective assumption. Actual delayed publication/partial coverage does not establish that requirement. Neither silently shifting issue time/features nor increasing the freshness allowance is authorized by these results. Public live model forecasting, duration activity planning, calibrated uncertainty and spatial exposure remain unavailable. No scheduler installed; serial ingestion/shadow/reconciliation commands are ready for an external scheduler.

## Implemented endpoint examples

```text
GET /api/v1/models
GET /api/v1/models/delhi-recorded-pm25-hourly-v2/evaluation?horizon_h=2
GET /api/v1/models/delhi-recorded-pm25-hourly-v2/predictions?horizon_h=2&split=test&issue_time_purged=true&target_start=2026-10-01T00:00:00&limit=25
GET /api/v1/models/delhi-openaq-pm25-hourly-v1/utc-evaluation?horizon_h=9
GET /api/v1/models/delhi-openaq-pm25-hourly-v1/utc-predictions?horizon_h=9&split=test&issue_time_purged=true&target_start=2026-10-01T00:00:00Z&limit=25
GET /api/v1/forecast-runs?station_id=openaq-235&limit=25
GET /api/v1/forecast-runs/09865bb9-377c-42e8-9014-7e163903b26f
```

UTC responses use explicit UTC issue/target fields. Recorded filters reject offsets; UTC filters reject naive/non-UTC clocks. Endpoint catalogue gives evaluation_path/predictions_path. New primary horizons/backtests use issue-purged comparisons; target_only_horizons preserves original qualified scores. Default playback is labeled target_timestamp_split_only; select issue_time_purged=true to reproduce the primary cohort. Supported horizons are model/version-specific; supplied native75 remains diagnostic-only.

## Checks and frontend boundary

- `make check`:95 backend passed+1 default PostgreSQL-only skip; Ruff, generated contract drift/types and current frontend typecheck passed. Initial combined failure exposed hardcoded0003 readiness probes; both now use a shared0004 revision constant with regression assertions.
- Isolated forecast runtime:64 mechanics tests passed, including24-horizon causality/missingness/split rules, actual native reload and supplement/source tampering. Actual full prediction CSV horizon/target-split/finite fields independently verified; purged results reproduced exactly without retraining.
- `npm run typecheck --prefix tools/browser-tests`:passed strict configuration without skipLibCheck or ignored errors. CI now includes this check.
- Local SQLite migration0004 upgrade/check:passed. PostgreSQL and clean packaging CI status appended after push.
- `DATABASE_URL=sqlite:///work/delhi-live.db DATA_MODE=live uv run --locked python scripts/check_forecast_milestone.py`:21 actual configured-data API-handler checks passed; no browser/provider mock. Purged playback counts matched real evaluation counts, clock/horizon gates and4 retained run statuses verified. FORECAST_MILESTONE_EVIDENCE.json.

Accepted prior browser/reconciliation milestone was not repeated. Antigravity's new source-ready snapshot still hardcoded recorded-v1 and had an incorrect run-detail return type when reviewed; targeted1.3.0 corrections are recorded in Codex handoff, editing explicitly OPEN. Its active changes are preserved and excluded from backend commits. No new frontend/browser acceptance is claimed. NEXT_MILESTONE_CONTRACT.md is the integration handoff; no concrete shared-manifest request is pending.
