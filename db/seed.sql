-- =============================================================================
-- Mawjood: seed data (fictional; any resemblance to real people is coincidental)
--
-- Load after db/schema.sql and db/dialect/<db>.sql. Portable to SQLite and PostgreSQL.
-- Explicit ids keep foreign keys readable.
--
-- Demo login for every account: password  Mawjood-Demo-2026
-- (argon2id hashes below; demo-only credentials, never reuse elsewhere).
--
-- Timeline: the seed is anchored on the week of Sunday 2026-10-04.
--   * Past activity: previous week (Sun 2026-09-27 .. Thu 2026-10-01).
--   * Upcoming appointments: next week (Sun 2026-10-11 .. Thu 2026-10-15).
--   scripts/reset_db.py --rebase shifts every timestamp by whole weeks so the
--   anchor week becomes the current week (weekdays and times are preserved).
-- All *_at values are UTC; Riyadh local time = UTC + 3 hours.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- departments (6). BUS has students but no professors (tests optional participation).
-- -----------------------------------------------------------------------------
INSERT INTO departments (department_id, code, name_ar, name_en, created_at) VALUES
    (1, 'CS',   'علوم الحاسب',         'Computer Science',        '2026-08-01 06:00:00'),
    (2, 'IS',   'نظم المعلومات',       'Information Systems',     '2026-08-01 06:00:00'),
    (3, 'SWE',  'هندسة البرمجيات',     'Software Engineering',    '2026-08-01 06:00:00'),
    (4, 'MATH', 'الرياضيات',           'Mathematics',             '2026-08-01 06:00:00'),
    (5, 'EE',   'الهندسة الكهربائية',  'Electrical Engineering',  '2026-08-01 06:00:00'),
    (6, 'BUS',  'إدارة الأعمال',       'Business Administration', '2026-08-01 06:00:00');

