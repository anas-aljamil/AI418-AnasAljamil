-- =============================================================================
-- Mawjood: database schema (portable core)
--
-- Runs unchanged on SQLite 3.35+ and PostgreSQL 13+.
-- Dialect-specific objects (triggers, identity columns) live in:
--   db/dialect/sqlite.sql       loaded after this file on SQLite
--   db/dialect/postgresql.sql   loaded after this file on PostgreSQL
-- Load order: schema.sql -> dialect/<db>.sql -> seed.sql   (scripts/reset_db.py)
--
-- Conventions
--   * Table names are plural snake_case; "users" avoids the PostgreSQL reserved word "user".
--   * Every *_at column is a UTC timestamp written as 'YYYY-MM-DD HH:MM:SS'.
--     SQLite compares timestamps as text, so this exact format is required.
--   * Weekly schedule times are Asia/Riyadh wall-clock 'HH:MM' strings.
--     Riyadh has no daylight saving time (always UTC+03:00).
--   * day_of_week: 0 = Sunday ... 4 = Thursday (working days only).
--   * Derived values are never stored: effective status, "last updated",
--     message recipient and notification text are computed (docs/normalization.md).
--   * SQLite ignores VARCHAR(n) lengths, so maximum lengths are also CHECKed.
--   * SQLite enforces foreign keys only after: PRAGMA foreign_keys = ON;
-- =============================================================================

-- Drop in reverse dependency order so the script can be re-run.
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

