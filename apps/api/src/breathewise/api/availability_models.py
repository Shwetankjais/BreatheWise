from breathewise.core.errors import metadata
from breathewise.schemas.availability_models import AvailabilityEvaluation
from breathewise.schemas.common import Envelope
from breathewise.services import availability_models
from fastapi import APIRouter, Request

router = APIRouter()


@router.get(
    "/models/{model_version}/availability-evaluation",
    response_model=Envelope[AvailabilityEvaluation],
)
def evaluation(request: Request, model_version: str, horizon_h: int | None = None):
    return Envelope(
        meta=metadata(
            request,
            "independent UTC simulated-publication-delay experiment; not observed historical availability",
        ),
        data=availability_models.evaluation(model_version, horizon_h),
    )
