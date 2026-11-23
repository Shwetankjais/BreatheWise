import os
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from breathewise.core.auth import provision_session
from breathewise.core.config import get_settings
from breathewise.db.session import engine
from breathewise.main import create_app
from breathewise.schemas.ingestion import ImportBatch
from breathewise.services.ingestion import import_batch
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session
from sqlalchemy.schema import CreateSchema, DropSchema


@pytest.fixture
def backend(tmp_path, monkeypatch):
    engine.cache_clear()
    get_settings.cache_clear()
    postgres_url = os.environ.get("BREATHEWISE_TEST_POSTGRES_URL")
    postgres_admin = None
    schema = None
    database_url = f"sqlite:///{tmp_path / 'backend.db'}"
    if postgres_url:
        if not postgres_url.startswith("postgresql"):
            raise ValueError("BREATHEWISE_TEST_POSTGRES_URL must use PostgreSQL")
        postgres_admin = create_engine(postgres_url)
        schema = "breathewise_test_" + uuid4().hex
        with postgres_admin.begin() as connection:
            connection.execute(CreateSchema(schema))
        database_url = (
            make_url(postgres_url)
            .update_query_dict({"options": f"-csearch_path={schema}"})
            .render_as_string(hide_password=False)
        )
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("DATA_MODE", "demo")
    monkeypatch.setenv("DATA_ROOT", str(tmp_path / "data"))
    get_settings.cache_clear()
    command.upgrade(Config("alembic.ini"), "head")
    with Session(engine()) as db, db.begin():
        batch = ImportBatch.model_validate(
            {
                "schema_version": "1.0",
                "data_mode": "demo",
                "timestamp_semantics": "hour_ending_utc",
                "provenance": "synthetic test batch",
                "stations": [
                    {
                        "id": "fixture",
                        "name": "Synthetic fixture",
                        "city_id": "delhi",
                        "latitude": 28.6,
                        "longitude": 77.2,
                        "source": "test",
                        "data_mode": "demo",
                    }
                ],
                "observations": [
                    {
                        "station_id": "fixture",
                        "pollutant": "co",
                        "measured_at": "2026-11-20T00:00:00Z",
                        "available_at": "2026-11-20T00:05:00Z",
                        "value": 0.6,
                        "unit": "mg/m3",
                        "source": "test",
                        "averaging_period_minutes": 60,
                    },
                    {
                        "station_id": "fixture",
                        "pollutant": "pm25",
                        "measured_at": "2026-11-20T00:00:00Z",
                        "available_at": "2026-11-20T00:05:00Z",
                        "value": 0,
                        "unit": "ug/m3",
                        "source": "test",
                        "averaging_period_minutes": 60,
                    },
                    {
                        "station_id": "fixture",
                        "pollutant": "pm25",
                        "measured_at": "2026-11-20T01:00:00Z",
                        "available_at": "2026-11-20T03:00:00Z",
                        "value": 200,
                        "unit": "ug/m3",
                        "source": "test",
                        "averaging_period_minutes": 60,
                    },
                ],
            }
        )
        import_batch(db, batch)
        first, token_a = provision_session(db)
        second, token_b = provision_session(db)
    client = TestClient(create_app())
    yield (
        client,
        {"Authorization": f"Bearer {token_a}"},
        {"Authorization": f"Bearer {token_b}"},
        batch,
    )
    client.close()
    engine().dispose()
    if postgres_admin is not None:
        with postgres_admin.begin() as connection:
            connection.execute(DropSchema(schema, cascade=True))
        postgres_admin.dispose()
    engine.cache_clear()
    get_settings.cache_clear()
