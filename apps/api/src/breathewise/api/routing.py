from breathewise.core.errors import metadata
from breathewise.schemas.common import Envelope
from breathewise.schemas.routing import GeometryRequest, GeometryResponse
from breathewise.services.routing import geometry
from fastapi import APIRouter, Request

router = APIRouter()


@router.post("/routes/geometry", response_model=Envelope[GeometryResponse])
def route_geometry(request: Request, body: GeometryRequest):
    return Envelope(
        meta=metadata(request, "OSRM road-network geometry; exposure unavailable"),
        data=geometry(body),
    )