-- -----------------------------------------------------------------------------
-- departments: academic departments that professors and students belong to.
-- -----------------------------------------------------------------------------
CREATE TABLE departments (
    department_id  INTEGER      PRIMARY KEY,
    code           VARCHAR(10)  NOT NULL UNIQUE
                   CHECK (length(code) BETWEEN 2 AND 10 AND code = upper(code)),
    name_ar        VARCHAR(100) NOT NULL UNIQUE CHECK (length(name_ar) BETWEEN 2 AND 100),
    name_en        VARCHAR(100) NOT NULL UNIQUE CHECK (length(name_en) BETWEEN 2 AND 100),
    created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- users: every account (supertype of students and professors; admins have no
-- subtype row). The role comes from the account, never from a user choice.
-- UNIQUE (user_id, role) lets subtype tables reference (id, role) so a student
-- row can only point at a 'student' account (and likewise for professors).
-- -----------------------------------------------------------------------------
CREATE TABLE users (
    user_id           INTEGER      PRIMARY KEY,
    email             VARCHAR(254) NOT NULL UNIQUE
                      CHECK (email LIKE '%_@_%._%' AND email = lower(email)),
    password_hash     VARCHAR(255) NOT NULL CHECK (length(password_hash) >= 20),
    role              VARCHAR(10)  NOT NULL CHECK (role IN ('student', 'professor', 'admin')),
    full_name_ar      VARCHAR(100) NOT NULL CHECK (length(full_name_ar) BETWEEN 2 AND 100),
    full_name_en      VARCHAR(100) NOT NULL CHECK (length(full_name_en) BETWEEN 2 AND 100),
    preferred_locale  VARCHAR(2)   NOT NULL DEFAULT 'ar' CHECK (preferred_locale IN ('ar', 'en')),
    is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_users_id_role UNIQUE (user_id, role),
    CONSTRAINT ck_users_updated_after_created CHECK (updated_at >= created_at)
);

-- -----------------------------------------------------------------------------
-- offices: physical office rooms. (building_code, room_number) determines the
-- floor, so the location lives here instead of on professors (3NF); an office
-- may be shared by several professors.
-- -----------------------------------------------------------------------------
CREATE TABLE offices (
    office_id      INTEGER     PRIMARY KEY,
    building_code  VARCHAR(10) NOT NULL CHECK (length(building_code) BETWEEN 1 AND 10),
    floor          INTEGER     NOT NULL DEFAULT 0 CHECK (floor BETWEEN 0 AND 20),
    room_number    VARCHAR(10) NOT NULL CHECK (length(room_number) BETWEEN 1 AND 10),
    created_at     TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_offices_building_room UNIQUE (building_code, room_number)
);

-- -----------------------------------------------------------------------------
-- students: subtype of users (1:1). Deleting the account deletes the profile.
-- -----------------------------------------------------------------------------
CREATE TABLE students (
    student_id     INTEGER     PRIMARY KEY,
    role           VARCHAR(10) NOT NULL DEFAULT 'student' CHECK (role = 'student'),
    university_no  VARCHAR(12) NOT NULL UNIQUE CHECK (length(university_no) BETWEEN 4 AND 12),
    department_id  INTEGER     NOT NULL,
    study_year     INTEGER     NOT NULL DEFAULT 1 CHECK (study_year BETWEEN 1 AND 6),
    CONSTRAINT fk_students_user FOREIGN KEY (student_id, role)
        REFERENCES users (user_id, role) ON DELETE CASCADE,
    CONSTRAINT fk_students_department FOREIGN KEY (department_id)
        REFERENCES departments (department_id) ON DELETE RESTRICT
);

-- -----------------------------------------------------------------------------
-- professors: subtype of users (1:1) with booking and messaging preferences.
-- slot_minutes is the bookable slot length; open_messages lets any student
-- start a chat without an appointment.
-- -----------------------------------------------------------------------------
CREATE TABLE professors (
    professor_id   INTEGER     PRIMARY KEY,
    role           VARCHAR(10) NOT NULL DEFAULT 'professor' CHECK (role = 'professor'),
    department_id  INTEGER     NOT NULL,
    office_id      INTEGER,
    honorific      VARCHAR(5)  NOT NULL DEFAULT 'dr'
                   CHECK (honorific IN ('dr', 'prof', 'mr', 'ms', 'eng')),
    academic_rank  VARCHAR(20) NOT NULL DEFAULT 'assistant_professor'
                   CHECK (academic_rank IN ('lecturer', 'assistant_professor',
                                            'associate_professor', 'professor')),
    slot_minutes   INTEGER     NOT NULL DEFAULT 15 CHECK (slot_minutes IN (15, 30)),
    open_messages  BOOLEAN     NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_professors_user FOREIGN KEY (professor_id, role)
        REFERENCES users (user_id, role) ON DELETE CASCADE,
    CONSTRAINT fk_professors_department FOREIGN KEY (department_id)
        REFERENCES departments (department_id) ON DELETE RESTRICT,
    CONSTRAINT fk_professors_office FOREIGN KEY (office_id)
        REFERENCES offices (office_id) ON DELETE SET NULL
);

-- -----------------------------------------------------------------------------
-- schedule_blocks: a professor's recurring weekly timetable.
-- 'office_hours' blocks are bookable and derive "In office";
-- 'class' blocks derive "In class". Bookable slots are computed, not stored.
-- Times sit on a 15-minute grid so both slot lengths divide them cleanly.
-- Overlapping blocks for one professor are rejected by the API.
-- -----------------------------------------------------------------------------
CREATE TABLE schedule_blocks (
    block_id      INTEGER     PRIMARY KEY,
    professor_id  INTEGER     NOT NULL,
    kind          VARCHAR(12) NOT NULL DEFAULT 'office_hours'
                  CHECK (kind IN ('office_hours', 'class')),
    day_of_week   INTEGER     NOT NULL CHECK (day_of_week BETWEEN 0 AND 4),
    start_time    VARCHAR(5)  NOT NULL,
    end_time      VARCHAR(5)  NOT NULL,
    label         VARCHAR(40) CHECK (length(label) BETWEEN 1 AND 40),
    CONSTRAINT fk_schedule_blocks_professor FOREIGN KEY (professor_id)
        REFERENCES professors (professor_id) ON DELETE CASCADE,
    CONSTRAINT ck_schedule_blocks_start_format CHECK (
        start_time LIKE '__:__'
        AND substr(start_time, 1, 2) BETWEEN '00' AND '23'
        AND substr(start_time, 4, 2) IN ('00', '15', '30', '45')),
    CONSTRAINT ck_schedule_blocks_end_format CHECK (
        end_time LIKE '__:__'
        AND substr(end_time, 1, 2) BETWEEN '00' AND '23'
        AND substr(end_time, 4, 2) IN ('00', '15', '30', '45')),
    CONSTRAINT ck_schedule_blocks_order CHECK (start_time < end_time),
    CONSTRAINT uq_schedule_blocks_start UNIQUE (professor_id, day_of_week, start_time)
);

-- -----------------------------------------------------------------------------
-- status_overrides: manual status updates (history is kept; the latest
-- unexpired row wins). expires_at is the optional "back at" time; when it is
-- NULL the API expires the override at the end of that Riyadh day.
-- -----------------------------------------------------------------------------
CREATE TABLE status_overrides (
    override_id   INTEGER     PRIMARY KEY,
    professor_id  INTEGER     NOT NULL,
    status        VARCHAR(10) NOT NULL CHECK (status IN ('in_office', 'in_class', 'busy', 'away')),
    note          VARCHAR(60) CHECK (length(note) BETWEEN 1 AND 60),
    created_at    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at    TIMESTAMP,
    CONSTRAINT fk_status_overrides_professor FOREIGN KEY (professor_id)
        REFERENCES professors (professor_id) ON DELETE CASCADE,
    CONSTRAINT ck_status_overrides_expiry CHECK (expires_at > created_at)
);

-- -----------------------------------------------------------------------------
-- appointments: a student's booking of one slot with a professor.
-- ends_at is stored (not derived from slot_minutes) because a professor may
-- change slot length later; it records the length agreed at booking time.
-- Lifecycle: pending -> approved | declined | cancelled; approved -> cancelled
-- | completed | no_show (transitions enforced by the API).
-- -----------------------------------------------------------------------------
CREATE TABLE appointments (
    appointment_id  INTEGER      PRIMARY KEY,
    student_id      INTEGER      NOT NULL,
    professor_id    INTEGER      NOT NULL,
    starts_at       TIMESTAMP    NOT NULL,
    ends_at         TIMESTAMP    NOT NULL,
    status          VARCHAR(10)  NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'declined',
                                      'cancelled', 'completed', 'no_show')),
    topic           VARCHAR(12)  CHECK (topic IN ('assignment', 'exam_review', 'advising', 'other')),
    note            VARCHAR(200) CHECK (length(note) BETWEEN 1 AND 200),
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_appointments_student FOREIGN KEY (student_id)
        REFERENCES students (student_id) ON DELETE CASCADE,
    CONSTRAINT fk_appointments_professor FOREIGN KEY (professor_id)
        REFERENCES professors (professor_id) ON DELETE CASCADE,
    CONSTRAINT ck_appointments_time_order CHECK (ends_at > starts_at),
    CONSTRAINT ck_appointments_updated_after_created CHECK (updated_at >= created_at)
);

