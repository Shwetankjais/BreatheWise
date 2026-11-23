from breathewise.core.errors import metadata
from breathewise.db.session import engine
from breathewise.schemas.common import Envelope
from breathewise.services.capabilities import Capabilities, capabilities
from fastapi import APIRouter, Request, Response
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

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
                == "0001"
            )
    except SQLAlchemyError:
        pass
    response.status_code = 503
    return Envelope(
        meta=metadata(request),
        data=Readiness(status="partial" if db_ready else "unavailable", database=db_ready),
    )


@router.get("/capabilities", response_model=Envelope[Capabilities])
def get_capabilities(request: Request):
    return Envelope(meta=metadata(request), data=capabilities())
