from typing import Annotated, Literal

from breathewise.core.errors import metadata
from breathewise.schemas.archive import ArchiveCatalogue, ArchiveCompare, ArchiveExplore
from breathewise.schemas.common import Envelope, Pollutant
from breathewise.services import archive as service
from fastapi import APIRouter, Query, Request
from pydantic import NaiveDatetime

router = APIRouter(prefix="/archive", tags=["Recorded-clock archive"])


def archive_metadata(request):
    meta = metadata(request, "local observed Parquet archive; recorded clock, not UTC")
    meta.quality_flags.extend(
        ["recorded_clock_timezone_unverified", "historical_publication_time_unknown"]
    )
    return meta


@router.get("/catalogue", response_model=Envelope[ArchiveCatalogue])
def catalogue(request: Request):
    return Envelope(meta=archive_metadata(request), data=service.catalogue())


@router.get("/explore", response_model=Envelope[ArchiveExplore])
def explore(
    request: Request,
    station_id: str,
    pollutant: Pollutant,
    start: NaiveDatetime,
    end: NaiveDatetime,
    aggregation: Literal["daily", "monthly"] = "daily",
    min_count: int = Query(1, ge=1, le=744),
    min_coverage: float = Query(0, ge=0, le=1),
):
    return Envelope(
        meta=archive_metadata(request),
        data=service.explore(
            station_id, pollutant, start, end, aggregation, min_count, min_coverage
        ),
    )


@router.get("/compare", response_model=Envelope[ArchiveCompare])
def compare(
    request: Request,
    station_ids: Annotated[list[str], Query(min_length=2, max_length=4)],
    pollutant: Pollutant,
    start: NaiveDatetime,
    end: NaiveDatetime,
    clock_assumption: Literal["same_recorded_clock"],
    aggregation: Literal["daily", "monthly"] = "daily",
):
    return Envelope(
        meta=archive_metadata(request),
        data=service.compare(station_ids, pollutant, start, end, aggregation, clock_assumption),
    )
