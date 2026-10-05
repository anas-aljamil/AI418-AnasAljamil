"""Prove the schema rejects bad data and the seed obeys the business rules.

Usage:
    python3 scripts/check_db.py

Builds throwaway in-memory databases (the dev database is not touched) and runs:
  1. constraint tests: statements that MUST fail, and edge cases that MUST succeed;
  2. seed invariants: CLAUDE.md section 4 rules that the API enforces, checked on
     the seed data so the demo data is itself valid;
  3. a rebase test: shifting the seed by several weeks keeps the database healthy;
  4. a sync test: docs/er-diagram.md lists exactly the tables and columns of the schema.
Exits with status 1 if any check fails.
"""

from __future__ import annotations

import re
import sqlite3
import sys
from collections import Counter
from datetime import datetime, timedelta

import reset_db

RIYADH_OFFSET = timedelta(hours=3)  # Asia/Riyadh has no DST
ANCHOR_NOW = "2026-10-04 21:00:00"   # Monday 2026-10-05 00:00 Riyadh, start of the demo
ACTIVE = ("pending", "approved")

# (description, SQL[, setup script]) entries that the database must reject.
MUST_FAIL = [
    ("users: duplicate email",
     "INSERT INTO users (email, password_hash, role, full_name_ar, full_name_en) "
     "VALUES ('n.alharbi@university.example', 'x' || hex(randomblob(16)), 'student', 'اسم', 'Name')"),
    ("users: email must be lower case",
     "INSERT INTO users (email, password_hash, role, full_name_ar, full_name_en) "
     "VALUES ('New.User@university.example', 'x' || hex(randomblob(16)), 'student', 'اسم', 'Name')"),
    ("users: unknown role",
     "INSERT INTO users (email, password_hash, role, full_name_ar, full_name_en) "
     "VALUES ('t@university.example', 'x' || hex(randomblob(16)), 'teacher', 'اسم', 'Name')"),
    ("users: role cannot change while a subtype row exists",
     "UPDATE users SET role = 'admin' WHERE user_id = 9"),
    ("students: row must point at a 'student' account (user 1 is a professor)",
     "INSERT INTO students (student_id, university_no, department_id) VALUES (1, 'S9999', 1)"),
    ("professors: slot length must be 15 or 30",
     "UPDATE professors SET slot_minutes = 20 WHERE professor_id = 1"),
    ("departments: code must be upper case",
     "INSERT INTO departments (code, name_ar, name_en) VALUES ('phys', 'الفيزياء', 'Physics')"),
    ("departments: cannot delete a department that has professors (RESTRICT)",
     "DELETE FROM departments WHERE department_id = 1"),
    ("offices: (building, room) is unique",
     "INSERT INTO offices (building_code, floor, room_number) VALUES ('A', 2, '214')"),
    ("schedule_blocks: Friday is not a working day",
     "INSERT INTO schedule_blocks (professor_id, day_of_week, start_time, end_time) "
     "VALUES (1, 5, '10:00', '11:00')"),
    ("schedule_blocks: end must be after start",
     "INSERT INTO schedule_blocks (professor_id, day_of_week, start_time, end_time) "
     "VALUES (1, 3, '11:00', '10:00')"),
    ("schedule_blocks: times sit on the 15-minute grid",
     "INSERT INTO schedule_blocks (professor_id, day_of_week, start_time, end_time) "
     "VALUES (1, 3, '10:10', '11:00')"),
    ("schedule_blocks: malformed time",
     "INSERT INTO schedule_blocks (professor_id, day_of_week, start_time, end_time) "
     "VALUES (1, 3, '9:00', '11:00')"),
    ("status_overrides: unknown status",
     "INSERT INTO status_overrides (professor_id, status) VALUES (1, 'lunch')"),
    ("status_overrides: note longer than 60 characters",
     "INSERT INTO status_overrides (professor_id, status, note) "
     "VALUES (1, 'busy', 'ملاحظة طويلة جدا تتجاوز الحد المسموح به وهو ستون حرفا في هذا الحقل')"),
    ("status_overrides: return time must be after creation",
     "INSERT INTO status_overrides (professor_id, status, created_at, expires_at) "
     "VALUES (1, 'busy', '2026-10-05 08:00:00', '2026-10-05 07:00:00')"),
    ("appointments: end must be after start",
     "INSERT INTO appointments (student_id, professor_id, starts_at, ends_at) "
     "VALUES (10, 2, '2026-10-12 06:30:00', '2026-10-12 06:00:00')"),
    ("appointments: unknown lifecycle status",
     "INSERT INTO appointments (student_id, professor_id, starts_at, ends_at, status) "
     "VALUES (10, 2, '2026-10-12 06:00:00', '2026-10-12 06:30:00', 'done')"),
    ("appointments: unknown student (foreign key)",
     "INSERT INTO appointments (student_id, professor_id, starts_at, ends_at) "
     "VALUES (999, 2, '2026-10-12 06:00:00', '2026-10-12 06:30:00')"),
    ("appointments: a professor is not a student (foreign key)",
     "INSERT INTO appointments (student_id, professor_id, starts_at, ends_at) "
     "VALUES (2, 1, '2026-10-12 06:00:00', '2026-10-12 06:15:00')"),
    ("appointments: double booking, same start (trigger fires first)",
     "INSERT INTO appointments (student_id, professor_id, starts_at, ends_at) "
     "VALUES (10, 1, '2026-10-11 07:30:00', '2026-10-11 07:45:00')"),
    ("appointments: double booking, same start, with triggers dropped (partial unique index alone)",
     "INSERT INTO appointments (student_id, professor_id, starts_at, ends_at) "
     "VALUES (10, 1, '2026-10-11 07:30:00', '2026-10-11 07:45:00')",
     "DROP TRIGGER trg_appointments_no_overlap_insert; DROP TRIGGER trg_appointments_no_overlap_update;"),
    ("appointments: overlapping booking, different start (trigger)",
     "INSERT INTO appointments (student_id, professor_id, starts_at, ends_at) "
     "VALUES (10, 1, '2026-10-11 07:15:00', '2026-10-11 07:45:00')"),
    ("appointments: rescheduling onto a taken slot (update trigger)",
     "UPDATE appointments SET starts_at = '2026-10-11 07:30:00', ends_at = '2026-10-11 07:45:00' "
     "WHERE appointment_id = 7"),
    ("appointments: re-activating a declined row that overlaps (update trigger)",
     "UPDATE appointments SET status = 'pending', professor_id = 1, "
     "starts_at = '2026-10-11 07:35:00', ends_at = '2026-10-11 07:50:00' WHERE appointment_id = 4"),
    ("pins: a student pins a professor only once",
     "INSERT INTO pins (student_id, professor_id) VALUES (9, 1)"),
    ("conversations: one conversation per student-professor pair",
     "INSERT INTO conversations (student_id, professor_id) VALUES (9, 1)"),
    ("conversations: both sides must be student and professor",
     "INSERT INTO conversations (student_id, professor_id) VALUES (9, 10)"),
    ("messages: sender must be 'student' or 'professor'",
     "INSERT INTO messages (conversation_id, sender_role, body) VALUES (1, 'admin', 'hello')"),
    ("messages: body cannot be blank",
     "INSERT INTO messages (conversation_id, sender_role, body) VALUES (1, 'student', '   ')"),
    ("messages: read time cannot precede sending",
     "INSERT INTO messages (conversation_id, sender_role, body, created_at, read_at) "
     "VALUES (1, 'student', 'hi', '2026-10-05 08:00:00', '2026-10-05 07:00:00')"),
    ("notifications: new_message must link a conversation, not an appointment",
     "INSERT INTO notifications (user_id, type, appointment_id) VALUES (9, 'new_message', 6)"),
    ("notifications: appointment types must link an appointment",
     "INSERT INTO notifications (user_id, type, conversation_id) VALUES (9, 'appointment_approved', 1)"),
]