-- -----------------------------------------------------------------------------
-- users (16): 8 professors (ids 1-8), 7 students (9-15), 1 admin (16).
-- users is the supertype, so its row count is the sum of its subtypes.
-- User 13 is deactivated (tests that inactive accounts cannot sign in).
-- -----------------------------------------------------------------------------
INSERT INTO users (user_id, email, password_hash, role, full_name_ar, full_name_en,
                   preferred_locale, is_active, created_at, updated_at) VALUES
    (1,  'n.alharbi@university.example',    '$argon2id$v=19$m=65536,t=3,p=4$iwU5PcxdfAi//aFShEBwNw$Xwh35LU5EynPNz3Nuhf2xaFoYJFmE3JEv04gBxktV4A',  'professor', 'نورة الحربي',    'Noura Al-Harbi',    'ar', TRUE,  '2026-08-20 06:00:00', '2026-08-20 06:00:00'),
    (2,  'k.alotaibi@university.example',   '$argon2id$v=19$m=65536,t=3,p=4$n5DW3Y2/+8X0PRDZpTOrkQ$cxsh60Qp8TPQr051JrEQbUTtc4e/bTfFpU7Eb56NzKc',  'professor', 'خالد العتيبي',   'Khalid Al-Otaibi',  'ar', TRUE,  '2026-08-20 06:05:00', '2026-08-20 06:05:00'),
    (3,  'h.alqahtani@university.example',  '$argon2id$v=19$m=65536,t=3,p=4$rWR+vMqiUR2A3sktrbj8oQ$PDk/WpkhwmCO0+It0okmc3XEHLuEOlk7PFsC9rWnsJA',  'professor', 'هدى القحطاني',   'Huda Al-Qahtani',   'ar', TRUE,  '2026-08-20 06:10:00', '2026-09-02 08:00:00'),
    (4,  'o.binsalem@university.example',   '$argon2id$v=19$m=65536,t=3,p=4$dWSCv3EuLEb6q4ta3DxKJA$3bfzXzdaLLE3R4LUt3cmJe53O0AoOdSNHy246sKhBUM',  'professor', 'عمر بن سالم',    'Omar Bin Salem',    'ar', TRUE,  '2026-08-20 06:15:00', '2026-08-20 06:15:00'),
    (5,  'h.marsh@university.example',      '$argon2id$v=19$m=65536,t=3,p=4$FYUPhLCM9JLBRxhaByQ2Hg$2OdSYRRbCTMV6e2lbxuM3AOfPLi3J9sZpxqWJCgKysk',  'professor', 'هيلين مارش',     'Helen Marsh',       'en', TRUE,  '2026-08-20 06:20:00', '2026-08-20 06:20:00'),
    (6,  'f.alzahrani@university.example',  '$argon2id$v=19$m=65536,t=3,p=4$LuEioX7d7Fop2iQnvn5FJQ$sR0T/GvDpLRKBEWRDDRdrGUZcUpeOiyTlD83qXzHUfw',  'professor', 'فيصل الزهراني',  'Faisal Al-Zahrani', 'ar', TRUE,  '2026-08-20 06:25:00', '2026-08-20 06:25:00'),
    (7,  'r.aldosari@university.example',   '$argon2id$v=19$m=65536,t=3,p=4$KasLwthN/0+zhrBRNwkfqw$r1jxwflWeyjdRTuCPD9RaBOztOU922eNXu455IcgCng',  'professor', 'ريم الدوسري',    'Reem Al-Dosari',    'ar', TRUE,  '2026-08-20 06:30:00', '2026-08-20 06:30:00'),
    (8,  't.haddad@university.example',     '$argon2id$v=19$m=65536,t=3,p=4$aUqHsk6dWx0VJdWN+/30dg$D6axsd/x9twcxoRVxFZ0N0ci/Cg/79UmE0aOnJFxIic',  'professor', 'طارق حداد',      'Tariq Haddad',      'en', TRUE,  '2026-08-20 06:35:00', '2026-08-20 06:35:00'),
    (9,  's.almutairi@university.example',  '$argon2id$v=19$m=65536,t=3,p=4$xRr7Nri0sbfEdxmjIw5qdg$GB6PkCYjaLqde9DYYSuTVS41Ts5zcrA3JWQyETzXt5s',  'student',   'سعد المطيري',    'Saad Al-Mutairi',   'ar', TRUE,  '2026-08-25 09:00:00', '2026-08-25 09:00:00'),
    (10, 'l.alshehri@university.example',   '$argon2id$v=19$m=65536,t=3,p=4$u/IxWi6OPilB7PSfIHvfGg$0Nda5bpZ0BbR0E7yemcTQqNldVVc+VI4nmoRZcoFGzU', 'student',   'لمى الشهري',     'Lama Al-Shehri',    'ar', TRUE,  '2026-08-25 09:10:00', '2026-08-25 09:10:00'),
    (11, 'y.alghamdi@university.example',   '$argon2id$v=19$m=65536,t=3,p=4$Wv2eOSRwpt2i7wzyKUxFwQ$yKfUf8xVQnbUupGeV9oPb+yHDj+xtXNp5kM7Vc6LQVY', 'student',   'يوسف الغامدي',   'Yousef Al-Ghamdi',  'en', TRUE,  '2026-08-25 09:20:00', '2026-09-10 12:00:00'),
    (12, 'm.alanazi@university.example',    '$argon2id$v=19$m=65536,t=3,p=4$meWDRSM1BiVa8Kh/n98Q+A$dQEdyAeDTE9a+WpF2k2GDRRt0eAgtOS371/3hwdr4+A', 'student',   'مها العنزي',     'Maha Al-Anazi',     'ar', TRUE,  '2026-08-25 09:30:00', '2026-08-25 09:30:00'),
    (13, 'z.alshammari@university.example', '$argon2id$v=19$m=65536,t=3,p=4$3DPIuP9ndTNOjz/6qCKBUg$QERHWq346RfJFifYaSY6xd8Q8x9/n30STwCnA1P6Ec0', 'student',   'زياد الشمري',    'Ziyad Al-Shammari', 'ar', FALSE, '2026-08-25 09:40:00', '2026-09-30 10:00:00'),
    (14, 's.collins@university.example',    '$argon2id$v=19$m=65536,t=3,p=4$xRTg6Oghoqd/9i9bYimBcw$7dtaOj19hIVQmF59dqDxdtYVK+DknERUB0UfNMBrrSc', 'student',   'سارة كولنز',     'Sarah Collins',     'en', TRUE,  '2026-08-25 09:50:00', '2026-08-25 09:50:00'),
    (15, 'h.almansour@university.example',  '$argon2id$v=19$m=65536,t=3,p=4$qPgQVTxIsx4bPYJh9fcsTw$DfiAbtwfkhc03CPtj8qTBtjCZR0vdyYkjoFPEaVQvcA', 'student',   'حصة المنصور',    'Hessa Al-Mansour',  'ar', TRUE,  '2026-08-25 10:00:00', '2026-08-25 10:00:00'),
    (16, 'admin@university.example',        '$argon2id$v=19$m=65536,t=3,p=4$Bg65xv6QMX4IglPnRqaq0g$+N/S0XtuiVZYCEacw5RXy52pgt0UYHRvpMj70b7IBAk', 'admin',     'سلمى الراشد',    'Salma Al-Rashid',   'ar', TRUE,  '2026-08-01 06:00:00', '2026-08-01 06:00:00');

