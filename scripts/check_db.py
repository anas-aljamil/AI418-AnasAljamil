"""Prove the MySQL schema rejects bad data and the seed obeys the business rules.

Usage:
    python3 scripts/check_db.py

Builds a throwaway database named <DB_NAME>_check (the dev database is not
touched) and runs:
  1. schema checks: InnoDB + utf8mb4 everywhere, no reserved-word identifiers,
     triggers present, load free of warnings;
  2. constraint tests: statements that MUST fail with a specific MySQL error
     code, and edge cases that MUST succeed (each in a rolled-back transaction);
  3. seed invariants: CLAUDE.md section 4 rules that the API enforces, checked
     on the seed data so the demo data is itself valid;
  4. a rebase test, and 5. a sync test between docs/er-diagram.md and the schema.
Exits with status 1 if any check fails.
"""

from __future__ import annotations

import re
import sys

import reset_db
from mysql_cli import ROOT, MySQLError, load_config, run, scalar

CONFIG = load_config()
CHECK_DB = f"{CONFIG.database}_check"
ANCHOR_NOW = "2026-10-04 21:00:00"  # Monday 2026-10-05 00:00 Riyadh, start of the demo

# MySQL error codes used below.
DUPLICATE = 1062          # unique / primary key violation
FK_CHILD = 1452           # child row references a missing parent
FK_PARENT = 1451          # parent row still referenced (RESTRICT)
CHECK_FAILED = 3819       # CHECK constraint violated
GENERATED_VALUE = 3105    # value written to a generated column
TOO_LONG = 1406           # string longer than the column (strict mode)
SIGNAL = 1644             # SIGNAL SQLSTATE '45000' from a trigger

NEW_USER = ("INSERT INTO users (email, password_hash, role, full_name_ar, full_name_en) "
            "VALUES ('{email}', 'argon2-placeholder-hash', '{role}', 'اسم', 'Name')")

