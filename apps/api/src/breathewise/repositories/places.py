from breathewise.core.errors import ServiceError
from breathewise.db.models import SavedPlace
from sqlalchemy import select


def owned_place(db, user_id, place_id):
    row = db.scalar(
        select(SavedPlace).where(SavedPlace.id == place_id, SavedPlace.user_id == user_id)
    )
    if row is None:
        raise ServiceError(404, "PLACE_NOT_FOUND", "Saved place not found")
    return row


def view(row):
    return {key: getattr(row, key) for key in ["id", "label", "latitude", "longitude"]}