-- -----------------------------------------------------------------------------
-- offices (8). Office 6 is shared by professors 6 and 7; office 7 is unassigned.
-- -----------------------------------------------------------------------------
INSERT INTO offices (office_id, building_code, floor, room_number, created_at) VALUES
    (1, 'A', 2, '214', '2026-08-01 06:00:00'),
    (2, 'A', 2, '218', '2026-08-01 06:00:00'),
    (3, 'A', 3, '305', '2026-08-01 06:00:00'),
    (4, 'B', 1, '112', '2026-08-01 06:00:00'),
    (5, 'B', 1, '118', '2026-08-01 06:00:00'),
    (6, 'C', 2, '207', '2026-08-01 06:00:00'),
    (7, 'C', 4, '410', '2026-08-01 06:00:00'),
    (8, 'B', 2, '221', '2026-08-01 06:00:00');

-- -----------------------------------------------------------------------------
-- students (7). Student 15 studies Business but books a Mathematics professor.
-- -----------------------------------------------------------------------------
INSERT INTO students (student_id, role, university_no, department_id, study_year) VALUES
    (9,  'student', 'S1001', 1, 3),
    (10, 'student', 'S1002', 1, 2),
    (11, 'student', 'S1003', 3, 4),
    (12, 'student', 'S1004', 2, 1),
    (13, 'student', 'S1005', 1, 3),
    (14, 'student', 'S1006', 3, 2),
    (15, 'student', 'S1007', 6, 1);

-- -----------------------------------------------------------------------------
-- professors (8). Professors 3 and 5 have open messages.
-- -----------------------------------------------------------------------------
INSERT INTO professors (professor_id, role, department_id, office_id, honorific,
                        academic_rank, slot_minutes, open_messages) VALUES
    (1, 'professor', 1, 1, 'dr',   'assistant_professor', 15, FALSE),
    (2, 'professor', 1, 2, 'prof', 'professor',           30, FALSE),
    (3, 'professor', 2, 3, 'dr',   'associate_professor', 15, TRUE),
    (4, 'professor', 3, 4, 'dr',   'assistant_professor', 30, FALSE),
    (5, 'professor', 3, 5, 'dr',   'associate_professor', 15, TRUE),
    (6, 'professor', 4, 6, 'mr',   'lecturer',            15, FALSE),
    (7, 'professor', 4, 6, 'dr',   'assistant_professor', 30, FALSE),
    (8, 'professor', 5, 8, 'dr',   'associate_professor', 15, FALSE);

