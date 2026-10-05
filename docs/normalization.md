# Mawjood: normalization

This document explains why the MySQL 8.0 schema in [`db/schema.sql`](../db/schema.sql) is in Third Normal Form (3NF), and why each MySQL-specific choice was made (Section 8). In fact every table is also in Boyce-Codd Normal Form (BCNF), with one documented technicality (Section 5). The diagram is in [`er-diagram.md`](er-diagram.md).

## 1. Method

For each table we list its candidate keys and its functional dependencies (FDs), written `X -> Y` ("X determines Y"). We then check:

- **1NF**: every column holds one atomic value; there are no repeating groups; every table has a primary key.
- **2NF**: 1NF, and no non-key column depends on only part of a composite candidate key.
- **3NF**: 2NF, and no non-key column depends on another non-key column (no transitive dependency). Formally, for every non-trivial FD `X -> A`, either `X` is a superkey or `A` is part of a candidate key.
- **BCNF**: for every non-trivial FD `X -> A`, `X` is a superkey.

## 2. Changes from the candidate entity list

The project brief proposed User, Student, Professor, Department, OfficeHourSlot, StatusOverride, Appointment, Message and Notification. The final design refines them as follows.

| Change | Reason (normalization or integrity) |
|---|---|
| `User` is named `users` | Plural table names throughout; `USER` is also a MySQL keyword and SQL-standard reserved word. `scripts/check_db.py` verifies that no identifier is a MySQL reserved word. |
| New `offices` table | Storing building, floor and room on `professors` creates the transitive dependency `professor_id -> (building, room) -> floor`. Shared offices would also repeat the same location on several rows (an update anomaly). |
| `OfficeHourSlot` becomes `schedule_blocks` with `kind` | The status rule needs to know when a professor is *teaching* ("In class"), not only when they hold office hours. Individual bookable slots are not stored: they are fully determined by a block plus `slot_minutes`, so storing them would be redundant. |
| New `conversations` table; `messages.sender_role` replaces sender/recipient ids | Storing both `sender_id` and `recipient_id` on each message repeats the pair on every row, and allows a message whose participants contradict its thread. With a conversation row, the pair is stored once, and `sender_role` identifies the sender among exactly two participants. |
| New `pins` table | Needed by the student home screen ("My professors"). It is an M:N relationship, so it gets its own table. |
| Admin has no subtype table | Admins have no attributes beyond `users`. |

## 3. Table-by-table analysis

Surrogate keys (`*_id`) are written in **bold** where they are the primary key. Every FD below has a candidate key on its left-hand side, which is what makes each table BCNF.

### departments
- Candidate keys: **department_id**, `code`, `name_ar`, `name_en` (all `UNIQUE`).
- FDs: `department_id -> code, name_ar, name_en, created_at`. Each alternate key also determines the row.
- Every determinant is a candidate key, so the table is in **BCNF**.

### users
- Candidate keys: **user_id**, `email`.
- FDs: `user_id -> email, password_hash, role, full_name_ar, full_name_en, preferred_locale, is_active, created_at, updated_at`; `email -> user_id`.
- 1NF note: a full name is stored as one value per language rather than split into first and last parts. Arabic names vary in structure (patronymics, "bin", family names), and the system never queries name parts separately. For our purposes the name is atomic.
- `UNIQUE (user_id, role)` is a superkey; it exists so the subtype tables can reference it (Section 4).
- **BCNF**.

### offices
- Candidate keys: **office_id**, `(building_code, room_number)`.
- FDs: `office_id -> building_code, floor, room_number`; `(building_code, room_number) -> office_id, floor`.
- `floor` depends on a candidate key, not on a non-key column. **BCNF**.

### students
- Candidate keys: **student_id**, `university_no`.
- FDs: `student_id -> university_no, department_id, study_year`.
- The department *name* is not stored here; it is reached through the `department_id` foreign key. Storing it would create `student_id -> department_id -> name_en`, a transitive dependency.
- **3NF/BCNF**, apart from the constant `role` column discussed in Section 5.

### professors
- Candidate key: **professor_id**.
- FDs: `professor_id -> department_id, office_id, honorific, academic_rank, slot_minutes, open_messages`.
- Office location, department names and the professor's own name all live in their own tables.
- **3NF/BCNF**, with the same `role` note as students (Section 5).