# (description, SQL, verification query, expected value) for edge cases that MUST succeed.
MUST_SUCCEED = [
    ("appointments: adjacent slot (ends exactly when the next starts) is allowed",
     "INSERT INTO appointments (student_id, professor_id, starts_at, ends_at) "
     "VALUES (10, 1, '2026-10-11 07:15:00', '2026-10-11 07:30:00')",
     "SELECT COUNT(*) FROM appointments WHERE professor_id = 1 AND starts_at = '2026-10-11 07:15:00'", 1),
    ("appointments: a cancelled appointment frees its slot",
     "INSERT INTO appointments (student_id, professor_id, starts_at, ends_at) "
     "VALUES (11, 5, '2026-09-30 09:15:00', '2026-09-30 09:30:00')",
     "SELECT COUNT(*) FROM appointments WHERE professor_id = 5 AND starts_at = '2026-09-30 09:15:00'", 2),
    ("appointments: cancelling an active appointment is always allowed",
     "UPDATE appointments SET status = 'cancelled' WHERE appointment_id = 6",
     "SELECT status FROM appointments WHERE appointment_id = 6", "cancelled"),
    ("offices: deleting an office sets professors.office_id to NULL",
     "DELETE FROM offices WHERE office_id = 1",
     "SELECT office_id FROM professors WHERE professor_id = 1", None),
    ("users: deleting a student account cascades to everything they own",
     "DELETE FROM users WHERE user_id = 9",
     "SELECT (SELECT COUNT(*) FROM students WHERE student_id = 9)"
     " + (SELECT COUNT(*) FROM appointments WHERE student_id = 9)"
     " + (SELECT COUNT(*) FROM pins WHERE student_id = 9)"
     " + (SELECT COUNT(*) FROM conversations WHERE student_id = 9)"
     " + (SELECT COUNT(*) FROM messages WHERE conversation_id = 1)"
     " + (SELECT COUNT(*) FROM notifications WHERE user_id = 9)", 0),
    ("defaults: new rows get role, status, locale and timestamps automatically",
     "INSERT INTO users (user_id, email, password_hash, role, full_name_ar, full_name_en) "
     "VALUES (100, 'new@university.example', 'x' || hex(randomblob(16)), 'student', 'اسم', 'Name')",
     "SELECT preferred_locale || '/' || is_active || '/' || (created_at IS NOT NULL) "
     "FROM users WHERE user_id = 100", "ar/1/1"),
]


