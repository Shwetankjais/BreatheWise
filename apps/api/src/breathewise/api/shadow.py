"""Read-only experimental forecast-run status; no public inference mutation."""

from typing import Annotated

from breathewise.core.errors import metadata
from breathewise.db.session import get_db
from breathewise.schemas.common import Envelope
from breathewise.schemas.shadow import ForecastRunDetail, ForecastRunPage
from breathewise.services import shadow
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

router = APIRouter()
Db = Annotated[Session, Depends(get_db)]


@router.get("/forecast-runs", response_model=Envelope[ForecastRunPage])
def runs(
    request: Request,
    db: Db,
    station_id: str | None = Query(None, max_length=100),
    model_version: str | None = Query(None, max_length=100),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0, le=1000000),
):
    return Envelope(
        meta=metadata(request, "experimental UTC shadow run log; not public live forecasts"),
        data=shadow.list_runs(db, station_id, model_version, limit, offset),
    )


@router.get("/forecast-runs/{run_id}", response_model=Envelope[ForecastRunDetail])
def run(request: Request, db: Db, run_id: str):
    return Envelope(
        meta=metadata(request, "experimental UTC shadow baseline and exact observed outcomes"),
        data=shadow.detail(db, run_id),
    )
