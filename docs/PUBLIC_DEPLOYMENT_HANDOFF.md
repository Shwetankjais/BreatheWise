> Update 24 November 2026: Render API is deployed at https://breathewise-api-56wc.onrender.com . GitHub Pages is connected through VITE_API_BASE_URL and CORS is verified. See RENDER_CONNECTION_STATUS.md for actual server scope and blockers. Earlier "no API" status below is historical; no Vercel deployment is needed for the Pages route.

# Optional full-stack hosting handoff — Vercel/Render pending

24 November 2026. **GitHub Pages static demo is now verified at https://shwetankjais.github.io/BreatheWise/; this document describes the optional, still pending Vercel/Render full-stack path.** Localhost is running and its accepted desktop/mobile results remain recorded in SUBMISSION.md. GitHub deployment history is empty; no local Vercel/Render authentication or project links were found. The user confirmed hosting credentials/identifiers are unavailable and requested preparation only until access is configured. No private archive, model, database or token was uploaded.

## Connect the accounts

1. Sign in to the intended **Render** account/workspace. Connect GitHub and authorize the GitHub app for `Shwetankjais/BreatheWise`. In New → Blueprint, select that repository, branch **feat/foundation**, and root `render.yaml`. Review the proposed API/database resources and Free plans; do not accept paid changes without authorization. Record the workspace ID, service ID, database ID and actual generated API URL. Do not use the example hostname in `render.yaml` as evidence of a deployment. [Render setup](https://render.com/docs/your-first-deploy), [Blueprint reference](https://render.com/docs/blueprint-spec).
2. For agent access, use Render Account Settings → Create API key. Restrict it to the intended workspace/resources with permission to inspect services/logs, deploy and configure the selected service; include database creation only if needed. Store its value as **RENDER_API_KEY** in the local agent process or ignored local environment, never chat/Git/frontend. Provide only nonsecret project/resource identifiers in chat. [Render API authentication](https://render.com/docs/api).
3. Sign in to the intended **Vercel** team. Add New → Project → Import Git Repository, authorize GitHub access to this repository, and select **Vite**. Keep Root Directory at repository root, Install Command `npm ci`, Build Command `npm run build --workspace apps/web`, Output Directory `apps/web/dist`. Use **feat/foundation** as production branch through Settings → Environments → Production → Branch Tracking. No main merge is required. Use the final verified commit from this handoff's Git history when creating a targeted deployment. [Vercel Git setup](https://vercel.com/docs/git).
4. For agent access, create a scoped Vercel access token in Account Settings → Tokens. Store as **VERCEL_TOKEN** locally. Record **VERCEL_ORG_ID** (team/account ID) and **VERCEL_PROJECT_ID**; these identifiers are not credentials. Project-scoped access is preferable for an existing project. No global CLI install is required merely to connect the dashboard integration. [Vercel access tokens](https://vercel.com/docs/accounts/access-tokens).

## Deployment environment variables

| Location | Name | Required value / handling |
| --- | --- | --- |
| Vercel build, Production and selected Preview environment | `VITE_API_BASE_URL` | Actual Render API HTTPS origin, without trailing slash. Client adds `/api/v1`; this public URL is bundled into JS. Redeploy after changing it. |
| Render API | `DATA_MODE` | `demo` for the initial public deployment; private local data is not authorized for redistribution. |
| Render API | `DATABASE_URL` | Managed PostgreSQL internal connection URL, kept secret. App uses psycopg3; normalize the scheme to `postgresql+psycopg://` while retaining the actual credentials/host/database. Current Blueprint connectionString returns `postgresql://`; this needs owner correction or a secret environment override before launch. |
| Render API | `WEB_ORIGIN` | Exact actual Vercel HTTPS origin. Comma-separated additional approved preview origins are supported. Replace the illustrative `breathewise.vercel.app`; do not use `*`. |
| Render API | `PORT` | Existing Blueprint uses `8000`; entrypoint binds `0.0.0.0:$PORT`. |
| Render API, optional later real intake | `OPENAQ_API_KEY` | Server secret only, unnecessary for the initial synthetic demo. Never use a `VITE_` prefix. |
| Render API, optional route provider | `ROUTING_BASE_URL` | Approved OSRM endpoint; verify rate limits and public-use suitability. Geometry readiness does not enable exposure. |

Vercel/Render management tokens belong in the agent's local environment, not the application runtime. Do not upload local `.env`, session files or SQLite databases. Render's current Free Postgres expires after30days and Free web services do not provide persistent disks; treat this as a time-limited submission demo, not durable production hosting. No paid resources have been purchased. [Render Free limits](https://render.com/docs/free).

## Asset scope and launch preflight

`DEPLOYMENT_ASSET_INVENTORY.json` lists the four retained experiment bundles with file sizes, SHA256s and training-source fingerprints. Evaluation/playback/replay need their manifests, heldout predictions, native artifacts and issue-purged supplements as checked by the existing loaders. Historical explorer needs the audited Delhi Parquet tree with quarantine exclusions and explicit recorded-clock semantics. Licensing/redistribution approval for these local assets is **not established**. Do not upload them. The teammate v5 binary is not necessary for a public diagnostic metadata row and must remain offline.

Initial public scope is synthetic demo observations, explicit Demo Preview fixtures and unavailable real-asset routes. The repository synthetic fixture hash is recorded in the inventory. Actual private archive exploration, measured retrospective evaluation/playback, complete saved replay trajectories, real station cache and learned-run database will be unavailable without separately approved assets. Frontend demo figures must retain their visible fixture labels; they cannot be presented as the measured localhost evidence. Public account behavior requires a newly provisioned hosted identity; never reuse the local session token or database. No signup/email delivery is claimed.

Before launching, coordinate these targeted deployment-owner corrections with Antigravity: verify the now-normalized database driver URL, fail-fast migrations/demo seed, and bundled metadata at runtime. Verify private files are excluded from any CLI build context. These are source-inspection findings, not observed production failures. Existing config alone is not deployment verification.

After access is configured, deploy API first, verify Alembic revision0004 and demo fixture state in the hosted database, then deploy Vercel with the actual API URL. Set exact CORS origin and verify allowed/denied origins using actual browser requests. Confirm HTTPS health, readiness's actual limitations, SPA deep-link reload, and no secrets in static assets/logs. Test desktop/mobile station/weather/history/model/replay/route/account states against actual public APIs; each unavailable real-data feature must remain visibly unavailable or explicitly demo-labeled. Record actual deployment IDs, Git SHA, URLs and results before marking this handoff deployed. Keep v5/public forecasting, exposure and live planner gates disabled. Localhost stays running throughout.


## GitHub Pages connected API mode

Pages can now connect to a hosted backend without moving the public frontend URL. In GitHub repository Settings → Secrets and variables → Actions → Variables, set `VITE_API_BASE_URL` to the actual HTTPS API origin, then rerun “Publish GitHub Pages demo.” Without this variable the site remains the explicit static demo. With it, startup selects live API mode and removes the static-demo scope statement; backend errors do not silently fall back to fixtures. Set the API's `WEB_ORIGIN=https://shwetankjais.github.io` (an origin has no /BreatheWise path).

Before enabling this variable, provision a backend/database, run migrations, configure server-only OpenAQ credentials and actually import verified observations. Evaluation/replay/archive need separately approved assets in their configured paths; do not copy private local sessions or the local database publicly. Live mode means real-source access, not verified live ML forecasts. Keep model capability gates unchanged until their evidence passes.

Current preparation verification: frontend typecheck; Pages builds with and without a configured HTTPS API origin; four database-driver configuration cases; shell entrypoint syntax. No hosted API is available or authenticated yet, so connected public API behavior remains unverified. Docker now excludes local data/secrets from build context, bundles documentation metadata and fails startup on migration or demo-seed failure.
