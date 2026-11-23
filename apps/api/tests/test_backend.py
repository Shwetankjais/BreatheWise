from datetime import UTC, datetime, timedelta

import pytest
from alembic import command
from alembic.config import Config
from breathewise.db.models import Notification, Observation, SessionToken
from breathewise.db.session import engine
from breathewise.schemas.ingestion import ImportBatch
from breathewise.services.alerts import evaluate
from breathewise.services.ingestion import import_batch
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

pytestmark = pytest.mark.integration


def test_migrations_match_orm(backend):
    command.check(Config("alembic.ini"))


def test_units_zero_and_issue_time_cutoff(backend):
    client, *_ = backend
    response = client.get(
        "/api/v1/stations/fixture/latest?pollutant=co&issue_at=2026-11-20T02:00:00Z"
    )
    assert response.status_code == 200
    assert response.json()["data"]["value"] == 600
    assert response.json()["data"]["original_unit"] == "mg/m3"
    assert response.json()["meta"]["data_mode"] == "demo"
    response = client.get("/api/v1/stations/fixture/latest?issue_at=2026-11-20T02:00:00Z")
    assert response.json()["data"]["value"] == 0  # Future-available 01:00 row must not leak.
    response = client.get(
        "/api/v1/history?station_id=fixture&start=2026-11-20T00:00:00Z&end=2026-11-20T03:00:00Z&issue_at=2026-11-20T02:00:00Z"
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert (data["valid_count"], data["missing_count"], data["expected_count"]) == (1, 2, 3)
    assert (
        client.get(
            "/api/v1/history?station_id=fixture&start=2026-11-20T00:30:00Z&end=2026-11-20T03:00:00Z"
        ).status_code
        == 422
    )
    assert client.get("/api/v1/stations?city_id=delhi&bbox=NaN,0,180,90").status_code == 422


def test_import_idempotency_and_conflict_rollback(backend):
    *_, batch = backend
    with Session(engine()) as db, db.begin():
        assert import_batch(db, batch)["inserted"] == 0
    changed = batch.model_copy(deep=True)
    changed.observations[0].value = 9
    with pytest.raises(ValueError, match="conflict"), Session(engine()) as db, db.begin():
        import_batch(db, changed)
    with Session(engine()) as db:
        assert db.scalar(select(func.count()).select_from(Observation)) == 3


def test_invalid_features_never_imputed(backend):
    *_, batch = backend
    payload = batch.model_dump(mode="json")
    payload["observations"][0]["value"] = -9999
    with pytest.raises(ValidationError):
        ImportBatch.model_validate(payload)
    payload["observations"][0]["value"] = float("nan")
    with pytest.raises(ValidationError):
        ImportBatch.model_validate(payload)
    payload["observations"][0]["value"] = 1
    payload["observations"][0]["measured_at"] = "2026-11-20T00:30:00Z"
    with pytest.raises(ValidationError):
        ImportBatch.model_validate(payload)


def test_saved_places_preferences_and_cross_user_ownership(backend):
    client, first, second, _ = backend
    assert client.get("/api/v1/me", headers={"X-User-ID": "guessed"}).status_code == 401
    place = {"label": "Home", "latitude": 28.6, "longitude": 77.2}
    response = client.post("/api/v1/saved-places", headers=first, json=place)
    assert response.status_code == 201
    identity = response.json()["data"]["id"]
    assert len(client.get("/api/v1/saved-places", headers=first).json()["data"]) == 1
    assert client.get("/api/v1/saved-places", headers=second).json()["data"] == []
    assert (
        client.patch(f"/api/v1/saved-places/{identity}", headers=second, json=place).status_code
        == 404
    )
    assert client.delete(f"/api/v1/saved-places/{identity}", headers=second).status_code == 404
    assert (
        client.patch(
            "/api/v1/preferences", headers=first, json={"sensitivity": "sensitive"}
        ).status_code
        == 200
    )
    assert (
        client.get("/api/v1/preferences", headers=second).json()["data"]["sensitivity"] == "general"
    )
    assert client.delete(f"/api/v1/saved-places/{identity}", headers=first).status_code == 204
    assert client.get("/api/v1/saved-places", headers=first).json()["data"] == []


def test_expired_session_is_denied(backend):
    client, first, *_ = backend
    with Session(engine()) as db, db.begin():
        tokens = db.scalars(select(SessionToken)).all()
        for token in tokens:
            token.expires_at = datetime.now(UTC) - timedelta(days=1)
    assert client.get("/api/v1/me", headers=first).status_code == 401


def test_alert_delivery_dedup_cooldown_and_ownership(backend):
    client, first, second, _ = backend
    body = {"station_id": "fixture", "pollutant": "pm25", "threshold": 100, "cooldown_minutes": 60}
    response = client.post("/api/v1/alert-rules", headers=first, json=body)
    assert response.status_code == 201
    rule_id = response.json()["data"]["id"]
    assert (
        client.patch(f"/api/v1/alert-rules/{rule_id}", headers=second, json=body).status_code == 404
    )
    now = datetime(2026, 11, 20, 3, 0, tzinfo=UTC)
    with Session(engine()) as db, db.begin():
        assert evaluate(db, now)["created"] == 1
    with Session(engine()) as db, db.begin():
        assert evaluate(db, now)["created"] == 0
        assert evaluate(db, now + timedelta(minutes=10))["created"] == 0
        assert db.scalar(select(func.count()).select_from(Notification)) == 1
    alerts = client.get("/api/v1/alerts", headers=first).json()["data"]
    assert alerts[0]["status"] == "delivered_in_app"
    alert_id = alerts[0]["id"]
    assert client.get("/api/v1/alerts", headers=second).json()["data"] == []
    assert client.post(f"/api/v1/alerts/{alert_id}/read", headers=second).status_code == 404
    one = client.post(f"/api/v1/alerts/{alert_id}/read", headers=first).json()
    two = client.post(f"/api/v1/alerts/{alert_id}/read", headers=first).json()
    assert one["data"]["read_at"] == two["data"]["read_at"]
    assert client.delete(f"/api/v1/alert-rules/{rule_id}", headers=first).status_code == 204
    assert client.get("/api/v1/alert-rules", headers=first).json()["data"] == []
    assert (
        client.patch(f"/api/v1/alert-rules/{rule_id}", headers=first, json=body).status_code == 404
    )
    assert (
        client.post(
            "/api/v1/alert-rules", headers=first, json=body | {"channel": "email"}
        ).status_code
        == 409
    )


def test_stale_observation_does_not_generate_alert(backend):
    client, first, *_ = backend
    body = {"station_id": "fixture", "pollutant": "pm25", "threshold": 100}
    client.post("/api/v1/alert-rules", headers=first, json=body)
    with Session(engine()) as db, db.begin():
        assert evaluate(db, datetime(2026, 11, 21, tzinfo=UTC))["created"] == 0


def test_replay_requires_cutoff_and_is_explicit(backend, monkeypatch):
    from breathewise.core.config import get_settings
    from breathewise.db.models import Station

    client, *_ = backend
    monkeypatch.setenv("DATA_MODE", "historical_replay")
    get_settings.cache_clear()
    with Session(engine()) as db, db.begin():
        db.get(Station, "fixture").data_mode = "historical_replay"
    assert client.get("/api/v1/stations/fixture/latest").status_code == 422
    data = client.get("/api/v1/stations/fixture/latest?issue_at=2026-11-20T02:00:00Z").json()
    assert data["meta"]["data_mode"] == "historical_replay"
    assert data["meta"]["replay_issue_at"] == "2026-11-20T02:00:00Z"
