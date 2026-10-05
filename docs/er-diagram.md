# Mawjood: ER diagram

Source of truth: [`db/schema.sql`](../db/schema.sql). This file must match it table for table and column for column; update both together. `python3 scripts/check_db.py` fails if they drift apart.

A rendered export for reports is in [`er-diagram.png`](er-diagram.png). Regenerate it after changing the diagram.

## Diagram

```mermaid
erDiagram
    DEPARTMENTS ||--o{ PROFESSORS : employs
    DEPARTMENTS ||--o{ STUDENTS : "majors in"
    USERS ||--o| STUDENTS : "is a"
    USERS ||--o| PROFESSORS : "is a"
    OFFICES |o--o{ PROFESSORS : houses
    PROFESSORS ||--o{ SCHEDULE_BLOCKS : defines
    PROFESSORS ||--o{ STATUS_OVERRIDES : sets
    STUDENTS ||--o{ APPOINTMENTS : books
    PROFESSORS ||--o{ APPOINTMENTS : receives
    STUDENTS ||--o{ PINS : pins
    PROFESSORS ||--o{ PINS : "is pinned in"
    STUDENTS ||--o{ CONVERSATIONS : "chats in"
    PROFESSORS ||--o{ CONVERSATIONS : "chats in"
    CONVERSATIONS ||--|{ MESSAGES : contains
    USERS ||--o{ NOTIFICATIONS : receives
    APPOINTMENTS |o--o{ NOTIFICATIONS : "is about"
    CONVERSATIONS |o--o{ NOTIFICATIONS : "is about"

    DEPARTMENTS {
        int department_id PK
        varchar code UK "upper case, 2-10 chars"
        varchar name_ar UK
        varchar name_en UK
        timestamp created_at "default now"
    }
    USERS {
        int user_id PK "UK (user_id, role)"
        varchar email UK "lower case"
        varchar password_hash "argon2id"
        varchar role "student | professor | admin"
        varchar full_name_ar
        varchar full_name_en
        varchar preferred_locale "ar | en, default ar"
        boolean is_active "default true"
        timestamp created_at
        timestamp updated_at
    }
    OFFICES {
        int office_id PK
        varchar building_code "UK (building_code, room_number)"
        int floor "0-20, default 0"
        varchar room_number
        timestamp created_at
    }
    STUDENTS {
        int student_id PK, FK "(student_id, role) -> users"
        varchar role "always 'student'"
        varchar university_no UK
        int department_id FK
        int study_year "1-6, default 1"
    }
    PROFESSORS {
        int professor_id PK, FK "(professor_id, role) -> users"
        varchar role "always 'professor'"
        int department_id FK
        int office_id FK "nullable"
        varchar honorific "dr | prof | mr | ms | eng"
        varchar academic_rank
        int slot_minutes "15 | 30, default 15"
        boolean open_messages "default false"
    }
    SCHEDULE_BLOCKS {
        int block_id PK
        int professor_id FK "UK (professor_id, day_of_week, start_time)"
        varchar kind "office_hours | class"
        int day_of_week "0 Sun - 4 Thu"
        varchar start_time "HH:MM Riyadh, 15-min grid"
        varchar end_time "after start_time"
        varchar label "nullable, e.g. CS 211"
    }
    STATUS_OVERRIDES {
        int override_id PK
        int professor_id FK
        varchar status "in_office | in_class | busy | away"
        varchar note "nullable, max 60"
        timestamp created_at
        timestamp expires_at "nullable, after created_at"
    }
    APPOINTMENTS {
        int appointment_id PK
        int student_id FK
        int professor_id FK "active (professor_id, starts_at) unique"
        timestamp starts_at
        timestamp ends_at "after starts_at"
        varchar status "lifecycle, default pending"
        varchar topic "nullable"
        varchar note "nullable, max 200"
        timestamp created_at
        timestamp updated_at
    }
    PINS {
        int student_id PK, FK
        int professor_id PK, FK
        timestamp created_at
    }
    CONVERSATIONS {
        int conversation_id PK
        int student_id FK "UK (student_id, professor_id)"
        int professor_id FK
        timestamp created_at
    }
    MESSAGES {
        int message_id PK
        int conversation_id FK
        varchar sender_role "student | professor"
        varchar body "1-1000 chars"
        timestamp created_at
        timestamp read_at "nullable"
    }
    NOTIFICATIONS {
        int notification_id PK
        int user_id FK
        varchar type "4 appointment types | new_message"
        int appointment_id FK "nullable"
        int conversation_id FK "nullable"
        timestamp created_at
        timestamp read_at "nullable"
    }
```

