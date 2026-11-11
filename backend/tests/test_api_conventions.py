"""CLAUDE.md section 7: one error shape, validation, pagination, CORS, OpenAPI, model/schema sync."""

from sqlalchemy import text

from app.core import schema_check
from app.models import Base
from tests.conftest import SAAD


def assert_error(response, status: int, code: str) -> None:
    assert response.status_code == status, response.text
    body = response.json()
    assert set(body) == {"error"} and set(body["error"]) == {"code", "message"}
    assert body["error"]["code"] == code and body["error"]["message"]


def test_unknown_route_uses_the_error_shape(client):
    assert_error(client.get("/api/v1/nothing-here"), 404, "NOT_FOUND")


def test_wrong_method_uses_the_error_shape(client):
    assert_error(client.delete("/api/v1/health"), 405, "METHOD_NOT_ALLOWED")


def test_validation_errors_use_the_error_shape_and_name_the_field(client, auth):
    response = client.put("/api/v1/me/pins/abc", headers=auth(SAAD))
    assert_error(response, 422, "VALIDATION_ERROR")
    assert "professor_id" in response.json()["error"]["message"]
    response = client.get("/api/v1/professors?limit=1000", headers=auth(SAAD))
    assert_error(response, 422, "VALIDATION_ERROR")
    assert "limit" in response.json()["error"]["message"]


def test_missing_resource_is_404_with_the_error_shape(client, auth):
    assert_error(client.get("/api/v1/professors/999", headers=auth(SAAD)), 404, "NOT_FOUND")


def test_list_endpoints_are_paginated(client, auth):
    page = client.get("/api/v1/professors?limit=3&offset=3", headers=auth(SAAD)).json()
    assert (page["total"], page["limit"], page["offset"], len(page["items"])) == (8, 3, 3, 3)


def test_health_endpoint_is_public(client):
    assert client.get("/api/v1/health").json() == {"status": "ok"}


def test_openapi_docs_are_served(client):
    assert client.get("/docs").status_code == 200
    paths = client.get("/openapi.json").json()["paths"]
    assert "/api/v1/professors" in paths and "/api/v1/appointments/{appointment_id}/{action}" in paths


def test_cors_allows_the_expo_web_dev_server_only(client):
    preflight = {"Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "Authorization"}
    allowed = client.options("/api/v1/professors", headers={"Origin": "http://localhost:8081", **preflight})
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:8081"
    assert allowed.headers["access-control-allow-credentials"] == "true"
    other = client.options("/api/v1/professors", headers={"Origin": "https://evil.example", **preflight})
    assert "access-control-allow-origin" not in other.headers


def test_models_match_the_mysql_schema(db):
    """db/schema.sql is the source of truth; the ORM must map every column of every table."""
    rows = db.execute(
        text("SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()")
    ).all()
    in_database: dict[str, set[str]] = {}
    for table, column in rows:
        in_database.setdefault(table, set()).add(column)
    in_models = {table.name: {c.name for c in table.columns} for table in Base.metadata.sorted_tables}
    assert in_models == in_database


def test_connections_use_utc_and_utf8mb4(db):
    zone, charset, collation = db.execute(
        text("SELECT @@session.time_zone, @@character_set_connection, @@collation_connection")
    ).one()
    assert (zone, charset, collation) == ("+00:00", "utf8mb4", "utf8mb4_0900_ai_ci")


def test_optional_text_fields_accept_an_explicit_null(client, auth):
    """Clients send "note": null for an empty optional field; that is not a server error."""
    from tests.conftest import KHALID, LAMA, NORA

    booked = client.post(
        "/api/v1/appointments",
        json={"professor_id": NORA, "starts_at": "2026-10-11T10:15:00+03:00", "topic": None, "note": None},
        headers=auth(LAMA),
    )
    assert booked.status_code == 201, booked.text
    assert booked.json()["note"] is None
    status = client.post("/api/v1/me/status", json={"status": "busy", "note": None}, headers=auth(KHALID))
    assert status.status_code == 200, status.text
    block = client.post(
        "/api/v1/me/schedule",
        json={"day_of_week": 4, "start_time": "15:00", "end_time": "16:00", "label": None},
        headers=auth(KHALID),
    )
    assert block.status_code == 201, block.text


def test_the_startup_check_finds_no_problem_in_a_current_database(engine):
    assert schema_check.schema_problems(engine) == []


def test_health_says_when_the_database_is_older_than_the_code(client):
    client.app.state.schema_problems = ["table colleges is missing"]
    response = client.get("/api/v1/health")
    assert response.status_code == 503
    error = response.json()["error"]
    assert error["code"] == "SCHEMA_OUTDATED"
    assert "table colleges is missing" in error["message"] and "reset_db.py" in error["message"]


def test_a_missing_table_or_column_says_the_database_is_outdated(client):
    """A database built before a schema change answers with how to fix it, not a bare 500."""
    import pymysql
    from sqlalchemy.exc import ProgrammingError

    for number, text_ in ((1146, "Table 'mawjood.colleges' doesn't exist"), (1054, "Unknown column")):

        def outdated(number=number, text_=text_):
            raise ProgrammingError("SELECT ...", {}, pymysql.err.ProgrammingError(number, text_))

        client.app.add_api_route(f"/outdated-{number}", outdated)
        response = client.get(f"/outdated-{number}")
        assert response.status_code == 503
        error = response.json()["error"]
        assert error["code"] == "SCHEMA_OUTDATED" and "reset_db.py" in error["message"]
