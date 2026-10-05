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
-- slot_minutes is the bookable slot length; open_messages lets any student
-- start a chat without an appointment.
-- -----------------------------------------------------------------------------
CREATE TABLE professors (
    professor_id   INT         NOT NULL,
    role           VARCHAR(10) COLLATE utf8mb4_0900_bin
                   GENERATED ALWAYS AS ('professor') STORED NOT NULL,
    department_id  INT         NOT NULL,
    office_id      INT         NULL,
    honorific      VARCHAR(5)  COLLATE utf8mb4_0900_bin NOT NULL DEFAULT 'dr',
    academic_rank  VARCHAR(20) COLLATE utf8mb4_0900_bin NOT NULL DEFAULT 'assistant_professor',
    slot_minutes   TINYINT     NOT NULL DEFAULT 15,
    open_messages  BOOLEAN     NOT NULL DEFAULT FALSE,
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
                                                               'associate_professor', 'professor')),
    CONSTRAINT ck_professors_slot      CHECK (slot_minutes IN (15, 30)),
    CONSTRAINT ck_professors_open      CHECK (open_messages IN (0, 1))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- schedule_blocks: a professor's recurring weekly timetable.
-- 'office_hours' blocks are bookable and derive "In office";
-- 'class' blocks derive "In class". Bookable slots are computed, not stored.
-- Times sit on a 15-minute grid so both slot lengths divide them cleanly.
-- Overlapping blocks for one professor are rejected by the API.
-- -----------------------------------------------------------------------------
CREATE TABLE schedule_blocks (
    block_id      INT         NOT NULL AUTO_INCREMENT,
    professor_id  INT         NOT NULL,
    kind          VARCHAR(12) COLLATE utf8mb4_0900_bin NOT NULL DEFAULT 'office_hours',
    day_of_week   TINYINT     NOT NULL,
    start_time    TIME        NOT NULL,
    end_time      TIME        NOT NULL,
    label         VARCHAR(40) NULL,
    PRIMARY KEY (block_id),
    CONSTRAINT uq_schedule_blocks_start UNIQUE (professor_id, day_of_week, start_time),
    CONSTRAINT fk_schedule_blocks_professor FOREIGN KEY (professor_id)
        REFERENCES professors (professor_id) ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT ck_schedule_blocks_kind  CHECK (kind IN ('office_hours', 'class')),
    CONSTRAINT ck_schedule_blocks_day   CHECK (day_of_week BETWEEN 0 AND 4),
    CONSTRAINT ck_schedule_blocks_range CHECK (start_time >= '00:00:00' AND end_time < '24:00:00'),
    CONSTRAINT ck_schedule_blocks_order CHECK (start_time < end_time),
    CONSTRAINT ck_schedule_blocks_grid  CHECK (
        MINUTE(start_time) IN (0, 15, 30, 45) AND SECOND(start_time) = 0
        AND MINUTE(end_time) IN (0, 15, 30, 45) AND SECOND(end_time) = 0),
    CONSTRAINT ck_schedule_blocks_label CHECK (CHAR_LENGTH(label) >= 1)
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
-- appointments: a student's booking of one slot with a professor.
-- ends_at is stored (not derived from slot_minutes) because a professor may
-- change slot length later; it records the length agreed at booking time.
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
-- Eligibility (non-declined appointment or open_messages) is checked by the API.
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
CREATE TABLE messages (
    message_id       INT           NOT NULL AUTO_INCREMENT,
    conversation_id  INT           NOT NULL,
    sender_role      VARCHAR(10)   COLLATE utf8mb4_0900_bin NOT NULL,
    body             VARCHAR(1000) NOT NULL,
    created_at       DATETIME      NOT NULL DEFAULT (UTC_TIMESTAMP()),
    read_at          DATETIME      NULL,
    PRIMARY KEY (message_id),
    KEY ix_messages_conversation_time (conversation_id, created_at),
    CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_id)
        REFERENCES conversations (conversation_id) ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT ck_messages_sender_role CHECK (sender_role IN ('student', 'professor')),
    CONSTRAINT ck_messages_body        CHECK (CHAR_LENGTH(TRIM(body)) >= 1),
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

DELIMITER ;