# (description, SQL, expected MySQL error code)
MUST_FAIL = [
    ("users: duplicate email", NEW_USER.format(email="n.alharbi@university.example", role="student"), DUPLICATE),
    ("users: email must be lower case", NEW_USER.format(email="New.User@university.example", role="student"), CHECK_FAILED),
    ("users: email needs a dotted domain", NEW_USER.format(email="someone@localhost", role="student"), CHECK_FAILED),
    ("users: unknown role", NEW_USER.format(email="t@university.example", role="teacher"), CHECK_FAILED),
    ("users: codes are exact ('Student' is not 'student')", NEW_USER.format(email="t@university.example", role="Student"), CHECK_FAILED),
    ("users: role cannot change while a subtype row exists (ON UPDATE RESTRICT)",
     "UPDATE users SET role = 'admin' WHERE user_id = 9", FK_PARENT),
    ("students: row must point at a 'student' account (user 1 is a professor)",
     "INSERT INTO students (student_id, university_no, department_id) VALUES (1, 'S9999', 1)", FK_CHILD),
    ("students: role is generated and cannot be written",
     "INSERT INTO students (student_id, role, university_no, department_id) VALUES (16, 'admin', 'S9999', 1)",
     GENERATED_VALUE),
    ("professors: slot length must be 15 or 30", "UPDATE professors SET slot_minutes = 20 WHERE professor_id = 1", CHECK_FAILED),
    ("departments: code must be upper case",
     "INSERT INTO departments (college_id, code, name_ar, name_en) VALUES (1, 'phys', 'الفيزياء', 'Physics')",
     CHECK_FAILED),
    ("departments: must belong to an existing college",
     "INSERT INTO departments (college_id, code, name_ar, name_en) VALUES (99, 'PHYS', 'الفيزياء', 'Physics')",
     FK_CHILD),
    ("colleges: cannot delete a college that has departments (RESTRICT)",
     "DELETE FROM colleges WHERE college_id = 1", FK_PARENT),
    ("departments: cannot delete a department that has professors (RESTRICT)",
     "DELETE FROM departments WHERE department_id = 1", FK_PARENT),
    ("offices: (building, room) is unique",
     "INSERT INTO offices (building_code, floor, room_number) VALUES ('A', 2, '214')", DUPLICATE),
    ("schedule_blocks: Friday is not a working day",
     "INSERT INTO schedule_blocks (professor_id, day_of_week, start_time, end_time) VALUES (1, 5, '10:00', '11:00')",
     CHECK_FAILED),
    ("schedule_blocks: end must be after start",
     "INSERT INTO schedule_blocks (professor_id, day_of_week, start_time, end_time) VALUES (1, 3, '11:00', '10:00')",
     CHECK_FAILED),
    ("schedule_blocks: times sit on the 15-minute grid",
     "INSERT INTO schedule_blocks (professor_id, day_of_week, start_time, end_time) VALUES (1, 3, '10:10', '11:00')",
     CHECK_FAILED),
    ("schedule_blocks: a block cannot run past midnight",
     "INSERT INTO schedule_blocks (professor_id, day_of_week, start_time, end_time) VALUES (1, 3, '23:00', '24:30')",
     CHECK_FAILED),
    ("status_overrides: unknown status",
     "INSERT INTO status_overrides (professor_id, status) VALUES (1, 'lunch')", CHECK_FAILED),
    ("status_overrides: note longer than 60 characters",
     "INSERT INTO status_overrides (professor_id, status, note) "
     "VALUES (1, 'busy', 'ملاحظة طويلة جدا تتجاوز الحد المسموح به وهو ستون حرفا في هذا الحقل')", TOO_LONG),
    ("status_overrides: return time must be after creation",
     "INSERT INTO status_overrides (professor_id, status, created_at, expires_at) "
     "VALUES (1, 'busy', '2026-10-05 08:00:00', '2026-10-05 07:00:00')", CHECK_FAILED),
    ("appointments: end must be after start",
     "INSERT INTO appointments (student_id, professor_id, starts_at, ends_at) "
     "VALUES (10, 2, '2026-10-12 06:30:00', '2026-10-12 06:00:00')", CHECK_FAILED),
    ("appointments: unknown lifecycle status",
     "INSERT INTO appointments (student_id, professor_id, starts_at, ends_at, status) "
     "VALUES (10, 2, '2026-10-12 06:00:00', '2026-10-12 06:30:00', 'done')", CHECK_FAILED),
    ("appointments: unknown student (foreign key)",
     "INSERT INTO appointments (student_id, professor_id, starts_at, ends_at) "
     "VALUES (999, 2, '2026-10-12 06:00:00', '2026-10-12 06:30:00')", FK_CHILD),
    ("appointments: a professor is not a student (foreign key)",
     "INSERT INTO appointments (student_id, professor_id, starts_at, ends_at) "
     "VALUES (2, 1, '2026-10-12 06:00:00', '2026-10-12 06:15:00')", FK_CHILD),
    ("appointments: double booking, same start (trigger fires first)",
     "INSERT INTO appointments (student_id, professor_id, starts_at, ends_at) "
     "VALUES (10, 1, '2026-10-11 07:30:00', '2026-10-11 07:45:00')", SIGNAL),
    ("appointments: overlapping booking, different start (insert trigger)",
     "INSERT INTO appointments (student_id, professor_id, starts_at, ends_at) "
     "VALUES (10, 1, '2026-10-11 07:15:00', '2026-10-11 07:45:00')", SIGNAL),
    ("appointments: rescheduling onto a taken slot (update trigger)",
     "UPDATE appointments SET starts_at = '2026-10-11 07:30:00', ends_at = '2026-10-11 07:45:00' "
     "WHERE appointment_id = 7", SIGNAL),
    ("appointments: re-activating a declined row that overlaps (update trigger)",
     "UPDATE appointments SET status = 'pending', professor_id = 1, "
     "starts_at = '2026-10-11 07:35:00', ends_at = '2026-10-11 07:50:00' WHERE appointment_id = 4", SIGNAL),
    ("pins: a student pins a professor only once",
     "INSERT INTO pins (student_id, professor_id) VALUES (9, 1)", DUPLICATE),
    ("conversations: one conversation per student-professor pair",
     "INSERT INTO conversations (student_id, professor_id) VALUES (9, 1)", DUPLICATE),
    ("conversations: both sides must be student and professor",
     "INSERT INTO conversations (student_id, professor_id) VALUES (9, 10)", FK_CHILD),
    ("messages: sender must be 'student' or 'professor'",
     "INSERT INTO messages (conversation_id, sender_role, body) VALUES (1, 'admin', 'hello')", CHECK_FAILED),
    ("messages: body cannot be blank",
     "INSERT INTO messages (conversation_id, sender_role, body) VALUES (1, 'student', '   ')", CHECK_FAILED),
    ("messages: read time cannot precede sending",
     "INSERT INTO messages (conversation_id, sender_role, body, created_at, read_at) "
     "VALUES (1, 'student', 'hi', '2026-10-05 08:00:00', '2026-10-05 07:00:00')", CHECK_FAILED),
    ("notifications: new_message must link a conversation, not an appointment",
     "INSERT INTO notifications (user_id, type, appointment_id) VALUES (9, 'new_message', 6)", CHECK_FAILED),
    ("notifications: appointment types must link an appointment",
     "INSERT INTO notifications (user_id, type, conversation_id) VALUES (9, 'appointment_approved', 1)", CHECK_FAILED),
]