-- -----------------------------------------------------------------------------
-- schedule_blocks (32): a realistic weekly timetable for every professor.
-- More than 10 rows on purpose: 8 professors x 3-5 weekly blocks is the
-- minimum for the schedule-derived status to be meaningful in a demo.
-- Times are Riyadh local; day 0 = Sunday ... 4 = Thursday.
-- -----------------------------------------------------------------------------
INSERT INTO schedule_blocks (block_id, professor_id, kind, day_of_week, start_time, end_time, label) VALUES
    -- 1 Noura Al-Harbi (CS)
    (1,  1, 'class',        0, '08:00', '09:30', 'CS 211'),
    (2,  1, 'office_hours', 0, '10:00', '12:00', NULL),
    (3,  1, 'class',        1, '13:00', '14:30', 'CS 340'),
    (4,  1, 'class',        2, '08:00', '09:30', 'CS 211'),
    (5,  1, 'office_hours', 2, '10:00', '11:30', NULL),
    -- 2 Khalid Al-Otaibi (CS)
    (6,  2, 'office_hours', 1, '09:00', '11:00', NULL),
    (7,  2, 'class',        1, '11:00', '12:30', 'CS 432'),
    (8,  2, 'office_hours', 3, '09:00', '11:00', NULL),
    (9,  2, 'class',        3, '11:00', '12:30', 'CS 432'),
    -- 3 Huda Al-Qahtani (IS)
    (10, 3, 'office_hours', 0, '12:00', '13:00', NULL),
    (11, 3, 'office_hours', 1, '10:00', '12:00', NULL),
    (12, 3, 'class',        2, '10:00', '11:30', 'IS 230'),
    (13, 3, 'office_hours', 4, '09:00', '10:00', NULL),
    -- 4 Omar Bin Salem (SWE)
    (14, 4, 'class',        0, '10:00', '11:30', 'SWE 312'),
    (15, 4, 'class',        2, '10:00', '11:30', 'SWE 312'),
    (16, 4, 'office_hours', 2, '13:00', '15:00', NULL),
    (17, 4, 'office_hours', 4, '10:00', '12:00', NULL),
    -- 5 Helen Marsh (SWE)
    (18, 5, 'class',        1, '08:00', '09:30', 'SWE 201'),
    (19, 5, 'office_hours', 1, '12:00', '13:30', NULL),
    (20, 5, 'class',        3, '08:00', '09:30', 'SWE 201'),
    (21, 5, 'office_hours', 3, '12:00', '13:30', NULL),
    -- 6 Faisal Al-Zahrani (MATH)
    (22, 6, 'office_hours', 0, '09:00', '10:00', NULL),
    (23, 6, 'class',        0, '10:00', '12:00', 'MATH 101'),
    (24, 6, 'office_hours', 2, '09:00', '10:00', NULL),
    (25, 6, 'office_hours', 4, '11:00', '12:00', NULL),
    -- 7 Reem Al-Dosari (MATH)
    (26, 7, 'office_hours', 1, '10:00', '12:00', NULL),
    (27, 7, 'class',        3, '10:00', '11:30', 'MATH 254'),
    (28, 7, 'office_hours', 3, '13:00', '14:00', NULL),
    -- 8 Tariq Haddad (EE)
    (29, 8, 'class',        0, '08:00', '09:30', 'EE 202'),
    (30, 8, 'office_hours', 0, '13:00', '14:00', NULL),
    (31, 8, 'class',        2, '08:00', '09:30', 'EE 202'),
    (32, 8, 'office_hours', 3, '10:00', '11:00', NULL);

-- -----------------------------------------------------------------------------
-- status_overrides (8): last week's manual updates (all expired by the anchor
-- week, so live status starts from the schedule). Override 4 has no return
-- time and therefore ended with its Riyadh day.
-- -----------------------------------------------------------------------------
INSERT INTO status_overrides (override_id, professor_id, status, note, created_at, expires_at) VALUES
    (1, 1, 'in_office', 'Grading in my office, please knock', '2026-09-27 06:50:00', '2026-09-27 09:00:00'),
    (2, 3, 'busy',      'اجتماع مجلس القسم',                  '2026-09-27 09:00:00', '2026-09-27 10:00:00'),
    (3, 2, 'away',      'في مؤتمر علمي، أعود يوم الخميس',      '2026-09-29 04:30:00', '2026-10-01 05:00:00'),
    (4, 4, 'in_office', NULL,                                 '2026-09-29 10:05:00', NULL),
    (5, 1, 'busy',      'Back in 15 min',                     '2026-09-29 07:40:00', '2026-09-29 07:55:00'),
    (6, 5, 'in_class',  'Extra lab session',                  '2026-09-30 06:00:00', '2026-09-30 08:00:00'),
    (7, 8, 'in_office', 'Extra office hours today',           '2026-09-30 07:00:00', '2026-09-30 10:00:00'),
    (8, 6, 'away',      'إجازة مرضية اليوم',                  '2026-10-01 04:30:00', '2026-10-01 21:00:00');

