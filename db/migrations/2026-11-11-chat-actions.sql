-- =============================================================================
-- Migration 2026-11-11 (owner decision): edited, deleted and reply messages.
-- Run after 2026-11-11-dates-and-skips.sql, once, in the mawjood database:
-- mysql -u root -p mawjood < this file. Existing messages are kept.
-- =============================================================================

ALTER TABLE messages
    MODIFY body VARCHAR(1000) NULL,
    ADD COLUMN reply_to_id INT NULL AFTER body,
    ADD COLUMN edited_at DATETIME NULL AFTER created_at,
    ADD COLUMN deleted_at DATETIME NULL AFTER edited_at,
    ADD KEY ix_messages_reply (reply_to_id),
    ADD CONSTRAINT fk_messages_reply FOREIGN KEY (reply_to_id)
        REFERENCES messages (message_id) ON DELETE SET NULL ON UPDATE RESTRICT,
    ADD CONSTRAINT ck_messages_deleted CHECK ((deleted_at IS NULL) = (body IS NOT NULL)),
    ADD CONSTRAINT ck_messages_edited_after_sent CHECK (edited_at >= created_at),
    ADD CONSTRAINT ck_messages_deleted_after_sent CHECK (deleted_at >= created_at);

DELIMITER $$

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

DELIMITER ;
