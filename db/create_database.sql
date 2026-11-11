-- =============================================================================
-- Mawjood: create the database (MySQL 8.0). Run this first, as root.
-- WARNING: drops the existing mawjood database and all of its data.
--
-- Then, in the same session, run db/schema.sql and db/seed.sql:
--   CLI:        mysql -u root -p   then   SOURCE db/create_database.sql;
--                                          SOURCE db/schema.sql;
--                                          SOURCE db/seed.sql;
--   Workbench:  open and run this file, then schema.sql, then seed.sql
--               (the USE below makes mawjood the default schema).
-- =============================================================================

DROP DATABASE IF EXISTS mawjood;

-- utf8mb4 stores every Unicode character (all Arabic letters and diacritics);
-- MySQL's older "utf8" (utf8mb3) is deprecated. Collation choice: see
-- docs/normalization.md, section "MySQL-specific decisions".
CREATE DATABASE mawjood
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_0900_ai_ci;

USE mawjood;
