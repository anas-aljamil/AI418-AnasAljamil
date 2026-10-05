"""Rebuild the MySQL development database from db/schema.sql and db/seed.sql.

Usage:
    python3 scripts/reset_db.py              # fresh database, seed dates as written
    python3 scripts/reset_db.py --rebase     # shift seed dates to the current week
    python3 scripts/reset_db.py --db NAME    # build a database with another name

Reads DB_* settings from .env (see .env.example) and needs the mysql client.
The database is dropped and recreated with utf8mb4 / utf8mb4_0900_ai_ci.
"""

from __future__ import annotations

import argparse
import sys
from datetime import date, datetime
from zoneinfo import ZoneInfo

from mysql_cli import ROOT, Config, MySQLError, check_identifier, load_config, run

DB_DIR = ROOT / "db"
SQL_FILES = (DB_DIR / "schema.sql", DB_DIR / "seed.sql")

RIYADH = ZoneInfo("Asia/Riyadh")
# The Sunday that starts the seed's "current" week (see the header of seed.sql).
SEED_ANCHOR_SUNDAY = date(2026, 10, 4)


def weeks_to_current(today: date | None = None) -> int:
    """Whole weeks between the seed anchor week and the current Riyadh week."""
    today = today or datetime.now(RIYADH).date()
    days_since_sunday = (today.weekday() + 1) % 7  # Python: Monday = 0
    current_sunday = date.fromordinal(today.toordinal() - days_since_sunday)
    return (current_sunday - SEED_ANCHOR_SUNDAY).days // 7


def create_database(config: Config, name: str) -> None:
    name = check_identifier(name)
    run(f"DROP DATABASE IF EXISTS `{name}`; "
        f"CREATE DATABASE `{name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;", config)


def load_files(config: Config, name: str) -> list[str]:
    """Load schema and seed; return any warnings MySQL reported.

    Notes (level "Note", e.g. 1051 from DROP TABLE IF EXISTS on an empty
    database) are informational and not returned.
    """
    warnings = []
    for sql_file in SQL_FILES:
        output = run(sql_file.read_text(encoding="utf-8"), config, name, show_warnings=True)
        warnings += [f"{sql_file.name}: {' '.join(row)}" for row in output
                     if row and row[0].startswith(("Warning", "Error"))]
    return warnings


def timestamp_columns(config: Config, name: str) -> dict[str, list[str]]:
    """Every stored DATETIME column per table (generated columns excluded)."""
    rows = run(
        "SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS "
        f"WHERE TABLE_SCHEMA = '{check_identifier(name)}' AND DATA_TYPE = 'datetime' "
        "AND EXTRA NOT LIKE '%GENERATED%' ORDER BY TABLE_NAME, ORDINAL_POSITION", config)
    columns: dict[str, list[str]] = {}
    for table, column in rows:
        columns.setdefault(table, []).append(column)
    return columns


def rebase(config: Config, name: str, weeks: int) -> None:
    """Shift every timestamp by whole weeks, keeping weekdays and times.

    All timestamp columns of a table move in one UPDATE so row-level CHECKs
    such as expires_at > created_at hold throughout. Appointments are visited
    latest-first when moving forward (earliest-first when moving back), so a
    moved row can never land on a row that has not moved yet: the unique
    active-slot index and the overlap trigger never see a false collision.
    """
    if weeks == 0:
        return
    days = weeks * 7
    statements = []
    for table, cols in timestamp_columns(config, name).items():
        assignments = ", ".join(f"{col} = {col} + INTERVAL {days} DAY" for col in cols)
        order = f" ORDER BY starts_at {'DESC' if days > 0 else 'ASC'}" if table == "appointments" else ""
        statements.append(f"UPDATE {table} SET {assignments}{order};")
    run("\n".join(statements), config, name)


def build(config: Config, name: str, rebase_weeks: int = 0) -> list[str]:
    """Create, load and optionally rebase a database. Returns load warnings."""
    create_database(config, name)
    warnings = load_files(config, name)
    rebase(config, name, rebase_weeks)
    return warnings


def row_counts(config: Config, name: str) -> dict[str, int]:
    tables = [row[0] for row in run(
        "SELECT TABLE_NAME FROM information_schema.TABLES "
        f"WHERE TABLE_SCHEMA = '{check_identifier(name)}' AND TABLE_TYPE = 'BASE TABLE' "
        "ORDER BY TABLE_NAME", config)]
    query = " UNION ALL ".join(f"SELECT '{t}', COUNT(*) FROM {t}" for t in tables)
    return {t: int(n) for t, n in run(query, config, name)} if tables else {}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--db", help="database name (default: DB_NAME from .env)")
    parser.add_argument("--rebase", action="store_true",
                        help="shift seed timestamps so the seed week is the current week")
    args = parser.parse_args()

    config = load_config()
    name = check_identifier(args.db or config.database)
    weeks = weeks_to_current() if args.rebase else 0
    try:
        warnings = build(config, name, weeks)
        counts = row_counts(config, name)
    except MySQLError as exc:
        print(f"FAILED: {exc}")
        return 1

    print(f"Database: {name} on {config.host}:{config.port} (utf8mb4_0900_ai_ci)")
    if args.rebase:
        print(f"Rebased seed timestamps by {weeks:+d} week(s).")
    for table, count in counts.items():
        print(f"  {table:<18} {count:>3} rows")
    if warnings:
        print("Loaded with warnings:")
        for warning in warnings:
            print(f"  {warning}")
        return 1
    print("Loaded schema.sql and seed.sql with no errors and no warnings.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