def fresh_db(rebase_weeks: int = 0) -> sqlite3.Connection:
    conn = reset_db.connect(":memory:")
    reset_db.build(conn, rebase_weeks)
    return conn


def run_constraint_tests() -> list[tuple[bool, str, str]]:
    results = []
    for description, sql, *setup in MUST_FAIL:
        conn = fresh_db()
        if setup:
            conn.executescript(setup[0])
        try:
            conn.execute(sql)
            results.append((False, description, "accepted, expected rejection"))
        except sqlite3.IntegrityError as exc:
            results.append((True, description, f"rejected: {exc}"))
        conn.close()
    for description, sql, check_sql, expected in MUST_SUCCEED:
        conn = fresh_db()
        try:
            conn.execute(sql)
            actual = conn.execute(check_sql).fetchone()[0]
            ok = actual == expected
            results.append((ok, description, f"result {actual!r}" + ("" if ok else f", expected {expected!r}")))
        except sqlite3.DatabaseError as exc:
            results.append((False, description, f"error: {exc}"))
        conn.close()
    return results


def to_local(ts: str) -> datetime:
    return datetime.strptime(ts, "%Y-%m-%d %H:%M:%S") + RIYADH_OFFSET


def day_of_week(local: datetime) -> int:
    return (local.weekday() + 1) % 7  # 0 = Sunday