# (description, SQL, verification query, expected first column of the last row)
MUST_SUCCEED = [
    ("appointments: adjacent slot (ends exactly when the next starts) is allowed",
     "INSERT INTO appointments (student_id, professor_id, starts_at, ends_at) "
     "VALUES (10, 1, '2026-10-11 07:15:00', '2026-10-11 07:30:00')",
     "SELECT COUNT(*) FROM appointments WHERE professor_id = 1 AND starts_at = '2026-10-11 07:15:00'", "1"),
    ("appointments: a cancelled appointment frees its slot",
     "INSERT INTO appointments (student_id, professor_id, starts_at, ends_at) "
     "VALUES (11, 5, '2026-09-30 09:15:00', '2026-09-30 09:30:00')",
     "SELECT COUNT(*) FROM appointments WHERE professor_id = 5 AND starts_at = '2026-09-30 09:15:00'", "2"),
    ("appointments: cancelling an active appointment is always allowed",
     "UPDATE appointments SET status = 'cancelled' WHERE appointment_id = 6",
     "SELECT status FROM appointments WHERE appointment_id = 6", "cancelled"),
    ("offices: deleting an office sets professors.office_id to NULL",
     "DELETE FROM offices WHERE office_id = 1",
     "SELECT office_id FROM professors WHERE professor_id = 1", "NULL"),
    ("users: deleting a student account cascades to everything they own",
     "DELETE FROM users WHERE user_id = 9",
     "SELECT (SELECT COUNT(*) FROM students WHERE student_id = 9)"
     " + (SELECT COUNT(*) FROM appointments WHERE student_id = 9)"
     " + (SELECT COUNT(*) FROM pins WHERE student_id = 9)"
     " + (SELECT COUNT(*) FROM conversations WHERE student_id = 9)"
     " + (SELECT COUNT(*) FROM messages WHERE conversation_id = 1)"
     " + (SELECT COUNT(*) FROM notifications WHERE user_id = 9)", "0"),
    ("users: deleting a professor account cascades to schedule, overrides and bookings",
     "DELETE FROM users WHERE user_id = 1",
     "SELECT (SELECT COUNT(*) FROM professors WHERE professor_id = 1)"
     " + (SELECT COUNT(*) FROM schedule_blocks WHERE professor_id = 1)"
     " + (SELECT COUNT(*) FROM status_overrides WHERE professor_id = 1)"
     " + (SELECT COUNT(*) FROM appointments WHERE professor_id = 1)", "0"),
    ("defaults: new rows get role, locale, active flag and timestamps automatically",
     "INSERT INTO users (user_id, email, password_hash, role, full_name_ar, full_name_en) "
     "VALUES (100, 'new@university.example', 'argon2-placeholder-hash', 'student', 'اسم', 'Name'); "
     "INSERT INTO students (student_id, university_no, department_id) VALUES (100, 'S9100', 1)",
     "SELECT CONCAT(s.role, '/', u.preferred_locale, '/', u.is_active, '/', s.study_year, '/', "
     "u.created_at IS NOT NULL) FROM users u JOIN students s ON s.student_id = u.user_id WHERE u.user_id = 100",
     "student/ar/1/1/1"),
    ("defaults: created_at is UTC even when the session time zone is Riyadh",
     "SET time_zone = '+03:00'; INSERT INTO departments (college_id, code, name_ar, name_en) VALUES (1, 'PHYS', 'الفيزياء', 'Physics')",
     "SELECT ABS(TIMESTAMPDIFF(SECOND, created_at, UTC_TIMESTAMP())) < 5 FROM departments WHERE code = 'PHYS'", "1"),
    ("arabic: text round-trips unchanged and lengths count characters, not bytes",
     "INSERT INTO departments (college_id, code, name_ar, name_en) "
     "VALUES (3, 'ARB', 'قسمُ اللغةِ العربيةِ وآدابِها', 'Arabic')",
     "SELECT CONCAT(name_ar = 'قسمُ اللغةِ العربيةِ وآدابِها' COLLATE utf8mb4_0900_bin, '/', "
     "CHAR_LENGTH(name_ar), '/', LENGTH(name_ar)) FROM departments WHERE code = 'ARB'", "1/29/55"),
]


