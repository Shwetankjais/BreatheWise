# Verification and checkpoint evidence — 24 November 2026

Status: incomplete product; backend/API checkpoints delivered. Model/data/provider and frontend integration gates remain open. Branch feat/foundation. Foundation commit 4e7baa758316da482938b2b6ccda1534ad1224dc pushed and remote verified; later checkpoints are recorded in Git and Codex handoff. No merge to main or deployment claimed.

| Check | Actual result |
| --- | --- |
| make check | Ruff lint/format, Python tests, contract drift/types and frontend TS passed; final test total in Codex handoff |
| make test-integration | 9 isolated SQLite/Alembic/API tests passed; no PostgreSQL/provider claim |
| SQLite Alembic upgrade head + check | Through 0002, no ORM schema drift |
| Demo seed twice | First inserted 1 observation, second inserted 0; explicit DATA_MODE=demo; JSON/Parquet archives generated |
| make audit-model | Both SHA256 hashes match supplied audit; no deserialization, feature parity or inference |
| Backend wheel build | breathewise-0.1.0-py3-none-any.whl built under ignored work/dist |
| Frontend typecheck/build | Passed on owner-ready source; review still requires corrections |
| Frontend unit tests | 12 passed in 3 files; tests do not establish model/scientific correctness |
| PostgreSQL | Unverified: daemon socket absent; Docker application launch could not locate app |
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
| AC10 | In-app observation worker, freshness/cooldown/idempotency/ownership tests; actual PostgreSQL concurrent worker and browser verification pending; email/forecast alerts unavailable |
| AC11 | EVALUATION_UNAVAILABLE; actual evaluation/baseline/split evidence absent |
| AC12 | Frontend compiles/tests; no accepted accessibility/responsive/browser evidence |
| AC13 | Locked setup/scripts/contracts/package verified locally; PostgreSQL/clean full-stack real setup open |
| AC14–AC18 | Extensions remain gated on routing/spatial/model/POI/population/explanation evidence; not delivered |

Frontend owner-ready slice is held from Git because auto fixture fallback, fabricated scenario coefficients, arbitrary forecast/evaluation/population and unsupported AQI/planner claims conflict with scientific requirements. See exact changes requested in Codex handoff. No ownership override or pause inferred. User confirmed teammate files have not arrived; no repeated model-file request is needed. Continue with original pipeline/features, compatible environment, golden station/issue/horizon inputs/outputs/units/tolerance, source datasets/forecast availability provenance and evaluation splits when supplied.

Official references used for implementation: [FastAPI error handlers](https://fastapi.tiangolo.com/tutorial/handling-errors/), [SQLAlchemy 2 sessions](https://docs.sqlalchemy.org/en/20/orm/session_basics.html), [OpenAPI TypeScript CLI](https://openapi-ts.dev/cli). Educational content source: [WHO outdoor air pollution facts](https://www.who.int/news-room/fact-sheets/detail/ambient-(outdoor)-air-quality-and-health), accessed 24 November 2026; concise paraphrases with no individual disease/causal claims.
