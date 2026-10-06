"""The views in db/queries.sql agree with the API's status rules (CLAUDE.md Sections 4 and 6).

The views are created once per session from db/queries.sql itself (CREATE VIEW
commits, so it cannot run inside a test's transaction). Each check freezes
MySQL's clock for the connection with SET timestamp and compares
v_professor_current_status with app/services/status.py, the code behind every
status the app shows.
"""

import calendar
from datetime import datetime, timedelta

import check_sql
import pytest
from sqlalchemy import text

from app.models import ScheduleBlock, StatusOverride
from app.services.directory import latest_overrides, load_professors
from app.services.status import effective_status
from tests.conftest import DEFAULT_NOW, FAISAL, HUDA, KHALID, NORA, OMAR, REEM, TARIQ

# Sunday 2026-10-04 00:00 in Riyadh, the start of the seed's week.
WEEK_START = datetime(2026, 10, 3, 21, 0)


@pytest.fixture(scope="session")
def views(engine):
    statements = check_sql.parse(check_sql.QUERIES.read_text(encoding="utf-8"))
    created = [s.sql for s in statements if s.sql.upper().startswith("CREATE OR REPLACE VIEW")]
    assert len(created) == 3
    with engine.begin() as connection:
        for sql in created:
            connection.exec_driver_sql(sql)


@pytest.fixture
def frozen(db, views):
    """frozen(moment) sets MySQL's clock for this connection; reset after the test."""

    def freeze(moment: datetime) -> None:
        db.execute(text("SET timestamp = :t"), {"t": calendar.timegm(moment.timetuple())})

    yield freeze
    db.execute(text("SET timestamp = DEFAULT"))


def view_rows(db) -> dict[int, dict]:
    rows = db.execute(text("SELECT * FROM v_professor_current_status")).mappings()
    return {row["professor_id"]: dict(row) for row in rows}


def api_statuses(db, now: datetime) -> dict[int, dict]:
    overrides = latest_overrides(db, now)
    result = {}
    for professor in load_professors(db, active_only=False):
        status = effective_status(now, professor.blocks, overrides.get(professor.professor_id))
        result[professor.professor_id] = {
            "effective_status": status.status,
            "source": status.source,
            "confirmed": int(status.confirmed),
            "note": status.note,
            "status_until": status.until,
            "schedule_status": status.schedule_status,
            "last_manual_update": status.updated_at,
        }
    return result


def add_overrides(db) -> None:
    """Overrides that exercise every rule during the seed week (UTC times; Riyadh = UTC + 3)."""
    monday = datetime(2026, 10, 5)
    tuesday = monday + timedelta(days=1)
    db.add_all(
        [
            # Back in 30 min: active 10:00-10:30 Riyadh, then the timetable again.
            StatusOverride(
                professor_id=NORA,
                status="busy",
                note="Back soon",
                created_at=monday.replace(hour=7),
                expires_at=monday.replace(hour=7, minute=30),
            ),
            # No return time: lasts until midnight Riyadh; confirms "In office" for 4 hours.
            StatusOverride(professor_id=KHALID, status="in_office", created_at=monday.replace(hour=6)),
            # Only the latest counts: the newer, short "busy" ends first, and the older "away"
            # (still unexpired) does not come back.
            StatusOverride(
                professor_id=OMAR,
                status="away",
                note="Conference",
                created_at=tuesday.replace(hour=5),
                expires_at=tuesday.replace(hour=9),
            ),
            StatusOverride(
                professor_id=OMAR,
                status="busy",
                created_at=tuesday.replace(hour=6),
                expires_at=tuesday.replace(hour=6, minute=15),
            ),
            # Set later in the week: ignored before it was made.
            StatusOverride(professor_id=FAISAL, status="in_class", created_at=datetime(2026, 10, 7, 8, 10)),
        ]
    )
    # A professor without a timetable is "unknown".
    db.query(ScheduleBlock).filter(ScheduleBlock.professor_id == TARIQ).delete()
    db.flush()


def test_the_status_view_matches_the_api_every_15_minutes_for_a_week(db, frozen):
    add_overrides(db)
    mismatches = []
    moment = WEEK_START
    while moment < WEEK_START + timedelta(days=7):
        frozen(moment)
        in_sql, in_api = view_rows(db), api_statuses(db, moment)
        for professor_id, expected in in_api.items():
            actual = {key: in_sql[professor_id][key] for key in expected}
            if actual != expected:
                mismatches.append((moment, professor_id, actual, expected))
        moment += timedelta(minutes=15)
    assert not mismatches, mismatches[:3]


def test_the_rules_hold_in_the_view_at_chosen_moments(db, frozen):
    add_overrides(db)
    frozen(datetime(2026, 10, 5, 7, 10))  # Monday 10:10 Riyadh
    rows = view_rows(db)
    assert (rows[NORA]["effective_status"], rows[NORA]["note"]) == ("busy", "Back soon")
    assert (rows[KHALID]["effective_status"], rows[KHALID]["confirmed"]) == ("in_office", 1)
    assert rows[TARIQ]["effective_status"] == "unknown" and rows[TARIQ]["source"] == "none"

    frozen(datetime(2026, 10, 6, 6, 30))  # Tuesday 09:30: Omar's newer update has ended
    assert view_rows(db)[OMAR]["source"] == "schedule"


def test_the_in_office_view_lists_exactly_the_active_professors_in_office(db, frozen):
    frozen(DEFAULT_NOW)  # Monday 10:00 Riyadh
    in_office = db.execute(
        text("SELECT professor_id, confirmed FROM v_professors_in_office_now ORDER BY professor_id")
    ).all()
    from_status = [
        (pid, row["confirmed"])
        for pid, row in sorted(view_rows(db).items())
        if row["effective_status"] == "in_office"
    ]
    assert in_office == from_status
    assert [pid for pid, _ in in_office] == [KHALID, HUDA, REEM]  # office hours on Monday at 10:00