-- Double-booking guard, layer 1: no two active appointments may start at the
-- same time with the same professor. Cancelled/declined rows free the slot.
-- Layer 2 (overlapping times of different lengths) is a trigger in db/dialect/.
CREATE UNIQUE INDEX uq_appointments_active_slot
    ON appointments (professor_id, starts_at)
    WHERE status IN ('pending', 'approved');

-- -----------------------------------------------------------------------------
-- pins: professors a student pinned to "My professors" (M:N).
-- -----------------------------------------------------------------------------
CREATE TABLE pins (
    student_id    INTEGER   NOT NULL,
    professor_id  INTEGER   NOT NULL,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_pins PRIMARY KEY (student_id, professor_id),
    CONSTRAINT fk_pins_student FOREIGN KEY (student_id)
        REFERENCES students (student_id) ON DELETE CASCADE,
    CONSTRAINT fk_pins_professor FOREIGN KEY (professor_id)
        REFERENCES professors (professor_id) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- conversations: one chat thread per student-professor pair. The foreign keys
-- to the subtype tables guarantee chat is only ever student <-> professor.
-- Eligibility (non-declined appointment or open_messages) is checked by the API.
-- -----------------------------------------------------------------------------
CREATE TABLE conversations (
    conversation_id  INTEGER   PRIMARY KEY,
    student_id       INTEGER   NOT NULL,
    professor_id     INTEGER   NOT NULL,
    created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_conversations_student FOREIGN KEY (student_id)
        REFERENCES students (student_id) ON DELETE CASCADE,
    CONSTRAINT fk_conversations_professor FOREIGN KEY (professor_id)
        REFERENCES professors (professor_id) ON DELETE CASCADE,
    CONSTRAINT uq_conversations_pair UNIQUE (student_id, professor_id)
);

-- -----------------------------------------------------------------------------
-- messages: sender_role plus the conversation identifies both sender and
-- recipient, so neither user id is stored (and a sender can never be an
-- outsider to the conversation).
-- -----------------------------------------------------------------------------
CREATE TABLE messages (
    message_id       INTEGER       PRIMARY KEY,
    conversation_id  INTEGER       NOT NULL,
    sender_role      VARCHAR(10)   NOT NULL CHECK (sender_role IN ('student', 'professor')),
    body             VARCHAR(1000) NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 1000),
    created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at          TIMESTAMP,
    CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_id)
        REFERENCES conversations (conversation_id) ON DELETE CASCADE,
    CONSTRAINT ck_messages_read_after_sent CHECK (read_at >= created_at)
);

