from datetime import UTC, datetime
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

CONTRACT_VERSION = "1.0.0"


class Pollutant(StrEnum):
    pm25 = "pm25"
    pm10 = "pm10"
    no2 = "no2"
    so2 = "so2"
    o3 = "o3"
    co = "co"


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class Metadata(BaseModel):
    request_id: str
    generated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    data_mode: Literal["live", "historical_replay", "demo"]
    source: str
    quality_flags: list[str] = Field(default_factory=list)
    contract_version: str = CONTRACT_VERSION
    replay_issue_at: datetime | None = None


class Envelope[T](BaseModel):
    meta: Metadata
    data: T


class ErrorDetail(BaseModel):
    code: str
    message: str
    retryable: bool = False
    requirements_missing: list[str] = Field(default_factory=list)
    fields: list[str] = Field(default_factory=list)


class ErrorResponse(BaseModel):
    meta: Metadata
    error: ErrorDetail
