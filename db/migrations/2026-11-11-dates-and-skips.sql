-- =============================================================================
-- Migration 2026-11-11 (owner decisions): weekly or dated schedule rows with
-- skipped dates, and no per-professor usual appointment length.
-- Brings a database built from the earlier schema.sql up to the current one
-- without losing data (a fresh database needs only schema.sql and seed.sql).
-- Run once, in the mawjood database: mysql -u root -p mawjood < this file.
-- The 'meeting' block kind of the same day is included (step 1) for databases
-- that do not have it yet; it is harmless when they do.
-- =============================================================================

-- 1. The timetable kinds: office hours, classes and meetings.
ALTER TABLE schedule_blocks
    DROP CHECK ck_schedule_blocks_kind,
    ADD CONSTRAINT ck_schedule_blocks_kind CHECK (kind IN ('office_hours', 'class', 'meeting'));

-- 2. No usual appointment length: students choose any length, 15 minutes first.
ALTER TABLE professors
    DROP CHECK ck_professors_slot,
    DROP COLUMN slot_minutes;

-- 3. Weekly (day_of_week, optionally until ends_on) or once (on_date).
ALTER TABLE schedule_blocks
    MODIFY day_of_week TINYINT NULL,
    ADD COLUMN on_date DATE NULL AFTER day_of_week,
    ADD COLUMN ends_on DATE NULL AFTER on_date,
    ADD CONSTRAINT uq_schedule_blocks_date UNIQUE (professor_id, on_date, start_time),
    ADD CONSTRAINT ck_schedule_blocks_when CHECK ((day_of_week IS NULL) <> (on_date IS NULL)),
    ADD CONSTRAINT ck_schedule_blocks_ends CHECK (ends_on IS NULL OR day_of_week IS NOT NULL),
    ADD CONSTRAINT ck_schedule_blocks_on_date CHECK (on_date IS NULL OR DAYOFWEEK(on_date) BETWEEN 1 AND 5);

ALTER TABLE booking_periods
    MODIFY day_of_week TINYINT NULL,
    ADD COLUMN on_date DATE NULL AFTER day_of_week,
    ADD COLUMN ends_on DATE NULL AFTER on_date,
    ADD CONSTRAINT uq_booking_periods_date UNIQUE (professor_id, on_date, start_time),
    ADD CONSTRAINT ck_booking_periods_when CHECK ((day_of_week IS NULL) <> (on_date IS NULL)),
    ADD CONSTRAINT ck_booking_periods_ends CHECK (ends_on IS NULL OR day_of_week IS NOT NULL),
    ADD CONSTRAINT ck_booking_periods_on_date CHECK (on_date IS NULL OR DAYOFWEEK(on_date) BETWEEN 1 AND 5);

ALTER TABLE chat_closed_hours
    MODIFY day_of_week TINYINT NULL,
    ADD COLUMN on_date DATE NULL AFTER day_of_week,
    ADD COLUMN ends_on DATE NULL AFTER on_date,
    ADD CONSTRAINT uq_chat_closed_hours_date UNIQUE (professor_id, on_date, start_time),
    ADD CONSTRAINT ck_chat_closed_hours_when CHECK ((day_of_week IS NULL) <> (on_date IS NULL)),
    ADD CONSTRAINT ck_chat_closed_hours_ends CHECK (ends_on IS NULL OR day_of_week IS NOT NULL);

-- 4. Dates a weekly row does not happen on.
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

DELIMITER $$

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
