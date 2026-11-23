from breathewise.core.config import get_settings
from breathewise.schemas.common import ErrorDetail, ErrorResponse, Metadata
from fastapi import Request


class ServiceError(Exception):
    def __init__(self, status: int, code: str, message: str, missing=None, retryable=False):
        self.status = status
        self.detail = ErrorDetail(
            code=code, message=message, requirements_missing=missing or [], retryable=retryable
        )


def metadata(request: Request, source="breathewise") -> Metadata:
    return Metadata(
        request_id=request.state.request_id, data_mode=get_settings().data_mode, source=source
    )


def error_body(request: Request, detail: ErrorDetail):
    return ErrorResponse(meta=metadata(request), error=detail).model_dump(mode="json")
