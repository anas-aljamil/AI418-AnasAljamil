-- =============================================================================
-- Mawjood: SQLite-specific objects. Load after db/schema.sql, before seed.sql.
-- PostgreSQL equivalent: db/dialect/postgresql.sql
-- =============================================================================

-- Double-booking guard, layer 2: reject an active (pending/approved)
-- appointment whose time range overlaps another active appointment with the
-- same professor. Layer 1 (same start time) is the partial unique index in
-- schema.sql; this trigger also catches overlaps after a professor switches
-- between 15- and 30-minute slots. Ranges are half-open: [starts_at, ends_at).
-- Timestamps compare correctly as text because they share the
-- 'YYYY-MM-DD HH:MM:SS' format.

DROP TRIGGER IF EXISTS trg_appointments_no_overlap_insert;
CREATE TRIGGER trg_appointments_no_overlap_insert
BEFORE INSERT ON appointments
WHEN NEW.status IN ('pending', 'approved')
BEGIN
    SELECT RAISE(ABORT, 'SLOT_TAKEN: overlapping appointment for this professor')
    WHERE EXISTS (
        SELECT 1
        FROM appointments AS a
        WHERE a.professor_id = NEW.professor_id
          AND a.status IN ('pending', 'approved')
          AND a.starts_at < NEW.ends_at
          AND NEW.starts_at < a.ends_at
    );
END;

-- Same rule when an existing row is rescheduled or re-activated.
DROP TRIGGER IF EXISTS trg_appointments_no_overlap_update;
CREATE TRIGGER trg_appointments_no_overlap_update
BEFORE UPDATE OF professor_id, starts_at, ends_at, status ON appointments
WHEN NEW.status IN ('pending', 'approved')
BEGIN
    SELECT RAISE(ABORT, 'SLOT_TAKEN: overlapping appointment for this professor')
    WHERE EXISTS (
        SELECT 1
        FROM appointments AS a
        WHERE a.professor_id = NEW.professor_id
          AND a.appointment_id <> NEW.appointment_id
          AND a.status IN ('pending', 'approved')
          AND a.starts_at < NEW.ends_at
          AND NEW.starts_at < a.ends_at
    );
END;
