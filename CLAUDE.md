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
Booking (revised 2026-10-06, owner decision): the student picks any start on a 5-minute step inside office hours and any length in 5-minute steps that fits inside that office-hours block; the professor's slot length (15 or 30 min) is only the length offered first; appointments cannot overlap (enforce in the database with a constraint/trigger AND in the API); a student cannot hold more than 2 pending/approved future appointments per professor; cancellation allowed until 1 hour before start.
Appointment lifecycle: pending -> approved | declined | cancelled | completed | no_show.
Chat is allowed only between a student and a professor, and only after the student has at least one non-declined appointment with that professor, or the professor has enabled "open messages".
5. Tech stack
Backend: Python 3.12, FastAPI, SQLAlchemy 2.x, Pydantic v2, MySQL driver PyMySQL[rsa].
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
Backend dev: cd backend && python3.12 -m venv .venv && .venv/bin/pip install -e ".[dev]" && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload   (API docs at /docs; needs JWT_SECRET in .env)
Client dev: cd app && npm install && npx expo start   (scan the QR code with Expo Go; needs Node 22 LTS; first launch asks for the language, then sign-in)
Client checks: cd app && npm run typecheck && npm run lint && npm run format && npm test   (Jest + RNTL, includes the WCAG token check)
Web build + Playwright: python3 scripts/reset_db.py, start the API with DEMO_NOW=2026-10-05T07:00:00Z (and LOGIN_ATTEMPTS_PER_MINUTE=100 SIGNUPS_PER_MINUTE=100 for repeated runs), cd app && npm run export:web && npx expo serve --port 8081, then in another terminal npm run screenshots   (tests run one at a time because they share the seeded database; flows.spec reseeds when done; sweep.spec fails on any console error or failed API call; styleguide at 360/768/1280, P3c, P4, P5 and sign-up at 360, final QA at 320, into docs/screenshots/; first time: npx playwright install chromium, or CHROMIUM_PATH=<chrome binary>)
Real-phone checks: docs/phone-checklist.md
Backend tests: cd backend && .venv/bin/pytest   (builds and drops a <DB_NAME>_test MySQL database; fixed clock Monday 2026-10-05 10:00 Riyadh)
DB reset + seed: python3 scripts/reset_db.py   (add --rebase to move seed dates to the current week; reads DB_* from .env; needs the mysql client: MYSQL_CLI in .env, else PATH, else the default Windows install folder)
DB checks (constraints, seed rules, charset, reserved words, ER sync): python3 scripts/check_db.py
SQL deliverables (runs db/queries.sql on a throwaway copy; coverage per table, view and trigger-demo results): python3 scripts/check_sql.py [--rows]   (by hand: mysql -u root -p mawjood < db/queries.sql, or run the file in MySQL Workbench)
DB load by hand: mysql -u root -p < db/create_database.sql, then run db/schema.sql and db/seed.sql in the mawjood database (CLI or MySQL Workbench; see docs/run-on-phone.md)
Palette check (WCAG contrast + colour-blind separation of status colours): python3 scripts/check_palette.py [palettes.json]
Backend lint/format: cd backend && .venv/bin/ruff check . && .venv/bin/ruff format --check .
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
Approved backend dependencies: uvicorn, argon2-cffi, PyJWT, pydantic-settings, PyMySQL[rsa] (approved 2026-10-05), pytest, httpx (tests), ruff. Client dependencies: the list in docs/plan.md (approved 2026-10-05), each installed in the phase that first uses it.
Client (P3b): Expo SDK 57, routes in app/src/app, @/ = app/src. Reanimated's plugin comes from babel-preset-expo (no babel.config.js). The RTL switch reloads with reloadAppAsync() from expo (no expo-updates). Lint forbids raw hex colours outside src/theme and whole-package lucide imports. In this sandbox, Expo CLI commands need EXPO_OFFLINE=1 (api.expo.dev is blocked). Web bundle: 495 KB gzipped (no longer a target, see Product focus below).
Product focus (2026-10-05, owner: "I just want the phone version"): the phone app (Android and iOS through Expo Go) is the product. The web build is kept only as the automated test harness (Playwright), because the cloud sandbox has no phone. No desktop layouts and no web bundle-size target. The admin area is therefore phone screens too (P4, my default; say if you want it otherwise).
Client (P3c): first launch shows the language screen (device language preselected, applied on Continue); then sign-in; the start route sends students to /home and professors and admins to /staff (a notice until P4). Student tabs: Home and Profile (Search, Appointments, Messages arrive in P4/P5, no placeholders). Access token in memory; refresh token in expo-secure-store (native) or the httpOnly cookie (web); a saved session opens at once with the cached profile (AsyncStorage key mawjood.user, public fields only) and is confirmed in the background. Server data: TanStack Query, polling every 20 s, paused offline (NetInfo), last known data persisted to AsyncStorage for 24 h (not search results) and deleted on sign-out. Home search shows results inline and can pin; the department list shows all professors of the student's department, pinned ones marked. Tab labels scale to 130% at most (system tab bars do the same); everything else to 200%. API: optional DEMO_NOW freezes the clock for screenshots and demos.
Client (P4): routes: students (student)/home, search, appointments, profile and professors/[id] (profile + booking sheet); professors staff/status, requests, schedule, account; admins admin/departments, offices, professors, students, account. The start route sends each role to its first tab. Booking: Book, day (defaults to today), time (start and length), confirm = at most 4 steps; unavailable times stay visible, are named "09:00, unavailable" and explain themselves; an error keeps the selection (only a time someone else just took is unselected). Cancel and delete confirm in a bottom sheet (React Native's Alert does nothing on the web build). Status presets: "Back in 15/30 min" = away until now + 15/30 min; "In office until HH:MM" = until the end of the current or next office-hours block today; "Away for today" = away with no return time. Admin forms check the same patterns as the API before sending. Absolute positions and text alignment go through app/src/lib/direction.ts (React Native mirrors start/end and left/right in RTL on phones; the web build does not).
Backend fix (P4): optional text fields (booking note, status note, block label) now accept an explicit null; before, null hit the max_length check and returned 500.
API decisions (P5): /api/v1/conversations (list by latest activity, open-or-reopen with professor_id or student_id, messages newest first, send, mark read) and /api/v1/notifications (list, unread counts for the badges, mark read). Chat eligibility is checked when a conversation opens and on every message; non-participants get 404, admins 403. Sending is limited to 20 messages per minute per user (MESSAGES_PER_MINUTE). A new message updates the recipient's one unread "new message" notification for that conversation (its time moves forward) instead of adding another. Reading a conversation marks its messages and that notification read. Notifications carry the other person and, for appointments, the start time; the client writes the sentence.
Sign-up (after P6, owner decisions 2026-10-05): POST /api/v1/auth/signup for students and professors (never admins), only at SIGNUP_EMAIL_DOMAIN (default upm.edu.sa, the university's domain; no email verification). A student's email is their university number (1234567@upm.edu.sa) and the number is read from it (no separate field); professors may use a name. Seed accounts keep the fictional university.example domain (Section 8). A student is active and signed in at once (tokens as at sign-in). A professor is created inactive (HTTP 202, no tokens) until an admin sets the account active; until then sign-in returns ACCOUNT_DISABLED and students do not see the professor. Rate limit: SIGNUPS_PER_MINUTE (5) per client address. GET /api/v1/departments is public, for the form. App: route sign-up, linked from sign-in. Inactive accounts are labelled "Not active" in the admin area. Account creation is shared by admin and sign-up in backend/app/services/accounts.py.
Colleges (owner decision 2026-10-05): new table colleges (code, name_ar, name_en); departments.college_id NOT NULL, ON DELETE RESTRICT. Seed = the university's 3 colleges and 12 departments (College of Computer and Cyber Sciences: SE, CYB, AI; College of Engineering: ARCH, EE, ID, CE; College of Business and Tourism: ACC, FIN, BM, MKT, IHM); Mechatronics left out. colleges (3) and departments (12) are documented exceptions to the 5-10 seed rows rule. The API returns each department with its college; GET /api/v1/colleges is public. The app chooses a department from a menu grouped by college (sign-up, admin forms, Search filter); search also matches college names.
Clock (owner decision 2026-10-05): every time shown in the app uses the 12-hour clock, "9:30 AM" / "9:30 ص" (clockText in app/src/lib/format.ts); the API and the database keep 24-hour HH:MM. The schedule editor picks hour, minutes and AM/PM with chips. A status ending at Riyadh midnight reads "for the rest of today". The app's saved API data carries a cache version (buster in app/src/api/queryClient.ts); change it whenever a response changes shape.
SQL (P6): the views (v_professor_current_status, v_professors_in_office_now, v_upcoming_appointments) live in db/queries.sql, not schema.sql. They are derived and created with CREATE OR REPLACE VIEW, and the API does not use them. queries.sql freezes its session clock at the demo moment with SET timestamp; delete that line for the real time. The trigger demo is a temporary procedure that catches each error and shows it as a row, inside a rolled-back transaction, so the file runs to the end in any client and changes no data. backend/tests/test_sql_views.py checks the status view against the API every 15 minutes for a week.
Client (P5): routes (student)/messages and staff/messages (tabs with an unread badge named "Messages, N unread"), conversations/[id] (thread, polled every 15 s) and notifications (the bell on Home and My status). A message shows at once and, if sending fails, stays with "Not sent. Tap to try again."; only your latest message shows Sending/Sent/Read. Professors get three quick replies that send in one tap. The profile's Message button and the Requests screen open the conversation. Settings (device only, AsyncStorage, kept after sign-out): text size Small/Medium/Big (x0.9, x1 default, x1.2 on top of the phone's size, 200% cap kept; earlier saved sizes map to Medium or Big, 2026-10-06) and in-app notification preferences (appointments, messages), which only filter what the bell shows. Tab labels ignore the in-app text size and shrink to fit one line.
API decisions (P2): bookings are open for this week and next (up to the Riyadh midnight starting the Sunday after next, matching the DESIGN.md 7.5 day strip); only a professor's latest override counts; clearing a status set in the same second deletes that override (the expires_at > created_at CHECK leaves no other way), and any earlier one from that second, until none is active; professor search and filtering run in Python over one query (small directory; Arabic normalization needs Python); appointments belonging to someone else return 404, not 403; login is rate-limited, and messages since P5 (docs/security.md).
Free booking and moving earlier (owner decisions 2026-10-06): GET /professors/{id}/slots lists every 5-minute start of the day's office hours with max_minutes (the longest free length from there) and step_minutes; POST /appointments takes minutes (5-minute steps, default the professor's slot_minutes); the start and the whole length must sit inside one office_hours block (INVALID_SLOT), and overlap is SLOT_TAKEN (API check plus the existing triggers). When a pending or approved appointment is cancelled, the next active appointment of that professor the same Riyadh day, if it belongs to another student who could move into the freed time, gets a slot_freed notification. GET /appointments/{id}/earlier-starts and POST /appointments/{id}/move (students, own appointment, pending or approved) move it earlier the same day with the same length and status; the professor gets appointment_moved, and the student's slot_freed notice is marked read. notifications.type CHECK gains appointment_moved and slot_freed (the only schema change). App: the booking sheet shows the free stretches, hour then minute chips and a length stepper with one-tap lengths; the notice opens a "Move earlier" sheet on Appointments (?move=<id>); appointment cards show the end and length. The "Today" timeline is an agenda (DESIGN.md Section 11). Cache buster free-booking.
