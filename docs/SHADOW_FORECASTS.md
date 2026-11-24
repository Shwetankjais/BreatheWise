# UTC shadow baseline service

`utc-persistence-shadow-v1` is an explicitly labeled experimental persistence baseline. It repeats the most recent eligible known PM2.5 concentration at each of 24 hourly targets. It is neither the supplied diagnostic model nor either recorded-clock learned model. Public forecasting, activity planning, calibrated intervals/probabilities and spatial exposure stay unavailable.

The shadow CLI requires an explicit scheduled UTC issue and input cutoff. Both timestamps must be timezone aware; cutoff must be at or before issue, and issue cannot be after actual generation. Generation may run at most 15 minutes after the scheduled issue; actual wall-clock `generated_at` and generation delay remain recorded, never replaced by a backdated prospective issue. All targets must be strictly later than actual generation. Target times are `scheduled issue + horizon hours`; API also reports actual lead seconds from generation. Issue minutes must match the provider observation's hourly end phase (currently Delhi :30 UTC); the CLI does not infer or shift a naive historical clock.

Inputs must be from the configured data mode, PM2.5 in canonical µg/m³, measured and actually available at/before the explicit cutoff, nonnegative/finite, at most 120 minutes old at issue, and not marked partial/unknown coverage or unresolved revision/verification. The persistence baseline needs exactly one current eligible observation; no older lags, imputation or zero defaults are required. Zero remains a valid measured value. Live inputs additionally require the existing cached verified OpenAQ station/sensor identity (verified within24hours and not in the future), matching source location URL, and no pending provider revision. Demo inputs are accepted only in the explicit demo database/mode for mechanics testing.

Each run records station/model version, scheduled issue, input cutoff, actual generation, operation/data mode, rules, source measurement/availability timestamps, input SHA256 and provenance. Rejected runs retain a concrete error code and zero prediction rows. Attempting either `delhi-recorded-*` model records `MODEL_CLOCK_INCOMPATIBLE`; successful retrospective evaluation never bypasses this gate.

A unique station/model/issue/cutoff key plus existing PostgreSQL advisory/local file overlap locks prevents duplicate runs. Repeating a rejected run retains the original rejection and cutoff; it does not silently retry using information arriving later. Use a new scheduled issue after intake improves. Read-only `/api/v1/forecast-runs` supports station/model filters and bounded limit/offset; `/api/v1/forecast-runs/{id}` returns status, provenance and at most 24 predictions. There is no public mutation endpoint.

Outcome matching runs separately or after each CLI batch. It pairs exact station/pollutant/unit/target-hour observations only, requires target measurement and actual observation availability strictly after the forecast's actual generation, and waits until the observation is available at matching cutoff. Partial/unknown-coverage observations are excluded. It stores matched observation IDs/time idempotently; unmatched targets stay null. This starts a prospective collection mechanism, not a claim that forecast-skill evidence already exists.

Run ingestion first with the existing bounded `scripts/refresh_delhi.py` worker (separate nonzero status may indicate quarantined provider revisions). Then run one explicit scheduled shadow batch, for example:

```sh
# Example timestamps only: choose the actual current scheduled issue, never replay as prospective.
DATABASE_URL=sqlite:///work/delhi-live.db uv run --locked python scripts/shadow_forecasts.py \
  --station-id openaq-235 --issue-at 2026-11-24T06:30:00Z --input-cutoff 2026-11-24T06:30:00Z
DATABASE_URL=sqlite:///work/delhi-live.db uv run --locked python scripts/shadow_forecasts.py --reconcile-only
```

A batch accepts at most ten explicit station IDs. Exit 0 means all requested runs succeeded (or reconciliation only); exit 1 includes retained rejected runs/database unavailable; exit 2 indicates overlap. Logs contain run IDs/status/error codes, never credentials. The command is suitable for an external scheduler; no daemon or scheduler was installed. Alembic migration 0004 creates the tables. Synthetic focused tests validate issue-time availability, zero preservation, 24 distinct future target times, stale/incomplete/clock rejection, idempotency/overlap, read-only APIs and delayed exact-hour outcome matching. Synthetic mechanics are not environmental validation.

Verification: `uv run --locked pytest -q apps/api/tests/test_shadow.py` passed11 focused synthetic mechanics cases. Ruff checks passed on owned files; isolated SQLite migration0004 upgrade and `alembic check` reported no drift. PostgreSQL verification remains the parent combined/CI check.
