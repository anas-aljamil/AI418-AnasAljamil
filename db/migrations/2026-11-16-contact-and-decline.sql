-- =============================================================================
-- Migration 2026-11-16 (owner request, site review): messages from the Help and
-- contact screen, and an optional reason when a professor declines a request.
-- Run after 2026-11-11-chat-actions.sql, once, in the mawjood database:
-- mysql -u root -p mawjood < this file. Existing data is kept.
-- =============================================================================

ALTER TABLE appointments
    ADD COLUMN decline_reason VARCHAR(200) NULL AFTER note,
    ADD CONSTRAINT ck_appointments_decline_reason CHECK (
        decline_reason IS NULL OR (status = 'declined' AND CHAR_LENGTH(decline_reason) >= 1));

-- -----------------------------------------------------------------------------
-- contact_messages: what people send through Help and contact (2026-11-16). The
-- form is open without an account, so the sender gives a name and a reply
-- address; user_id links the account when one was signed in (SET NULL keeps
-- the message if the account is deleted). The name and address are the ones
-- given for this message, not copies of the account (docs/normalization.md).
-- handled_at: when the administrator dealt with it; NULL = still open.
-- -----------------------------------------------------------------------------
CREATE TABLE contact_messages (
    contact_id    INT           NOT NULL AUTO_INCREMENT,
    user_id       INT           NULL,
    sender_name   VARCHAR(100)  NOT NULL,
    sender_email  VARCHAR(254)  NOT NULL,
    topic         VARCHAR(10)   COLLATE utf8mb4_0900_bin NOT NULL DEFAULT 'other',
    body          VARCHAR(1000) NOT NULL,
    created_at    DATETIME      NOT NULL DEFAULT (UTC_TIMESTAMP()),
    handled_at    DATETIME      NULL,
    PRIMARY KEY (contact_id),
    KEY ix_contact_messages_open (handled_at, created_at),
    KEY ix_contact_messages_user (user_id),
    CONSTRAINT fk_contact_messages_user FOREIGN KEY (user_id)
        REFERENCES users (user_id) ON DELETE SET NULL ON UPDATE RESTRICT,
    CONSTRAINT ck_contact_messages_topic CHECK (topic IN ('account', 'problem', 'idea', 'other')),
    CONSTRAINT ck_contact_messages_name  CHECK (CHAR_LENGTH(sender_name) >= 2),
    CONSTRAINT ck_contact_messages_email CHECK (
        REGEXP_LIKE(sender_email, '^[a-z0-9._%+-]+@[a-z0-9-]+([.][a-z0-9-]+)+$', 'c')),
    CONSTRAINT ck_contact_messages_body  CHECK (CHAR_LENGTH(body) >= 5),
    CONSTRAINT ck_contact_messages_handled_after_sent CHECK (handled_at >= created_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

