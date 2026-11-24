# BreatheWise localhost prototype

Run inside the repository root. This workflow uses the existing real-data SQLite cache `work/delhi-live.db`, live data mode, local audited archive and ignored model registry. PostgreSQL17 is separately tested in CI; Docker or a production database is not required for this local prototype. No production deployment or paid service is configured.

## Start and stop

Dependencies are installed via `uv` and `npm`. On a fresh checkout, run `make setup` and install the isolated forecast runtime only when actually using model training/native execution. Local ignored datasets/models and `.env` credentials do not arrive through Git.

```sh
cd /path/to/BreatheWise
UV_CACHE_DIR="$PWD/work/uv-cache" uv run --locked python scripts/local_prototype.py prepare
UV_CACHE_DIR="$PWD/work/uv-cache" uv run --locked python scripts/local_prototype.py start
UV_CACHE_DIR="$PWD/work/uv-cache" uv run --locked python scripts/local_prototype.py status
```

Open **http://127.0.0.1:5173**. API documentation is **http://127.0.0.1:8000/docs**; health is `/api/v1/health`. The Vite browser proxy sends `/api` to the documented API port. Both bind only to loopback. Startup refuses occupied8000/5173 ports, never stops their existing owners, and never silently chooses another port. API/web readiness is checked before a successful running response. If ports are occupied, identify or stop the owning application yourself, or ask Codex to coordinate a documented alternative; do not use a broad process-kill command.

`start` supervises only API/web process groups it created and leaves them running for the local demo. Stop through its private authenticated local control socket:

```sh
UV_CACHE_DIR="$PWD/work/uv-cache" uv run --locked python scripts/local_prototype.py stop
UV_CACHE_DIR="$PWD/work/uv-cache" uv run --locked python scripts/local_prototype.py status
```

The expected final status is `not_running`. The command never kills a PID merely because a stale PID file exists. `work/prototype/supervisor.log` and `server.log` contain startup errors and access paths; authorization headers and keys are not emitted. `make dev` remains the foreground alternative using the same strict ports and child-group lifecycle; Ctrl-C stops its owned groups. Do not run both supervisors simultaneously.

## Configuration, migrations and artifacts

`prepare`/`start` select `DATABASE_URL=sqlite:///.../work/delhi-live.db` by default and `DATA_MODE=live`. An explicit process-environment DATABASE_URL overrides this selected local default. Existing `.env` secrets are preserved. The workflow applies current additive Alembic migrations before serving, verifies configured archive/model artifacts and writes a nonsecret preparation summary to private `work/prototype/prepared.json`.

Required configured archive source is `ARCHIVE_ROOT/data/cleaned/pollutants/Aanad Vihar.parquet`; configure `ARCHIVE_ROOT` in your `.env` to point to your local archive folder (default `data/archive`). Recorded-clock archive timestamps stay naive/qualified and are never silently converted to UTC. The model registry is `FORECAST_REGISTRY_ROOT` (default `work/forecast-experiment`). Required checked existing versions are `delhi-recorded-pm25-hourly-v2` and `delhi-openaq-pm25-hourly-v1`, including native model/prediction hashes and issue-purged evaluation supplement integrity. New availability-aware experimental artifacts have their own version/readiness and must not replace these original experiments.

Existing local `OPENAQ_API_KEY` remains server-only. `prepare` reports only whether it is configured. Routing uses the existing configured OSRM service/cache; geometry readiness remains separate from exposure readiness. No API request initiates unbounded provider discovery or training.

## Local identity and owned saved places/alerts

`prepare` provisions a local opaque bearer identity into **`work/prototype/session.token`**, mode0600, and retains the same provisioned identity while rotating expired sessions. It reuses a valid session without creating a new token. Tokens are never printed or committed. To enter it in the Saved Places authentication field on this Mac, copy privately to the clipboard:

```sh
pbcopy < work/prototype/session.token
```

Paste into the app's session field, authenticate, then clear the field/clipboard after use. Avoid screenshots while the token field contains a value. This is administrator-provisioned local identity, not public signup/OIDC. Saved places and preferences persist in the selected database and are isolated by bearer owner. In-app rules inspect actual eligible observations with freshness/cooldown/deduplication; they do not promise email, forecast alerts or immediate delivery when source data is stale.

## Repeatable intake and worker commands

```sh
DATABASE_URL=sqlite:///work/delhi-live.db DATA_MODE=live UV_CACHE_DIR="$PWD/work/uv-cache" \
  uv run --locked python scripts/refresh_delhi.py --lookback-hours 24 --overlap-hours 2
DATABASE_URL=sqlite:///work/delhi-live.db DATA_MODE=live UV_CACHE_DIR="$PWD/work/uv-cache" \
  uv run --locked python scripts/shadow_forecasts.py --reconcile-only
```

