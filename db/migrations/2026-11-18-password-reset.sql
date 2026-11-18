-- =============================================================================
-- Migration 2026-11-18 (owner request S5d, forgotten password by email): the one
-- open reset link of an account, stored as the SHA-256 of its token. Run after
-- 2026-11-18-cancel-reason-and-proposals.sql, once, in the mawjood database:
-- mysql -u root -p mawjood < this file. Existing data is kept; no account has an
-- open link.
-- =============================================================================

ALTER TABLE users
    ADD COLUMN password_reset_hash       CHAR(64) COLLATE utf8mb4_0900_bin NULL AFTER photo_updated_at,
    ADD COLUMN password_reset_expires_at DATETIME NULL AFTER password_reset_hash,
    ADD CONSTRAINT uq_users_password_reset UNIQUE (password_reset_hash),
    ADD CONSTRAINT ck_users_password_reset CHECK (
        (password_reset_hash IS NULL AND password_reset_expires_at IS NULL)
        OR (password_reset_hash IS NOT NULL AND password_reset_expires_at IS NOT NULL
            AND REGEXP_LIKE(password_reset_hash, '^[0-9a-f]{64}$', 'c')));
