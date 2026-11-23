export UV_CACHE_DIR := $(CURDIR)/work/uv-cache
export npm_config_cache := $(CURDIR)/work/npm-cache
UV := uv run --locked
.PHONY: setup db-up migrate seed-demo ingest audit-model dev check test-integration test-e2e build contracts
setup:
	uv sync --locked
	npm ci --no-audit --no-fund
db-up:
	docker compose up -d --wait db
migrate:
	$(UV) alembic upgrade head
contracts:
	$(UV) python scripts/export_contracts.py
	npm run contracts
check:
	$(UV) ruff check apps/api scripts tools/model-diagnostics/tests
	$(UV) ruff format --check apps/api scripts tools/model-diagnostics/tests
	$(UV) pytest -q
	$(UV) python scripts/export_contracts.py --check
	npm run contracts:check
	npm run typecheck:contracts
	@if test -f apps/web/src/main.tsx; then npm run typecheck --workspace apps/web; else echo 'UNVERIFIED: Antigravity frontend entry not supplied'; fi
audit-model:
	$(UV) python scripts/audit_model.py
dev:
	$(UV) python scripts/dev.py
build:
	$(UV) python -m build --wheel --outdir work/dist
	npm run build --workspace apps/web
seed-demo:
	$(UV) python scripts/data_cli.py seed-demo
ingest:
	$(UV) python scripts/data_cli.py ingest $(ARGS)
test-integration:
	$(UV) pytest -q -m integration
test-e2e:
	PLAYWRIGHT_BROWSERS_PATH="$(CURDIR)/work/browsers" npm test --prefix tools/browser-tests

test-postgres:
	@test -n "$$BREATHEWISE_TEST_POSTGRES_URL" || (echo 'Set BREATHEWISE_TEST_POSTGRES_URL to a disposable PostgreSQL database with schema-create rights'; exit 2)
	$(UV) pytest -q -m integration

# Isolated optional runtime: does not modify the web or API dependency environments.
setup-model-diagnostics:
	uv sync --locked --project tools/model-diagnostics
recover-model:
	$(UV) python scripts/model_diagnostics.py recover $(ARGS)
diagnose-model:
	uv run --locked --project tools/model-diagnostics python scripts/model_diagnostics.py predict $(ARGS)
probe-model:
	uv run --locked --project tools/model-diagnostics python scripts/model_diagnostics.py probe $(ARGS)
check-model-diagnostics:
	uv run --locked --project tools/model-diagnostics python scripts/model_diagnostics.py check $(ARGS)

worker:
	$(UV) python scripts/run_worker.py $(ARGS)
feature-snapshot:
	$(UV) python scripts/feature_snapshot.py $(ARGS)

setup-browser-tests:
	npm ci --prefix tools/browser-tests --no-audit --no-fund
	PLAYWRIGHT_BROWSERS_PATH="$(CURDIR)/work/browsers" tools/browser-tests/node_modules/.bin/playwright install chromium
