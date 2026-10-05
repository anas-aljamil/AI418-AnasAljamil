Mawjood: Office-Hours Availability System
1. Mission

Students waste trips to campus only to find a professor absent. Mawjood shows, remotely and in real time, whether a professor is in their office, lets students book a slot, and lets them chat. It must serve students AND faculty without burdening professors (status update = 1 tap, or fully automatic from the schedule). Context: this is a graded university project (HCI + Database Systems). Database quality, traceability, and polish are graded, so correctness and clarity beat feature count.

2. Users and goals
Student (primary): find a professor, trust the status, book, message.
Professor (secondary): set availability with near-zero effort, approve/decline requests, reply.
Admin (optional): manage departments, professors, students, offices, accounts.
3. Scope

In: a mobile app for Android and iOS (Expo, run through Expo Go) plus the Expo web build of the same codebase (professors on desktop, admin area, projector demos); role-based auth, professor status, weekly schedule, search/filter, booking, chat, in-app notifications (polling), Arabic/English with RTL, admin CRUD. Out (do not build): payments, video calls, grades, app store publishing, push notifications, email/SMS, calendar sync.

4. Business rules (authoritative defaults; may be revised after user research)
Timezone: Asia/Riyadh for all schedules; store timestamps in UTC.
Week starts Sunday; working days Sunday-Thursday.
Effective status = manual override (if not expired) > schedule-derived status > "Unknown".
A manual override may include a return time; when it passes, the override expires and status falls back to the schedule.
Staleness: if the last manual update is older than 4 hours AND the schedule says the professor should be in office, show "In office (not confirmed)" instead of a confident "In office". Always show a relative "updated X min ago".
Booking: slot length 15 or 30 min (per professor); a slot cannot be double-booked (enforce in the database with a constraint/trigger AND in the API); a student cannot hold more than 2 pending/approved future appointments per professor; cancellation allowed until 1 hour before start.
Appointment lifecycle: pending -> approved | declined | cancelled | completed | no_show.
Chat is allowed only between a student and a professor, and only after the student has at least one non-declined appointment with that professor, or the professor has enabled "open messages".
5. Tech stack
Backend: Python 3.12, FastAPI, SQLAlchemy 2.x, Pydantic v2, MySQL driver PyMySQL (proposed, awaiting approval; see docs/plan.md).
Database: MySQL 8.0 (not MariaDB) is the only database for development, tests and submission. InnoDB for every table; utf8mb4 with collation utf8mb4_0900_ai_ci for the database, tables and connections; DATETIME in UTC with session time_zone '+00:00'; TIME for schedule times.
Client: Expo (React Native) + TypeScript + Expo Router, one codebase for Android, iOS (via Expo Go) and the Expo web build. Typed theme module for tokens (no CSS variables), react-native-svg for the doors and icons, Reanimated for motion, TanStack Query, react-i18next. The exact dependency list is in docs/plan.md and needs approval before P3b.
Realtime: polling every 15-30s is acceptable for MVP; WebSocket/SSE only if time allows.
Tests: pytest (backend, against MySQL); Jest + React Native Testing Library (client); Playwright screenshots of the Expo web build at 360, 768 and 1280 px. Checks that need a real phone are listed in docs/plan.md and reported as such.
6. Database requirements (graded)
3NF; document the normalization reasoning in docs/normalization.md.
All SQL is MySQL 8.0 syntax. Files kept in sync at all times: db/schema.sql (tables, constraints, triggers), db/seed.sql, db/queries.sql, docs/er-diagram.md (Mermaid diagram + Chen-notation description).
schema.sql: PK, FK (with ON DELETE rules), NOT NULL, UNIQUE, CHECK, DEFAULT on all tables.
Candidate entities: User, Student, Professor, Department, OfficeHourSlot, StatusOverride, Appointment, Message, Notification. Refine and justify any change.
seed.sql: 5-10 realistic, fictional rows per table (Arabic and English names, plausible departments and schedules).
queries.sql: >= 5 queries per table (WHERE, ORDER BY, LIKE, BETWEEN, IN, IS NULL, DISTINCT, UNION), >= 2 aggregates per table, INNER + OUTER JOINs, GROUP BY + HAVING, >= 2 views (e.g., v_professors_in_office_now), >= 1 trigger (double-booking prevention). Each query has a comment explaining its purpose.
The UI must perform full CRUD against the real database in the final version (no mock data).
7. API conventions
REST, JSON, versioned under /api/v1.
Consistent error shape: { "error": { "code": string, "message": string } }.
Input validation on every endpoint; pagination on list endpoints.
Authorization enforced server-side per role and per resource ownership.
OpenAPI docs available at /docs.
8. Security and privacy
Hash passwords with argon2 or bcrypt; never log secrets or tokens.
Parameterized queries only (no string-built SQL).
Short-lived JWT access token kept in memory. Refresh token: expo-secure-store on Android/iOS (sent in the request body); httpOnly SameSite=Strict cookie on the web build. CSRF consideration documented.
Rate-limit login and message endpoints.
Secrets in .env (never committed); provide .env.example.
Seed data must be fictional; no real names, IDs, or emails.
9. Design (authoritative source: docs/DESIGN.md)
Read docs/DESIGN.md fully before any client task. It overrides generic design habits, and gives the mobile (React Native) equivalent of every web rule.
Non-negotiables: Arabic-first with full RTL; the "door" status signature; status always shown as icon + label + color; designed light and dark themes; WCAG 2.2 AA; mobile-first; none of the templated defaults listed in DESIGN.md Section 3.
Follow the design process in DESIGN.md Section 10 and run its Section 12 checklist for every screen.
Record design decisions in DESIGN.md Section 11.
10. UX targets (verify, don't assume)
"Is Dr. X in right now?" is answerable within 3 seconds of opening the app.
Student reaches a professor's status in <= 2 taps from home.
Professor changes status in 1 tap.
Booking flow <= 4 steps.
Screen-reader usable (TalkBack, VoiceOver); on the web build, keyboard-navigable with visible focus rings; labels on all inputs.
11. Phases (acceptance criteria per phase: docs/plan.md)
P1: DB schema + seed (+ ER diagram, Chen description and normalization docs), MySQL 8.
P2: Backend API + auth + tests.
P3a: Design plan with two directions (DESIGN.md Section 10, step 1). Stop for my choice.
P3b: Expo app foundations + /styleguide. Stop for my review.
P3c: Language choice, sign-in and student home screen. Stop for my review.
P4: Remaining screens (search, profile, booking, appointments, professor status, requests, schedule) + admin area (web layout).
P5: Chat + notifications + settings.
P6: queries.sql, views, trigger demo, docs, README, test plan, final design QA.
12. Commands (keep this section updated)
Backend dev: <fill in once created>
Client dev: <fill in once created>
Tests: <fill in once created>
DB reset + seed: python3 scripts/reset_db.py   (add --rebase to move seed dates to the current week; reads DB_* from .env; needs the mysql client on PATH or MYSQL_CLI in .env)
DB checks (constraints, seed rules, charset, reserved words, ER sync): python3 scripts/check_db.py
DB load by hand: mysql -u root -p < db/create_database.sql, then run db/schema.sql and db/seed.sql in the mawjood database (CLI or MySQL Workbench; see docs/run-on-phone.md)
Lint/format: <fill in once created>
13. Working agreement
Work in small phases. Never start the next phase without my approval.
Before coding a phase: state the plan and acceptance criteria. After coding: run the app and tests, fix failures, then report what changed and how to verify.
A phase is "done" only when its acceptance criteria are demonstrably met (command output, test results, screenshots, or a described manual check).
Commit after every working phase using Conventional Commits (feat:, fix:, docs:, test:, style:), then open a pull request into main with a clear summary for my review and merge.
Do not add features, dependencies, or schema changes outside this document without asking first; state any assumption explicitly.
Prefer simple, readable code with comments where the logic is non-obvious; no dead code or TODO litter.
If requirements conflict, stop and ask one precise question.
Update this file whenever a decision changes (commands, schema names, assumptions).
14. Decisions and assumptions
Schema (approved 2026-10-05): tables departments, users, offices, students, professors, schedule_blocks, status_overrides, appointments, pins, conversations, messages, notifications (rationale in docs/normalization.md). No MySQL reserved words as identifiers (checked by scripts/check_db.py).
MySQL (2026-10-05): schema.sql holds tables, indexes and triggers; db/create_database.sql creates the utf8mb4 database. Timestamps are DATETIME UTC with DEFAULT (UTC_TIMESTAMP()); schedule times are TIME on a 15-minute grid; day_of_week 0 = Sunday .. 4 = Thursday; booleans are TINYINT(1).
Double booking: virtual generated column active_slot (starts_at as text, non-null only for pending/approved; text because of a MySQL 8.0 DATETIME generated-column defect, see docs/normalization.md) + UNIQUE (professor_id, active_slot), plus BEFORE INSERT/UPDATE overlap triggers using SIGNAL SQLSTATE '45000'; the API also pre-checks.
Subtype guard: students.role / professors.role are stored generated constants in a composite FK to users (user_id, role) ON DELETE CASCADE ON UPDATE RESTRICT.
Creating triggers with binary logging on needs root (or SUPER), or log_bin_trust_function_creators = 1 for a dedicated user.
Status outside any schedule block = Away; Unknown only when a professor has no schedule. An override without a return time expires at the end of that Riyadh day.
Seed: fictional, anchored on the week of Sunday 2026-10-04; demo password Mawjood-Demo-2026 for every seed account. 5-10 rows per table except users (16, supertype = sum of subtypes) and schedule_blocks (32, a realistic weekly timetable).
Auth: 15-minute JWT access token in memory; refresh token in expo-secure-store (native, body) or an httpOnly SameSite=Strict cookie read only by the refresh endpoint plus a custom header (web, against CSRF).
Arabic search normalization (diacritics, alef forms, teh marbuta, alef maksura) is done in the API; the collation alone does not fold these letters.
Approved backend dependencies: uvicorn, argon2-cffi, PyJWT, pydantic-settings, httpx (tests), ruff. Proposed, awaiting approval: PyMySQL[rsa] and the client list in docs/plan.md.
