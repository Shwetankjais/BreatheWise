"""Cached multi-station observations; no request-triggered external polling."""

from typing import Annotated

from breathewise.core.errors import metadata
from breathewise.db.session import get_db
from breathewise.repositories.observations import cutoff_at
from breathewise.schemas.catalogue import ObservedRankings, StationCatalogue
from breathewise.schemas.common import Envelope, Pollutant
from breathewise.services.catalogue import observed_rankings, station_catalogue
from breathewise.services.cities import validate_city
from fastapi import APIRouter, Depends, Query, Request
from pydantic import AwareDatetime
from sqlalchemy.orm import Session

router = APIRouter()
Db = Annotated[Session, Depends(get_db)]


@router.get("/station-catalogue", response_model=Envelope[StationCatalogue])
def catalogue(
    request: Request, db: Db, city_id: str = "delhi", issue_at: AwareDatetime | None = None
):
    validate_city(city_id)
    cutoff = cutoff_at(issue_at)
    return Envelope(
        meta=metadata(request, "cached verified provider catalogue and imported observations"),
        data=station_catalogue(db, city_id, cutoff),
    )


@router.get("/observed-rankings", response_model=Envelope[ObservedRankings])
def rankings(
    request: Request,
    db: Db,
    city_id: str = "delhi",
    pollutant: Pollutant = Pollutant.pm25,
    limit: int = Query(20, ge=1, le=100),
    include_stale: bool = True,
    issue_at: AwareDatetime | None = None,
):
    validate_city(city_id)
    cutoff = cutoff_at(issue_at)
    return Envelope(
        meta=metadata(request, "latest observed concentrations; not predicted hotspots"),
        data=observed_rankings(db, city_id, pollutant, cutoff, limit, include_stale),
    )
