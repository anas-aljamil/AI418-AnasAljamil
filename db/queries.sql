-- =============================================================================
-- Mawjood: SQL queries, views and the double-booking trigger demo (MySQL 8.0)
--
-- Run inside the mawjood database after db/schema.sql and db/seed.sql, e.g.
--     mysql -u root -p mawjood < db/queries.sql
-- or open it in MySQL Workbench and run it all. Every statement succeeds and
-- the file changes no data: the trigger demo at the end runs inside a
-- transaction that is rolled back. It creates or replaces the three views.
-- scripts/check_sql.py runs it on a throwaway copy and prints the coverage.
--
-- Layout: views first, then one section per table (at least 5 queries and 2
-- aggregates each), then queries across tables, then the trigger demo.
-- Each statement has a comment saying what it answers; "App:" names the screen
-- that asks the same question through the API.
--
-- The clock. Live status depends on the current time, so this session is
-- frozen at the demo moment, Monday 2026-10-05 10:00 in Riyadh (07:00 UTC),
-- the same moment as the API's DEMO_NOW. SET timestamp changes NOW() and
-- UTC_TIMESTAMP() for this connection only. Delete the SET timestamp line to
-- use the real time (after scripts/reset_db.py --rebase, the seed week is the
-- current week).
-- All *_at columns are UTC; Riyadh is always UTC+03:00 (no daylight saving).
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET timestamp = UNIX_TIMESTAMP('2026-10-05 07:00:00');


-- =============================================================================
-- 1. views
-- =============================================================================

-- V1. v_professor_current_status: every professor's effective status right now,
-- with the CLAUDE.md Section 4 rules written in SQL (the API computes the same
-- in backend/app/services/status.py):
--   * only the latest manual update counts; it is active until its return time,
--     or until the end of that Riyadh day when it has none;
--   * otherwise the timetable decides: inside office hours = in_office, inside a
--     class = in_class, outside every block = away, no timetable at all = unknown;
--   * "In office" from the timetable with no manual update in the last 4 hours
--     is not confirmed.
CREATE OR REPLACE VIEW v_professor_current_status AS
WITH clock AS (
    SELECT UTC_TIMESTAMP()                                 AS now_utc,
           CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+03:00') AS now_riyadh
),
latest_override AS (
    SELECT o.professor_id, o.status, o.note, o.created_at,
           COALESCE(o.expires_at,
                    CONVERT_TZ(TIMESTAMP(DATE(CONVERT_TZ(o.created_at, '+00:00', '+03:00')) + INTERVAL 1 DAY),
                               '+03:00', '+00:00')) AS ends_at,
           ROW_NUMBER() OVER (PARTITION BY o.professor_id
                              ORDER BY o.created_at DESC, o.override_id DESC) AS recency
    FROM status_overrides AS o
    CROSS JOIN clock AS c
    WHERE o.created_at <= c.now_utc
),
current_block AS (
    SELECT b.professor_id, b.kind, b.end_time
    FROM schedule_blocks AS b
    CROSS JOIN clock AS c
    WHERE b.day_of_week = DAYOFWEEK(c.now_riyadh) - 1      -- DAYOFWEEK: 1 = Sunday
      AND b.start_time <= TIME(c.now_riyadh)
      AND TIME(c.now_riyadh) < b.end_time
),
combined AS (
    SELECT p.professor_id, c.now_utc, c.now_riyadh,
           CASE
               WHEN NOT EXISTS (SELECT 1 FROM schedule_blocks AS any_block
                                WHERE any_block.professor_id = p.professor_id) THEN 'unknown'
               WHEN cb.kind = 'office_hours' THEN 'in_office'
               WHEN cb.kind = 'class'        THEN 'in_class'
               ELSE 'away'
           END AS schedule_status,
           cb.end_time AS block_end,
           lo.status, lo.note, lo.created_at AS updated_at, lo.ends_at,
           COALESCE(c.now_utc < lo.ends_at, FALSE) AS override_active
    FROM professors AS p
    CROSS JOIN clock AS c
    LEFT JOIN current_block AS cb ON cb.professor_id = p.professor_id
    LEFT JOIN latest_override AS lo ON lo.professor_id = p.professor_id AND lo.recency = 1
)
SELECT x.professor_id,
       IF(x.override_active, x.status, x.schedule_status) AS effective_status,
       CASE WHEN x.override_active THEN 'override'
            WHEN x.schedule_status = 'unknown' THEN 'none'
            ELSE 'schedule' END AS source,
       -- 0 for "unknown" and for an unconfirmed "In office".
       (IF(x.override_active, x.status, x.schedule_status) <> 'unknown'
        AND NOT (IF(x.override_active, x.status, x.schedule_status) = 'in_office'
                 AND x.schedule_status = 'in_office'
                 AND (x.updated_at IS NULL
                      OR TIMESTAMPDIFF(SECOND, x.updated_at, x.now_utc) > 4 * 3600))) AS confirmed,
       IF(x.override_active, x.note, NULL) AS note,
       -- When the status is expected to change (UTC): the return time, or the end of the current block.
       CASE WHEN x.override_active THEN x.ends_at
            WHEN x.block_end IS NOT NULL
                THEN CONVERT_TZ(TIMESTAMP(DATE(x.now_riyadh), x.block_end), '+03:00', '+00:00')
       END AS status_until,
       x.schedule_status,
       x.updated_at AS last_manual_update,
       TIMESTAMPDIFF(MINUTE, x.updated_at, x.now_utc) AS minutes_since_update
FROM combined AS x;

