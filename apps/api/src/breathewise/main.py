from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException

from breathewise.api import account, alerts, environment, observations, system
from breathewise.core.config import get_settings
from breathewise.core.errors import ServiceError, error_body
from breathewise.schemas.common import CONTRACT_VERSION, ErrorDetail, ErrorResponse


def create_app():
    app = FastAPI(
        title="BreatheWise API",
        version=CONTRACT_VERSION,
        responses={code: {"model": ErrorResponse} for code in [401, 404, 409, 422, 503]},
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[get_settings().web_origin],
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )

    @app.middleware("http")
    async def request_identity(request: Request, call_next):
        request.state.request_id = str(uuid4())
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        response.headers["X-Contract-Version"] = CONTRACT_VERSION
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.exception_handler(ServiceError)
    async def service_error(request, exc):
        return JSONResponse(status_code=exc.status, content=error_body(request, exc.detail))

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, exc):
        fields = [".".join(map(str, error["loc"])) for error in exc.errors()]
        return JSONResponse(
            status_code=422,
            content=error_body(
                request,
                ErrorDetail(
                    code="VALIDATION_ERROR", message="Invalid request fields", fields=fields
                ),
            ),
        )

    @app.exception_handler(HTTPException)
    async def http_error(request, exc):
        return JSONResponse(
            status_code=exc.status_code,
            content=error_body(request, ErrorDetail(code="HTTP_ERROR", message=str(exc.detail))),
        )

    @app.exception_handler(SQLAlchemyError)
    async def database_error(request, exc):
        return JSONResponse(
            status_code=503,
            content=error_body(
                request,
                ErrorDetail(
                    code="DATABASE_UNAVAILABLE",
                    message="Database or migrations unavailable",
                    retryable=True,
                ),
            ),
        )

    app.include_router(system.router, prefix="/api/v1")
    app.include_router(environment.router, prefix="/api/v1")
    app.include_router(observations.router, prefix="/api/v1")
    app.include_router(account.router, prefix="/api/v1")
    app.include_router(alerts.router, prefix="/api/v1")
    return app


app = create_app()
