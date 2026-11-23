from typing import Literal

from breathewise.schemas.common import StrictModel
from breathewise.schemas.environment import Coordinates
from pydantic import Field, field_validator


class PlaceInput(Coordinates):
    label: str = Field(min_length=1, max_length=120)

    @field_validator("label")
    @classmethod
    def meaningful(cls, value):
        if not value.strip():
            raise ValueError("Label must contain text")
        return value.strip()


class PlaceView(PlaceInput):
    id: str


class Preferences(StrictModel):
    sensitivity: Literal["general", "sensitive"] = "general"
    default_city_id: str | None = None
    display_timezone: Literal["Asia/Kolkata"] = "Asia/Kolkata"


class Identity(StrictModel):
    user_id: str
    preferences: Preferences