-- -----------------------------------------------------------------------------
-- appointments (10): every row sits inside an office_hours block on the
-- professor's slot grid. 1-5 are last week (closed states); 6-10 are next week.
-- Student 9 holds 2 active future appointments with professor 1 (the limit).
-- -----------------------------------------------------------------------------
INSERT INTO appointments (appointment_id, student_id, professor_id, starts_at, ends_at,
                          status, topic, note, created_at, updated_at) VALUES
    (1,  9,  1, '2026-09-27 07:00:00', '2026-09-27 07:15:00', 'completed', 'assignment',  NULL,                              '2026-09-24 12:10:00', '2026-09-27 07:20:00'),
    (2,  10, 1, '2026-09-29 07:30:00', '2026-09-29 07:45:00', 'completed', 'exam_review', NULL,                              '2026-09-27 15:00:00', '2026-09-29 07:50:00'),
    (3,  13, 2, '2026-09-28 06:30:00', '2026-09-28 07:00:00', 'no_show',   'advising',    NULL,                              '2026-09-25 09:00:00', '2026-09-28 07:05:00'),
    (4,  11, 4, '2026-10-01 07:00:00', '2026-10-01 07:30:00', 'declined',  'advising',    'Choosing between two electives',  '2026-09-28 18:30:00', '2026-09-29 06:00:00'),
    (5,  14, 5, '2026-09-30 09:15:00', '2026-09-30 09:30:00', 'cancelled', 'assignment',  NULL,                              '2026-09-27 10:00:00', '2026-09-29 16:00:00'),
    (6,  9,  1, '2026-10-11 07:30:00', '2026-10-11 07:45:00', 'approved',  'exam_review', 'مراجعة الفصلين الثالث والرابع',   '2026-09-30 15:00:00', '2026-09-30 16:20:00'),
    (7,  9,  1, '2026-10-13 07:00:00', '2026-10-13 07:15:00', 'pending',   'assignment',  NULL,                              '2026-10-01 13:05:00', '2026-10-01 13:05:00'),
    (8,  12, 3, '2026-10-12 07:00:00', '2026-10-12 07:15:00', 'pending',   'advising',    'اختيار المسار التخصصي',           '2026-10-01 09:40:00', '2026-10-01 09:40:00'),
    (9,  15, 7, '2026-10-12 07:30:00', '2026-10-12 08:00:00', 'approved',  'exam_review', NULL,                              '2026-09-30 11:00:00', '2026-09-30 14:00:00'),
    (10, 11, 4, '2026-10-13 10:30:00', '2026-10-13 11:00:00', 'pending',   'other',       'Feedback on my project proposal', '2026-10-01 19:15:00', '2026-10-01 19:15:00');

-- -----------------------------------------------------------------------------
-- pins (8). Students 12, 13 and 15 have none (home screen empty state).
-- -----------------------------------------------------------------------------
INSERT INTO pins (student_id, professor_id, created_at) VALUES
    (9,  1, '2026-09-01 08:00:00'),
    (9,  2, '2026-09-01 08:01:00'),
    (9,  6, '2026-09-03 10:30:00'),
    (10, 1, '2026-09-02 11:00:00'),
    (10, 3, '2026-09-02 11:02:00'),
    (11, 4, '2026-09-05 14:20:00'),
    (11, 5, '2026-09-05 14:21:00'),
    (14, 5, '2026-09-07 09:00:00');