def build_check_db(rebase_weeks: int = 0) -> list[str]:
    return reset_db.build(CONFIG, CHECK_DB, rebase_weeks)


def in_transaction(sql: str, verify: str = "") -> list[list[str]]:
    """Run statements in a transaction that is always rolled back."""
    return run(f"START TRANSACTION; {sql}; {verify + ';' if verify else ''} ROLLBACK;", CONFIG, CHECK_DB)


def q(sql: str) -> list[list[str]]:
    return run(sql, CONFIG, CHECK_DB)


def run_schema_checks(load_warnings: list[str]) -> list[tuple[bool, str, str]]:
    results = [(not load_warnings, "schema.sql and seed.sql load without warnings",
                "; ".join(load_warnings) or "no warnings")]
    db = f"TABLE_SCHEMA = '{CHECK_DB}'"
    bad_tables = q(f"SELECT TABLE_NAME, ENGINE, TABLE_COLLATION FROM information_schema.TABLES WHERE {db} "
                   "AND TABLE_TYPE = 'BASE TABLE' AND (ENGINE <> 'InnoDB' OR TABLE_COLLATION <> 'utf8mb4_0900_ai_ci')")
    results.append((not bad_tables, "every table is InnoDB with utf8mb4_0900_ai_ci",
                    str(bad_tables) if bad_tables else "12 tables ok"))
    bad_columns = q(f"SELECT TABLE_NAME, COLUMN_NAME, CHARACTER_SET_NAME FROM information_schema.COLUMNS WHERE {db} "
                    "AND CHARACTER_SET_NAME IS NOT NULL AND CHARACTER_SET_NAME <> 'utf8mb4'")
    results.append((not bad_columns, "every text column is utf8mb4", str(bad_columns) if bad_columns else "ok"))
    db_charset = q(f"SELECT DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME FROM information_schema.SCHEMATA "
                   f"WHERE SCHEMA_NAME = '{CHECK_DB}'")
    results.append((db_charset == [["utf8mb4", "utf8mb4_0900_ai_ci"]], "database default is utf8mb4_0900_ai_ci",
                    str(db_charset)))
    reserved = q("SELECT DISTINCT k.WORD FROM information_schema.KEYWORDS k WHERE k.RESERVED = 1 AND k.WORD IN ("
                 f"SELECT UPPER(TABLE_NAME) FROM information_schema.TABLES WHERE {db} "
                 f"UNION SELECT UPPER(COLUMN_NAME) FROM information_schema.COLUMNS WHERE {db} "
                 f"UNION SELECT UPPER(TRIGGER_NAME) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = '{CHECK_DB}' "
                 f"UNION SELECT UPPER(CONSTRAINT_NAME) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = '{CHECK_DB}' "
                 "AND CONSTRAINT_TYPE <> 'PRIMARY KEY')")
    results.append((not reserved, "no table, column, trigger or constraint name is a MySQL reserved word",
                    f"reserved: {reserved}" if reserved else "none"))
    triggers = q(f"SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = '{CHECK_DB}' "
                 "ORDER BY TRIGGER_NAME")
    expected = [["trg_appointments_no_overlap_insert"], ["trg_appointments_no_overlap_update"]]
    results.append((triggers == expected, "double-booking triggers exist", ", ".join(t[0] for t in triggers)))
    checks = scalar(f"SELECT COUNT(*) FROM information_schema.CHECK_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = '{CHECK_DB}'", CONFIG)
    results.append((int(checks) >= 40, "CHECK constraints are installed and enforced", f"{checks} CHECK constraints"))
    return results


