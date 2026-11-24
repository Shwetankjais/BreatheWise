"""Cheap dependency probes expose actual imported scope without synthetic fallback."""

from breathewise.core.config import get_settings
from breathewise.db.models import Observation, Station
from breathewise.db.session import LATEST_SCHEMA_REVISION, engine
from sqlalchemy import func, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session


def availability():
    try:
        with Session(engine()) as db:
            migrated = (
                db.execute(text("select version_num from alembic_version")).scalar()
                == LATEST_SCHEMA_REVISION
            )
            if not migrated:
                return False, 0, {}
            city_counts = dict(
                db.execute(
                    select(Station.city_id, func.count())
                    .where(Station.data_mode == get_settings().data_mode)
                    .group_by(Station.city_id)
                ).all()
            )
            count = db.scalar(
                select(func.count())
                .select_from(Observation)
                .join(Station)
                .where(Station.data_mode == get_settings().data_mode)
            )
            return True, count, city_counts
    except SQLAlchemyError:
        return False, 0, {}
