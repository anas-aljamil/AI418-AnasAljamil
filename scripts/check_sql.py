"""Run db/queries.sql against MySQL 8 and report its coverage (CLAUDE.md Section 6).

Usage:
    python3 scripts/check_sql.py            # summary per section
    python3 scripts/check_sql.py --rows     # also print every result

Builds a throwaway database named <DB_NAME>_sql from db/schema.sql and
db/seed.sql (the dev database is not touched), runs db/queries.sql in it as one
session, exactly as `mysql < db/queries.sql` would, and checks:
  1. every statement runs without an error;
  2. every statement (except session SETs) has a comment right above it;
  3. each table section has at least 5 queries and 2 aggregate queries;
  4. the file as a whole uses WHERE, ORDER BY, LIKE, BETWEEN, IN, IS NULL,
     DISTINCT, UNION, INNER and OUTER joins, GROUP BY with HAVING, at least
     2 views and the double-booking trigger demo;
  5. the views and the trigger demo give the results the seed implies at the
     demo moment (Monday 2026-10-05 10:00 Riyadh).
Exits with status 1 if any check fails.
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass, field

import reset_db
from mysql_cli import ROOT, MySQLError, load_config, run, scalar

CONFIG = load_config()
SQL_DB = f"{CONFIG.database}_sql"
QUERIES = ROOT / "db" / "queries.sql"
TABLES = [
    "departments", "users", "offices", "students", "professors", "schedule_blocks",
    "status_overrides", "appointments", "pins", "conversations", "messages", "notifications",
]
MIN_QUERIES, MIN_AGGREGATES = 5, 2
AGGREGATE = re.compile(r"\b(COUNT|SUM|AVG|MIN|MAX|GROUP_CONCAT)\s*\(", re.IGNORECASE)
SECTION = re.compile(r"^-- \d+\. (.+)$")
MARKER = "#statement "

# (feature, pattern) checked over the whole file.
FEATURES = [
    ("WHERE", r"\bWHERE\b"),
    ("ORDER BY", r"\bORDER BY\b"),
    ("LIKE", r"\bLIKE\b"),
    ("BETWEEN", r"\bBETWEEN\b"),
    ("IN (...)", r"\bIN\s*\("),
    ("IS NULL", r"\bIS NULL\b"),
    ("DISTINCT", r"\bDISTINCT\b"),
    ("UNION", r"\bUNION\b"),
    ("INNER JOIN", r"\bINNER JOIN\b"),
    ("LEFT (OUTER) JOIN", r"\bLEFT (OUTER )?JOIN\b"),
    ("RIGHT (OUTER) JOIN", r"\bRIGHT (OUTER )?JOIN\b"),
    ("GROUP BY", r"\bGROUP BY\b"),
    ("HAVING", r"\bHAVING\b"),
    ("subquery (EXISTS / derived table)", r"\bEXISTS\s*\(|\bFROM\s*\(\s*SELECT\b"),
    ("window function (OVER)", r"\bOVER\b"),
]


@dataclass
class Statement:
    number: int
    section: str
    sql: str
    comment: str  # the comment block right above it ("" when missing)
    rows: list[list[str]] = field(default_factory=list)

    @property
    def label(self) -> str:
        first = self.comment.splitlines()[0] if self.comment else self.sql.splitlines()[0]
        return first.removeprefix("-- ").strip()

    @property
    def is_query(self) -> bool:
        return bool(re.match(r"(SELECT|WITH|CREATE OR REPLACE VIEW)\b", self.sql, re.IGNORECASE))


def parse(text: str) -> list[Statement]:
    """Split the file into statements, keeping DELIMITER blocks whole."""
    statements: list[Statement] = []
    section, comment, buffer = "header", [], []
    delimiter = ";"
    for line in text.splitlines():
        stripped = line.strip()
        if not buffer:
            match = SECTION.match(stripped)
            if match:
                section, comment = match.group(1).strip(), []
                continue
            if stripped.startswith("-- ="):
                continue
            if stripped.startswith("--"):
                comment.append(stripped)
                continue
            if not stripped:  # a comment only belongs to the statement right below it
                comment = []
                continue
        if stripped.upper().startswith("DELIMITER "):
            buffer.append(line)
            delimiter = stripped.split()[1]
            if delimiter == ";":  # end of the block: one statement
                statements.append(Statement(len(statements) + 1, section, "\n".join(buffer), "\n".join(comment)))
                buffer, comment = [], []
            continue
        buffer.append(line)
        if delimiter == ";" and stripped.endswith(";"):
            statements.append(Statement(len(statements) + 1, section, "\n".join(buffer), "\n".join(comment)))
            buffer, comment = [], []
    return statements


def execute(statements: list[Statement]) -> str | None:
    """Run all statements in one session; fill in their rows. Returns an error or None."""
    script, starts = [], []
    line = 1
    for statement in statements:
        marker = f"SELECT '{MARKER}{statement.number}';"
        script.append(marker)
        starts.append((line + 1, statement))
        script.append(statement.sql)
        line += 1 + statement.sql.count("\n") + 1
    try:
        output = run("\n".join(script), CONFIG, SQL_DB)
    except MySQLError as exc:
        message = str(exc)
        at = re.search(r"at line (\d+)", message)
        culprit = None
        if at:
            failing_line = int(at.group(1))
            culprit = next((s for start, s in reversed(starts) if start <= failing_line), None)
        where = f" in {culprit.section} / {culprit.label}" if culprit else ""
        return f"{message.splitlines()[0]}{where}"
    current: Statement | None = None
    by_number = {s.number: s for s in statements}
    for row in output:
        if len(row) == 1 and row[0].startswith(MARKER):
            current = by_number[int(row[0][len(MARKER):])]
        elif current is not None:
            current.rows.append(row)
    return None


def rows_of(statements: list[Statement], label_prefix: str) -> list[list[str]]:
    return next(s.rows for s in statements if s.label.startswith(label_prefix))


def result_checks(statements: list[Statement]) -> list[tuple[bool, str, str]]:
    """What the seed implies at Monday 2026-10-05 10:00 Riyadh (see db/seed.sql)."""
    checks = []

    in_office = sorted(row[0] for row in rows_of(statements, "V6."))
    expected = ["Huda Al-Qahtani", "Khalid Al-Otaibi", "Reem Al-Dosari"]
    checks.append((in_office == expected, "v_professors_in_office_now: Monday 10:00 office hours",
                   f"{in_office} (expected {expected}; none confirmed: no manual update today)"))

    statuses = {row[0]: row[1] for row in rows_of(statements, "V4.")}
    checks.append((len(statuses) == 8 and statuses.get("Noura Al-Harbi") == "away",
                   "v_professor_current_status: one row per professor; outside every block = away",
                   f"{len(statuses)} professors; Noura Al-Harbi = {statuses.get('Noura Al-Harbi')}"))

    upcoming = [row[0] for row in rows_of(statements, "A1.")]
    checks.append((upcoming == ["6", "7"], "v_upcoming_appointments: Saad's two upcoming appointments",
                   f"appointment ids {upcoming}"))

    demo = {row[0]: row[2] for row in rows_of(statements, "T3.")}
    rejected = all(demo.get(n, "").startswith("SLOT_TAKEN") for n in ("1", "2", "4"))
    accepted = all(demo.get(n) == "accepted" for n in ("3", "5"))
    checks.append((rejected and accepted, "trigger demo: overlaps rejected (1, 2, 4), others accepted (3, 5)",
                   "; ".join(f"{n}: {demo.get(n)}" for n in sorted(demo))))

    left = rows_of(statements, "T5.")
    checks.append((left == [["0"]], "trigger demo rolled back: none of its rows is left",
                   f"{left[0][0] if left else '?'} rows left"))

    for prefix, what in (("U7.", "users without their subtype row"),
                         ("C3.", "conversations that break the chat rule"),
                         ("N6.", "notifications sent to an outsider")):
        found = rows_of(statements, prefix)
        checks.append((not found, f"data quality ({prefix[:-1]}): no {what}", f"{len(found)} rows"))
    return checks


def coverage_checks(statements: list[Statement]) -> list[tuple[bool, str, str]]:
    checks = []
    # SET statements (session settings) need no comment of their own.
    missing = [s.label for s in statements if not s.comment and not s.sql.upper().startswith("SET ")]
    checks.append((not missing, "every statement has a comment above it", ", ".join(missing) or "ok"))

    for table in TABLES:
        queries = [s for s in statements if s.section == table and s.is_query]
        aggregates = [s for s in queries if AGGREGATE.search(s.sql)]
        ok = len(queries) >= MIN_QUERIES and len(aggregates) >= MIN_AGGREGATES
        checks.append((ok, f"{table}: >= {MIN_QUERIES} queries, >= {MIN_AGGREGATES} aggregates",
                       f"{len(queries)} queries, {len(aggregates)} aggregates"))

    text = "\n".join(s.sql for s in statements)
    for feature, pattern in FEATURES:
        count = len(re.findall(pattern, text, re.IGNORECASE))
        checks.append((count > 0, f"uses {feature}", f"{count} times"))
    views = re.findall(r"CREATE OR REPLACE VIEW (\w+)", text, re.IGNORECASE)
    checks.append((len(views) >= 2, "at least 2 views", ", ".join(views)))
    return checks


def main() -> int:
    print_rows = "--rows" in sys.argv
    statements = parse(QUERIES.read_text(encoding="utf-8"))
    try:
        warnings = reset_db.build(CONFIG, SQL_DB)
        error = execute(statements) or ("schema/seed warnings: " + "; ".join(warnings) if warnings else None)
        version = scalar("SELECT VERSION()", CONFIG)
    except MySQLError as exc:
        print(f"FAILED to build {SQL_DB}: {exc}")
        return 1
    finally:
        try:
            run(f"DROP DATABASE IF EXISTS `{SQL_DB}`", CONFIG)
        except MySQLError:
            pass

    sections = [("Execution", [(error is None, f"all {len(statements)} statements run on MySQL {version}",
                                error or "no errors")])]
    if error is None:
        sections.append(("Results at the demo moment", result_checks(statements)))
    sections.append(("Coverage (CLAUDE.md Section 6)", coverage_checks(statements)))

    if print_rows and error is None:
        for statement in statements:
            if statement.rows:
                print(f"\n[{statement.section}] {statement.label}")
                for row in statement.rows:
                    print("    " + " | ".join(row))

    failures = 0
    for title, results in sections:
        print(f"\n{title}")
        for ok, description, detail in results:
            failures += not ok
            print(f"  [{'PASS' if ok else 'FAIL'}] {description}\n         {detail}")
    queries = [s for s in statements if s.is_query]
    print(f"\n{len(queries)} queries and views in {len(statements)} statements; "
          f"{sum(len(r) for _, r in sections) - failures}/{sum(len(r) for _, r in sections)} checks passed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
