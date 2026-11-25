#!/bin/sh
set -e

echo "[BreatheWise API] Starting up in ${DATA_MODE:-live} mode..."

# The hosted database may already contain demo fixtures in public. Keep live
# observations and their migrations in a dedicated schema; never mix modes.
if [ "${DATA_MODE}" = "live" ] && [ -n "${DATABASE_URL:-}" ]; then
    case "$DATABASE_URL" in
        postgres://*|postgresql://*|postgresql+psycopg://*)
            python -m breathewise.db.ensure_live_schema
            export PGOPTIONS="-csearch_path=breathewise_live"
            echo "[BreatheWise API] Using isolated live PostgreSQL schema."
            ;;
    esac
fi

# Apply database migrations if DATABASE_URL is set
if [ -n "$DATABASE_URL" ]; then
    echo "[BreatheWise API] Running database migrations..."
    alembic upgrade head
fi

# In demo mode, if database has no stations, seed demo fixtures
if [ "${DATA_MODE}" = "demo" ]; then
    if [ -f "packages/contracts/fixtures/demo-import.json" ]; then
        echo "[BreatheWise API] Ensuring demo fixture availability..."
        python scripts/data_cli.py seed-demo
    fi
fi

if [ "${BREATHEWISE_AUTO_REFRESH:-0}" = "1" ] && [ "${DATA_MODE}" = "live" ]; then
    if [ -z "${OPENAQ_API_KEY:-}" ]; then
        echo "[BreatheWise API] Auto refresh requires an OpenAQ key." >&2
        exit 1
    fi
    echo "[BreatheWise API] Starting bounded live OpenAQ refresh worker..."
    python -u -m breathewise.jobs.hosted_refresh &
fi

PORT="${PORT:-8000}"
echo "[BreatheWise API] Serving on 0.0.0.0:${PORT}..."
exec uvicorn breathewise.main:create_app --factory --host 0.0.0.0 --port "$PORT"