Intake is bounded to the existing verified Delhi cohort, cached/incremental, overlap-protected and retried. Provider revisions remain quarantined; a nonzero partial result is useful evidence, not permission to overwrite immutable observations. Existing cached observations remain visible with actual timestamps/staleness. The shadow reconciliation command matches only eligible actual observations received after the recorded generation; unmatched points stay missing.

New learned experimental forecast generation uses its own version and explicit availability rules; use the finalized availability-model run command in the prototype milestone handoff. The original `utc-persistence-shadow-v1` remains separately labeled as a baseline. A model rejection is retained visibly; do not widen freshness or substitute synthetic values to force a successful run. No recurring scheduler is installed. These once-commands can be invoked by a local scheduler after explicit scheduling configuration.

## Desktop/mobile demo sequence

1. Overview: inspect real station markers, latest observed concentration, source timestamp/unit/age and stale/partial state. Fresh-only observed rankings may correctly be empty; they are not forecast hotspots.
2. Historical EDA: select recorded-clock archive, source301 and an available interval; compare another source using explicit `same_recorded_clock`. Switch back to live UTC intake to verify clock/source separation.
3. Model Audit: select recorded hourly v2, then UTC hourly v1 through registry paths. Inspect primary issue-purged metrics and aligned held-out playback. V1's original target-only evidence remains qualified; neither retrospective model enables live forecasting.
4. Experimental runs: inspect real retained success/rejection details, input cutoff/provenance and complete target rows only when eligible. Zero rows on rejection remain zero.
5. Replay activity planning, when its additive contract/UI is wired: select one complete historical model/issue trajectory. Rank concentration-time windows without using future observed targets; compare duration/sensitivity. This is a historical comparison, not current safe-time advice. Incomplete trajectories stay unavailable.
6. Routes: inspect actual driving alternatives/distance/provider duration and coordinates. Exposure and traffic-aware claims remain unavailable.
7. Saved Places: authenticate locally, save a place, refresh and verify persistence. Change owned presentation/sensitivity preferences as supported. Configure an in-app observed-concentration rule and inspect the empty/delivered state honestly; stale source inputs can prevent delivery.
8. Repeat at desktop and390px mobile widths. Keep failure/empty/error states visible rather than enabling automatic demo fallback. Explicit Demo Preview remains separate from real inputs.

Public health/live-planner, calibrated intervals/probabilities, street-level exposure, population extent and supplied75-feature operational inference remain gated unless separately verified. Localhost running is not a deployment or a claim of complete live forecasting.


## Availability-aware experimental model

Preparation now also verifies delhi-openaq-pm25-delay3h-v2 with its independent manifest loader. If running on macOS with Homebrew or conda, set the OpenMP library path if prompted by LightGBM:

```sh
# On macOS (Homebrew example: brew install libomp)
BREATHEWISE_OPENMP_LIBRARY=$(brew --prefix libomp 2>/dev/null)/lib/libomp.dylib UV_CACHE_DIR="$PWD/work/uv-cache" uv run --locked python scripts/local_prototype.py start
```

Linux environments with a working LightGBM runtime do not need the Mac-specific library variable. This does not install or modify global libraries. The new model is trained under a simulated3h historical publication-delay scenario, allows only the independently evaluated latest complete input age3/4h regime, and separately enforces actual first-seen cutoffs during serving. Its v1 draft was preserved but is unaccepted; only correctedv2 respects3h target-label publication in fit/selection availability. An experimental model existing does not mean current inputs qualify. Actual current required hours are partial, so the persisted learned run is AVAILABILITY_REQUIRED_INPUT_UNAVAILABLE with zero forecasts. The next external condition is a complete verified observation at nominalissue−3h or−4h actually received by cutoff, with compatible known history; older freshness limits are unchanged.

Historical replay planning is implemented separately at /activity-plan/replay from complete single-issue saved forecasts. Use /models/{version}/replay-issues to find eligible trajectories. This is a historical concentration-time comparison, not current safe-time advice; public live planner remains disabled.


## One repeatable refresh/worker command

```sh
# Uses existing local credentials; refreshes only the bounded selected Delhi cohort.
uv run --locked python scripts/prototype_cycle.py
# Offline/cache-only replay of the same real intake: no provider requests.
uv run --locked python scripts/prototype_cycle.py --no-refresh
```

This is a once-command with a whole-command overlap guard, existing per-job locks/retries and idempotent scheduledissue keys. It refreshes bounded observations, evaluates owned in-app alerts, then attempts the separatelytrained learned shadow model for the current nominal UTC:end30 issue. Actual generation time remains separate and all targets must remain future. Exit1 can honestly mean partial provider revisions or a retained model/input rejection; inspect JSON event reasons, not just exitstatus. It never zero-fills or substitutes demo results. Actual cache-only execution returnedalerts0 and retained the same rejected learned run without a duplicate. No recurring scheduler is installed.