-- V2. v_professors_in_office_now: who is in their office right now and where,
-- confirmed ones first. App: the "In office" filter in Search.
CREATE OR REPLACE VIEW v_professors_in_office_now AS
SELECT s.professor_id,
       u.full_name_ar, u.full_name_en,
       d.code AS department_code,
       o.building_code, o.floor, o.room_number,
       s.confirmed, s.source, s.note, s.status_until
FROM v_professor_current_status AS s
INNER JOIN users AS u        ON u.user_id = s.professor_id
INNER JOIN professors AS p   ON p.professor_id = s.professor_id
INNER JOIN departments AS d  ON d.department_id = p.department_id
LEFT JOIN offices AS o       ON o.office_id = p.office_id
WHERE s.effective_status = 'in_office'
  AND u.is_active = TRUE;

-- V3. v_upcoming_appointments: pending and approved appointments that have not
-- started, with both names, the Riyadh start time and whether the student may
-- still cancel (until 1 hour before the start). App: Appointments, Upcoming.
CREATE OR REPLACE VIEW v_upcoming_appointments AS
SELECT a.appointment_id, a.status, a.topic, a.note,
       a.student_id,   su.full_name_ar AS student_name_ar,   su.full_name_en AS student_name_en,
       a.professor_id, pu.full_name_ar AS professor_name_ar, pu.full_name_en AS professor_name_en,
       a.starts_at, a.ends_at,
       CONVERT_TZ(a.starts_at, '+00:00', '+03:00') AS starts_at_riyadh,
       TIMESTAMPDIFF(MINUTE, UTC_TIMESTAMP(), a.starts_at) AS minutes_until_start,
       (UTC_TIMESTAMP() <= a.starts_at - INTERVAL 1 HOUR) AS can_cancel
FROM appointments AS a
INNER JOIN users AS su ON su.user_id = a.student_id
INNER JOIN users AS pu ON pu.user_id = a.professor_id
WHERE a.status IN ('pending', 'approved')
  AND a.starts_at > UTC_TIMESTAMP();

-- V4. Use the views: every professor's status, with the label a student sees.
SELECT u.full_name_en,
       s.effective_status,
       CASE WHEN s.effective_status = 'in_office' AND s.confirmed = 0 THEN 'In office (not confirmed)'
            ELSE REPLACE(s.effective_status, '_', ' ') END AS shown_as,
       s.source,
       DATE_FORMAT(CONVERT_TZ(s.status_until, '+00:00', '+03:00'), '%H:%i') AS until_riyadh
FROM v_professor_current_status AS s
INNER JOIN users AS u ON u.user_id = s.professor_id
ORDER BY s.effective_status, u.full_name_en;

-- V5. Aggregate on a view: how many professors are in each status right now.
SELECT effective_status, COUNT(*) AS professors, SUM(confirmed) AS confirmed
FROM v_professor_current_status
GROUP BY effective_status
ORDER BY professors DESC;

-- V6. Use a view: professors in their office now, with their room.
SELECT full_name_en, department_code,
       CONCAT(building_code, '-', room_number, ', floor ', floor) AS office,
       IF(confirmed, 'confirmed', 'not confirmed') AS confirmation
FROM v_professors_in_office_now
ORDER BY confirmed DESC, full_name_en;


-- =============================================================================
-- 2. departments
-- =============================================================================

-- D1. All departments in English alphabetical order. App: admin Departments tab.
SELECT department_id, code, name_en, name_ar
FROM departments
ORDER BY name_en;

-- D2. Search departments by code or by part of either name. App: admin search.
SELECT code, name_en, name_ar
FROM departments
WHERE code LIKE 'S%'
   OR name_en LIKE '%engineering%'          -- the collation ignores case
   OR name_ar LIKE '%هندسة%'
ORDER BY code;

-- D3. Aggregate: professors and students per department, including departments
-- with none (outer joins; COUNT(DISTINCT) because both joins multiply rows).
SELECT d.code, d.name_en,
       COUNT(DISTINCT p.professor_id) AS professors,
       COUNT(DISTINCT s.student_id)   AS students
FROM departments AS d
LEFT JOIN professors AS p ON p.department_id = d.department_id
LEFT JOIN students AS s   ON s.department_id = d.department_id
GROUP BY d.department_id, d.code, d.name_en
ORDER BY professors DESC, d.code;

-- D4. Aggregate: departments with at least two professors (GROUP BY + HAVING).
SELECT d.code, COUNT(*) AS professors
FROM departments AS d
INNER JOIN professors AS p ON p.department_id = d.department_id
GROUP BY d.department_id, d.code
HAVING COUNT(*) >= 2
ORDER BY professors DESC;

-- D5. Departments that have no professor (students there book other departments).
SELECT d.code, d.name_en
FROM departments AS d
LEFT JOIN professors AS p ON p.department_id = d.department_id
WHERE p.professor_id IS NULL;

-- D6. Departments whose students booked a professor from another department.
SELECT DISTINCT sd.code AS student_department, pd.code AS professor_department
FROM appointments AS a
INNER JOIN students AS s     ON s.student_id = a.student_id
INNER JOIN professors AS p   ON p.professor_id = a.professor_id
INNER JOIN departments AS sd ON sd.department_id = s.department_id
INNER JOIN departments AS pd ON pd.department_id = p.department_id
WHERE s.department_id <> p.department_id
ORDER BY student_department;


-- =============================================================================
-- 3. users
-- =============================================================================

