-- =============================================================================
-- Mawjood: PostgreSQL only. Run after seed.sql so new rows get ids above the
-- explicit ids used by the seed data.
-- =============================================================================
SELECT setval(pg_get_serial_sequence('departments', 'department_id'),        (SELECT MAX(department_id)   FROM departments));
SELECT setval(pg_get_serial_sequence('users', 'user_id'),                    (SELECT MAX(user_id)         FROM users));
SELECT setval(pg_get_serial_sequence('offices', 'office_id'),                (SELECT MAX(office_id)       FROM offices));
SELECT setval(pg_get_serial_sequence('schedule_blocks', 'block_id'),         (SELECT MAX(block_id)        FROM schedule_blocks));
SELECT setval(pg_get_serial_sequence('status_overrides', 'override_id'),     (SELECT MAX(override_id)     FROM status_overrides));
SELECT setval(pg_get_serial_sequence('appointments', 'appointment_id'),      (SELECT MAX(appointment_id)  FROM appointments));
SELECT setval(pg_get_serial_sequence('conversations', 'conversation_id'),    (SELECT MAX(conversation_id) FROM conversations));
SELECT setval(pg_get_serial_sequence('messages', 'message_id'),              (SELECT MAX(message_id)      FROM messages));
SELECT setval(pg_get_serial_sequence('notifications', 'notification_id'),    (SELECT MAX(notification_id) FROM notifications));
