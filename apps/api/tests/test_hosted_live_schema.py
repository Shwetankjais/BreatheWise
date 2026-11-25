import os
from types import SimpleNamespace

import pytest
from breathewise.db import ensure_live_schema
from sqlalchemy import create_engine, text


def test_live_schema_is_selected_without_touching_public(monkeypatch):
    url = os.environ.get("BREATHEWISE_TEST_POSTGRES_URL")
    if not url:
        pytest.skip("PostgreSQL integration URL not configured")
    monkeypatch.setattr(
        ensure_live_schema, "get_settings", lambda: SimpleNamespace(database_url=url)
    )
    ensure_live_schema.main()
    monkeypatch.setenv("PGOPTIONS", "-csearch_path=breathewise_live")
    database = create_engine(url)
    try:
        with database.connect() as connection:
            assert connection.scalar(text("SELECT current_schema()")) == "breathewise_live"
    finally:
        database.dispose()