-- U1. Active accounts by role, then name. App: who can sign in.
SELECT user_id, role, full_name_en, email
FROM users
WHERE is_active = TRUE
ORDER BY role, full_name_en;

-- U2. Find a person by part of their name in either language. App: admin search.
SELECT user_id, role, full_name_en, full_name_ar
FROM users
WHERE full_name_en LIKE '%harbi%'
   OR full_name_ar LIKE '%الحربي%';

-- U3. Aggregate: accounts per role and preferred language.
SELECT role, preferred_locale, COUNT(*) AS accounts
FROM users
GROUP BY role, preferred_locale
ORDER BY role, preferred_locale;

-- U4. Deactivated accounts (they cannot sign in).
SELECT user_id, role, full_name_en, updated_at
FROM users
WHERE is_active = FALSE;

-- U5. Accounts created during student onboarding week (BETWEEN on a date range).
SELECT user_id, full_name_en, created_at
FROM users
WHERE created_at BETWEEN '2026-08-25 00:00:00' AND '2026-08-31 23:59:59'
ORDER BY created_at;

-- U6. Aggregate: first and latest account per role, for roles with more than one account.
SELECT role, COUNT(*) AS accounts, MIN(created_at) AS first_created, MAX(created_at) AS last_created
FROM users
GROUP BY role
HAVING COUNT(*) > 1;

-- U7. Data quality: student or professor accounts without their subtype row
-- (expected: no rows; admins have no subtype).
SELECT u.user_id, u.role
FROM users AS u
LEFT JOIN students AS s   ON s.student_id = u.user_id
LEFT JOIN professors AS p ON p.professor_id = u.user_id
WHERE (u.role = 'student' AND s.student_id IS NULL)
   OR (u.role = 'professor' AND p.professor_id IS NULL);


-- =============================================================================
-- 4. offices
-- =============================================================================

-- O1. All offices by building and room. App: admin Offices tab.
SELECT office_id, building_code, floor, room_number
FROM offices
ORDER BY building_code, room_number;

-- O2. Offices in buildings A or B on floors 1 to 2 (IN + BETWEEN).
SELECT building_code, floor, room_number
FROM offices
WHERE building_code IN ('A', 'B')
  AND floor BETWEEN 1 AND 2
ORDER BY building_code, floor;

-- O3. Aggregate: offices and floor range per building.
SELECT building_code, COUNT(*) AS offices, MIN(floor) AS lowest_floor, MAX(floor) AS highest_floor
FROM offices
GROUP BY building_code
ORDER BY building_code;

-- O4. Offices nobody uses (free rooms the admin can assign).
SELECT o.building_code, o.room_number
FROM offices AS o
LEFT JOIN professors AS p ON p.office_id = o.office_id
WHERE p.professor_id IS NULL;

-- O5. Aggregate: shared offices, with who shares them (GROUP BY + HAVING).
SELECT o.building_code, o.room_number,
       COUNT(*) AS occupants,
       GROUP_CONCAT(u.full_name_en ORDER BY u.full_name_en SEPARATOR ', ') AS professors
FROM offices AS o
INNER JOIN professors AS p ON p.office_id = o.office_id
INNER JOIN users AS u      ON u.user_id = p.professor_id
GROUP BY o.office_id, o.building_code, o.room_number
HAVING COUNT(*) > 1;

-- O6. Office directory: every office with its occupants, empty ones included
-- (RIGHT JOIN keeps every office).
SELECT o.building_code, o.room_number, u.full_name_en AS occupant
FROM professors AS p
INNER JOIN users AS u ON u.user_id = p.professor_id
RIGHT JOIN offices AS o ON o.office_id = p.office_id
ORDER BY o.building_code, o.room_number;


-- =============================================================================
-- 5. students
-- =============================================================================

-- S1. Computer Science students by study year. App: admin Students tab.
SELECT s.university_no, u.full_name_en, s.study_year
FROM students AS s
INNER JOIN users AS u       ON u.user_id = s.student_id
INNER JOIN departments AS d ON d.department_id = s.department_id
WHERE d.code = 'CS'
ORDER BY s.study_year, u.full_name_en;

-- S2. First- and second-year students of Computer Science or Software Engineering.
SELECT s.university_no, u.full_name_en, d.code, s.study_year
FROM students AS s
INNER JOIN users AS u       ON u.user_id = s.student_id
INNER JOIN departments AS d ON d.department_id = s.department_id
WHERE s.study_year BETWEEN 1 AND 2
  AND d.code IN ('CS', 'SWE')
ORDER BY s.university_no;

-- S3. Aggregate: students and average study year per department.
SELECT d.code, COUNT(*) AS students, ROUND(AVG(s.study_year), 1) AS average_year
FROM students AS s
INNER JOIN departments AS d ON d.department_id = s.department_id
GROUP BY d.department_id, d.code
ORDER BY students DESC;

-- S4. Students who pinned nobody (their Home shows the "search and pin" invitation).
SELECT u.full_name_en
FROM students AS s
INNER JOIN users AS u ON u.user_id = s.student_id
LEFT JOIN pins AS pn  ON pn.student_id = s.student_id
WHERE pn.student_id IS NULL;

-- S5. Aggregate: appointments per student by outcome, for students with at least two.
SELECT u.full_name_en,
       COUNT(*) AS appointments,
       SUM(a.status IN ('pending', 'approved')) AS active,
       SUM(a.status = 'completed')              AS completed,
       SUM(a.status IN ('no_show', 'cancelled', 'declined')) AS other
FROM appointments AS a
INNER JOIN users AS u ON u.user_id = a.student_id
GROUP BY a.student_id, u.full_name_en
HAVING COUNT(*) >= 2
ORDER BY appointments DESC;

