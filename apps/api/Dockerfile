# Multi-stage production build for BreatheWise API
FROM python:3.12-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:0.5.26 /uv /uvx /bin/

COPY pyproject.toml uv.lock ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

RUN uv sync --frozen --no-dev

FROM python:3.12-slim AS runtime

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/apps/api /app/apps/api
COPY --from=builder /app/packages /app/packages
COPY pyproject.toml alembic.ini ./
COPY scripts/ /app/scripts/

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/apps/api/src \
    DATA_ROOT=/app/data \
    PORT=8000

RUN useradd -m -u 1000 -U breathewise && \
    mkdir -p /app/data /app/work && \
    chmod +x /app/scripts/docker_entrypoint.sh && \
    chown -R breathewise:breathewise /app

USER breathewise

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://127.0.0.1:${PORT}/api/v1/health || exit 1

ENTRYPOINT ["/app/scripts/docker_entrypoint.sh"]