### schedule_blocks
- Candidate keys: **block_id**, `(professor_id, day_of_week, start_time)`.
- FDs: `block_id -> professor_id, kind, day_of_week, start_time, end_time, label`.
- 1NF: the weekly timetable is one row per block, not repeating columns such as `sun_start` or `mon_start`.
- `label` (a course code such as `CS 211`) has no dependent attributes. If course titles were ever needed, a `courses` table would be added rather than storing titles here.
- **BCNF**.

### status_overrides
- Candidate key: **override_id**.
- FDs: `override_id -> professor_id, status, note, created_at, expires_at`.
- The professor's *current* status is **not** stored anywhere. It depends on these rows, the schedule and the current time, so storing it would be derived data that goes stale (see Section 6).
- **BCNF**.

### appointments
- Candidate key: **appointment_id**.
- FDs: `appointment_id -> student_id, professor_id, starts_at, ends_at, status, topic, note, created_at, updated_at`.
- `(professor_id, starts_at)` is unique only among *active* rows. A cancelled booking and a new booking may share a start time, so it is not a candidate key. MySQL enforces the active-only uniqueness through the virtual column `active_slot` (Section 8.4).
- `active_slot` is not stored data: it is a **virtual** generated column (computed when read; only the unique index keeps a copy). It cannot disagree with `status` and `starts_at`, so it introduces no update anomaly.
- `ends_at` is stored deliberately. It is **not** determined by `starts_at + professors.slot_minutes`, because a professor may change their slot length after a booking is made. `ends_at` records the length agreed at booking time, which is a fact about the appointment itself.
- **BCNF**.

### pins
- Candidate key: **(student_id, professor_id)**.
- FDs: `(student_id, professor_id) -> created_at`.
- 2NF: `created_at` depends on the whole pair (the moment *this* student pinned *this* professor), not on either half alone.
- **BCNF**.

### conversations
- Candidate keys: **conversation_id**, `(student_id, professor_id)`.
- FDs: `conversation_id -> student_id, professor_id, created_at`; `(student_id, professor_id) -> conversation_id`.
- **BCNF**.

### messages
- Candidate key: **message_id**.
- FDs: `message_id -> conversation_id, sender_role, body, created_at, read_at`.
- The sender's and recipient's user ids are derivable via `conversation_id` and `sender_role`, so they are not stored.
- **BCNF**.

### notifications
- Candidate key: **notification_id**.
- FDs: `notification_id -> user_id, type, appointment_id, conversation_id, created_at, read_at`.
- The notification text is not stored. It is rendered from `type` and the linked appointment or conversation, in the reader's language. Storing it would duplicate appointment data and freeze one language.
- The rule "exactly the reference that matches the type is set" is a `CHECK` constraint, not a functional dependency.
- **BCNF**.

## 4. Specialization without redundancy

`students` and `professors` are subtypes of `users`, each sharing the user's primary key (a 1:1 ISA relationship). Common attributes (email, names, password, locale) are stored once in `users`, and each subtype stores only its own attributes. This avoids two common designs that break normalization:

- one wide `users` table with student-only and professor-only columns that are NULL for other roles, or
- two separate account tables that repeat email, name and password columns.

`users.role` and "which subtype table holds this id" express the same fact. That overlap is kept consistent by the database itself. Each subtype has a stored generated column `role` fixed to `'student'` or `'professor'`, and a composite foreign key `(id, role) -> users (user_id, role) ON DELETE CASCADE ON UPDATE RESTRICT`. So:

- a student row cannot reference a professor account, and
- an account's role cannot change while its subtype row exists (verified by `scripts/check_db.py`).

## 5. The one technicality: constant `role` columns

`students.role` and `professors.role` always hold one fixed value. In strict theory, a column that never varies is functionally dependent on the empty set (`{} -> role`), and the empty set is not a superkey.

We accept this deliberately:

- **It stores no information and cannot cause anomalies.** It is a generated column whose expression is a constant: MySQL rejects any attempt to write it (error 3105). There is nothing to update inconsistently, and no insert or delete depends on it.
- **It enforces disjoint subtypes declaratively, with no trigger** (Section 8.5).