-- S6. Students who have never booked an appointment.
SELECT u.full_name_en, u.is_active
FROM students AS s
INNER JOIN users AS u ON u.user_id = s.student_id
WHERE NOT EXISTS (SELECT 1 FROM appointments AS a WHERE a.student_id = s.student_id);


-- =============================================================================
-- 6. professors
-- =============================================================================

-- P1. Professor directory: rank, department and office (an office is optional).
-- App: Search.
SELECT u.full_name_en, p.honorific, p.academic_rank, d.code AS department,
       CONCAT(o.building_code, '-', o.room_number) AS office
FROM professors AS p
INNER JOIN users AS u       ON u.user_id = p.professor_id
INNER JOIN departments AS d ON d.department_id = p.department_id
LEFT JOIN offices AS o      ON o.office_id = p.office_id
ORDER BY d.code, u.full_name_en;

-- P2. Professors any student may message, or who give 30-minute slots.
SELECT u.full_name_en, p.open_messages, p.slot_minutes
FROM professors AS p
INNER JOIN users AS u ON u.user_id = p.professor_id
WHERE p.open_messages = TRUE
   OR p.slot_minutes IN (30)
ORDER BY u.full_name_en;

-- P3. Aggregate: professors per academic rank, in rank order.
SELECT academic_rank, COUNT(*) AS professors
FROM professors
GROUP BY academic_rank
ORDER BY FIELD(academic_rank, 'lecturer', 'assistant_professor', 'associate_professor', 'professor');

-- P4. Aggregate: weekly office-hours time per professor, listing those below
-- three hours a week (GROUP BY + HAVING).
SELECT u.full_name_en,
       SUM(TIME_TO_SEC(TIMEDIFF(b.end_time, b.start_time))) DIV 60 AS office_minutes_per_week
FROM professors AS p
INNER JOIN users AS u           ON u.user_id = p.professor_id
INNER JOIN schedule_blocks AS b ON b.professor_id = p.professor_id
WHERE b.kind = 'office_hours'
GROUP BY p.professor_id, u.full_name_en
HAVING office_minutes_per_week < 180;

-- P5. Professors who have never set their status by hand (they rely on the timetable).
SELECT u.full_name_en
FROM professors AS p
INNER JOIN users AS u          ON u.user_id = p.professor_id
LEFT JOIN status_overrides AS o ON o.professor_id = p.professor_id
WHERE o.override_id IS NULL;

-- P6. Search professors by part of a name or department name. App: Search.
SELECT u.full_name_en, u.full_name_ar, d.name_en
FROM professors AS p
INNER JOIN users AS u       ON u.user_id = p.professor_id
INNER JOIN departments AS d ON d.department_id = p.department_id
WHERE u.full_name_en LIKE '%al-%'
  AND d.name_en LIKE '%science%';


-- =============================================================================
-- 7. schedule_blocks
-- =============================================================================

