# BreatheWise India

Hyperlocal Atmospheric Intelligence & Machine Learning Forecasting for India's Cities.

BreatheWise integrates air quality monitoring observations, meteorological forecasts, and machine learning models to provide retrospective evaluation, held-out model playback, historical activity replay planning, and criteria pollutant health advisories.

---

## Quick Start (Clean Checkout / ZIP Download)

Anyone cloning this repository or downloading the GitHub ZIP can immediately run a reproducible, fully functional demo preview on their local machine without requiring private datasets, trained model binaries, or external API keys.

### 1. Prerequisites
- **Node.js** >= 20 & **npm**
- **Python** 3.12 & **uv** (`curl -LsSf https://astral.sh/uv/install.sh | sh`)
- *Optional:* **Docker** & **Docker Compose**

### 2. Run the Reproducible Demo Preview
```bash
# 1. Install dependencies
npm ci --no-audit --no-fund
uv sync --locked

# 2. Initialize local demo database and seed developer fixtures
DATABASE_URL=sqlite:///demo.db DATA_MODE=demo uv run alembic upgrade head
DATABASE_URL=sqlite:///demo.db DATA_MODE=demo uv run python scripts/data_cli.py seed-demo

# 3. Start API (terminal 1)
DATABASE_URL=sqlite:///demo.db DATA_MODE=demo uv run uvicorn breathewise.main:create_app --factory --port 8000

# 4. Start Web Application (terminal 2)
npm run dev --workspace apps/web
```

Open **`http://localhost:5173`**. The application runs in explicit Demo mode, clearly labeled with persistent **`DEMO PREVIEW ACTIVE`** banners and transparent synthetic provenance flags.

---

## Feature Matrix & Operational Reality

| Feature Journey | Contract Endpoint | Status | Operational Reality & Scientific Safeguards |
|---|---|---|---|
| **Geographic Station Map** | `GET /api/v1/stations` | **Operational** | Interactive Leaflet map with OpenStreetMap tiles, custom marker styling, dual IST (`Asia/Kolkata`) / UTC (`Z`) timestamps, and concentration legends. |
| **Welcome & Geolocation Flow** | Browser Geolocation API | **Operational** | User-consented browser geolocation finds nearest monitoring station using Haversine formula; enforces 50 km boundary with polite fallback. |
| **Observed Concentration Rankings** | `GET /api/v1/observed-rankings` | **Operational** | Shows actual sorted sensor observations; explicitly disclaims predictive hotspot status. |
| **Historical Activity Replay** | `POST /api/v1/activity-plan/replay` | **Operational** | Retrospectively ranks outdoor activity windows across complete 24h saved forecast issues (`Contract 1.4`). Target observations are never used to choose windows. |
| **Live Prospective Planner** | `POST /api/v1/activity-plan` | **Gated (409)** | Refuses prospective activity planning with `409 TRAJECTORY_UNAVAILABLE` until continuous 24h operational trajectory is scientifically validated. |
| **Criteria Pollutant Health Guide** | `GET /api/v1/advisories` | **Operational** | Educational guidance for PM2.5, PM10, NO₂, SO₂, CO, O₃ with structured WHO 2021 Air Quality Guidelines matrix, averaging periods, and non-clinical disclaimer. |
| **Historical Archive & EDA** | `GET /api/v1/archive/*` | **Operational** | Historical data exploration with mandatory `clock_assumption=same_recorded_clock`. CO reported in `mg/m³`. |
| **Model Performance Audit** | `GET /api/v1/models/*` | **Operational** | Metadata-driven model inspection (`v2` recorded-clock 1–24h, `v1` UTC-clock), primary issue-purged cohort metrics, held-out playback, error residuals, and CSV export. |
| **Availability Model Shadow Runs** | `GET /api/v1/forecast-runs` | **Operational** | Availability-aware shadow model inspection honestly retains rejection reasons (`AVAILABILITY_REQUIRED_INPUT_UNAVAILABLE`) with 0 rows on partial input. |
| **Operational Live Forecasts** | `GET /api/v1/stations/{id}/forecast` | **Gated (503)** | Honestly surfaces `503 MODEL_UNAVAILABLE` in live mode when backend live inference pipelines are unverified. No fake zeros or synthetic fallbacks. |
| **Route Geometry Workspace** | `POST /api/v1/routes/geometry` | **Operational** | Returns GeoJSON LineString alternatives, distance, and duration. Route exposure comparison is honestly gated (`409 EXPOSURE_UNAVAILABLE`). |
| **Saved Places & Alerts** | `GET /api/v1/saved-places`, `/alert-rules` | **Operational** | Bearer session authorization (`Authorization: Bearer <token>`), isolated per-user persistence, custom threshold rules, and sensitivity preferences. |
| **Population Extent & Hotspots** | `GET /api/v1/coverage`, `/hotspots` | **Gated (409)** | Gated with `409 COVERAGE_UNAVAILABLE` due to missing validated population raster extraction provenance. |
| **What-If Weather Scenarios** | `POST /api/v1/scenarios/weather` | **Gated (409)** | Gated with `409 SCENARIO_UNAVAILABLE` pending validated physical pipeline integration. |

