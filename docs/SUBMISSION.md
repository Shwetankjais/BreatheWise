# Verification and checkpoint evidence — 24 November 2026

Status: incomplete product; backend/API checkpoints delivered. Model/data/provider and frontend integration gates remain open. Branch feat/foundation. Foundation commit 4e7baa758316da482938b2b6ccda1534ad1224dc pushed and remote verified; later checkpoints are recorded in Git and Codex handoff. No merge to main or deployment claimed.

| Check | Actual result |
| --- | --- |
| make check | Ruff lint/format, Python tests, contract drift/types and frontend TS passed; 18 passed, 1 PostgreSQL-only test skipped locally |
| make test-integration | 11 isolated SQLite/Alembic/API tests passed, 1 PostgreSQL-only concurrency case skipped locally |
| SQLite Alembic upgrade head + check | Through 0002, no ORM schema drift |
| Demo seed twice | First inserted 1 observation, second inserted 0; explicit DATA_MODE=demo; JSON/Parquet archives generated |
| make audit-model | Both SHA256 hashes match supplied audit; no deserialization, feature parity or inference |
| Backend wheel build | breathewise-0.1.0-py3-none-any.whl built under ignored work/dist |
| Frontend typecheck/build | Passed on owner-ready source; review still requires corrections |
| Frontend unit tests | 12 passed in 3 files; tests do not establish model/scientific correctness |
| PostgreSQL | GitHub Actions run 45250542048 passed all 12 PostgreSQL 17 cases at f7e4a9c, including concurrent alert workers; local daemon unavailable |
| Browser/e2e | Not performed; corrected frontend and coordination required |

| Acceptance | Evidence and remaining gate |
| --- | --- |
| AC01 | Canonical station/latest APIs and synthetic tests; no actual station dataset/provider or accepted browser integration |
| AC02 | Explicit model unavailable and unsupported horizon/pollutant checks; original source/environment/golden/data missing |
| AC03 | Model-unavailable hotspot response only; ranking unfinished |
| AC04 | TRAJECTORY_UNAVAILABLE; full planner unfinished |
| AC05 | Sourced WHO general facts with version/review scope; no clinical review or category-specific guidance; browser integration pending |
| AC06 | Station hourly history, valid/missing counts and issue-time leakage tests; city aggregation/actual-data EDA unfinished |
| AC07 | Population extent/epoch absent; unfinished |
| AC08 | Structured capabilities/errors, freshness, mode/replay labels, cutoff tests; frontend automatic fallback rejected in review |
| AC09 | Persisted opaque sessions/places/preferences, cross-user and expiry API tests; production DB and browser auth flow pending |
| AC10 | In-app observation worker, freshness/cooldown/idempotency/ownership tests; PostgreSQL concurrent-worker test passed in CI; browser verification pending; email/forecast alerts unavailable |
| AC11 | EVALUATION_UNAVAILABLE; actual evaluation/baseline/split evidence absent |
| AC12 | Frontend compiles/tests; no accepted accessibility/responsive/browser evidence |
| AC13 | Locked setup/scripts/contracts/package verified locally; PostgreSQL/clean full-stack real setup open |
| AC14–AC18 | Extensions remain gated on routing/spatial/model/POI/population/explanation evidence; not delivered |

Frontend owner-ready slice is held from Git because auto fixture fallback, fabricated scenario coefficients, arbitrary forecast/evaluation/population and unsupported AQI/planner claims conflict with scientific requirements. See exact changes requested in Codex handoff. No ownership override or pause inferred. User confirmed teammate files have not arrived; no repeated model-file request is needed. Continue with original pipeline/features, compatible environment, golden station/issue/horizon inputs/outputs/units/tolerance, source datasets/forecast availability provenance and evaluation splits when supplied.

Official references used for implementation: [FastAPI error handlers](https://fastapi.tiangolo.com/tutorial/handling-errors/), [SQLAlchemy 2 sessions](https://docs.sqlalchemy.org/en/20/orm/session_basics.html), [OpenAPI TypeScript CLI](https://openapi-ts.dev/cli). Educational content source: [WHO outdoor air pollution facts](https://www.who.int/news-room/fact-sheets/detail/ambient-(outdoor)-air-quality-and-health), accessed 24 November 2026; concise paraphrases with no individual disease/causal claims.


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
