from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError

from app.db import ensure_data_dir
from app.errors import (
    http_exception_handler,
    unhandled_exception_handler,
    validation_exception_handler,
)
from app.routes import api_router


def create_app() -> FastAPI:
    ensure_data_dir()

    app = FastAPI(title="PaRo API", version="0.1.0")
    app.include_router(api_router)

    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)

    return app


app = create_app()
