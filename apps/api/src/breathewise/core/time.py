from datetime import UTC, datetime


def utc(value: datetime) -> datetime:
    # SQLite loses timezone information; all persisted times are normalized UTC.
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)
