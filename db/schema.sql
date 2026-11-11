-- =============================================================================
-- Mawjood: database schema (MySQL 8.0, InnoDB, utf8mb4)
--
-- Run inside the mawjood database (db/create_database.sql creates it), then
-- run db/seed.sql. Needs MySQL 8.0.16+ (enforced CHECK constraints) and the
-- default strict SQL mode. Creating the triggers needs root (or SUPER), or
-- log_bin_trust_function_creators = 1 when binary logging is on.
--
-- Conventions
--   * Table names are plural snake_case; no identifier is a MySQL reserved word.
--   * Every *_at column is a DATETIME in UTC. Defaults use UTC_TIMESTAMP(), so
--     they are UTC whatever the session time zone; connections still set
--     time_zone = '+00:00' so NOW() and CURRENT_TIMESTAMP agree.
--   * Weekly schedule times are TIME values in Asia/Riyadh wall-clock time
--     (Riyadh has no daylight saving time; always UTC+03:00).
--   * day_of_week: 0 = Sunday ... 4 = Thursday (working days only).
--   * Human text uses the table collation utf8mb4_0900_ai_ci. Machine codes
--     (role, status, kind, type, ...) use utf8mb4_0900_bin so CHECK lists match
--     exactly: 'Student' is rejected rather than treated as 'student'.
--   * Booleans are declared BOOLEAN (stored as TINYINT(1)) with CHECK (x IN (0, 1)).
--   * Derived values are never stored: effective status, "last updated",
--     message recipient and notification text are computed (docs/normalization.md).
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- Drop in reverse dependency order so the script can be re-run.
-- Triggers are dropped together with their tables.
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS conversations;
DROP TABLE IF EXISTS pins;
DROP TABLE IF EXISTS appointments;
DROP TABLE IF EXISTS status_overrides;
DROP TABLE IF EXISTS chat_closed_hours;
DROP TABLE IF EXISTS booking_periods;
DROP TABLE IF EXISTS schedule_blocks;
DROP TABLE IF EXISTS professors;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS offices;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS departments;
DROP TABLE IF EXISTS colleges;