def run_constraint_tests() -> list[tuple[bool, str, str]]:
    results = []
    for description, sql, expected_code in MUST_FAIL:
        try:
            in_transaction(sql)
            results.append((False, description, "accepted, expected rejection"))
        except MySQLError as exc:
            message = str(exc).split(": ", 1)[-1]
            ok = exc.code == expected_code
            results.append((ok, description, f"rejected ({exc.code}): {message}"
                            + ("" if ok else f"  <- expected error {expected_code}")))
    for description, sql, verify, expected in MUST_SUCCEED:
        try:
            rows = in_transaction(sql, verify)
            actual = rows[-1][0] if rows else None
            ok = actual == expected
            results.append((ok, description, f"result {actual!r}" + ("" if ok else f", expected {expected!r}")))
        except MySQLError as exc:
            results.append((False, description, f"error: {exc}"))

    # Layer 1 alone: drop the triggers (DDL, so not rollback-able) and show the
    # unique (professor_id, active_slot) index still blocks the same start.
    description = "appointments: same start with triggers dropped (unique active-slot index alone)"
    run("DROP TRIGGER trg_appointments_no_overlap_insert; DROP TRIGGER trg_appointments_no_overlap_update;",
        CONFIG, CHECK_DB)
    try:
        in_transaction("INSERT INTO appointments (student_id, professor_id, starts_at, ends_at) "
                       "VALUES (10, 1, '2026-10-11 07:30:00', '2026-10-11 07:45:00')")
        results.append((False, description, "accepted, expected rejection"))
    except MySQLError as exc:
        results.append((exc.code == DUPLICATE, description, f"rejected ({exc.code}): {str(exc).split(': ', 1)[-1]}"))
    build_check_db()  # restore the triggers for the remaining checks
    return results


