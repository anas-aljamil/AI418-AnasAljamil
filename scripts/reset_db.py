"""Rebuild the development SQLite database from db/schema.sql and db/seed.sql.

Usage:
    python3 scripts/reset_db.py              # fresh db/mawjood.db, seed dates as written
    python3 scripts/reset_db.py --rebase     # shift seed dates to the current week
    python3 scripts/reset_db.py --db PATH    # build somewhere else

Standard library only. Load order: schema.sql -> dialect/sqlite.sql -> seed.sql.
"""

from __future__ import annotations

import argparse
import sqlite3
import sys
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
DB_DIR = ROOT / "db"
DEFAULT_DB_PATH = DB_DIR / "mawjood.db"
SQL_FILES = (
    DB_DIR / "schema.sql",
    DB_DIR / "dialect" / "sqlite.sql",
    DB_DIR / "seed.sql",
)

RIYADH = ZoneInfo("Asia/Riyadh")
# The Sunday that starts the seed's "current" week (see the header of seed.sql).
SEED_ANCHOR_SUNDAY = date(2026, 10, 4)


def connect(path: str | Path) -> sqlite3.Connection:
    conn = sqlite3.connect(path)
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def load_sql(conn: sqlite3.Connection) -> None:
    for sql_file in SQL_FILES:
        conn.executescript(sql_file.read_text(encoding="utf-8"))


def weeks_to_current(today: date | None = None) -> int:
    """Whole weeks between the seed anchor week and the current Riyadh week."""
    today = today or datetime.now(RIYADH).date()
    days_since_sunday = (today.weekday() + 1) % 7  # Python: Monday = 0
    current_sunday = date.fromordinal(today.toordinal() - days_since_sunday)
    return (current_sunday - SEED_ANCHOR_SUNDAY).days // 7


def timestamp_columns(conn: sqlite3.Connection) -> dict[str, list[str]]:
    """Every TIMESTAMP column per table, read from the live schema."""
    tables = [row[0] for row in conn.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")]
    columns: dict[str, list[str]] = {}
    for table in tables:
        cols = [row[1] for row in conn.execute(f"PRAGMA table_info({table})")
                if row[2].upper() == "TIMESTAMP"]
        if cols:
            columns[table] = cols
    return columns


def rebase(conn: sqlite3.Connection, weeks: int) -> None:
    """Shift every timestamp by whole weeks, keeping weekdays and times.

    All timestamp columns of a table move in one UPDATE so row-level CHECKs
    such as expires_at > created_at hold throughout. Active appointments in the
    seed never share professor + weekday + time across weeks, so the shift
    cannot collide with the double-booking index or trigger.
    """
    if weeks == 0:
        return
    modifier = f"{weeks * 7:+d} days"
    for table, cols in timestamp_columns(conn).items():
        assignments = ", ".join(f"{col} = datetime({col}, :shift)" for col in cols)
        conn.execute(f"UPDATE {table} SET {assignments}", {"shift": modifier})
    conn.commit()


def build(conn: sqlite3.Connection, rebase_weeks: int = 0) -> None:
    load_sql(conn)
    rebase(conn, rebase_weeks)


def health_report(conn: sqlite3.Connection) -> list[str]:
    """Return a list of problems (empty when the database is healthy)."""
    problems = []
    integrity = conn.execute("PRAGMA integrity_check").fetchone()[0]
    if integrity != "ok":
        problems.append(f"integrity_check: {integrity}")
    for row in conn.execute("PRAGMA foreign_key_check"):
        problems.append(f"foreign_key_check: {row}")
    return problems


def row_counts(conn: sqlite3.Connection) -> dict[str, int]:
    tables = [row[0] for row in conn.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' "
        "ORDER BY name")]
    return {t: conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0] for t in tables}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--db", type=Path, default=DEFAULT_DB_PATH, help="SQLite file to (re)create")
    parser.add_argument("--rebase", action="store_true",
                        help="shift seed timestamps so the seed week is the current week")
    args = parser.parse_args()

    args.db.parent.mkdir(parents=True, exist_ok=True)
    args.db.unlink(missing_ok=True)

    weeks = weeks_to_current() if args.rebase else 0
    with connect(args.db) as conn:
        build(conn, weeks)
        problems = health_report(conn)
        counts = row_counts(conn)
    conn.close()

    print(f"Database: {args.db}")
    if args.rebase:
        print(f"Rebased seed timestamps by {weeks:+d} week(s).")
    for table, count in counts.items():
        print(f"  {table:<18} {count:>3} rows")
    if problems:
        print("FAILED health checks:")
        for problem in problems:
            print(f"  {problem}")
        return 1
    print("integrity_check: ok, foreign_key_check: no violations")
    return 0


if __name__ == "__main__":
    sys.exit(main())
