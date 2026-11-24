from datetime import datetime
from typing import Literal

from breathewise.core.errors import metadata
from breathewise.schemas.common import Envelope
from breathewise.schemas.models import ModelCatalogue, ModelEvaluation, PredictionPage
from breathewise.schemas.utc_models import UtcModelEvaluation, UtcPredictionPage
from breathewise.services import models, utc_models
from fastapi import APIRouter, Query, Request

router = APIRouter()


def recorded_meta(request):
    meta = metadata(
        request, "independent retrospective experiment; recorded clock, publication unknown"
    )
    meta.quality_flags.extend(["recorded_clock_timezone_unverified", "retrospective_only"])
    return meta


@router.get("/models", response_model=Envelope[ModelCatalogue])
def catalogue(request: Request):
    return Envelope(
        meta=metadata(request, "local versioned model registry"), data=models.catalogue()
    )


@router.get("/models/{model_version}/evaluation", response_model=Envelope[ModelEvaluation])
def evaluation(request: Request, model_version: str, horizon_h: int | None = None):
    return Envelope(meta=recorded_meta(request), data=models.evaluation(model_version, horizon_h))


@router.get("/models/{model_version}/predictions", response_model=Envelope[PredictionPage])
def predictions(
    request: Request,
    model_version: str,
    horizon_h: int,
    split: Literal["test", "validation", "rolling_2022", "rolling_2023"] = "test",
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0, le=1000000),
    target_start: datetime | None = None,
    target_end: datetime | None = None,
    issue_time_purged: bool = False,
):
    return Envelope(
        meta=recorded_meta(request),
        data=models.predictions(
            model_version,
            horizon_h,
            split,
            limit,
            offset,
            target_start,
            target_end,
            issue_time_purged,
        ),
    )


@router.get("/models/{model_version}/utc-evaluation", response_model=Envelope[UtcModelEvaluation])
def utc_evaluation(request: Request, model_version: str, horizon_h: int | None = None):
    return Envelope(
        meta=metadata(
            request, "UTC-native retrospective provider experiment; historical publication unknown"
        ),
        data=utc_models.evaluation(model_version, horizon_h),
    )


@router.get("/models/{model_version}/utc-predictions", response_model=Envelope[UtcPredictionPage])
def utc_predictions(
    request: Request,
    model_version: str,
    horizon_h: int,
    split: str = "test",
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0, le=1000000),
    target_start: datetime | None = None,
    target_end: datetime | None = None,
    issue_time_purged: bool = False,
):
    return Envelope(
        meta=metadata(request, "UTC-native retrospective heldout predictions; not live forecasts"),
        data=utc_models.predictions(
            model_version,
            horizon_h,
            split,
            limit,
            offset,
            target_start,
            target_end,
            issue_time_purged,
        ),
    )
