from datetime import UTC, datetime

from breathewise.core.config import get_settings
from breathewise.core.errors import ServiceError
from breathewise.core.time import utc
from breathewise.db.models import Observation, Station
from breathewise.schemas.environment import Measurement, StationView
from sqlalchemy import select
from sqlalchemy.orm import Session


def station_view(row):
    return StationView(
        **{
            key: getattr(row, key)
            for key in ["id", "name", "city_id", "latitude", "longitude", "source", "data_mode"]
        }
    )


def station(db: Session, station_id: str) -> Station:
    row = db.get(Station, station_id)
    if row is None or row.data_mode != get_settings().data_mode:
        raise ServiceError(404, "STATION_NOT_FOUND", "Station is not in the configured data mode")
    return row


def observations(db, station_id, pollutant, cutoff):
    return (
        select(Observation)
        .where(
            Observation.station_id == station_id,
            Observation.pollutant == pollutant,
            Observation.measured_at <= cutoff,
            Observation.available_at <= cutoff,
        )
        .order_by(Observation.measured_at)
    )


def measurement(row, cutoff):
    age = max(0, (utc(cutoff) - utc(row.measured_at)).total_seconds() / 60)
    return Measurement(
        station_id=row.station_id,
        pollutant=row.pollutant,
        measured_at=utc(row.measured_at),
        available_at=utc(row.available_at),
        value=row.value,
        unit=row.unit,
        original_value=row.original_value,
        original_unit=row.original_unit,
        source=row.source,
        quality_flags=row.quality_flags,
        observation_age_minutes=age,
        stale=age > 120,
    )


def latest(db, station_id, pollutant, cutoff):
    station(db, station_id)
    row = db.scalar(
        observations(db, station_id, pollutant, cutoff)
        .order_by(None)
        .order_by(Observation.measured_at.desc())
        .limit(1)
    )
    if not row:
        raise ServiceError(
            503,
            "OBSERVATIONS_UNAVAILABLE",
            "No observations known at cutoff for this pollutant/station",
            ["audited observations"],
        )
    return measurement(row, cutoff)


def cutoff_at(issue_at):
    mode = get_settings().data_mode
    if mode == "historical_replay" and issue_at is None:
        raise ServiceError(422, "REPLAY_TIME_REQUIRED", "Historical replay needs explicit issue_at")
    now = datetime.now(UTC)
    cutoff = utc(issue_at) if issue_at is not None else now
    if cutoff > now:
        raise ServiceError(422, "FUTURE_CUTOFF", "Observational cutoff cannot be in the future")
    return cutoff