## 6. Derived data that is intentionally not stored

| Value shown in the UI | How it is obtained |
|---|---|
| Professor's effective status (In office / In class / Busy / Away / Not confirmed / Unknown) | Latest unexpired `status_overrides` row; else the schedule: the block covering "now" in Riyadh time, or Away outside all blocks; Unknown only for a professor with no schedule. Computed by the API (and later by a view) |
| "Updated X min ago" | `MAX(status_overrides.created_at)` for the professor |
| Bookable time slots | `office_hours` blocks split into `slot_minutes` pieces, minus active appointments |
| Message sender and recipient | `conversations` + `messages.sender_role` |
| Notification text | `notifications.type` + linked row + reader's language |
| Unread counts | `COUNT(*) ... WHERE read_at IS NULL` |

Storing any of these would introduce update anomalies: the stored copy would disagree with its source the moment the source or the clock changes.

## 7. Anomalies the design prevents (examples)

- **Update anomaly**: a department is renamed in one place, `departments.name_en`, and every professor and student shows the new name. A professor moves office by changing one `office_id`, and the floor follows automatically.
- **Insertion anomaly**: a new office or department can be recorded before anyone is assigned to it (office 7 and the BUS department demonstrate this in the seed).
- **Deletion anomaly**: deleting a professor's last appointment does not lose the professor's schedule or office. Deleting a department that still has people is refused (`ON DELETE RESTRICT`) rather than silently orphaning or deleting them.

## 8. MySQL-specific decisions

Every claim below was tested on MySQL 8.0.46; `scripts/check_db.py` re-checks the behavior on every run.

### 8.1 Character set and collation

The database, every table and every connection use **utf8mb4**. It stores every Unicode character, including all Arabic letters and diacritics; MySQL's older `utf8` (utf8mb3) is deprecated.

The default collation is **`utf8mb4_0900_ai_ci`**:

- It is MySQL 8's default, based on Unicode Collation Algorithm 9.0, which sorts Arabic correctly.
- Workbench, the CLI and the Python driver all use it without conversion, so mixed-collation errors cannot occur.
- It is case-insensitive, so `Ahmad@x` and `ahmad@x` cannot both be registered.
- It ignores Arabic diacritics (tested: `'مُحَمَّد' = 'محمد'` is true).
- It does **not** treat أ/إ/آ/ا, ة/ه or ى/ي as equal (tested: all false). Search therefore normalizes those letters in the API, as CLAUDE.md requires.

Machine codes are the enum-like columns: `role`, `status`, `kind`, `type`, `topic`, `sender_role`, `honorific`, `academic_rank`, `preferred_locale` and the generated `active_slot`. These use **`utf8mb4_0900_bin`**, so `CHECK (role IN ('student', ...))` is exact: `'Student'` is rejected instead of being stored as a second spelling (tested).

Text length rules use `CHAR_LENGTH` (characters), never `LENGTH` (bytes): an Arabic name of 29 characters occupies 55 bytes (tested).

### 8.2 Types

- **Timestamps:** `DATETIME` in UTC with `DEFAULT (UTC_TIMESTAMP())`. The default is UTC even if a client forgets to set the session time zone (tested with `time_zone = '+03:00'`), and every script and the API also set `time_zone = '+00:00'`.
  - `DATETIME` rather than `TIMESTAMP`: it has no 2038 limit and is never converted by the session time zone.
- **Schedule times:** `TIME`, with CHECKs for the 15-minute grid and for staying within one day.
- **Booleans:** `BOOLEAN` (stored as `TINYINT(1)`), plus `CHECK (x IN (0, 1))`.
- **Engine:** InnoDB, which is required for foreign keys and transactions.

### 8.3 CHECK constraints and foreign-key actions

MySQL forbids a CHECK constraint on a column that a foreign-key referential action can change (error 3823). Tested on 8.0.46:

| Foreign-key action on the column | CHECK on that column |
|---|---|
| `ON DELETE CASCADE` | allowed (the row is deleted, the column value never changes) |
| `ON DELETE RESTRICT` / `ON UPDATE RESTRICT` | allowed |
| `ON DELETE SET NULL` | **rejected** (error 3823) |
| `ON UPDATE CASCADE` | **rejected** (error 3823) |