-- -----------------------------------------------------------------------------
-- colleges: the university's colleges; every department belongs to one. The
-- college name lives here, not on departments, so it is stored once (3NF).
-- -----------------------------------------------------------------------------
CREATE TABLE colleges (
    college_id  INT          NOT NULL AUTO_INCREMENT,
    code        VARCHAR(10)  NOT NULL,
    name_ar     VARCHAR(100) NOT NULL,
    name_en     VARCHAR(100) NOT NULL,
    created_at  DATETIME     NOT NULL DEFAULT (UTC_TIMESTAMP()),
    PRIMARY KEY (college_id),
    CONSTRAINT uq_colleges_code    UNIQUE (code),
    CONSTRAINT uq_colleges_name_ar UNIQUE (name_ar),
    CONSTRAINT uq_colleges_name_en UNIQUE (name_en),
    CONSTRAINT ck_colleges_code    CHECK (REGEXP_LIKE(code, '^[A-Z]{2,10}$', 'c')),
    CONSTRAINT ck_colleges_name_ar CHECK (CHAR_LENGTH(name_ar) >= 2),
    CONSTRAINT ck_colleges_name_en CHECK (CHAR_LENGTH(name_en) >= 2)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- departments: academic departments that professors and students belong to.
-- A college with departments cannot be deleted (RESTRICT).
-- -----------------------------------------------------------------------------
CREATE TABLE departments (
    department_id  INT          NOT NULL AUTO_INCREMENT,
    college_id     INT          NOT NULL,
    code           VARCHAR(10)  NOT NULL,
    name_ar        VARCHAR(100) NOT NULL,
    name_en        VARCHAR(100) NOT NULL,
    created_at     DATETIME     NOT NULL DEFAULT (UTC_TIMESTAMP()),
    PRIMARY KEY (department_id),
    KEY ix_departments_college (college_id),
    CONSTRAINT fk_departments_college FOREIGN KEY (college_id)
        REFERENCES colleges (college_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT uq_departments_code    UNIQUE (code),
    CONSTRAINT uq_departments_name_ar UNIQUE (name_ar),
    CONSTRAINT uq_departments_name_en UNIQUE (name_en),
    CONSTRAINT ck_departments_code    CHECK (REGEXP_LIKE(code, '^[A-Z]{2,10}$', 'c')),
    CONSTRAINT ck_departments_name_ar CHECK (CHAR_LENGTH(name_ar) >= 2),
    CONSTRAINT ck_departments_name_en CHECK (CHAR_LENGTH(name_en) >= 2)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- users: every account (supertype of students and professors; admins have no
-- subtype row). The role comes from the account, never from a user choice.
-- UNIQUE (user_id, role) lets each subtype reference (id, role), so a student
-- row can only point at a 'student' account (and likewise for professors).
-- -----------------------------------------------------------------------------
CREATE TABLE users (
    user_id           INT          NOT NULL AUTO_INCREMENT,
    email             VARCHAR(254) NOT NULL,
    password_hash     VARCHAR(255) NOT NULL,
    role              VARCHAR(10)  COLLATE utf8mb4_0900_bin NOT NULL,
    full_name_ar      VARCHAR(100) NOT NULL,
    full_name_en      VARCHAR(100) NOT NULL,
    preferred_locale  CHAR(2)      COLLATE utf8mb4_0900_bin NOT NULL DEFAULT 'ar',
    is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at        DATETIME     NOT NULL DEFAULT (UTC_TIMESTAMP()),
    updated_at        DATETIME     NOT NULL DEFAULT (UTC_TIMESTAMP()),
    PRIMARY KEY (user_id),
    CONSTRAINT uq_users_email   UNIQUE (email),
    CONSTRAINT uq_users_id_role UNIQUE (user_id, role),
    -- Lower-case address with a dotted domain ('c' = case-sensitive match).
    CONSTRAINT ck_users_email CHECK (
        REGEXP_LIKE(email, '^[a-z0-9._%+-]+@[a-z0-9-]+([.][a-z0-9-]+)+$', 'c')),
    CONSTRAINT ck_users_password_hash CHECK (CHAR_LENGTH(password_hash) >= 20),
    CONSTRAINT ck_users_role          CHECK (role IN ('student', 'professor', 'admin')),
    CONSTRAINT ck_users_full_name_ar  CHECK (CHAR_LENGTH(full_name_ar) >= 2),
    CONSTRAINT ck_users_full_name_en  CHECK (CHAR_LENGTH(full_name_en) >= 2),
    CONSTRAINT ck_users_locale        CHECK (preferred_locale IN ('ar', 'en')),
    CONSTRAINT ck_users_is_active     CHECK (is_active IN (0, 1)),
    CONSTRAINT ck_users_updated_after_created CHECK (updated_at >= created_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- offices: physical office rooms. (building_code, room_number) determines the
-- floor, so the location lives here instead of on professors (3NF); an office
-- may be shared by several professors.
-- -----------------------------------------------------------------------------
CREATE TABLE offices (
    office_id      INT         NOT NULL AUTO_INCREMENT,
    building_code  VARCHAR(10) NOT NULL,
    floor          TINYINT     NOT NULL DEFAULT 0,
    room_number    VARCHAR(10) NOT NULL,
    created_at     DATETIME    NOT NULL DEFAULT (UTC_TIMESTAMP()),
    PRIMARY KEY (office_id),
    CONSTRAINT uq_offices_building_room UNIQUE (building_code, room_number),
    CONSTRAINT ck_offices_building_code CHECK (REGEXP_LIKE(building_code, '^[A-Z0-9]{1,10}$', 'c')),
    CONSTRAINT ck_offices_floor         CHECK (floor BETWEEN 0 AND 20),
    CONSTRAINT ck_offices_room_number   CHECK (REGEXP_LIKE(room_number, '^[A-Z0-9-]{1,10}$', 'c'))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- students: subtype of users (1:1). role is a stored generated constant: it
-- cannot be written, and the composite foreign key accepts only accounts whose
-- role is 'student'. ON UPDATE RESTRICT stops the account's role from changing
-- while this row exists; deleting the account deletes the profile.
-- -----------------------------------------------------------------------------
CREATE TABLE students (
    student_id     INT         NOT NULL,
    role           VARCHAR(10) COLLATE utf8mb4_0900_bin
                   GENERATED ALWAYS AS ('student') STORED NOT NULL,
    university_no  VARCHAR(12) NOT NULL,
    department_id  INT         NOT NULL,
    study_year     TINYINT     NOT NULL DEFAULT 1,
    PRIMARY KEY (student_id),
    CONSTRAINT uq_students_university_no UNIQUE (university_no),
    KEY ix_students_user (student_id, role),
    KEY ix_students_department (department_id),
    CONSTRAINT fk_students_user FOREIGN KEY (student_id, role)
        REFERENCES users (user_id, role) ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT fk_students_department FOREIGN KEY (department_id)
        REFERENCES departments (department_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT ck_students_university_no CHECK (REGEXP_LIKE(university_no, '^[A-Z0-9]{4,12}$', 'c')),
    CONSTRAINT ck_students_study_year    CHECK (study_year BETWEEN 1 AND 6)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- professors: subtype of users (1:1), same role guard as students.
-- (slot_minutes, the usual appointment length, was removed on 2026-11-11:
-- students choose any length, and the app offers 15 minutes first.)
-- -----------------------------------------------------------------------------
CREATE TABLE professors (
    professor_id   INT         NOT NULL,
    role           VARCHAR(10) COLLATE utf8mb4_0900_bin
                   GENERATED ALWAYS AS ('professor') STORED NOT NULL,
    department_id  INT         NOT NULL,
    office_id      INT         NULL,
    honorific      VARCHAR(5)  COLLATE utf8mb4_0900_bin NOT NULL DEFAULT 'dr',
    academic_rank  VARCHAR(20) COLLATE utf8mb4_0900_bin NOT NULL DEFAULT 'assistant_professor',
    PRIMARY KEY (professor_id),
    KEY ix_professors_user (professor_id, role),
    KEY ix_professors_department (department_id),
    KEY ix_professors_office (office_id),
    CONSTRAINT fk_professors_user FOREIGN KEY (professor_id, role)
        REFERENCES users (user_id, role) ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT fk_professors_department FOREIGN KEY (department_id)
        REFERENCES departments (department_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    -- office_id has no CHECK: MySQL forbids CHECKs on a column whose foreign
    -- key action can change it (SET NULL here).
    CONSTRAINT fk_professors_office FOREIGN KEY (office_id)
        REFERENCES offices (office_id) ON DELETE SET NULL ON UPDATE RESTRICT,
    CONSTRAINT ck_professors_honorific CHECK (honorific IN ('dr', 'prof', 'mr', 'ms', 'eng')),
    CONSTRAINT ck_professors_rank      CHECK (academic_rank IN ('lecturer', 'assistant_professor',
                                                               'associate_professor', 'professor'))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- schedule_blocks: a professor's recurring weekly timetable.
-- 'office_hours' blocks derive "In office"; 'class' blocks derive "In class";
-- 'meeting' blocks (department meetings, committees) derive "Busy".
-- Bookings are not tied to these blocks: see booking_periods.
-- Block times sit on a 15-minute grid (whole 5-minute steps).
-- Overlapping blocks for one professor are rejected by the API.
-- When (owner decision 2026-11-11): a row happens either every week on
-- day_of_week, optionally until ends_on (its last date), or once on on_date;
-- exactly one of day_of_week and on_date is set. A weekly row that should not
-- happen on one date has a row in skipped_dates.
-- -----------------------------------------------------------------------------
CREATE TABLE schedule_blocks (
    block_id      INT         NOT NULL AUTO_INCREMENT,
    professor_id  INT         NOT NULL,
    kind          VARCHAR(12) COLLATE utf8mb4_0900_bin NOT NULL DEFAULT 'office_hours',
    day_of_week   TINYINT     NULL,
    on_date       DATE        NULL,
    ends_on       DATE        NULL,
    start_time    TIME        NOT NULL,
    end_time      TIME        NOT NULL,
    label         VARCHAR(40) NULL,
    PRIMARY KEY (block_id),
    CONSTRAINT uq_schedule_blocks_start UNIQUE (professor_id, day_of_week, start_time),
    CONSTRAINT uq_schedule_blocks_date  UNIQUE (professor_id, on_date, start_time),
    CONSTRAINT fk_schedule_blocks_professor FOREIGN KEY (professor_id)
        REFERENCES professors (professor_id) ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT ck_schedule_blocks_kind  CHECK (kind IN ('office_hours', 'class', 'meeting')),
    CONSTRAINT ck_schedule_blocks_day   CHECK (day_of_week BETWEEN 0 AND 4),
    CONSTRAINT ck_schedule_blocks_range CHECK (start_time >= '00:00:00' AND end_time < '24:00:00'),
    CONSTRAINT ck_schedule_blocks_order CHECK (start_time < end_time),
    CONSTRAINT ck_schedule_blocks_grid  CHECK (
        MINUTE(start_time) IN (0, 15, 30, 45) AND SECOND(start_time) = 0
        AND MINUTE(end_time) IN (0, 15, 30, 45) AND SECOND(end_time) = 0),
    CONSTRAINT ck_schedule_blocks_label CHECK (CHAR_LENGTH(label) >= 1),
    CONSTRAINT ck_schedule_blocks_when  CHECK ((day_of_week IS NULL) <> (on_date IS NULL)),
    CONSTRAINT ck_schedule_blocks_ends  CHECK (ends_on IS NULL OR day_of_week IS NOT NULL),
    -- DAYOFWEEK: 1 = Sunday ... 5 = Thursday (working days only).
    CONSTRAINT ck_schedule_blocks_on_date CHECK (on_date IS NULL OR DAYOFWEEK(on_date) BETWEEN 1 AND 5)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- booking_periods: the weekly times a professor accepts bookings in (owner
-- decision 2026-11-07). Chosen by the professor and independent of the
-- timetable: a period may lie inside office hours or outside them, and it does
-- not change the derived status. Bookable times are computed, not stored: any
-- 5-minute start inside a period, for any length that fits in that period.
-- A professor with no periods cannot be booked. Times are Riyadh local on the
-- 15-minute grid, Sunday to Thursday; the API rejects overlapping periods.
-- -----------------------------------------------------------------------------
CREATE TABLE booking_periods (
    period_id     INT     NOT NULL AUTO_INCREMENT,
    professor_id  INT     NOT NULL,
    day_of_week   TINYINT NULL,
    on_date       DATE    NULL,
    ends_on       DATE    NULL,
    start_time    TIME    NOT NULL,
    end_time      TIME    NOT NULL,
    PRIMARY KEY (period_id),
    CONSTRAINT uq_booking_periods_start UNIQUE (professor_id, day_of_week, start_time),
    CONSTRAINT uq_booking_periods_date  UNIQUE (professor_id, on_date, start_time),
    CONSTRAINT fk_booking_periods_professor FOREIGN KEY (professor_id)
        REFERENCES professors (professor_id) ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT ck_booking_periods_day   CHECK (day_of_week BETWEEN 0 AND 4),
    CONSTRAINT ck_booking_periods_range CHECK (start_time >= '00:00:00' AND end_time < '24:00:00'),
    CONSTRAINT ck_booking_periods_order CHECK (start_time < end_time),
    CONSTRAINT ck_booking_periods_grid  CHECK (
        MINUTE(start_time) IN (0, 15, 30, 45) AND SECOND(start_time) = 0
        AND MINUTE(end_time) IN (0, 15, 30, 45) AND SECOND(end_time) = 0),
    CONSTRAINT ck_booking_periods_when  CHECK ((day_of_week IS NULL) <> (on_date IS NULL)),
    CONSTRAINT ck_booking_periods_ends  CHECK (ends_on IS NULL OR day_of_week IS NOT NULL),
    CONSTRAINT ck_booking_periods_on_date CHECK (on_date IS NULL OR DAYOFWEEK(on_date) BETWEEN 1 AND 5)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- chat_closed_hours: weekly times when students cannot send this professor a
-- message (owner decision 2026-11-07; outside them chat is open to every
-- student). Any day of the week (0 = Sunday ... 6 = Saturday), Riyadh local,
-- 15-minute grid. An end at or before the start runs past midnight into the
-- next day ('20:00' -> '08:00' closes the night; '00:00' -> '00:00' closes the
-- whole day). The API rejects overlapping closures for one professor.
-- When (owner decision 2026-11-11): a row happens either every week on
-- day_of_week, optionally until ends_on (its last date), or once on on_date;
-- exactly one of day_of_week and on_date is set. A weekly row that should not
-- happen on one date has a row in skipped_dates.
-- A dated closure may fall on any day, Friday and Saturday included.
-- -----------------------------------------------------------------------------
CREATE TABLE chat_closed_hours (
    closure_id    INT     NOT NULL AUTO_INCREMENT,
    professor_id  INT     NOT NULL,
    day_of_week   TINYINT NULL,
    on_date       DATE    NULL,
    ends_on       DATE    NULL,
    start_time    TIME    NOT NULL,
    end_time      TIME    NOT NULL,
    PRIMARY KEY (closure_id),
    CONSTRAINT uq_chat_closed_hours_start UNIQUE (professor_id, day_of_week, start_time),
    CONSTRAINT uq_chat_closed_hours_date  UNIQUE (professor_id, on_date, start_time),
    CONSTRAINT fk_chat_closed_hours_professor FOREIGN KEY (professor_id)
        REFERENCES professors (professor_id) ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT ck_chat_closed_hours_day   CHECK (day_of_week BETWEEN 0 AND 6),
    CONSTRAINT ck_chat_closed_hours_range CHECK (start_time >= '00:00:00' AND start_time < '24:00:00'
                                                 AND end_time >= '00:00:00' AND end_time < '24:00:00'),
    CONSTRAINT ck_chat_closed_hours_grid  CHECK (
        MINUTE(start_time) IN (0, 15, 30, 45) AND SECOND(start_time) = 0
        AND MINUTE(end_time) IN (0, 15, 30, 45) AND SECOND(end_time) = 0),
    CONSTRAINT ck_chat_closed_hours_when  CHECK ((day_of_week IS NULL) <> (on_date IS NULL)),
    CONSTRAINT ck_chat_closed_hours_ends  CHECK (ends_on IS NULL OR day_of_week IS NOT NULL)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- skipped_dates: one date on which a weekly row does not happen (owner
-- decision 2026-11-11), e.g. no office hours on 20 October. Each row belongs
-- to exactly one weekly schedule block, booking period or chat closure (the
-- triggers below enforce "exactly one": MySQL forbids a CHECK on columns
-- whose foreign key action can change them, CASCADE here). That the date is
-- one of the parent's dates is checked by the API.
-- -----------------------------------------------------------------------------
CREATE TABLE skipped_dates (
    skip_id     INT      NOT NULL AUTO_INCREMENT,
    block_id    INT      NULL,
    period_id   INT      NULL,
    closure_id  INT      NULL,
    skip_date   DATE     NOT NULL,
    created_at  DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
    PRIMARY KEY (skip_id),
    CONSTRAINT uq_skipped_dates_block   UNIQUE (block_id, skip_date),
    CONSTRAINT uq_skipped_dates_period  UNIQUE (period_id, skip_date),
    CONSTRAINT uq_skipped_dates_closure UNIQUE (closure_id, skip_date),
    CONSTRAINT fk_skipped_dates_block FOREIGN KEY (block_id)
        REFERENCES schedule_blocks (block_id) ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT fk_skipped_dates_period FOREIGN KEY (period_id)
        REFERENCES booking_periods (period_id) ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT fk_skipped_dates_closure FOREIGN KEY (closure_id)
        REFERENCES chat_closed_hours (closure_id) ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT ck_skipped_dates_created CHECK (created_at >= '2026-01-01 00:00:00')
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- status_overrides: manual status updates (history is kept; the latest
-- unexpired row wins). expires_at is the optional "back at" time; when it is
-- NULL the API expires the override at the end of that Riyadh day.
-- -----------------------------------------------------------------------------
CREATE TABLE status_overrides (
    override_id   INT         NOT NULL AUTO_INCREMENT,
    professor_id  INT         NOT NULL,
    status        VARCHAR(10) COLLATE utf8mb4_0900_bin NOT NULL,
    note          VARCHAR(60) NULL,
    created_at    DATETIME    NOT NULL DEFAULT (UTC_TIMESTAMP()),
    expires_at    DATETIME    NULL,
    PRIMARY KEY (override_id),
    KEY ix_status_overrides_prof_time (professor_id, created_at),
    CONSTRAINT fk_status_overrides_professor FOREIGN KEY (professor_id)
        REFERENCES professors (professor_id) ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT ck_status_overrides_status CHECK (status IN ('in_office', 'in_class', 'busy', 'away')),
    CONSTRAINT ck_status_overrides_note   CHECK (CHAR_LENGTH(note) >= 1),
    CONSTRAINT ck_status_overrides_expiry CHECK (expires_at > created_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- appointments: a student's booking of a stretch of a professor's office hours.
-- ends_at is stored because the student chooses the length (5-minute steps);
-- it is not derived from slot_minutes, which is only the suggested length.
-- Lifecycle: pending -> approved | declined | cancelled; approved -> cancelled
-- | completed | no_show (transitions enforced by the API).
--
-- Double-booking guard, layer 1: active_slot is a virtual generated column
-- holding starts_at (as text) for pending/approved rows and NULL otherwise. A
-- UNIQUE index allows many NULLs, so (professor_id, active_slot) forbids two
-- active appointments at the same start while cancelled/declined rows free the
-- slot. MySQL has no partial indexes; this is the equivalent.
-- The key is text, not DATETIME, because of a MySQL 8.0 defect: with a BEFORE
-- INSERT trigger on the table, a generated DATETIME column fails with error
-- 1292 whenever created_at/updated_at are left to their default (reproduction
-- in docs/normalization.md). CAST(starts_at AS CHAR) gives the same
-- 'YYYY-MM-DD HH:MM:SS' value and is not affected.
-- Layer 2 (overlapping times of different lengths) is the trigger pair below.
-- -----------------------------------------------------------------------------
CREATE TABLE appointments (
    appointment_id    INT          NOT NULL AUTO_INCREMENT,
    student_id        INT          NOT NULL,
    professor_id      INT          NOT NULL,
    starts_at         DATETIME     NOT NULL,
    ends_at           DATETIME     NOT NULL,
    status            VARCHAR(10)  COLLATE utf8mb4_0900_bin NOT NULL DEFAULT 'pending',
    topic             VARCHAR(12)  COLLATE utf8mb4_0900_bin NULL,
    note              VARCHAR(200) NULL,
    created_at        DATETIME     NOT NULL DEFAULT (UTC_TIMESTAMP()),
    updated_at        DATETIME     NOT NULL DEFAULT (UTC_TIMESTAMP()),
    active_slot       VARCHAR(19)  COLLATE utf8mb4_0900_bin GENERATED ALWAYS AS (
                          CASE WHEN status IN ('pending', 'approved')
                               THEN CAST(starts_at AS CHAR(19)) END) VIRTUAL,
    PRIMARY KEY (appointment_id),
    CONSTRAINT uq_appointments_active_slot UNIQUE (professor_id, active_slot),
    KEY ix_appointments_prof_time (professor_id, starts_at),
    KEY ix_appointments_student (student_id, starts_at),
    CONSTRAINT fk_appointments_student FOREIGN KEY (student_id)
        REFERENCES students (student_id) ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT fk_appointments_professor FOREIGN KEY (professor_id)
        REFERENCES professors (professor_id) ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT ck_appointments_status CHECK (status IN ('pending', 'approved', 'declined',
                                                        'cancelled', 'completed', 'no_show')),
    CONSTRAINT ck_appointments_topic  CHECK (topic IN ('assignment', 'exam_review', 'advising', 'other')),
    CONSTRAINT ck_appointments_note   CHECK (CHAR_LENGTH(note) >= 1),
    CONSTRAINT ck_appointments_time_order CHECK (ends_at > starts_at),
    CONSTRAINT ck_appointments_updated_after_created CHECK (updated_at >= created_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- pins: professors a student pinned to "My professors" (M:N).
-- -----------------------------------------------------------------------------
CREATE TABLE pins (
    student_id    INT      NOT NULL,
    professor_id  INT      NOT NULL,
    created_at    DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
    PRIMARY KEY (student_id, professor_id),
    KEY ix_pins_professor (professor_id),
    CONSTRAINT fk_pins_student FOREIGN KEY (student_id)
        REFERENCES students (student_id) ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT fk_pins_professor FOREIGN KEY (professor_id)
        REFERENCES professors (professor_id) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- conversations: one chat thread per student-professor pair. The foreign keys
-- to the subtype tables guarantee chat is only ever student <-> professor.
-- Any student may write to any active professor outside the professor's
-- chat_closed_hours; the API checks the closed hours on every student message.
-- -----------------------------------------------------------------------------
CREATE TABLE conversations (
    conversation_id  INT      NOT NULL AUTO_INCREMENT,
    student_id       INT      NOT NULL,
    professor_id     INT      NOT NULL,
    created_at       DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
    PRIMARY KEY (conversation_id),
    CONSTRAINT uq_conversations_pair UNIQUE (student_id, professor_id),
    KEY ix_conversations_professor (professor_id),
    CONSTRAINT fk_conversations_student FOREIGN KEY (student_id)
        REFERENCES students (student_id) ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT fk_conversations_professor FOREIGN KEY (professor_id)
        REFERENCES professors (professor_id) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- messages: sender_role plus the conversation identifies both sender and
-- recipient, so neither user id is stored (and a sender can never be an
-- outsider to the conversation).
-- -----------------------------------------------------------------------------
-- Edited, deleted and reply messages (owner decision 2026-11-11): the sender
-- may change the text within 15 minutes (edited_at) and delete a message at
-- any time; a deleted message keeps its place in the thread but loses its
-- text (body NULL exactly when deleted_at is set). reply_to_id points at an
-- earlier message of the same conversation (trigger below), SET NULL if it
-- goes with its conversation.
CREATE TABLE messages (
    message_id       INT           NOT NULL AUTO_INCREMENT,
    conversation_id  INT           NOT NULL,
    sender_role      VARCHAR(10)   COLLATE utf8mb4_0900_bin NOT NULL,
    body             VARCHAR(1000) NULL,
    reply_to_id      INT           NULL,
    created_at       DATETIME      NOT NULL DEFAULT (UTC_TIMESTAMP()),
    edited_at        DATETIME      NULL,
    deleted_at       DATETIME      NULL,
    read_at          DATETIME      NULL,
    PRIMARY KEY (message_id),
    KEY ix_messages_conversation_time (conversation_id, created_at),
    KEY ix_messages_reply (reply_to_id),
    CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_id)
        REFERENCES conversations (conversation_id) ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT fk_messages_reply FOREIGN KEY (reply_to_id)
        REFERENCES messages (message_id) ON DELETE SET NULL ON UPDATE RESTRICT,
    CONSTRAINT ck_messages_sender_role CHECK (sender_role IN ('student', 'professor')),
    CONSTRAINT ck_messages_body        CHECK (CHAR_LENGTH(TRIM(body)) >= 1),
    CONSTRAINT ck_messages_deleted     CHECK ((deleted_at IS NULL) = (body IS NOT NULL)),
    CONSTRAINT ck_messages_edited_after_sent  CHECK (edited_at >= created_at),
    CONSTRAINT ck_messages_deleted_after_sent CHECK (deleted_at >= created_at),
    CONSTRAINT ck_messages_read_after_sent CHECK (read_at >= created_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- notifications: in-app notifications. Text is rendered from type + the linked
-- row in the reader's language, so it is not stored. Exactly the reference that
-- matches the type must be set. MySQL allows this CHECK because ON DELETE
-- CASCADE removes the row instead of changing the referenced columns
-- (only SET NULL / ON UPDATE CASCADE would conflict; see docs/normalization.md).
-- -----------------------------------------------------------------------------
CREATE TABLE notifications (
    notification_id  INT         NOT NULL AUTO_INCREMENT,
    user_id          INT         NOT NULL,
    type             VARCHAR(25) COLLATE utf8mb4_0900_bin NOT NULL,
    appointment_id   INT         NULL,
    conversation_id  INT         NULL,
    created_at       DATETIME    NOT NULL DEFAULT (UTC_TIMESTAMP()),
    read_at          DATETIME    NULL,
    PRIMARY KEY (notification_id),
    KEY ix_notifications_user_time (user_id, created_at),
    KEY ix_notifications_appointment (appointment_id),
    KEY ix_notifications_conversation (conversation_id),
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id)
        REFERENCES users (user_id) ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT fk_notifications_appointment FOREIGN KEY (appointment_id)
        REFERENCES appointments (appointment_id) ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT fk_notifications_conversation FOREIGN KEY (conversation_id)
        REFERENCES conversations (conversation_id) ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT ck_notifications_type CHECK (type IN ('appointment_requested', 'appointment_approved',
                                                     'appointment_declined', 'appointment_cancelled',
                                                     'appointment_moved', 'slot_freed',
                                                     'new_message')),
    CONSTRAINT ck_notifications_reference CHECK (
        (type = 'new_message' AND conversation_id IS NOT NULL AND appointment_id IS NULL)
        OR (type <> 'new_message' AND appointment_id IS NOT NULL AND conversation_id IS NULL)),
    CONSTRAINT ck_notifications_read_after_created CHECK (read_at >= created_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Double-booking guard, layer 2: reject an active (pending/approved)
-- appointment whose time range overlaps another active appointment with the
-- same professor, e.g. after a professor switches between 15- and 30-minute
-- slots. Ranges are half-open [starts_at, ends_at): back-to-back slots are fine.
-- SQLSTATE '45000' is the standard "unhandled user-defined exception"; MySQL
-- reports it to clients as error 1644 with the message below.
-- -----------------------------------------------------------------------------
DELIMITER $$

CREATE TRIGGER trg_appointments_no_overlap_insert
BEFORE INSERT ON appointments
FOR EACH ROW
BEGIN
    IF NEW.status IN ('pending', 'approved') AND EXISTS (
        SELECT 1
        FROM appointments AS a
        WHERE a.professor_id = NEW.professor_id
          AND a.status IN ('pending', 'approved')
          AND a.starts_at < NEW.ends_at
          AND NEW.starts_at < a.ends_at
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'SLOT_TAKEN: overlapping appointment for this professor';
    END IF;
END$$

-- Same rule when an existing row is rescheduled or re-activated.
CREATE TRIGGER trg_appointments_no_overlap_update
BEFORE UPDATE ON appointments
FOR EACH ROW
BEGIN
    IF NEW.status IN ('pending', 'approved') AND EXISTS (
        SELECT 1
        FROM appointments AS a
        WHERE a.professor_id = NEW.professor_id
          AND a.appointment_id <> NEW.appointment_id
          AND a.status IN ('pending', 'approved')
          AND a.starts_at < NEW.ends_at
          AND NEW.starts_at < a.ends_at
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'SLOT_TAKEN: overlapping appointment for this professor';
    END IF;
END$$

-- A reply quotes a message of its own conversation (a foreign key alone would
-- allow any message).
CREATE TRIGGER trg_messages_reply_same_conversation_insert
BEFORE INSERT ON messages
FOR EACH ROW
BEGIN
    IF NEW.reply_to_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM messages AS m
        WHERE m.message_id = NEW.reply_to_id AND m.conversation_id = NEW.conversation_id
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'REPLY_ELSEWHERE: a reply quotes a message of its own conversation';
    END IF;
END$$

CREATE TRIGGER trg_messages_reply_same_conversation_update
BEFORE UPDATE ON messages
FOR EACH ROW
BEGIN
    IF NEW.reply_to_id IS NOT NULL AND NOT (NEW.reply_to_id <=> OLD.reply_to_id) AND NOT EXISTS (
        SELECT 1 FROM messages AS m
        WHERE m.message_id = NEW.reply_to_id AND m.conversation_id = NEW.conversation_id
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'REPLY_ELSEWHERE: a reply quotes a message of its own conversation';
    END IF;
END$$

-- A skipped date belongs to exactly one parent: a schedule block, a booking
-- period or a chat closure.
CREATE TRIGGER trg_skipped_dates_one_parent_insert
BEFORE INSERT ON skipped_dates
FOR EACH ROW
BEGIN
    IF (NEW.block_id IS NOT NULL) + (NEW.period_id IS NOT NULL) + (NEW.closure_id IS NOT NULL) <> 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'SKIP_PARENT: a skipped date needs exactly one block, period or closure';
    END IF;
END$$

CREATE TRIGGER trg_skipped_dates_one_parent_update
BEFORE UPDATE ON skipped_dates
FOR EACH ROW
BEGIN
    IF (NEW.block_id IS NOT NULL) + (NEW.period_id IS NOT NULL) + (NEW.closure_id IS NOT NULL) <> 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'SKIP_PARENT: a skipped date needs exactly one block, period or closure';
    END IF;
END$$

DELIMITER ;