-- -----------------------------------------------------------------------------
-- notifications: in-app notifications. Text is rendered from type + the linked
-- row in the reader's language, so it is not stored. Exactly the reference that
-- matches the type must be set.
-- -----------------------------------------------------------------------------
CREATE TABLE notifications (
    notification_id  INTEGER     PRIMARY KEY,
    user_id          INTEGER     NOT NULL,
    type             VARCHAR(25) NOT NULL
                     CHECK (type IN ('appointment_requested', 'appointment_approved',
                                     'appointment_declined', 'appointment_cancelled',
                                     'new_message')),
    appointment_id   INTEGER,
    conversation_id  INTEGER,
    created_at       TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at          TIMESTAMP,
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id)
        REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_notifications_appointment FOREIGN KEY (appointment_id)
        REFERENCES appointments (appointment_id) ON DELETE CASCADE,
    CONSTRAINT fk_notifications_conversation FOREIGN KEY (conversation_id)
        REFERENCES conversations (conversation_id) ON DELETE CASCADE,
    CONSTRAINT ck_notifications_reference CHECK (
        (type = 'new_message' AND conversation_id IS NOT NULL AND appointment_id IS NULL)
        OR (type <> 'new_message' AND appointment_id IS NOT NULL AND conversation_id IS NULL)),
    CONSTRAINT ck_notifications_read_after_created CHECK (read_at >= created_at)
);

-- -----------------------------------------------------------------------------
-- Indexes on foreign keys and the hottest lookups.
-- -----------------------------------------------------------------------------
CREATE INDEX ix_students_department        ON students (department_id);
CREATE INDEX ix_professors_department      ON professors (department_id);
CREATE INDEX ix_professors_office          ON professors (office_id);
CREATE INDEX ix_schedule_blocks_prof_day   ON schedule_blocks (professor_id, day_of_week);
CREATE INDEX ix_status_overrides_prof_time ON status_overrides (professor_id, created_at);
CREATE INDEX ix_appointments_student       ON appointments (student_id, starts_at);
CREATE INDEX ix_appointments_prof_time     ON appointments (professor_id, starts_at);
CREATE INDEX ix_pins_professor             ON pins (professor_id);
CREATE INDEX ix_conversations_professor    ON conversations (professor_id);
CREATE INDEX ix_messages_conversation_time ON messages (conversation_id, created_at);
CREATE INDEX ix_notifications_user_time    ON notifications (user_id, created_at);
CREATE INDEX ix_notifications_appointment  ON notifications (appointment_id);
CREATE INDEX ix_notifications_conversation ON notifications (conversation_id);
