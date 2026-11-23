from datetime import UTC
from typing import Annotated

from breathewise.core.config import get_settings
from breathewise.core.errors import ServiceError, metadata
from breathewise.db.models import Observation, Station
from breathewise.db.session import get_db
from breathewise.repositories import observations as repo
from breathewise.schemas.common import Envelope, Pollutant
from breathewise.schemas.environment import Measurement, StationView
from breathewise.schemas.history import History, HistoryPoint
from breathewise.services.cities import validate_city
from fastapi import APIRouter, Depends, Query, Request
from pydantic import AwareDatetime
from sqlalchemy import select
from sqlalchemy.orm import Session

router = APIRouter()
Db = Annotated[Session, Depends(get_db)]


def data_meta(request, cutoff=None):
    meta = metadata(request, "audited canonical import")
    if meta.data_mode == "historical_replay":
        meta.replay_issue_at = cutoff
    if meta.data_mode == "demo":
        meta.quality_flags.append("synthetic_demo")
    return meta


@router.get("/stations", response_model=Envelope[list[StationView]])
def stations(
    request: Request,
    db: Db,
    city_id: str,
    pollutant: Pollutant | None = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    bbox: str | None = None,
):
    validate_city(city_id)
    query = select(Station).where(
        Station.city_id == city_id, Station.data_mode == get_settings().data_mode
    )
    if pollutant:
        query = query.where(
            Station.id.in_(select(Observation.station_id).where(Observation.pollutant == pollutant))
        )
    if bbox:
        try:
            west, south, east, north = map(float, bbox.split(","))
            if not (-180 <= west <= east <= 180 and -90 <= south <= north <= 90):
                raise ValueError()
        except ValueError:
            raise ServiceError(
                422, "INVALID_BBOX", "bbox must be west,south,east,north in WGS84"
            ) from None
        query = query.where(
            Station.longitude.between(west, east), Station.latitude.between(south, north)
        )
    rows = db.scalars(query.order_by(Station.id).offset(offset).limit(limit)).all()
    meta = data_meta(request)
    if not rows:
        meta.quality_flags.append("no_audited_stations_for_filter")
    return Envelope(meta=meta, data=[repo.station_view(row) for row in rows])


@router.get("/stations/{station_id}", response_model=Envelope[StationView])
def station(request: Request, db: Db, station_id: str):
    return Envelope(meta=data_meta(request), data=repo.station_view(repo.station(db, station_id)))


@router.get("/stations/{station_id}/latest", response_model=Envelope[Measurement])
def latest(
    request: Request,
    db: Db,
    station_id: str,
    pollutant: Pollutant = Pollutant.pm25,
    issue_at: AwareDatetime | None = None,
):
    cutoff = repo.cutoff_at(issue_at)
    data = repo.latest(db, station_id, pollutant, cutoff)
    meta = data_meta(request, cutoff)
    if data.stale:
        meta.quality_flags.append("stale_observation")
    return Envelope(meta=meta, data=data)


@router.get("/history", response_model=Envelope[History])
def history(
    request: Request,
    db: Db,
    station_id: str,
    start: AwareDatetime,
    end: AwareDatetime,
    pollutant: Pollutant = Pollutant.pm25,
    aggregation: str = "hourly",
    issue_at: AwareDatetime | None = None,
):
    cutoff = repo.cutoff_at(issue_at)
    start, end = start.astimezone(UTC), end.astimezone(UTC)
    if start >= end or (end - start).total_seconds() > 31 * 86400:
        raise ServiceError(
            422, "INVALID_HISTORY_RANGE", "Use a positive interval of at most 31 days"
        )
    if aggregation != "hourly":
        raise ServiceError(
            409, "UNSUPPORTED_AGGREGATION", "Only source hourly values are supported"
        )
    if (
        any(t.minute not in {0, 30} or t.second or t.microsecond for t in [start, end])
        or (end - start).total_seconds() % 3600
    ):
        raise ServiceError(
            422,
            "UNALIGNED_RANGE",
            "History bounds must preserve a single UTC hourly phase (00 or 30 minutes)",
        )
    repo.station(db, station_id)
    rows = db.scalars(
        repo.observations(db, station_id, pollutant, cutoff).where(
            Observation.measured_at >= start, Observation.measured_at < end
        )
    ).all()
    if not rows:
        raise ServiceError(
            503, "HISTORY_UNAVAILABLE", "No observations in this range known at cutoff"
        )
    points = [
        HistoryPoint(measured_at=repo.utc(row.measured_at), value=row.value, source=row.source)
        for row in rows
    ]
    expected = int((end - start).total_seconds() / 3600)
    return Envelope(
        meta=data_meta(request, cutoff),
        data=History(
            station_id=station_id,
            pollutant=pollutant,
            start=start,
            end=end,
            input_cutoff_at=cutoff,
            valid_count=len(rows),
            missing_count=expected - len(rows),
            expected_count=expected,
            points=points,
        ),
    )