def check_seed_invariants(conn: sqlite3.Connection) -> list[tuple[bool, str, str]]:
    results = []
    q = lambda sql, *p: conn.execute(sql, p).fetchall()  # noqa: E731

    # Rule: bookings fall inside an office_hours block, on the slot grid, one slot long.
    bad = []
    for appt_id, prof_id, starts, ends, slot in q(
            "SELECT a.appointment_id, a.professor_id, a.starts_at, a.ends_at, p.slot_minutes "
            "FROM appointments a JOIN professors p ON p.professor_id = a.professor_id"):
        start, end = to_local(starts), to_local(ends)
        fits = False
        for block_start, block_end in q(
                "SELECT start_time, end_time FROM schedule_blocks "
                "WHERE professor_id = ? AND kind = 'office_hours' AND day_of_week = ?",
                prof_id, day_of_week(start)):
            b_start = datetime.combine(start.date(), datetime.strptime(block_start, "%H:%M").time())
            b_end = datetime.combine(start.date(), datetime.strptime(block_end, "%H:%M").time())
            on_grid = (start - b_start) % timedelta(minutes=slot) == timedelta(0)
            if b_start <= start and end <= b_end and on_grid:
                fits = True
        if not fits or end - start != timedelta(minutes=slot):
            bad.append(appt_id)
    results.append((not bad, "appointments sit in office hours, on the slot grid, one slot long",
                    f"violations: {bad}" if bad else "all 10 rows valid"))

    # Rule: at most 2 pending/approved future appointments per student per professor.
    counts = q("SELECT student_id, professor_id, COUNT(*) FROM appointments "
               "WHERE status IN ('pending', 'approved') AND starts_at > ? "
               "GROUP BY student_id, professor_id HAVING COUNT(*) > 2", ANCHOR_NOW)
    results.append((not counts, "no student holds more than 2 active future bookings per professor",
                    f"violations: {counts}" if counts else "max per pair is within limit"))

    # Rule: cancellation allowed only until 1 hour before start (updated_at = cancel time).
    late = [r[0] for r in q("SELECT appointment_id, starts_at, updated_at FROM appointments "
                            "WHERE status = 'cancelled'")
            if to_local(r[1]) - to_local(r[2]) < timedelta(hours=1)]
    results.append((not late, "cancellations happened at least 1 hour before start",
                    f"violations: {late}" if late else "ok"))

    # Rule: chat only after a non-declined appointment, or with open messages.
    ineligible = q(
        "SELECT c.conversation_id FROM conversations c JOIN professors p ON p.professor_id = c.professor_id "
        "WHERE p.open_messages = FALSE AND NOT EXISTS ("
        "  SELECT 1 FROM appointments a WHERE a.student_id = c.student_id "
        "  AND a.professor_id = c.professor_id AND a.status <> 'declined')")
    results.append((not ineligible, "every conversation is eligible for chat",
                    f"violations: {ineligible}" if ineligible else "ok"))

    # Participation: a conversation contains at least one message, none before it opened.
    empty = q("SELECT conversation_id FROM conversations c WHERE NOT EXISTS "
              "(SELECT 1 FROM messages m WHERE m.conversation_id = c.conversation_id)")
    early = q("SELECT m.message_id FROM messages m JOIN conversations c "
              "ON c.conversation_id = m.conversation_id WHERE m.created_at < c.created_at")
    results.append((not empty and not early, "conversations have 1..N messages, none before opening",
                    f"empty: {empty}, early: {early}" if empty or early else "ok"))

    # Notifications go to a participant of the linked appointment or conversation.
    outsiders = q(
        "SELECT n.notification_id FROM notifications n "
        "LEFT JOIN appointments a ON a.appointment_id = n.appointment_id "
        "LEFT JOIN conversations c ON c.conversation_id = n.conversation_id "
        "WHERE n.user_id NOT IN (COALESCE(a.student_id, c.student_id), "
        "                        COALESCE(a.professor_id, c.professor_id))")
    results.append((not outsiders, "notifications only reach participants",
                    f"violations: {outsiders}" if outsiders else "ok"))

    # A professor's weekly blocks never overlap (enforced by the API).
    overlaps = q("SELECT a.block_id, b.block_id FROM schedule_blocks a JOIN schedule_blocks b "
                 "ON a.professor_id = b.professor_id AND a.day_of_week = b.day_of_week "
                 "AND a.block_id < b.block_id AND a.start_time < b.end_time AND b.start_time < a.end_time")
    results.append((not overlaps, "no overlapping schedule blocks per professor",
                    f"violations: {overlaps}" if overlaps else "ok"))

    # Every professor has office hours (otherwise "Is Dr. X in?" can never be answered).
    no_hours = q("SELECT professor_id FROM professors p WHERE NOT EXISTS (SELECT 1 FROM schedule_blocks s "
                 "WHERE s.professor_id = p.professor_id AND s.kind = 'office_hours')")
    results.append((not no_hours, "every professor has weekly office hours",
                    f"missing: {no_hours}" if no_hours else "ok"))

    # Seed size: 5-10 rows per table, except the two documented exceptions.
    exceptions = {"users", "schedule_blocks"}
    sizes = reset_db.row_counts(conn)
    off = {t: n for t, n in sizes.items() if t not in exceptions and not 5 <= n <= 10}
    results.append((not off, "5-10 seed rows per table (users, schedule_blocks documented exceptions)",
                    f"out of range: {off}" if off else ", ".join(f"{t}={n}" for t, n in sizes.items())))
    return results


