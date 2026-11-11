"""Startup check: does the database match the code?

After pulling a version that changes db/schema.sql, the database must be rebuilt
(python3 scripts/reset_db.py). Without it every request touching a changed table fails
with a bare 500, which looks like an empty screen in the app. This check names the
problem once at startup, in the server log and in GET /api/v1/health.
"""

import logging

from sqlalchemy import Engine, text
from sqlalchemy.exc import SQLAlchemyError

from app.models import Base

log = logging.getLogger("mawjood")
FIX = "Rebuild the database: python3 scripts/reset_db.py (then restart the API)."


def schema_problems(engine: Engine) -> list[str]:
    """Tables or columns the models need but the database lacks (empty when they match)."""
    try:
        with engine.connect() as connection:
            rows = connection.execute(
                text(
                    "SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS "
                    "WHERE TABLE_SCHEMA = DATABASE()"
                )
            ).all()
    except SQLAlchemyError as exc:
        return [f"cannot reach the database ({exc.__class__.__name__})"]
    in_database: dict[str, set[str]] = {}
    for table, column in rows:
        in_database.setdefault(table, set()).add(column)
    problems = []
    for table in Base.metadata.sorted_tables:
        if table.name not in in_database:
            problems.append(f"table {table.name} is missing")
            continue
        problems += [
            f"column {table.name}.{c.name} is missing"
            for c in table.columns
            if c.name not in in_database[table.name]
        ]
    return problems


def check_on_startup(engine: Engine) -> list[str]:
    problems = schema_problems(engine)
    if problems:
        log.error("The database does not match this version of the code: %s. %s", "; ".join(problems), FIX)
    return problems
