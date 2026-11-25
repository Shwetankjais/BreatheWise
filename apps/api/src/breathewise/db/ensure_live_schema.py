"""Keep hosted live rows separate from existing demo rows in one PostgreSQL instance."""

from breathewise.core.config import get_settings
from sqlalchemy import create_engine, text

LIVE_SCHEMA = "breathewise_live"


def main():
    url = get_settings().database_url
    if not url.startswith("postgresql"):
        return
    database = create_engine(url)
    try:
        with database.begin() as connection:
            connection.execute(text(f"CREATE SCHEMA IF NOT EXISTS {LIVE_SCHEMA}"))
    finally:
        database.dispose()


if __name__ == "__main__":
    main()