---

## Deployment Paths

### Option A: Full-Stack Docker (`compose.yaml`)

A production-ready multi-container configuration is provided that starts PostgreSQL 17, the FastAPI backend, and Nginx SPA frontend with automated healthchecks, migrations, and persistent storage:

```bash
# Build and start all services
docker compose up --build

# In a separate terminal, verify services:
# Web Frontend:  http://localhost:3000
# API Backend:   http://localhost:8000/api/v1/health
# PostgreSQL:    localhost:5432 (user: breathewise, db: breathewise)
```

- **Healthchecks:** PostgreSQL uses `pg_isready -U breathewise`, API uses `curl -f http://127.0.0.1:8000/api/v1/health`, Web uses `wget -q http://127.0.0.1:80/`.
- **Migrations & Seeding:** The API container automatically applies Alembic migrations on startup (`alembic upgrade head`) and seeds demo fixtures if running in demo mode.
- **Volumes:** `postgres_data` persists database storage; `api_data` persists local artifacts.

---

### Option B: Cloud Deployment (Vercel Frontend + Render API & Database)

#### 1. API & Database on Render (`render.yaml`)
A verified Render Blueprint configuration is provided in `render.yaml`:
1. Connect this repository to **Render** and create a new **Blueprint Instance**.
2. Render automatically provisions:
   - **`breathewise-db`**: PostgreSQL 16/17 managed database.
   - **`breathewise-api`**: Docker Web Service built using `./Dockerfile.api` with automatic database connection string injection.
3. Set the following environment variables in the Render dashboard:
   - `DATA_MODE`: `demo` (or `live` if providing live data credentials).
   - `WEB_ORIGIN`: Your frontend URL, e.g. `https://your-app.vercel.app`.
   - `OPENAQ_API_KEY`: *(Optional server-only key for live data refresh)*.

#### 2. Web Frontend on Vercel (`vercel.json`)
A verified Vercel configuration is provided in `vercel.json` (root) and `apps/web/vercel.json`:
1. Import this repository into **Vercel**.
2. Framework Preset: **Vite**.
3. Build Command: `npm run build --workspace apps/web`.
4. Output Directory: `apps/web/dist`.
5. Environment Variables:
   - `VITE_API_BASE_URL`: The URL of your deployed Render API, e.g. `https://breathewise-api.onrender.com`.
6. SPA Routing: All routes automatically rewrite to `/index.html`.

---

## Real-Data Prerequisites & Environment Layout

To run BreatheWise against real atmospheric datasets and models, supply the following files and configuration:

```text
BreatheWise/
├── .env                                 # Server-only secrets (never commit)
├── data/
│   └── archive/
│       └── data/cleaned/pollutants/
│           └── Aanad Vihar.parquet      # CPCB Anand Vihar historical archive
└── work/
    ├── delhi-live.db                    # Real SQLite or PostgreSQL observation store
    └── forecast-experiment/
        ├── delhi-recorded-pm25-hourly-v2/ # 24h recorded-clock model & predictions
        ├── delhi-openaq-pm25-hourly-v1/   # 24h UTC model & predictions
        └── delhi-openaq-pm25-delay3h-v2/  # Availability-aware learned shadow model
```

### Environment Variables (`.env`)
```bash
# Database connection (SQLite or PostgreSQL)
DATABASE_URL=sqlite:///work/delhi-live.db

# Data mode: live, historical_replay, or demo
DATA_MODE=live

# Allowed CORS origins (comma-separated for multi-origin support)
WEB_ORIGIN=http://localhost:5173,http://127.0.0.1:5173

# Server-only OpenAQ v3 API Key (never prefix with VITE_)
OPENAQ_API_KEY=your_openaq_api_key_here

# Local historical archive root
ARCHIVE_ROOT=data/archive

# Trained model experiment registry root
FORECAST_REGISTRY_ROOT=work/forecast-experiment
```

---

## Verification & Test Commands

Teammates can verify test coverage and build readiness on any clean machine:

```bash
# 1. Frontend Unit Tests (58 tests across 4 suites)
npm --workspace=@breathewise/web run test

# 2. TypeScript Static Typecheck (0 errors)
npm --workspace=@breathewise/web run typecheck

# 3. Production Bundle Build
npm --workspace=@breathewise/web run build

# 4. Backend Unit & Contract Tests (127 passed)
uv run pytest -q

# 5. Contract Specification Export & Validation
uv run python scripts/export_contracts.py --check
npm run contracts:check
```

---

## Scientific Transparency & Disclaimer

- **Historical Retrospective Comparisons:** Activity replay rankings compare past saved model forecasts from completed runs; they do not predict tomorrow's outdoor activity risk or guarantee personal safety.
- **Educational Content:** Air quality advisories and pollutant guides are sourced from WHO 2021 Global Air Quality Guidelines and are educational. BreatheWise does not provide medical diagnosis, clinical evaluation, or personalized health prescriptions.
- **Honest Model Gating:** Operational live inference is withheld (`503 MODEL_UNAVAILABLE`) when input data is partial or unverified. Zero forecasts are never fabricated.
