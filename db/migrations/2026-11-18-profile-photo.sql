-- =============================================================================
-- Migration 2026-11-18 (owner request S5b, edit profile): an optional profile
-- photo on every account. Run after 2026-11-16-contact-and-decline.sql, once, in
-- the mawjood database: mysql -u root -p mawjood < this file. Existing data is
-- kept; every account starts without a photo.
-- =============================================================================

ALTER TABLE users
    ADD COLUMN photo            MEDIUMBLOB  NULL AFTER updated_at,
    ADD COLUMN photo_type       VARCHAR(10) COLLATE utf8mb4_0900_bin NULL AFTER photo,
    ADD COLUMN photo_updated_at DATETIME    NULL AFTER photo_type,
    ADD CONSTRAINT ck_users_photo_parts CHECK (
        (photo IS NULL AND photo_type IS NULL AND photo_updated_at IS NULL)
        OR (photo IS NOT NULL AND photo_type IS NOT NULL AND photo_updated_at IS NOT NULL)),
    ADD CONSTRAINT ck_users_photo_type CHECK (photo_type IN ('image/jpeg', 'image/png', 'image/webp')),
    ADD CONSTRAINT ck_users_photo_size CHECK (LENGTH(photo) BETWEEN 100 AND 262144);
