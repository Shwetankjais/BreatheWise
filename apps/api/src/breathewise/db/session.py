from functools import lru_cache

from breathewise.core.config import get_settings
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

LATEST_SCHEMA_REVISION = "0004"


@lru_cache
def engine():
    url = get_settings().database_url
    args = {"check_same_thread": False} if url.startswith("sqlite") else {"connect_timeout": 3}
    return create_engine(url, connect_args=args, pool_pre_ping=True)


def get_db():
    with Session(engine()) as session:
        yield session