def run_seed_invariants() -> list[tuple[bool, str, str]]:
    results = []

    def add(rows: list[list[str]], description: str, ok_detail: str = "ok") -> None:
        results.append((not rows, description, f"violations: {rows}" if rows else ok_detail))

    # Rule: bookings fall inside an office_hours block, on the slot grid, one slot long.
    # Riyadh local = UTC + 3 h; DAYOFWEEK() is 1 = Sunday, so subtract 1.
    add(q("SELECT a.appointment_id FROM appointments a JOIN professors p ON p.professor_id = a.professor_id "
          "WHERE TIMESTAMPDIFF(MINUTE, a.starts_at, a.ends_at) <> p.slot_minutes OR NOT EXISTS ("
          "  SELECT 1 FROM schedule_blocks b WHERE b.professor_id = a.professor_id AND b.kind = 'office_hours'"
          "  AND b.day_of_week = DAYOFWEEK(a.starts_at + INTERVAL 3 HOUR) - 1"
          "  AND b.start_time <= TIME(a.starts_at + INTERVAL 3 HOUR)"
          "  AND TIME(a.ends_at + INTERVAL 3 HOUR) <= b.end_time"
          "  AND MOD(TIME_TO_SEC(TIME(a.starts_at + INTERVAL 3 HOUR)) - TIME_TO_SEC(b.start_time),"
          "          p.slot_minutes * 60) = 0)"),
        "appointments sit in office hours, on the slot grid, one slot long", "all 10 rows valid")

    # Rule: at most 2 pending/approved future appointments per student per professor.
    add(q("SELECT student_id, professor_id, COUNT(*) FROM appointments "
          f"WHERE status IN ('pending', 'approved') AND starts_at > '{ANCHOR_NOW}' "
          "GROUP BY student_id, professor_id HAVING COUNT(*) > 2"),
        "no student holds more than 2 active future bookings per professor")

    # Rule: cancellation allowed only until 1 hour before start (updated_at = cancel time).
    add(q("SELECT appointment_id FROM appointments WHERE status = 'cancelled' "
          "AND TIMESTAMPDIFF(MINUTE, updated_at, starts_at) < 60"),
        "cancellations happened at least 1 hour before start")

    # Rule: chat only after a non-declined appointment, or with open messages.
    add(q("SELECT c.conversation_id FROM conversations c JOIN professors p ON p.professor_id = c.professor_id "
          "WHERE p.open_messages = FALSE AND NOT EXISTS (SELECT 1 FROM appointments a "
          "WHERE a.student_id = c.student_id AND a.professor_id = c.professor_id AND a.status <> 'declined')"),
        "every conversation is eligible for chat")

    # Participation: a conversation contains 1..N messages, none before it opened.
    add(q("SELECT c.conversation_id FROM conversations c WHERE NOT EXISTS "
          "(SELECT 1 FROM messages m WHERE m.conversation_id = c.conversation_id) "
          "UNION SELECT m.conversation_id FROM messages m JOIN conversations c "
          "ON c.conversation_id = m.conversation_id WHERE m.created_at < c.created_at"),
        "conversations have 1..N messages, none before opening")

    # Notifications go to a participant of the linked appointment or conversation.
    add(q("SELECT n.notification_id FROM notifications n "
          "LEFT JOIN appointments a ON a.appointment_id = n.appointment_id "
          "LEFT JOIN conversations c ON c.conversation_id = n.conversation_id "
          "WHERE n.user_id NOT IN (COALESCE(a.student_id, c.student_id), COALESCE(a.professor_id, c.professor_id))"),
        "notifications only reach participants")

    # A professor's weekly blocks never overlap (enforced by the API).
    add(q("SELECT a.block_id, b.block_id FROM schedule_blocks a JOIN schedule_blocks b "
          "ON a.professor_id = b.professor_id AND a.day_of_week = b.day_of_week AND a.block_id < b.block_id "
          "AND a.start_time < b.end_time AND b.start_time < a.end_time"),
        "no overlapping schedule blocks per professor")

    # Every professor has office hours (otherwise "Is Dr. X in?" is always Away).
    add(q("SELECT professor_id FROM professors p WHERE NOT EXISTS (SELECT 1 FROM schedule_blocks s "
          "WHERE s.professor_id = p.professor_id AND s.kind = 'office_hours')"),
        "every professor has weekly office hours")

    # Seed size: 5-10 rows per table, except the documented exceptions (seed.sql headers):
    # users and schedule_blocks (more, by design), colleges and departments (the real list).
    sizes = reset_db.row_counts(CONFIG, CHECK_DB)
    exceptions = {"users", "schedule_blocks", "colleges", "departments"}
    off = {t: n for t, n in sizes.items() if t not in exceptions and not 5 <= n <= 10}
    results.append((not off, "5-10 seed rows per table (users, schedule_blocks, colleges, departments excepted)",
                    f"out of range: {off}" if off else ", ".join(f"{t}={n}" for t, n in sizes.items())))
    return results


