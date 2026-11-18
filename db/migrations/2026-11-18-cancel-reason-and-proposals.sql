-- =============================================================================
-- Migration 2026-11-18 (owner request S5c, approved appointments): an optional
-- reason when a professor cancels, and another time a professor can suggest,
-- which the student accepts or turns down. Run after
-- 2026-11-18-profile-photo.sql, once, in the mawjood database:
-- mysql -u root -p mawjood < this file. Existing data is kept.
-- =============================================================================

ALTER TABLE appointments
    ADD COLUMN cancel_reason      VARCHAR(200) NULL AFTER decline_reason,
    ADD COLUMN proposed_starts_at DATETIME     NULL AFTER cancel_reason,
    ADD COLUMN proposed_ends_at   DATETIME     NULL AFTER proposed_starts_at,
    ADD CONSTRAINT ck_appointments_cancel_reason CHECK (
        cancel_reason IS NULL OR (status = 'cancelled' AND CHAR_LENGTH(cancel_reason) >= 1)),
    ADD CONSTRAINT ck_appointments_proposal CHECK (
        (proposed_starts_at IS NULL AND proposed_ends_at IS NULL)
        OR (proposed_starts_at IS NOT NULL AND proposed_ends_at IS NOT NULL
            AND proposed_ends_at > proposed_starts_at
            AND status IN ('pending', 'approved')));

ALTER TABLE notifications
    DROP CHECK ck_notifications_type,
    ADD CONSTRAINT ck_notifications_type CHECK (type IN ('appointment_requested', 'appointment_approved',
                                                         'appointment_declined', 'appointment_cancelled',
                                                         'appointment_moved', 'slot_freed',
                                                         'time_proposed', 'proposal_accepted',
                                                         'proposal_declined', 'new_message'));