## Relationships: cardinality and participation

"Total" participation means every row of that entity must take part (enforced by `NOT NULL` foreign keys); "partial" means it may not.

| Relationship | Cardinality | Participation | Enforced by |
|---|---|---|---|
| User **is a** Student | 1 : 0..1 | Student total; User partial | `students (student_id, role)` FK to `users (user_id, role)`, PK on `student_id` |
| User **is a** Professor | 1 : 0..1 | Professor total; User partial | Same composite-FK pattern; the `role` value makes the subtypes disjoint |
| Department **employs** Professor | 1 : 0..N | Professor total; Department partial (BUS has none) | `professors.department_id NOT NULL`, `ON DELETE RESTRICT` |
| Department **has major** Student | 1 : 0..N | Student total; Department partial | `students.department_id NOT NULL`, `ON DELETE RESTRICT` |
| Office **houses** Professor | 0..1 : 0..N | Both partial (office 7 is empty; office may be unset) | `professors.office_id` nullable, `ON DELETE SET NULL` |
| Professor **defines** ScheduleBlock | 1 : 0..N | Block total; Professor partial | `NOT NULL` FK, `ON DELETE CASCADE` |
| Professor **sets** StatusOverride | 1 : 0..N | Override total; Professor partial | `NOT NULL` FK, `ON DELETE CASCADE` |
| Student **books** Appointment | 1 : 0..N | Appointment total; Student partial | `NOT NULL` FK, `ON DELETE CASCADE` |
| Professor **receives** Appointment | 1 : 0..N | Appointment total; Professor partial | `NOT NULL` FK, `ON DELETE CASCADE` |
| Student **pins** Professor | M : N (via `pins`) | Both partial | Composite PK `(student_id, professor_id)` |
| Student **chats with** Professor | M : N (via `conversations`), at most one conversation per pair | Both partial | `UNIQUE (student_id, professor_id)` |
| Conversation **contains** Message | 1 : 1..N | Message total; Conversation total (the API creates a conversation together with its first message) | `NOT NULL` FK, `ON DELETE CASCADE`; the 1..N minimum is API-enforced and seed-checked |
| User **receives** Notification | 1 : 0..N | Notification total; User partial | `NOT NULL` FK, `ON DELETE CASCADE` |
| Notification **is about** Appointment or Conversation | N : 0..1 each, exactly one of the two | Notification total over the pair | `ck_notifications_reference` CHECK |

## Specialization (ISA)

`users` is the supertype of `students` and `professors`.

- **Disjoint**: an account is at most one subtype. Each subtype table stores a constant `role` column (`CHECK (role = 'student')`), and its foreign key references `users (user_id, role)`. A student row can therefore only point at an account whose role is `student`, and that role cannot change while the subtype row exists.
- **Partial**: admin accounts (`role = 'admin'`) have no subtype row.

## Weak or associative entities

- `pins` and `conversations` resolve M:N relationships between students and professors. `pins` has a composite primary key. `conversations` has a surrogate key, because messages and notifications reference it, plus a `UNIQUE` pair.
- `schedule_blocks`, `status_overrides`, `appointments` and `messages` have surrogate keys but depend on their owner for existence (`ON DELETE CASCADE`).