-- -----------------------------------------------------------------------------
-- conversations (5). Each pair is eligible: the student has a non-declined
-- appointment with the professor, or the professor has open messages.
-- -----------------------------------------------------------------------------
INSERT INTO conversations (conversation_id, student_id, professor_id, created_at) VALUES
    (1, 9,  1, '2026-09-30 17:00:00'),
    (2, 10, 1, '2026-09-29 12:00:00'),
    (3, 12, 3, '2026-09-30 19:00:00'),
    (4, 14, 5, '2026-09-29 16:05:00'),
    (5, 15, 7, '2026-10-01 18:00:00');

-- -----------------------------------------------------------------------------
-- messages (10). read_at NULL = not yet read by the recipient.
-- -----------------------------------------------------------------------------
INSERT INTO messages (message_id, conversation_id, sender_role, body, created_at, read_at) VALUES
    (1,  1, 'student',   'السلام عليكم دكتورة، هل أحضر مسودة التقرير معي في موعد الأحد؟', '2026-09-30 17:00:00', '2026-09-30 18:10:00'),
    (2,  1, 'professor', 'وعليكم السلام، نعم أحضرها مطبوعة لو سمحت.',                    '2026-09-30 18:12:00', '2026-09-30 18:30:00'),
    (3,  2, 'student',   'Thank you for the feedback on Tuesday, it helped a lot.',      '2026-09-29 12:00:00', '2026-09-29 13:00:00'),
    (4,  2, 'professor', 'You are welcome, Lama. Good luck in the midterm.',            '2026-09-29 13:02:00', '2026-09-29 15:45:00'),
    (5,  3, 'student',   'دكتورة هدى، أحتاج استشارة بخصوص اختيار المسار التخصصي.',       '2026-09-30 19:00:00', '2026-10-01 06:30:00'),
    (6,  3, 'professor', 'أهلاً مها، احجزي موعداً يوم الاثنين القادم وسنناقش الخيارات.',  '2026-10-01 06:35:00', '2026-10-01 09:30:00'),
    (7,  3, 'student',   'تم الحجز، شكراً لكِ.',                                         '2026-10-01 09:42:00', NULL),
    (8,  4, 'student',   'Hi Dr. Marsh, sorry I had to cancel Wednesday''s meeting.',    '2026-09-29 16:05:00', '2026-09-29 17:00:00'),
    (9,  4, 'professor', 'No problem, Sarah. Book another slot when you are ready.',    '2026-09-29 17:01:00', NULL),
    (10, 5, 'student',   'دكتورة ريم، هل تشمل المراجعة الفصل الخامس؟',                   '2026-10-01 18:00:00', NULL);

-- -----------------------------------------------------------------------------
-- notifications (10). Each goes to a participant of the linked appointment or
-- conversation.
-- -----------------------------------------------------------------------------
INSERT INTO notifications (notification_id, user_id, type, appointment_id, conversation_id, created_at, read_at) VALUES
    (1,  1,  'appointment_requested', 7,    NULL, '2026-10-01 13:05:00', NULL),
    (2,  9,  'appointment_approved',  6,    NULL, '2026-09-30 16:20:00', '2026-09-30 16:45:00'),
    (3,  11, 'appointment_declined',  4,    NULL, '2026-09-29 06:00:00', '2026-09-29 07:10:00'),
    (4,  5,  'appointment_cancelled', 5,    NULL, '2026-09-29 16:00:00', '2026-09-29 17:00:00'),
    (5,  3,  'appointment_requested', 8,    NULL, '2026-10-01 09:40:00', NULL),
    (6,  15, 'appointment_approved',  9,    NULL, '2026-09-30 14:00:00', NULL),
    (7,  4,  'appointment_requested', 10,   NULL, '2026-10-01 19:15:00', NULL),
    (8,  12, 'new_message',           NULL, 3,    '2026-10-01 06:35:00', '2026-10-01 09:30:00'),
    (9,  14, 'new_message',           NULL, 4,    '2026-09-29 17:01:00', NULL),
    (10, 7,  'new_message',           NULL, 5,    '2026-10-01 18:00:00', NULL);
