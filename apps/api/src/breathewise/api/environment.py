from typing import Annotated, Literal

from breathewise.core.errors import ServiceError, metadata
from breathewise.schemas.common import Envelope, Pollutant
from breathewise.schemas.environment import (
    ActivityRequest,
    City,
    Forecast,
    RouteRequest,
    WeatherRequest,
)
from breathewise.schemas.models import ModelEvaluation
from breathewise.services.advisories import Advisory, advisory
from breathewise.services.capabilities import MODEL_MISSING
from breathewise.services.cities import cities, validate_city
from fastapi import APIRouter, Query, Request

router = APIRouter()


@router.get("/cities", response_model=Envelope[list[City]])
def get_cities(request: Request):
    from breathewise.services.availability import availability

    _, _, counts = availability()
    data = cities()
    for city in data:
        city.observed_station_count = counts.get(city.id, 0)
        if city.observed_station_count:
            city.availability = "imported_observations_model_eligibility_unverified"
    return Envelope(
        meta=metadata(
            request,
            "requested city scope; imported observation counts; model eligibility unaudited",
        ),
        data=data,
    )


@router.get("/stations/{station_id}/forecast", response_model=Envelope[Forecast])
def forecast(
    station_id: str,
    pollutant: Pollutant = Pollutant.pm25,
    horizons: Annotated[list[int] | None, Query()] = None,
    model_version: str | None = None,
):
    if horizons is not None and (not horizons or any(h not in [1, 3, 6, 12, 24] for h in horizons)):
        raise ServiceError(
            409,
            "UNSUPPORTED_HORIZON",
            "Only declared horizons 1,3,6,12,24 may be requested; none are runtime verified yet",
        )
    if pollutant != Pollutant.pm25:
        raise ServiceError(
            409, "UNSUPPORTED_POLLUTANT", "Artifact has no verified support for this pollutant"
        )
    if model_version is not None:
        from breathewise.services.models import NATIVE_VERSION, experiment_manifest

        if model_version != NATIVE_VERSION:
            experiment_manifest(model_version)
            raise ServiceError(
                409,
                "MODEL_RETROSPECTIVE_ONLY",
                "Selected model is recorded-clock retrospective only; live input/time compatibility is unverified",
            )
    raise ServiceError(
        503,
        "MODEL_UNAVAILABLE",
        "Preprocessing and golden predictions are not verified",
        MODEL_MISSING,
    )


@router.get("/hotspots")
def hotspots(
    city_id: str,
    horizon_h: Literal[1, 3, 6, 24],
    pollutant: Pollutant = Pollutant.pm25,
    threshold: float = Query(ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    validate_city(city_id)
    raise ServiceError(
        503,
        "MODEL_UNAVAILABLE",
        "No verified forecasts for monitored-location ranking",
        MODEL_MISSING,
    )


@router.get("/coverage")
def coverage(city_id: str, population_epoch: int = Query(2020, ge=1980, le=2030)):
    validate_city(city_id)
    raise ServiceError(
        409,
        "COVERAGE_UNAVAILABLE",
        "Population extent and epoch have not been audited",
        ["complete population raster and extraction provenance"],
    )


@router.post("/activity-plan")
def activity_plan(body: ActivityRequest):
    raise ServiceError(
        409,
        "TRAJECTORY_UNAVAILABLE",
        "Duration-integrated planning needs a validated complete trajectory; five sampled horizons are insufficient",
        ["validated hourly forecast trajectory"],
    )


@router.post("/routes/compare")
def routes(body: RouteRequest):
    raise ServiceError(
        409,
        "ROUTE_COMPARISON_UNAVAILABLE",
        "Routing and spatial pollution estimation are not configured",
        ["routing endpoint", "validated spatial estimator"],
    )


@router.post("/scenarios/weather")
def weather(body: WeatherRequest):
    raise ServiceError(
        409,
        "SCENARIO_UNAVAILABLE",
        "Dependent feature recomputation and parity not verified",
        MODEL_MISSING,
    )


@router.get("/model-performance", response_model=Envelope[ModelEvaluation])
def performance(
    request: Request,
    model_version: str | None = None,
    city_id: str | None = None,
    horizon_h: Literal[1, 3, 6, 12, 24] | None = None,
):
    if model_version:
        from breathewise.api.models import recorded_meta
        from breathewise.services.models import evaluation

        report = evaluation(model_version, horizon_h)
        if city_id not in {None, "delhi"}:
            raise ServiceError(
                409,
                "EVALUATION_SCOPE_UNSUPPORTED",
                "This experiment covers the single Delhi archive source only",
            )
        return Envelope(meta=recorded_meta(request), data=report)
    raise ServiceError(
        503,
        "EVALUATION_UNAVAILABLE",
        "No actual held-out predictions, splits or baseline results supplied",
        ["evaluation predictions and chronological split dates"],
    )


@router.get("/advisories", response_model=Envelope[list[Advisory]])
def advisories(request: Request, pollutant: Pollutant):
    return Envelope(
        meta=metadata(request, "WHO educational facts; engineering source review"),
        data=[advisory(pollutant)],
    )
