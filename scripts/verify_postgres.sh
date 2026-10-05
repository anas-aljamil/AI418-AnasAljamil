#!/usr/bin/env bash
# Load the schema and seed into a scratch PostgreSQL database to prove the SQL
# is portable, then show the double-booking trigger rejecting an overlap.
#
# Usage: scripts/verify_postgres.sh [database_name]
# Connection settings come from the standard libpq variables (PGHOST, PGUSER, ...);
# the role needs permission to create databases. The database is dropped and recreated.
set -euo pipefail

DB="${1:-mawjood_verify}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"
PSQL=(psql --no-psqlrc -v ON_ERROR_STOP=1 --quiet -d "$DB")

dropdb --if-exists "$DB"
createdb --encoding=UTF8 --template=template0 "$DB"

# Files are piped on stdin so the server role never needs read access to the repo.
cat "$ROOT/db/schema.sql" \
    "$ROOT/db/dialect/postgresql.sql" \
    "$ROOT/db/seed.sql" \
    "$ROOT/db/dialect/postgresql_sequences.sql" | "${PSQL[@]}" > /dev/null
echo "Loaded schema.sql, dialect/postgresql.sql, seed.sql, postgresql_sequences.sql into $DB"

"${PSQL[@]}" -c "
SELECT 'departments' AS table_name, COUNT(*) AS row_count FROM departments
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'offices', COUNT(*) FROM offices
UNION ALL SELECT 'students', COUNT(*) FROM students
UNION ALL SELECT 'professors', COUNT(*) FROM professors
UNION ALL SELECT 'schedule_blocks', COUNT(*) FROM schedule_blocks
UNION ALL SELECT 'status_overrides', COUNT(*) FROM status_overrides
UNION ALL SELECT 'appointments', COUNT(*) FROM appointments
UNION ALL SELECT 'pins', COUNT(*) FROM pins
UNION ALL SELECT 'conversations', COUNT(*) FROM conversations
UNION ALL SELECT 'messages', COUNT(*) FROM messages
UNION ALL SELECT 'notifications', COUNT(*) FROM notifications;"

expect_rejection() {
    local description="$1" sql="$2"
    local error
    if error="$("${PSQL[@]}" -c "$sql" 2>&1 > /dev/null)"; then
        echo "FAIL: $description was accepted"
        exit 1
    fi
    echo "ok: $description rejected -> ${error%%$'\n'*}"
}

expect_rejection "same-start double booking" \
    "INSERT INTO appointments (student_id, professor_id, starts_at, ends_at)
     VALUES (10, 1, '2026-10-11 07:30:00', '2026-10-11 07:45:00');"
expect_rejection "overlapping booking (trigger)" \
    "INSERT INTO appointments (student_id, professor_id, starts_at, ends_at)
     VALUES (10, 1, '2026-10-11 07:15:00', '2026-10-11 07:45:00');"
expect_rejection "student row pointing at a professor account" \
    "INSERT INTO students (student_id, university_no, department_id) VALUES (1, 'S9999', 1);"

# Identity columns continue after the seed's explicit ids.
"${PSQL[@]}" -c "
INSERT INTO departments (code, name_ar, name_en) VALUES ('PHYS', 'الفيزياء', 'Physics')
RETURNING department_id AS new_department_id;"
echo "PostgreSQL verification passed."
