"""One error shape for every failure: {"error": {"code": str, "message": str}}."""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import DBAPIError
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("mawjood")


class AppError(Exception):
    def __init__(self, status: int, code: str, message: str, headers: dict[str, str] | None = None):
        super().__init__(message)
        self.status, self.code, self.message, self.headers = status, code, message, headers


def not_found(what: str) -> AppError:
    return AppError(404, "NOT_FOUND", f"{what} was not found.")


def forbidden(message: str = "You do not have permission to do this.") -> AppError:
    return AppError(403, "FORBIDDEN", message)


def error_body(code: str, message: str) -> dict:
    return {"error": {"code": code, "message": message}}


# MySQL error numbers that reach the API when the database rejects a write.
# The services check these rules first; this mapping is the backstop.
MYSQL_ERRORS = {
    1062: (409, "CONFLICT", "This record already exists."),
    1451: (409, "IN_USE", "This record is still referenced by other records."),
    1452: (422, "INVALID_REFERENCE", "A referenced record does not exist."),
    3819: (422, "CONSTRAINT_VIOLATION", "The data breaks a database rule."),
    1644: (409, "SLOT_TAKEN", "This time overlaps another appointment."),
}

HTTP_CODES = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    409: "CONFLICT",
    429: "RATE_LIMITED",
}


def mysql_error_number(exc: DBAPIError) -> int | None:
    args = getattr(exc.orig, "args", ())
    return args[0] if args and isinstance(args[0], int) else None


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(error_body(exc.code, exc.message), exc.status, headers=exc.headers)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        first = exc.errors()[0] if exc.errors() else {}
        where = ".".join(str(part) for part in first.get("loc", ()) if part != "body")
        message = (
            f"{where}: {first.get('msg', 'invalid value')}" if where else first.get("msg", "Invalid input.")
        )
        return JSONResponse(error_body("VALIDATION_ERROR", message), 422)

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = HTTP_CODES.get(exc.status_code, "HTTP_ERROR")
        return JSONResponse(error_body(code, str(exc.detail)), exc.status_code, headers=exc.headers)

    @app.exception_handler(DBAPIError)
    async def database_error(_: Request, exc: DBAPIError) -> JSONResponse:
        number = mysql_error_number(exc)
        if number in MYSQL_ERRORS:
            status, code, message = MYSQL_ERRORS[number]
            return JSONResponse(error_body(code, message), status)
        log.exception("Unhandled database error %s", number)
        return JSONResponse(error_body("INTERNAL_ERROR", "Something went wrong on the server."), 500)

    @app.exception_handler(Exception)
    async def unexpected(_: Request, exc: Exception) -> JSONResponse:
        log.exception("Unhandled error")
        return JSONResponse(error_body("INTERNAL_ERROR", "Something went wrong on the server."), 500)
