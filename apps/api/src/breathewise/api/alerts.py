from typing import Annotated
from uuid import uuid4

from breathewise.core.auth import current_user
from breathewise.core.errors import ServiceError, metadata
from breathewise.core.time import utc
from breathewise.db.models import AlertRule, Notification, User
from breathewise.db.session import get_db
from breathewise.repositories.observations import station
from breathewise.schemas.alerts import NotificationView, RuleInput, RuleView
from breathewise.schemas.common import Envelope
from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

router = APIRouter()
Db = Annotated[Session, Depends(get_db)]
Owner = Annotated[User, Depends(current_user)]


def owned_rule(db, user_id, rule_id):
    row = db.scalar(
        select(AlertRule).where(
            AlertRule.id == rule_id, AlertRule.user_id == user_id, AlertRule.deleted.is_(False)
        )
    )
    if row is None:
        raise ServiceError(404, "RULE_NOT_FOUND", "Alert rule not found")
    return row


def rule_view(row):
    return RuleView(
        **{
            key: getattr(row, key)
            for key in ["id", "station_id", "pollutant", "threshold", "cooldown_minutes", "enabled"]
        }
    )


def values(body):
    if body.channel != "in_app" or body.averaging_period_minutes != 60:
        raise ServiceError(
            409,
            "ALERT_METHOD_UNSUPPORTED",
            "Only in-app hourly observation alerts are implemented; email and forecast alerts unavailable",
        )
    return body.model_dump(exclude={"channel", "averaging_period_minutes"})


@router.get("/alert-rules", response_model=Envelope[list[RuleView]])
def rules(request: Request, db: Db, user: Owner):
    rows = db.scalars(
        select(AlertRule)
        .where(AlertRule.user_id == user.id, AlertRule.deleted.is_(False))
        .order_by(AlertRule.id)
    ).all()
    return Envelope(
        meta=metadata(request, "authenticated account"), data=[rule_view(row) for row in rows]
    )


@router.post("/alert-rules", response_model=Envelope[RuleView], status_code=201)
def create_rule(request: Request, body: RuleInput, db: Db, user: Owner):
    fields = values(body)
    station(db, body.station_id)
    row = AlertRule(id=str(uuid4()), user_id=user.id, **fields)
    db.add(row)
    db.commit()
    return Envelope(meta=metadata(request, "authenticated account"), data=rule_view(row))


@router.patch("/alert-rules/{rule_id}", response_model=Envelope[RuleView])
def update_rule(request: Request, rule_id: str, body: RuleInput, db: Db, user: Owner):
    row = owned_rule(db, user.id, rule_id)
    fields = values(body)
    station(db, body.station_id)
    for key, value in fields.items():
        setattr(row, key, value)
    db.commit()
    return Envelope(meta=metadata(request, "authenticated account"), data=rule_view(row))


@router.delete("/alert-rules/{rule_id}", status_code=204)
def delete_rule(rule_id: str, db: Db, user: Owner):
    row = owned_rule(db, user.id, rule_id)
    # Preserve event history and dedup keys; disable tombstoned rules.
    row.enabled = False
    row.deleted = True
    db.commit()
    return Response(status_code=204)


def notification_view(row):
    return NotificationView(
        id=row.id,
        rule_id=row.rule_id,
        created_at=utc(row.created_at),
        value=row.value,
        threshold=row.threshold,
        status=row.status,
        read_at=utc(row.read_at) if row.read_at else None,
    )


@router.get("/alerts", response_model=Envelope[list[NotificationView]])
def alerts(
    request: Request,
    db: Db,
    user: Owner,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    rows = db.scalars(
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .offset(offset)
        .limit(limit)
    ).all()
    return Envelope(
        meta=metadata(request, "in-app notification store"),
        data=[notification_view(row) for row in rows],
    )


@router.post("/alerts/{notification_id}/read", response_model=Envelope[NotificationView])
def read_alert(request: Request, notification_id: str, db: Db, user: Owner):
    from datetime import UTC, datetime

    row = db.scalar(
        select(Notification).where(
            Notification.id == notification_id, Notification.user_id == user.id
        )
    )
    if row is None:
        raise ServiceError(404, "ALERT_NOT_FOUND", "Notification not found")
    if row.read_at is None:
        row.read_at = datetime.now(UTC)
    db.commit()
    return Envelope(
        meta=metadata(request, "in-app notification store"), data=notification_view(row)
    )
