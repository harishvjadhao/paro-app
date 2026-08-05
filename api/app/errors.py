from fastapi import HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


def error_response(status_code: int, code: str, message: str, detail: object | None = None) -> JSONResponse:
    payload: dict[str, object] = {"error": {"code": code, "message": message}}
    if detail is not None:
        payload["error"]["detail"] = detail
    return JSONResponse(status_code=status_code, content=payload)


async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    code = "http_error"
    message = str(exc.detail) if exc.detail else "Request failed"
    return error_response(exc.status_code, code, message)


async def validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    return error_response(422, "validation_error", "Validation failed", exc.errors())


async def unhandled_exception_handler(_: Request, exc: Exception) -> JSONResponse:
    return error_response(500, "internal_error", "Internal server error", str(exc))
