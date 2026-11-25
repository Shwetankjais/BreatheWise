# Render live observation rollout

The public frontend is GitHub Pages; the API is the `breathewise-api` Render Docker service. `OPENAQ_API_KEY` belongs only in Render's Environment settings. Never put it in GitHub Pages, Vite variables, screenshots, or commits.

## What this deployment can ingest

The verified importer in `scripts/refresh_delhi.py` checks four explicitly selected Delhi Pollution Control Committee OpenAQ locations, their assigned PM2.5 sensors, units, coordinates, and recent availability. It writes immutable live observations to PostgreSQL. Rejected, stale, partial, or revised provider records retain their actual status. This is not an all-India or all-pollutant importer. `DATA_MODE=live` changes which rows the API serves; it does not itself fetch observations.

## Activate after the application commit is deployed

1. In Render **breathewise-api → Deploys**, confirm the image containing `breathewise.jobs.hosted_refresh` is Live. The committed Blueprint declares `BREATHEWISE_AUTO_REFRESH=1` and `DATA_MODE=live`.
2. In **Environment**, retain the already configured `OPENAQ_API_KEY` and the existing `DATABASE_URL` and `WEB_ORIGIN`. Ensure there is exactly one `DATA_MODE` entry. If the service still shows `demo`, change it to `live` and select **Save, rebuild, and deploy**, or sync the updated Blueprint. Do not set a Mac `/Users/...` path as `ARCHIVE_ROOT` on Render.
3. The Docker entrypoint applies migrations, then starts the bounded refresh worker before serving the API. The worker calls the existing verifier/importer immediately, then once per hour while the container is running. It requests at most 24 hours of history with a two-hour overlap. It runs only in live mode with a nonempty server-side OpenAQ key. Provider failures remain failures and are retried on the next cycle; there is no demo fallback.
4. In Render **Logs**, find `hosted_refresh_finished`, `cohort_refresh`, and each station result. An exit code of 1 or a rejected station is not proof of live data. The free web service can sleep or restart, so this in-process schedule is best effort rather than guaranteed continuous ingestion.
5. Check actual API responses, not just HTTP health:

   ```sh
   curl -fsS https://breathewise-api-56wc.onrender.com/api/v1/health
   curl -fsS 'https://breathewise-api-56wc.onrender.com/api/v1/stations?city_id=delhi'
   curl -fsS 'https://breathewise-api-56wc.onrender.com/api/v1/stations/openaq-235/pollutants'
   ```

   Require `meta.data_mode=live`, an actual `openaq-*` station, `synthetic_demo` absent, and a measured PM2.5 timestamp/value with its source and quality flags. The selected candidate may be rejected by provider verification; inspect all station results before declaring success. Then reload the public website and inspect the same station on the map. GitHub Pages already points to the Render API; no Vercel deployment or frontend rebuild is required for this server-mode change.

## What remains unavailable

The current importer covers PM2.5 at four Delhi candidates. Other cities and pollutants require separately verified station discovery, unit conversion, and ingestion; the UI must show unavailable fields rather than invented values. Retrospective evaluation and replay require the approved archive and complete versioned artifact folders at the configured `ARCHIVE_ROOT` and `FORECAST_REGISTRY_ROOT`. The free Render web plan has no persistent disk or shell; checked, licensed assets need a paid disk or an independently implemented private object-store loader. The supplied v5 artifact remains diagnostic-only until feature formulas, units, issue-time inputs, and a golden parity example are verified. Neither `OPENAQ_API_KEY` nor this worker enables public live ML forecasts or current safe-time planning.
