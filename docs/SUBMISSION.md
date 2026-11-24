# Verification and checkpoint evidence — 24 November 2026

Current status: Prototype backend/model/replay/local operations bdebeed and frontend PhaseA2d979ad verified. CI45350115600 passed127standard+1defaultskip,46PostgreSQL,89forecastmechanics,2nativechecks and packaging;PhaseA49frontend tests/build and8desktop/mobile actualAPI/error/emptychecks passed underfresh13:17ISTfreeze with36unchangedfingerprints. Contract1.4 replaybackend works on actualcompleteforecasts; actuallearnedavailabilityrunrejects partialrequiredinputs with0forecasts. Localhost8000/5173running underowned supervisor/privateidentity. PhaseB UI/finalfullbrowserwalk pending—prior browser results do not establish it. Currentevidence/commands/limits: PROTOTYPE_COMPLETION.md and LOCALHOST_PROTOTYPE.md.

## Historical evidence (old failures/statuses below are superseded)

| Check | Actual result |
| --- | --- |
| make check | 46 passed, 1 PostgreSQL-only local skip; Ruff, generated 1.1.0 contract drift/types and frontend TS passed |
| Native diagnostics | Both artifact hashes preserved; identical native booster hash, 75 features, 1105 trees; 2 isolated mechanics tests passed; no wrapper/golden parity |
| Migration/worker | Through 0003; safe retry/overlap controls, persisted outcomes; demo repeated intake inserted 1 then 0 |
| Real provider | OpenAQ authenticated locally; 70 actual Anand Vihar PM2.5 hours cached; latest 98 µg/m³ at 24 Nov 03:00 IST was stale/partial; source flags retained |
| Real API/browser | Stations/latest/history 200; history 70 valid/3 missing of 73; forecast/evaluation 503. Desktop/mobile display checks passed; DATA_EVIDENCE.json |
| Account/error/demo browser | Latest targeted snapshot: 6 passed, 2 mobile interaction timeouts; desktop persistence/ownership, errors/empty/demo pass. Earlier snapshot had 8 passes. Mobile responsive defect remains open |
| Frontend unit/build | 22 owner unit tests and production build passed; targeted scientific/geographic owner corrections remain open; source not committed |
| PostgreSQL/CI | [CI45291003341](https://github.com/Shwetankjais/BreatheWise/actions/runs/45291003341) at 4e6ccf5 succeeded: 46 standard + 1 default skip, 18 PostgreSQL, 2 native mechanics, wheel; logs inspected |

| Acceptance | Evidence and remaining gate |
| --- | --- |
| AC01 | One real station/latest API and desktop/mobile slice; broader data/geography/frontend review incomplete |
| AC02 | Native diagnostics work; original feature generation/units/anchors, golden output and held-out validation missing; public forecast unavailable |
| AC03–AC04 | Hotspot forecasts and full trajectory planner unavailable |
| AC05 | WHO-sourced general facts; engineering review only, no clinical/category guidance acceptance |
| AC06 | Actual station hourly history with units/flags and missing counts; original preprocessing and city aggregation/EDA unfinished |
| AC07 | Population extent/epoch and raster extraction missing |
| AC08 | Failure/empty/demo behavior browser-tested; scientific copy, mobile mode, pollutant/map review still open |
| AC09 | Server-owned opaque sessions/places/preferences and ownership tests; place persistence across refresh browser-tested; public signup/OIDC absent |
| AC10 | In-app observed alerts with freshness/cooldown/deduplication; PostgreSQL concurrency verified; email/forecast alerts unavailable |
| AC11 | Evaluation unavailable; no invented metrics or calibrated intervals |
| AC12 | Desktop/mobile behavioral evidence exists; full accessibility/cartographic/content acceptance incomplete |
| AC13 | Locked tooling, CI, contract and ingestion workflows; local credential/cache not supplied by a clone; no deployed scheduler |
| AC14–AC18 | Routing/spatial/model/POI/population/explanation extensions remain unfinished |

Frontend ready paths remain held from Git pending the targeted map/wind/radius/attribution, hero/data-mode/quality copy, pollutant selection, zero threshold, demo hotspot and AQI issues in docs/handoffs/codex.md. Source ownership remains with Antigravity. Source values for lat/lon/PM2.5 are verified; all 75 model-feature source/formula/units/time/history/availability statuses are in FEATURE_PROVENANCE.json/md. Missing teammate feature source/environment/golden/evaluation and issue-time driver semantics still block operational inference; no repeated key or model-binary request is needed.

Official references used for implementation: [FastAPI error handlers](https://fastapi.tiangolo.com/tutorial/handling-errors/), [SQLAlchemy 2 sessions](https://docs.sqlalchemy.org/en/20/orm/session_basics.html), [OpenAPI TypeScript CLI](https://openapi-ts.dev/cli). Educational content source: [WHO outdoor air pollution facts](https://www.who.int/news-room/fact-sheets/detail/ambient-(outdoor)-air-quality-and-health), accessed 24 November 2026; concise paraphrases with no individual disease/causal claims.


## Historical checkpoints (superseded where current evidence differs)

Post-foundation real HTTP smoke passed using an explicitly labeled synthetic demo database: health 200, partial readiness 503, actual imported scope, disabled forecast 503, anonymous account 401, authenticated account 200, persisted saved-place create/delete and token-file permissions 0600. The child API process was stopped afterward; no persistent server/deployment claimed.

Hardening adds refusal of mixed-mode imports, rejection of nonfinite normalized units, a distinct-observation cooldown regression, and a PostgreSQL-only two-worker race test. Original PostgreSQL CI evidence: https://github.com/Shwetankjais/BreatheWise/actions/runs/45250165492 (success). Later run status is recorded at checkpoint rather than assumed.


Final code checkpoint: f7e4a9ce1e06f9499784235970aaa76b41eb36ae, remote verified. [Expanded CI run](https://github.com/Shwetankjais/BreatheWise/actions/runs/45250542048) completed success: 18 standard cases passed and 1 PostgreSQL-only case skipped in SQLite, then all 12 PostgreSQL integration cases passed with no skips, wheel packaged. The source tree is unchanged by the following evidence-only documentation commit. Frontend owner files remain local/untracked pending corrections; no main merge/deployment or real model/browser success.


## Diagnostic model milestone (extends original task)
User authorized offline state/native recovery and diagnostic execution without teammate source. Both streams traversed without executing Python serialized constructors; native hash/order/state parity across artifacts established. Recovered native tree count/best iteration 1105, registry count 769, malformed city semantics and missing population fields recorded in MODEL_RECOVERY.json. No data/model binaries, raw registry, model text or numerical probe rows committed. Native string/file score difference is 0 for an explicitly synthetic five-row numerical probe, not a golden/real-station validation example. Both artifact recoveries produce identical probe scores; no concentration unit or operational readiness claimed.

Verification at this checkpoint: backend 31 passed, 1 PostgreSQL-only case skipped locally; 13 new state/input guard cases are included. Optional isolated runtime: 2 native-format mechanics tests passed. Frontend is actively migrating owned source; the latest shared-tree make check failed frontend TypeScript while backend lint/format/tests and contract drift/type checks passed. Do not describe the current shared checkout as a passing full-stack build. Corrected frontend readiness, new CI, real model inputs/source/golden/data and browser integration remain pending. Previous PostgreSQL CI evidence remains valid for its unchanged backend persistence code.


Diagnostic checkpoint CI evidence: [run 45285296772](https://github.com/Shwetankjais/BreatheWise/actions/runs/45285296772) at 0f44ba07199e6c896e2e305bcfd2615346413892 is SUCCESS. Logs show 31 default backend tests passed with 1 PostgreSQL-only skip; all 12 PostgreSQL cases passed; isolated native-format tests 2 passed; wheel packaging passed. Local actual-artifact technical probes are distinct evidence and do not establish golden feature/output parity, accuracy or target units. Current uncommitted frontend source remains in active owner migration; its latest full-checkout TypeScript failure is not hidden by the clean committed-backend CI. Corrected owner readiness and browser verification are pending. Following evidence-only docs commit changes no tested source/runtime tree.


## Provider/feature/worker and browser milestone
Implemented bounded OpenAQ hourly intake and a canonical archive/import interface over the existing SQL/Parquet architecture; station-history cache and original first-seen times are retained. Full 75-feature provenance matrix separates recovered metadata, verified source semantics, reconstructed candidates and missing evidence. No real feature row has been fabricated. The experimental current/lag bridge refuses future availability and missing exact lags. UTC :30 interval endings are preserved; mixed phases require explicit reconciliation.
Repeatable worker provides per-database overlap guards, transient retries, rate-limit deferral, persisted ingestion outcomes, safe logs and independent in-app alert evaluation. Canonical demo smoke: first worker cycle inserted 1 row, repeated cycle inserted 0. No schedule/daemon installed.
Verification: make check passed with 43 backend cases and 1 local PostgreSQL-only skip; lint/format/contracts/frontend typecheck passed. Native mechanics 2 passed; corrected frontend unit suites 18 passed and production build passed. Eight Chromium desktop/mobile/reduced-motion journeys passed against a running API and isolated labeled synthetic-demo DB; source/provider failure tests use synthetic fixtures. Original browser process sandbox block was resolved via authorized process permissions; test selector mismatches were fixed in owned test harness. Screenshots reviewed visually. Behavior passing does not clear remaining hero/map/metadata/pollutant/threshold owner review items in Codex handoff. No real Delhi observation, operational pollution forecast or independent model evaluation is claimed.
OpenAQ key absent in local env and no real observation archive found in the project. Key/archive request is pending; do not request either already-present model binary again. Source-first verification and city/station/driver eligibility remain required. Current tested contract remains 1.1.0; no main merge/deployment.

Provider/feature/worker CI: [run 45288748827](https://github.com/Shwetankjais/BreatheWise/actions/runs/45288748827) at 435d5b6bf581c844830c74ae2d795b9d82bf3c38 is SUCCESS. Logs inspected: 43 backend cases passed, 1 default-run PostgreSQL-only skip; all 17 PostgreSQL integration cases passed; 2 isolated native mechanics tests passed; wheel built. Eight browser journeys are separate local Chromium evidence on the uncommitted owner snapshot, not CI or real-provider evidence. A further readiness guard rejects future-dated as well as stale provider success records; its focused test passes locally and will be included in the next CI run.


## Real observation milestone
See DATA_EVIDENCE.json for exact measured/available timestamps, source IDs and archive hash. Stored actual data, keys, native model text and numerical probe tensors remain ignored. Real browser checks were read-only on the cache; eight broader journeys used synthetic inputs. Readiness was database/provider true but model false at verification; provider freshness expires without another run. Existing pipeline source, original units/time anchors/missingness, issue-time weather/CAMS/FIRMS inputs and golden/evaluation evidence remain missing. No native diagnostic score is presented as a city forecast.

## Delhi archive comparison follow-up
Read-only full pollutant archive audit and bounded real OpenAQ overlap check completed; DELHI_DATA_COMPARISON.md records the hybrid recommendation and DELHI_DATA_AUDIT.json records actual counts/hashes. All 75 candidate archive sources/blockers are mapped in DELHI_FEATURE_INPUTS.csv. Clock/interval/availability uncertainty prevents authoritative historical UTC import. No original model semantics or operational forecast readiness promoted. Current mobile frontend regressions and remaining AQI/mode-title review are in the Codex handoff; source ownership preserved.

Archive-audit code checkpoint cfe5631 passed [CI45297386248](https://github.com/Shwetankjais/BreatheWise/actions/runs/45297386248): 46 standard tests + 1 default skip, 18 PostgreSQL, 2 isolated native mechanics and backend wheel. Local full make check/frontend typecheck passed; 22 owner frontend unit tests/build passed; latest browser result remains 6 passed/2 failed on mobile. No original model/golden parity or scientific frontend acceptance inferred.

## Mobile correction acceptance supersedes the prior two failures
FRONTEND_MOBILE_FIXES_READY reviewed and verified by Codex: 8 browser journeys passed (including both formerly failing mobile cases), 22 frontend unit cases passed, production build and make check passed. Stable owner paths accepted for feature-branch integration. This is synthetic-data behavioral evidence; no operational model inference, official AQI validation, main merge or deployment. Optional extra geometry/live-cache probes were not completed because ports were occupied/unavailable; prior real-observation evidence is unchanged.

Final local verification: make check passed (Ruff,74 backend tests+1 default PostgreSQL-only skip, generated contract drift/types, frontend typecheck); frontend34 unit tests and production build passed; reconciled isolated synthetic browser journeys8/8 passed. Actual asset feature checks22/22 passed across desktop/mobile. Vite reports a nonfatal582.59kB bundle warning. Baseline synthetic browser stack now explicitly isolates archive/model roots and disables routing to avoid inheriting local real datasets/provider settings.

GitHub verified checkpoint: implementation db1ef9f + integrated frontend/tooling ff0f95f6674ff3e5cc6fd473d84c68184e57d1ca on feat/foundation; ls-remote matches local HEAD. CI https://github.com/Shwetankjais/BreatheWise/actions/runs/45333637605 completed SUCCESS; actual logs inspected:74 standard passed+1 default PostgreSQL-only skip,30 PostgreSQL passed,13 new-forecast mechanics passed,2 native mechanics passed, wheel built. No main merge/deployment. Untracked artifacts/models/.gitkeep preserved and excluded from commits.


## Final verified backend checkpoint
Implementation f42c389 plus compatibility follow-up8a7761c32d744ec22415029b420da5aeade15602 pushed on feat/foundation; remote SHA independently matched. CI https://github.com/Shwetankjais/BreatheWise/actions/runs/45339745693 completed SUCCESS; actual logs inspected:95 standard passed+1 default PostgreSQL-only skip,41 actual PostgreSQL passed,64 forecast mechanics passed,2 supplied-native mechanics passed, browser-tool strict types passed and wheel built. Prior run45339387837 failed only at committed frontend demo fixture output types after95 backend tests passed. Three owner-authored contract-default additions were staged selectively from Antigravity's already-present changes; independent exported committed-source typecheck passed. No frontend source was rewritten and unrelated owned hunks remain unstaged.

Antigravity has since published FRONTEND_1_3_0_INTEGRATION_STABLE_READY with editing OPEN. Source reinspection confirms registry paths/version selection, ForecastRunDetail and issue_time_purged wiring now exist; the preceding source-review corrections are historical. Its current45 unit tests and production build were independently run (results below). No fresh combined browser snapshot ACK was requested or inferred; no new browser acceptance claimed. Existing accepted5cd7127 milestone was not repeated. Ready source remains preserved for scoped1.3.0 integration. Remaining review point: supported horizons should come from registry/evaluation metadata rather than model-name inference when registry readiness is missing. No shared dependency request pending.

Updated frontend source checks:45/45 unit tests and production build passed;630.31kB JavaScript chunk gives a nonfatal Vite size warning. This verifies current source checks, not a frozen browser snapshot or acceptance of uncommitted frontend changes.