def check_rebase() -> list[tuple[bool, str, str]]:
    weeks = 7
    conn = fresh_db(rebase_weeks=weeks)
    problems = reset_db.health_report(conn)
    first = conn.execute("SELECT starts_at FROM appointments WHERE appointment_id = 6").fetchone()[0]
    expected = "2026-11-29 07:30:00"  # 2026-10-11 + 7 weeks, still a Sunday
    weekdays = Counter(day_of_week(to_local(r[0])) for r in conn.execute("SELECT starts_at FROM appointments"))
    conn.close()
    ok = not problems and first == expected and all(d <= 4 for d in weekdays)
    detail = f"appointment 6 -> {first}; problems: {problems or 'none'}"
    return [(ok, f"rebase by {weeks} weeks keeps data valid and weekdays intact", detail)]


def check_er_diagram_sync() -> list[tuple[bool, str, str]]:
    """Compare the Mermaid entity blocks with the live schema, column by column."""
    text = (reset_db.ROOT / "docs" / "er-diagram.md").read_text(encoding="utf-8")
    diagram = {
        name.lower(): {line.split()[1] for line in body.strip().splitlines()}
        for name, body in re.findall(r"^\s*([A-Z_]+) \{\n(.*?)^\s*\}", text, re.M | re.S)
    }
    conn = fresh_db()
    schema = {
        table: {row[1] for row in conn.execute(f"PRAGMA table_info({table})")}
        for table in reset_db.row_counts(conn)
    }
    conn.close()
    diffs = []
    for table in sorted(schema.keys() | diagram.keys()):
        missing = schema.get(table, set()) - diagram.get(table, set())
        extra = diagram.get(table, set()) - schema.get(table, set())
        if table not in diagram or table not in schema or missing or extra:
            diffs.append(f"{table}: missing {sorted(missing)}, extra {sorted(extra)}")
    return [(not diffs, "docs/er-diagram.md matches db/schema.sql (tables and columns)",
             "; ".join(diffs) if diffs else f"{len(schema)} tables in sync")]


def main() -> int:
    sections = [
        ("Constraint tests (must reject / must accept)", run_constraint_tests()),
        ("Seed invariants (business rules on demo data)", check_seed_invariants(fresh_db())),
        ("Rebase", check_rebase()),
        ("Documentation sync", check_er_diagram_sync()),
    ]
    failures = 0
    for title, results in sections:
        print(f"\n{title}")
        for ok, description, detail in results:
            failures += not ok
            print(f"  [{'PASS' if ok else 'FAIL'}] {description}\n         {detail}")
    total = sum(len(r) for _, r in sections)
    print(f"\n{total - failures}/{total} checks passed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