Consequences for the schema:

- **`professors.office_id`** uses `ON DELETE SET NULL`, so it has no CHECK.
- **No foreign key uses `ON UPDATE CASCADE`.** Primary keys are surrogate and never change, so all foreign keys use `ON UPDATE RESTRICT`.
- **`notifications`:** `ck_notifications_reference` (exactly one of `appointment_id` / `conversation_id`, chosen by `type`) stays a declarative CHECK. Both columns use `ON DELETE CASCADE`, which deletes the notification rather than changing those columns, so MySQL allows it.
  - Replacing the CHECK with a trigger would hide the rule from `SHOW CREATE TABLE` and the ER documentation.
  - Switching the foreign keys to RESTRICT would block deleting a student whose appointments have notifications.

### 8.4 Double booking without partial indexes

MySQL has no partial (filtered) unique indexes. The equivalent is:

- **Layer 1:** `active_slot`, a virtual generated column equal to `starts_at` while the appointment is pending or approved and NULL otherwise, plus `UNIQUE (professor_id, active_slot)`. A unique index allows any number of NULLs, so cancelled and declined rows free their slot.
- **Layer 2:** `BEFORE INSERT` and `BEFORE UPDATE` triggers reject any *overlapping* active appointment with `SIGNAL SQLSTATE '45000'` (client error 1644, message `SLOT_TAKEN: ...`). This also covers overlaps after a professor switches between 15- and 30-minute slots.

`check_db.py` proves each layer separately. It drops the triggers and shows the unique index alone still rejects a same-start booking (error 1062).

**Why `active_slot` is text, not DATETIME.** MySQL 8.0.46 has a defect that triggers when all three of these hold:
1. the table has a `BEFORE INSERT` trigger;
2. it has a generated column of type `DATETIME`;
3. an INSERT leaves a DATETIME column to a time-function default (`UTC_TIMESTAMP()` or `CURRENT_TIMESTAMP`).

The INSERT then fails with error 1292 ("Incorrect datetime value: '0000-00-00 00:00:00'" for the generated column). This happens even though the generated value would be valid. Minimal reproduction:

```sql
CREATE TABLE t (id INT PRIMARY KEY AUTO_INCREMENT, s DATETIME NOT NULL, e DATETIME NOT NULL,
  st VARCHAR(10) NOT NULL DEFAULT 'pending', c DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  g DATETIME AS (CASE WHEN st = 'pending' THEN s END) VIRTUAL, UNIQUE (g));
-- add any BEFORE INSERT trigger that reads NEW.s / NEW.e, then:
INSERT INTO t (s, e) VALUES ('2026-10-12 06:00:00', '2026-10-12 06:30:00');  -- ERROR 1292
```

Things that were tested and did not help:
- `STORED` instead of `VIRTUAL`;
- `DEFAULT CURRENT_TIMESTAMP` instead of the expression default;
- reordering the columns.

What does avoid it is giving the generated column a text type: `CAST(starts_at AS CHAR(19))` holds the same `'YYYY-MM-DD HH:MM:SS'` value, and the uniqueness is identical.

### 8.5 Disjoint subtypes

`students.role` and `professors.role` are `GENERATED ALWAYS AS ('student') STORED` (and `'professor'`). They take part in the composite foreign key to `users (user_id, role)`:

- **`ON DELETE CASCADE`**: deleting an account deletes its profile. MySQL allows CASCADE (but not SET NULL) on stored generated columns.
- **`ON UPDATE RESTRICT`**: an account's role cannot change while its subtype row exists (error 1451, tested).
- **The generated value cannot be written** (error 3105, tested), so no CHECK constraint is needed.

This replaces the earlier `CHECK (role = 'student')`. That CHECK would also have been legal with `ON DELETE CASCADE`, but the generated column is stronger: it is impossible to even attempt a wrong value.

### 8.6 Triggers and privileges

MySQL 8 has binary logging on by default. In that mode, only an account with SUPER (for example root) can create triggers, unless the server sets `log_bin_trust_function_creators = 1`.

Load `schema.sql` as root (the usual setup on a student laptop), or set that variable once for a dedicated application user. The steps are in `docs/run-on-phone.md`.
