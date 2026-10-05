# Mawjood: normalization

This document explains why the schema in [`db/schema.sql`](../db/schema.sql) is in Third Normal Form (3NF). In fact every table is also in Boyce-Codd Normal Form (BCNF), with one documented technicality (Section 5). The diagram is in [`er-diagram.md`](er-diagram.md).

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
| `User` is named `users` | `user` is a reserved word in PostgreSQL. |
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
- `(professor_id, starts_at)` is unique only among *active* rows (partial unique index). A cancelled booking and a new booking may share a start time, so it is not a candidate key.
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

`users.role` and "which subtype table holds this id" express the same fact. That overlap is kept consistent by the database itself: each subtype has a composite foreign key `(id, role) -> users (user_id, role)` plus `CHECK (role = 'student')` or `CHECK (role = 'professor')`. So:

- a student row cannot reference a professor account, and
- an account's role cannot change while its subtype row exists (verified by `scripts/check_db.py`).

## 5. The one technicality: constant `role` columns

`students.role` and `professors.role` always hold one fixed value. In strict theory, a column that never varies is functionally dependent on the empty set (`{} -> role`), and the empty set is not a superkey.

We accept this deliberately:

- **It stores no information and cannot cause anomalies.** The `CHECK` forbids any other value, so there is nothing to update inconsistently, and no insert or delete depends on it.
- **It is the only portable way to enforce disjoint subtypes declaratively.** The alternative is a trigger, which would differ between SQLite and PostgreSQL.

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
