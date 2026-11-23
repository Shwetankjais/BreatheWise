from typing import Annotated
from uuid import uuid4

from breathewise.core.auth import current_user
from breathewise.core.errors import metadata
from breathewise.db.models import SavedPlace, User
from breathewise.db.session import get_db
from breathewise.repositories.places import owned_place, view
from breathewise.schemas.account import Identity, PlaceInput, PlaceView, Preferences
from breathewise.schemas.common import Envelope
from breathewise.services.cities import validate_city
from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

router = APIRouter()
Db = Annotated[Session, Depends(get_db)]
Owner = Annotated[User, Depends(current_user)]


@router.get("/me", response_model=Envelope[Identity])
def me(request: Request, user: Owner):
    return Envelope(
        meta=metadata(request, "authenticated account"),
        data=Identity(user_id=user.id, preferences=Preferences(**user.preferences)),
    )


@router.get("/preferences", response_model=Envelope[Preferences])
def preferences(request: Request, user: Owner):
    return Envelope(
        meta=metadata(request, "authenticated account"), data=Preferences(**user.preferences)
    )


@router.patch("/preferences", response_model=Envelope[Preferences])
def update_preferences(request: Request, body: Preferences, db: Db, user: Owner):
    merged = Preferences(**(user.preferences | body.model_dump(exclude_unset=True)))
    if merged.default_city_id:
        validate_city(merged.default_city_id)
    user.preferences = merged.model_dump()
    db.commit()
    return Envelope(meta=metadata(request, "authenticated account"), data=merged)


@router.get("/saved-places", response_model=Envelope[list[PlaceView]])
def places(request: Request, db: Db, user: Owner):
    rows = db.scalars(
        select(SavedPlace).where(SavedPlace.user_id == user.id).order_by(SavedPlace.id)
    ).all()
    return Envelope(
        meta=metadata(request, "authenticated account"),
        data=[PlaceView(**view(row)) for row in rows],
    )


@router.post("/saved-places", response_model=Envelope[PlaceView], status_code=201)
def create_place(request: Request, body: PlaceInput, db: Db, user: Owner):
    row = SavedPlace(id=str(uuid4()), user_id=user.id, **body.model_dump())
    db.add(row)
    db.commit()
    return Envelope(meta=metadata(request, "authenticated account"), data=PlaceView(**view(row)))


@router.patch("/saved-places/{place_id}", response_model=Envelope[PlaceView])
def update_place(request: Request, place_id: str, body: PlaceInput, db: Db, user: Owner):
    row = owned_place(db, user.id, place_id)
    for key, value in body.model_dump().items():
        setattr(row, key, value)
    db.commit()
    return Envelope(meta=metadata(request, "authenticated account"), data=PlaceView(**view(row)))


@router.delete("/saved-places/{place_id}", status_code=204)
def delete_place(place_id: str, db: Db, user: Owner):
    db.delete(owned_place(db, user.id, place_id))
    db.commit()
    return Response(status_code=204)