-- B1. Dr. Noura's weekly timetable in Riyadh time. App: profile timeline, Schedule tab.
SELECT ELT(b.day_of_week + 1, 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday') AS day,
       TIME_FORMAT(b.start_time, '%H:%i') AS starts, TIME_FORMAT(b.end_time, '%H:%i') AS ends,
       b.kind, b.label
FROM schedule_blocks AS b
WHERE b.professor_id = 1
ORDER BY b.day_of_week, b.start_time;

-- B2. Office hours on Monday that start between 09:00 and 12:00.
SELECT u.full_name_en, b.start_time, b.end_time
FROM schedule_blocks AS b
INNER JOIN users AS u ON u.user_id = b.professor_id
WHERE b.kind = 'office_hours'
  AND b.day_of_week = 1
  AND b.start_time BETWEEN '09:00:00' AND '12:00:00'
ORDER BY b.start_time;

-- B3. Aggregate: weekly minutes of classes and of office hours per professor.
SELECT u.full_name_en,
       SUM(IF(b.kind = 'class', TIME_TO_SEC(TIMEDIFF(b.end_time, b.start_time)), 0)) DIV 60 AS class_minutes,
       SUM(IF(b.kind = 'office_hours', TIME_TO_SEC(TIMEDIFF(b.end_time, b.start_time)), 0)) DIV 60 AS office_minutes
FROM schedule_blocks AS b
INNER JOIN users AS u ON u.user_id = b.professor_id
GROUP BY b.professor_id, u.full_name_en
ORDER BY u.full_name_en;

-- B4. Aggregate: how many blocks fall on each working day, and the earliest start.
SELECT ELT(day_of_week + 1, 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday') AS day,
       COUNT(*) AS blocks, MIN(start_time) AS earliest
FROM schedule_blocks
GROUP BY day_of_week
ORDER BY day_of_week;

-- B5. Classes of Computer Science courses (label starts with "CS ").
SELECT DISTINCT b.label, u.full_name_en
FROM schedule_blocks AS b
INNER JOIN users AS u ON u.user_id = b.professor_id
WHERE b.kind = 'class'
  AND b.label LIKE 'CS %'
ORDER BY b.label;

-- B6. Blocks happening right now in Riyadh (what the timetable alone says).
SELECT u.full_name_en, b.kind, b.start_time, b.end_time
FROM schedule_blocks AS b
INNER JOIN users AS u ON u.user_id = b.professor_id
WHERE b.day_of_week = DAYOFWEEK(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+03:00')) - 1
  AND TIME(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+03:00')) >= b.start_time
  AND TIME(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+03:00')) < b.end_time;


-- =============================================================================
-- 8. status_overrides
-- =============================================================================

-- SO1. Dr. Noura's manual status history, newest first.
SELECT status, note, created_at, expires_at
FROM status_overrides
WHERE professor_id = 1
ORDER BY created_at DESC;

-- SO2. Updates without a return time (they end at midnight Riyadh time).
SELECT o.override_id, u.full_name_en, o.status, o.created_at
FROM status_overrides AS o
INNER JOIN users AS u ON u.user_id = o.professor_id
WHERE o.expires_at IS NULL;

-- SO3. Aggregate: how often each status is set by hand.
SELECT status, COUNT(*) AS updates, COUNT(DISTINCT professor_id) AS professors
FROM status_overrides
GROUP BY status
ORDER BY updates DESC;

-- SO4. Aggregate: average planned length of updates that have a return time,
-- per status, for statuses used more than once.
SELECT status, ROUND(AVG(TIMESTAMPDIFF(MINUTE, created_at, expires_at))) AS average_minutes
FROM status_overrides
WHERE expires_at IS NOT NULL
GROUP BY status
HAVING COUNT(*) > 1;

-- SO5. Each professor's latest update (only that one counts; window function).
SELECT professor_id, status, note, created_at
FROM (SELECT o.*, ROW_NUMBER() OVER (PARTITION BY professor_id
                                     ORDER BY created_at DESC, override_id DESC) AS recency
      FROM status_overrides AS o) AS ranked
WHERE recency = 1
ORDER BY created_at DESC;

-- SO6. Updates made during the previous week whose note mentions the office
-- or a return (English or Arabic).
SELECT professor_id, status, note
FROM status_overrides
WHERE created_at BETWEEN '2026-09-27 00:00:00' AND '2026-10-01 23:59:59'
  AND (note LIKE '%office%' OR note LIKE '%back%' OR note LIKE '%أعود%');


-- =============================================================================
-- 9. appointments
-- =============================================================================

-- A1. Saad's upcoming appointments, soonest first (view V3). App: Appointments.
SELECT appointment_id, professor_name_en, status,
       DATE_FORMAT(starts_at_riyadh, '%W %d/%m %H:%i') AS starts, can_cancel
FROM v_upcoming_appointments
WHERE student_id = 9
ORDER BY starts_at;

-- A2. Requests waiting for Dr. Noura's answer, oldest request first. App: Requests.
SELECT a.appointment_id, u.full_name_en AS student, a.starts_at, a.topic, a.note
FROM appointments AS a
INNER JOIN users AS u ON u.user_id = a.student_id
WHERE a.professor_id = 1
  AND a.status = 'pending'
ORDER BY a.created_at;

-- A3. Aggregate: appointments in each state of the lifecycle.
SELECT status, COUNT(*) AS appointments
FROM appointments
GROUP BY status
ORDER BY FIELD(status, 'pending', 'approved', 'declined', 'cancelled', 'completed', 'no_show');

-- A4. Aggregate: per professor, requests answered and the share approved or
-- held, for professors with at least two appointments.
SELECT u.full_name_en,
       COUNT(*) AS appointments,
       SUM(a.status <> 'pending') AS answered,
       ROUND(100 * SUM(a.status IN ('approved', 'completed', 'no_show')) / COUNT(*)) AS percent_accepted
FROM appointments AS a
INNER JOIN users AS u ON u.user_id = a.professor_id
GROUP BY a.professor_id, u.full_name_en
HAVING COUNT(*) >= 2;

-- A5. Students at the limit: 2 active future appointments with the same
-- professor (CLAUDE.md Section 4; the API refuses a third).
SELECT student_id, professor_id, COUNT(*) AS active_future
FROM appointments
WHERE status IN ('pending', 'approved')
  AND starts_at > UTC_TIMESTAMP()
GROUP BY student_id, professor_id
HAVING COUNT(*) >= 2;

-- A6. Next week's appointments, Sunday to Thursday in Riyadh time (BETWEEN on UTC bounds).
SELECT appointment_id, professor_id, status,
       CONVERT_TZ(starts_at, '+00:00', '+03:00') AS starts_riyadh
FROM appointments
WHERE starts_at BETWEEN CONVERT_TZ('2026-10-11 00:00:00', '+03:00', '+00:00')
                    AND CONVERT_TZ('2026-10-15 23:59:59', '+03:00', '+00:00')
ORDER BY starts_at;

-- A7. Exam reviews and advising sessions that came with a note for the professor.
SELECT appointment_id, topic, note
FROM appointments
WHERE topic IN ('exam_review', 'advising')
  AND note IS NOT NULL;

-- A8. Busy days: the Riyadh dates with more than one active appointment.
SELECT DATE(CONVERT_TZ(starts_at, '+00:00', '+03:00')) AS riyadh_date, COUNT(*) AS active
FROM appointments
WHERE status IN ('pending', 'approved')
GROUP BY riyadh_date
HAVING COUNT(*) > 1;


-- =============================================================================
-- 10. pins
-- =============================================================================

-- PN1. Saad's pinned professors with their live status (view V1). App: Home.
SELECT u.full_name_en, s.effective_status, s.confirmed
FROM pins AS pn
INNER JOIN users AS u ON u.user_id = pn.professor_id
INNER JOIN v_professor_current_status AS s ON s.professor_id = pn.professor_id
WHERE pn.student_id = 9
ORDER BY u.full_name_en;

-- PN2. Aggregate: the most pinned professors.
SELECT u.full_name_en, COUNT(*) AS pinned_by
FROM pins AS pn
INNER JOIN users AS u ON u.user_id = pn.professor_id
GROUP BY pn.professor_id, u.full_name_en
ORDER BY pinned_by DESC, u.full_name_en;

-- PN3. Aggregate: students who pinned two professors or more.
SELECT u.full_name_en, COUNT(*) AS pins, MAX(pn.created_at) AS last_pinned
FROM pins AS pn
INNER JOIN users AS u ON u.user_id = pn.student_id
GROUP BY pn.student_id, u.full_name_en
HAVING COUNT(*) >= 2;

-- PN4. Pins of professors outside the student's own department.
SELECT su.full_name_en AS student, pu.full_name_en AS professor
FROM pins AS pn
INNER JOIN students AS s   ON s.student_id = pn.student_id
INNER JOIN professors AS p ON p.professor_id = pn.professor_id
INNER JOIN users AS su     ON su.user_id = pn.student_id
INNER JOIN users AS pu     ON pu.user_id = pn.professor_id
WHERE s.department_id <> p.department_id;

-- PN5. Pins made in the first week of September.
SELECT student_id, professor_id, created_at
FROM pins
WHERE created_at BETWEEN '2026-09-01 00:00:00' AND '2026-09-07 23:59:59'
ORDER BY created_at;

-- PN6. Professors nobody has pinned.
SELECT u.full_name_en
FROM professors AS p
INNER JOIN users AS u ON u.user_id = p.professor_id
LEFT JOIN pins AS pn  ON pn.professor_id = p.professor_id
WHERE pn.professor_id IS NULL;


-- =============================================================================
-- 11. conversations
-- =============================================================================

-- C1. Dr. Noura's conversations, latest activity first, with the unread count.
-- App: Messages tab.
SELECT c.conversation_id, u.full_name_en AS student,
       MAX(m.created_at) AS last_message_at,
       SUM(m.sender_role = 'student' AND m.read_at IS NULL) AS unread
FROM conversations AS c
INNER JOIN users AS u   ON u.user_id = c.student_id
LEFT JOIN messages AS m ON m.conversation_id = c.conversation_id
WHERE c.professor_id = 1
GROUP BY c.conversation_id, u.full_name_en
ORDER BY COALESCE(MAX(m.created_at), MAX(c.created_at)) DESC;

-- C2. Why each conversation is allowed (CLAUDE.md Section 4): a non-declined
-- appointment, or the professor accepts messages from everyone.
SELECT c.conversation_id, c.student_id, c.professor_id,
       EXISTS (SELECT 1 FROM appointments AS a
               WHERE a.student_id = c.student_id AND a.professor_id = c.professor_id
                 AND a.status <> 'declined') AS has_booking,
       p.open_messages
FROM conversations AS c
INNER JOIN professors AS p ON p.professor_id = c.professor_id
ORDER BY c.conversation_id;

-- C3. Data quality: conversations that meet neither rule (expected: no rows).
SELECT c.conversation_id
FROM conversations AS c
INNER JOIN professors AS p ON p.professor_id = c.professor_id
WHERE p.open_messages = FALSE
  AND NOT EXISTS (SELECT 1 FROM appointments AS a
                  WHERE a.student_id = c.student_id AND a.professor_id = c.professor_id
                    AND a.status <> 'declined');

-- C4. Aggregate: conversations per professor, including professors with none.
SELECT u.full_name_en, COUNT(c.conversation_id) AS conversations
FROM professors AS p
INNER JOIN users AS u        ON u.user_id = p.professor_id
LEFT JOIN conversations AS c ON c.professor_id = p.professor_id
GROUP BY p.professor_id, u.full_name_en
ORDER BY conversations DESC, u.full_name_en;

-- C5. Aggregate: messages and average message length per conversation.
SELECT c.conversation_id, COUNT(m.message_id) AS messages,
       ROUND(AVG(CHAR_LENGTH(m.body))) AS average_characters
FROM conversations AS c
LEFT JOIN messages AS m ON m.conversation_id = c.conversation_id
GROUP BY c.conversation_id;

-- C6. Conversations started in the last days of September.
SELECT conversation_id, student_id, professor_id, created_at
FROM conversations
WHERE created_at BETWEEN '2026-09-29 00:00:00' AND '2026-09-30 23:59:59'
ORDER BY created_at;


-- =============================================================================
-- 12. messages
-- =============================================================================

-- M1. One thread in order, with the sender's name (the sender is the
-- conversation's student or professor, chosen by sender_role). App: conversation.
SELECT m.message_id,
       IF(m.sender_role = 'student', su.full_name_en, pu.full_name_en) AS sender,
       m.body, m.created_at, m.read_at
FROM messages AS m
INNER JOIN conversations AS c ON c.conversation_id = m.conversation_id
INNER JOIN users AS su        ON su.user_id = c.student_id
INNER JOIN users AS pu        ON pu.user_id = c.professor_id
WHERE m.conversation_id = 3
ORDER BY m.created_at, m.message_id;

-- M2. Unread messages waiting for professors. App: Messages badge.
SELECT c.professor_id, m.message_id, m.body
FROM messages AS m
INNER JOIN conversations AS c ON c.conversation_id = m.conversation_id
WHERE m.sender_role = 'student'
  AND m.read_at IS NULL
ORDER BY c.professor_id, m.created_at;

-- M3. Aggregate: messages and average length by sender role.
SELECT sender_role, COUNT(*) AS messages, ROUND(AVG(CHAR_LENGTH(body))) AS average_characters
FROM messages
GROUP BY sender_role;

-- M4. Aggregate: how fast each professor answers, in minutes from a student's
-- message to the professor's next message (window function LEAD).
SELECT u.full_name_en, COUNT(*) AS replies, ROUND(AVG(reply_minutes)) AS average_reply_minutes
FROM (SELECT c.professor_id, m.sender_role,
             LEAD(m.sender_role) OVER w AS next_role,
             TIMESTAMPDIFF(MINUTE, m.created_at, LEAD(m.created_at) OVER w) AS reply_minutes
      FROM messages AS m
      INNER JOIN conversations AS c ON c.conversation_id = m.conversation_id
      WINDOW w AS (PARTITION BY m.conversation_id ORDER BY m.created_at, m.message_id)) AS pairs
INNER JOIN users AS u ON u.user_id = pairs.professor_id
WHERE pairs.sender_role = 'student' AND pairs.next_role = 'professor'
GROUP BY pairs.professor_id, u.full_name_en
ORDER BY average_reply_minutes;

-- M5. Messages about an appointment or a meeting, in Arabic or English.
SELECT message_id, conversation_id, body
FROM messages
WHERE body LIKE '%موعد%'
   OR body LIKE '%meeting%';

-- M6. Messages sent on Wednesday 30 September (Riyadh day, as UTC bounds).
SELECT message_id, sender_role, CONVERT_TZ(created_at, '+00:00', '+03:00') AS sent_riyadh
FROM messages
WHERE created_at BETWEEN '2026-09-29 21:00:00' AND '2026-09-30 20:59:59'
ORDER BY created_at;


-- =============================================================================
-- 13. notifications
-- =============================================================================

-- N1. Dr. Noura's notifications, newest first, with the sentence the app shows
-- (built from the type and the other person; text is never stored). App: bell.
SELECT n.notification_id,
       CASE n.type
           WHEN 'appointment_requested' THEN CONCAT(other.full_name_en, ' asked for an appointment')
           WHEN 'appointment_approved'  THEN CONCAT(other.full_name_en, ' approved your appointment')
           WHEN 'appointment_declined'  THEN CONCAT(other.full_name_en, ' declined your request')
           WHEN 'appointment_cancelled' THEN CONCAT('Appointment with ', other.full_name_en, ' cancelled')
           ELSE CONCAT('New message from ', other.full_name_en)
       END AS shown_as,
       n.created_at, n.read_at IS NULL AS is_new
FROM notifications AS n
LEFT JOIN appointments AS a  ON a.appointment_id = n.appointment_id
LEFT JOIN conversations AS c ON c.conversation_id = n.conversation_id
INNER JOIN users AS other ON other.user_id =
      CASE WHEN a.appointment_id IS NOT NULL
           THEN IF(a.student_id = n.user_id, a.professor_id, a.student_id)
           ELSE IF(c.student_id = n.user_id, c.professor_id, c.student_id) END
WHERE n.user_id = 1
ORDER BY n.created_at DESC;

-- N2. Aggregate: unread notifications per person (the bell badge), most first.
SELECT u.full_name_en, COUNT(*) AS unread
FROM notifications AS n
INNER JOIN users AS u ON u.user_id = n.user_id
WHERE n.read_at IS NULL
GROUP BY n.user_id, u.full_name_en
ORDER BY unread DESC, u.full_name_en;

-- N3. Aggregate: notifications per type and how many were read.
SELECT type, COUNT(*) AS sent, COUNT(read_at) AS read_count
FROM notifications
GROUP BY type
ORDER BY sent DESC;

-- N4. Appointment notifications created between 29 September and 1 October.
SELECT notification_id, user_id, type, created_at
FROM notifications
WHERE type IN ('appointment_requested', 'appointment_approved', 'appointment_declined', 'appointment_cancelled')
  AND created_at BETWEEN '2026-09-29 00:00:00' AND '2026-10-01 23:59:59'
ORDER BY created_at;

-- N5. Aggregate: notification types that people take more than half an hour
-- to read, on average (read ones only).
SELECT type, ROUND(AVG(TIMESTAMPDIFF(MINUTE, created_at, read_at))) AS average_minutes_to_read
FROM notifications
WHERE read_at IS NOT NULL
GROUP BY type
HAVING AVG(TIMESTAMPDIFF(MINUTE, created_at, read_at)) > 30
ORDER BY average_minutes_to_read DESC;

-- N6. Data quality: notifications sent to someone outside their appointment or
-- conversation (expected: no rows).
SELECT n.notification_id
FROM notifications AS n
LEFT JOIN appointments AS a  ON a.appointment_id = n.appointment_id
LEFT JOIN conversations AS c ON c.conversation_id = n.conversation_id
WHERE n.user_id NOT IN (COALESCE(a.student_id, c.student_id), COALESCE(a.professor_id, c.professor_id));


-- =============================================================================
-- 14. across tables
-- =============================================================================

-- X1. Saad's activity in one timeline: appointments booked, messages sent and
-- professors pinned (UNION ALL keeps every row; one ORDER BY sorts them all).
SELECT a.created_at AS happened_at, 'booked'    AS activity, u.full_name_en AS with_whom
FROM appointments AS a INNER JOIN users AS u ON u.user_id = a.professor_id
WHERE a.student_id = 9
UNION ALL
SELECT m.created_at, 'messaged', u.full_name_en
FROM messages AS m
INNER JOIN conversations AS c ON c.conversation_id = m.conversation_id
INNER JOIN users AS u         ON u.user_id = c.professor_id
WHERE c.student_id = 9 AND m.sender_role = 'student'
UNION ALL
SELECT pn.created_at, 'pinned', u.full_name_en
FROM pins AS pn INNER JOIN users AS u ON u.user_id = pn.professor_id
WHERE pn.student_id = 9
ORDER BY happened_at;

-- X2. Every professor Saad is connected to, once each (UNION removes duplicates).
SELECT professor_id FROM appointments  WHERE student_id = 9
UNION
SELECT professor_id FROM conversations WHERE student_id = 9
UNION
SELECT professor_id FROM pins          WHERE student_id = 9
ORDER BY professor_id;

-- X3. Student-professor pairs with an appointment, a conversation or both.
-- MySQL has no FULL OUTER JOIN, so it is a LEFT JOIN UNION a RIGHT JOIN.
SELECT ap.student_id, ap.professor_id, TRUE AS has_appointment, cv.conversation_id IS NOT NULL AS has_conversation
FROM (SELECT DISTINCT student_id, professor_id FROM appointments) AS ap
LEFT JOIN conversations AS cv ON cv.student_id = ap.student_id AND cv.professor_id = ap.professor_id
UNION
SELECT cv.student_id, cv.professor_id, ap.student_id IS NOT NULL, TRUE
FROM (SELECT DISTINCT student_id, professor_id FROM appointments) AS ap
RIGHT JOIN conversations AS cv ON cv.student_id = ap.student_id AND cv.professor_id = ap.professor_id
ORDER BY student_id, professor_id;


-- =============================================================================
-- 15. double-booking trigger demo
-- =============================================================================

-- T1. Remove a demo procedure left over from an interrupted run, if any.
DROP PROCEDURE IF EXISTS demo_double_booking;

-- T2. Shows the two double-booking guards in schema.sql at work. Each attempt
-- runs inside one transaction that is rolled back, so no data changes (only the
-- AUTO_INCREMENT counter moves on). Errors are caught by a handler and shown as
-- rows, so the file runs to the end in any client. Dr. Noura (professor 1) has
-- appointment 6, approved, Sunday 2026-10-11 10:30-10:45 Riyadh (07:30-07:45 UTC).
--   1. the same slot again                         -> rejected by the BEFORE INSERT trigger
--   2. a 30-minute slot overlapping it              -> rejected by the BEFORE INSERT trigger
--   3. the next slot, back to back (10:45)          -> accepted: ranges are half-open
--   4. moving that new row to 10:40 (UPDATE)        -> rejected by the BEFORE UPDATE trigger
--   5. the slot of a cancelled appointment (5)      -> accepted: cancelled rows free the slot
-- The trigger fires before the UNIQUE (professor_id, active_slot) index is
-- checked; the index is the backstop for two bookings that race each other.
DELIMITER $$
CREATE PROCEDURE demo_double_booking()
BEGIN
    DECLARE outcome VARCHAR(255);
    DECLARE r1, r2, r3, r4, r5 VARCHAR(255);
    DECLARE new_id INT;
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION
        GET DIAGNOSTICS CONDITION 1 outcome = MESSAGE_TEXT;

    START TRANSACTION;

    SET outcome = 'accepted';
    INSERT INTO appointments (student_id, professor_id, starts_at, ends_at, status)
    VALUES (10, 1, '2026-10-11 07:30:00', '2026-10-11 07:45:00', 'pending');
    SET r1 = outcome;

    SET outcome = 'accepted';
    INSERT INTO appointments (student_id, professor_id, starts_at, ends_at, status)
    VALUES (10, 1, '2026-10-11 07:15:00', '2026-10-11 07:45:00', 'pending');
    SET r2 = outcome;

    SET outcome = 'accepted';
    INSERT INTO appointments (student_id, professor_id, starts_at, ends_at, status)
    VALUES (10, 1, '2026-10-11 07:45:00', '2026-10-11 08:00:00', 'pending');
    SET r3 = outcome, new_id = LAST_INSERT_ID();

    SET outcome = 'accepted';
    UPDATE appointments
    SET starts_at = '2026-10-11 07:40:00', ends_at = '2026-10-11 07:55:00'
    WHERE appointment_id = new_id;
    SET r4 = outcome;

    SET outcome = 'accepted';
    INSERT INTO appointments (student_id, professor_id, starts_at, ends_at, status)
    VALUES (10, 5, '2026-09-30 09:15:00', '2026-09-30 09:30:00', 'pending');
    SET r5 = outcome;

    ROLLBACK;

    SELECT 1 AS attempt, 'same slot as appointment 6' AS what, r1 AS outcome
    UNION ALL SELECT 2, '30 minutes overlapping appointment 6', r2
    UNION ALL SELECT 3, 'next slot, back to back', r3
    UNION ALL SELECT 4, 'move that slot to overlap (UPDATE)', r4
    UNION ALL SELECT 5, 'slot of cancelled appointment 5', r5;
END$$
DELIMITER ;

-- T3. Run the demo: one result row per attempt.
CALL demo_double_booking();

-- T4. Remove the demo procedure (it is not part of the schema).
DROP PROCEDURE demo_double_booking;

-- T5. Proof that the demo changed nothing: none of its five rows exists
-- (expected: 0).
SELECT COUNT(*) AS rows_left_by_demo
FROM appointments
WHERE student_id = 10
  AND starts_at IN ('2026-10-11 07:15:00', '2026-10-11 07:30:00', '2026-10-11 07:40:00',
                    '2026-10-11 07:45:00', '2026-09-30 09:15:00');

SET timestamp = DEFAULT;
