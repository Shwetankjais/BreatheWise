from datetime import UTC, datetime
from uuid import uuid4

from breathewise.core.config import get_settings
from breathewise.core.time import utc
from breathewise.db.models import AlertRule, Notification, Observation, Station
from sqlalchemy import select


def evaluate(db, now=None):
    now = now or datetime.now(UTC)
    # PostgreSQL serializes evaluation per rule. Unique event key is a second guard.
    rules = db.scalars(
        select(AlertRule)
        .where(AlertRule.enabled.is_(True), AlertRule.deleted.is_(False))
        .with_for_update()
    ).all()
    created = 0
    for rule in rules:
        station = db.get(Station, rule.station_id)
        if station is None or station.data_mode != get_settings().data_mode:
            continue
        latest = db.scalar(
            select(Observation)
            .where(
                Observation.station_id == rule.station_id,
                Observation.pollutant == rule.pollutant,
                Observation.measured_at <= now,
                Observation.available_at <= now,
            )
            .order_by(Observation.measured_at.desc())
            .limit(1)
        )
        if latest is None or (now - utc(latest.measured_at)).total_seconds() > 7200:
            continue
        if latest.value <= rule.threshold:
            continue
        if (
            rule.last_event_at
            and (now - utc(rule.last_event_at)).total_seconds() < rule.cooldown_minutes * 60
        ):
            continue
        if db.scalar(
            select(Notification.id).where(
                Notification.rule_id == rule.id, Notification.observation_id == latest.id
            )
        ):
            continue
        db.add(
            Notification(
                id=str(uuid4()),
                user_id=rule.user_id,
                rule_id=rule.id,
                observation_id=latest.id,
                created_at=now,
                value=latest.value,
                threshold=rule.threshold,
                status="delivered_in_app",
            )
        )
        rule.last_event_at = now
        db.flush()
        created += 1
    return {"created": created, "channel": "in_app", "forecast_alerts": False}
