from datetime import UTC, datetime

from breathewise.core.config import get_settings
from breathewise.core.errors import metadata
from breathewise.core.time import utc
from breathewise.db.models import IngestionRun
from breathewise.db.session import engine
from breathewise.schemas.common import Envelope
from breathewise.services.capabilities import Capabilities, capabilities
from fastapi import APIRouter, Request, Response
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

router = APIRouter()


class Health(BaseModel):
    status: str


class Readiness(BaseModel):
    status: str
    database: bool
    model: bool = False
    providers: bool = False


@router.get("/health", response_model=Envelope[Health])
def health(request: Request):
    return Envelope(meta=metadata(request), data=Health(status="ok"))


@router.get("/ready", response_model=Envelope[Readiness])
def ready(request: Request, response: Response):
    db_ready = False
    try:
        with engine().connect() as connection:
            db_ready = (
                connection.execute(text("select version_num from alembic_version")).scalar()
                == "0003"
            )
    except SQLAlchemyError:
        pass
    provider_ready = False
    if db_ready:
        try:
            with Session(engine()) as db:
                last = db.scalar(
                    select(IngestionRun)
                    .where(
                        IngestionRun.provider == "openaq",
                        IngestionRun.data_mode == get_settings().data_mode,
                    )
                    .order_by(IngestionRun.started_at.desc())
                    .limit(1)
                )
                provider_ready = bool(
                    last
                    and last.status in {"success", "partial"}
                    and last.details.get("actual_provider_fetch")
                    and last.finished_at
                    and 0 <= (datetime.now(UTC) - utc(last.finished_at)).total_seconds() <= 900
                )
        except SQLAlchemyError:
            pass
    response.status_code = 503
    return Envelope(
        meta=metadata(request),
        data=Readiness(
            status="partial" if db_ready else "unavailable",
            database=db_ready,
            providers=provider_ready,
        ),
    )


@router.get("/capabilities", response_model=Envelope[Capabilities])
def get_capabilities(request: Request):
    return Envelope(meta=metadata(request), data=capabilities())