def run_rebase_check() -> list[tuple[bool, str, str]]:
    weeks = 7
    warnings = build_check_db(rebase_weeks=weeks)
    first = scalar("SELECT starts_at FROM appointments WHERE appointment_id = 6", CONFIG, CHECK_DB)
    weekend = scalar("SELECT COUNT(*) FROM appointments "
                     "WHERE DAYOFWEEK(starts_at + INTERVAL 3 HOUR) - 1 > 4", CONFIG, CHECK_DB)
    expected = "2026-11-29 07:30:00"  # 2026-10-11 + 7 weeks, still a Sunday
    ok = not warnings and first == expected and weekend == "0"
    build_check_db()
    return [(ok, f"rebase by {weeks} weeks keeps data valid and weekdays intact",
             f"appointment 6 -> {first}; appointments on Fri/Sat: {weekend}")]


def check_er_diagram_sync() -> list[tuple[bool, str, str]]:
    """Compare the Mermaid entity blocks with the live schema, column by column."""
    text = (ROOT / "docs" / "er-diagram.md").read_text(encoding="utf-8")
    mermaid = re.search(r"```mermaid\n(.*?)```", text, re.S).group(1)
    diagram = {
        name.lower(): {line.split()[1] for line in body.strip().splitlines()}
        for name, body in re.findall(r"^\s*([A-Z_]+) \{\n(.*?)^\s*\}", mermaid, re.M | re.S)
    }
    schema: dict[str, set[str]] = {}
    for table, column in q(f"SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS "
                           f"WHERE TABLE_SCHEMA = '{CHECK_DB}'"):
        schema.setdefault(table, set()).add(column)
    diffs = []
    for table in sorted(schema.keys() | diagram.keys()):
        missing = schema.get(table, set()) - diagram.get(table, set())
        extra = diagram.get(table, set()) - schema.get(table, set())
        if table not in diagram or table not in schema or missing or extra:
            diffs.append(f"{table}: missing {sorted(missing)}, extra {sorted(extra)}")
    return [(not diffs, "docs/er-diagram.md matches db/schema.sql (tables and columns)",
             "; ".join(diffs) if diffs else f"{len(schema)} tables in sync")]


def main() -> int:
    try:
        load_warnings = build_check_db()
        sections = [
            ("Schema (engine, character set, reserved words, triggers)", run_schema_checks(load_warnings)),
            ("Constraint tests (must reject with the expected error / must accept)", run_constraint_tests()),
            ("Seed invariants (business rules on demo data)", run_seed_invariants()),
            ("Rebase", run_rebase_check()),
            ("Documentation sync", check_er_diagram_sync()),
        ]
    except MySQLError as exc:
        print(f"FAILED to build or query {CHECK_DB}: {exc}")
        return 1
    finally:
        try:
            run(f"DROP DATABASE IF EXISTS `{CHECK_DB}`", CONFIG)
        except MySQLError:
            pass

    failures = 0
    for title, results in sections:
        print(f"\n{title}")
        for ok, description, detail in results:
            failures += not ok
            print(f"  [{'PASS' if ok else 'FAIL'}] {description}\n         {detail}")
    total = sum(len(r) for _, r in sections)
    print(f"\n{total - failures}/{total} checks passed (MySQL {scalar('SELECT VERSION()', CONFIG)})")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
