Mawjood: Office-Hours Availability System
1. Mission

Students waste trips to campus only to find a professor absent. Mawjood shows, remotely and in real time, whether a professor is in their office, lets students book a slot, and lets them chat. It must serve students AND faculty without burdening professors (status update = 1 tap, or fully automatic from the schedule). Context: this is a graded university project (HCI + Database Systems). Database quality, traceability, and polish are graded, so correctness and clarity beat feature count.

2. Users and goals
Student (primary): find a professor, trust the status, book, message.
Professor (secondary): set availability with near-zero effort, approve/decline requests, reply.
Admin (optional): manage departments, professors, accounts.
3. Scope

In: role-based auth, professor status, weekly schedule, search/filter, booking, chat, in-app notifications, Arabic/English with RTL. Out (do not build): payments, video calls, grades, native mobile apps, email/SMS, calendar sync.

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
Backend: Python 3.12, FastAPI, SQLAlchemy 2.x, Pydantic v2.
Database: SQLite for development (the cloud sandbox may not have PostgreSQL); keep SQL portable so it also runs on PostgreSQL.
Frontend: React + Vite + TypeScript, Tailwind CSS, shadcn/ui primitives restyled to our tokens (never their default look), Lucide icons, Motion (Framer Motion), TanStack Query, react-i18next.
Realtime: polling every 15-30s is acceptable for MVP; WebSocket/SSE only if time allows.
Tests: pytest (backend), Vitest + Testing Library (frontend), Playwright for screenshots if available.
6. Database requirements (graded)
3NF; document the normalization reasoning in docs/normalization.md.
Files kept in sync at all times: db/schema.sql, db/seed.sql, db/queries.sql, docs/er-diagram.md (Mermaid).
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
JWT (short-lived access token) or secure session cookie; CSRF consideration documented.
Rate-limit login and message endpoints.
Secrets in .env (never committed); provide .env.example.
Seed data must be fictional; no real names, IDs, or emails.
9. Design (authoritative source: docs/DESIGN.md)
Read docs/DESIGN.md fully before any frontend task. It overrides generic design habits.
Non-negotiables: Arabic-first with full RTL; the "door" status signature; status always shown as icon + label + color; designed light and dark themes; WCAG 2.2 AA; mobile-first; none of the templated defaults listed in DESIGN.md Section 3.
Follow the design process in DESIGN.md Section 10 and run its Section 12 checklist for every screen.
Record design decisions in DESIGN.md Section 11.
10. UX targets (verify, don't assume)
"Is Dr. X in right now?" is answerable within 3 seconds of opening the app.
Student reaches a professor's status in <= 2 taps from home.
Professor changes status in 1 tap.
Booking flow <= 4 steps.
Keyboard-navigable; visible focus rings; labels on all inputs.
11. Phases
P1: DB schema + seed (+ ER diagram and normalization docs).
P2: Backend API + auth + tests.
P3a: Design plan with two directions (DESIGN.md Section 10, step 1). Stop for my choice.
P3b: Design foundations + /styleguide. Stop for my review.
P3c: Student home screen. Stop for my review.
P4: Remaining screens (search, profile, booking, appointments, professor status).
P5: Chat + notifications.
P6: queries.sql, views, trigger, docs, README, test plan, final design QA.
12. Commands (keep this section updated)
Backend dev: <fill in once created>
Frontend dev: <fill in once created>
Tests: <fill in once created>
DB reset + seed: <fill in once created>
Lint/format: <fill in once created>
13. Working agreement
Work in small phases. Never start the next phase without my approval.
Before coding a phase: state the plan and acceptance criteria. After coding: run the app and tests, fix failures, then report what changed and how to verify.
A phase is "done" only when its acceptance criteria are demonstrably met (command output, test results, screenshots, or a described manual check).
Commit after every working phase using Conventional Commits (feat:, fix:, docs:, test:, style:).
Do not add features, dependencies, or schema changes outside this document without asking first; state any assumption explicitly.
Prefer simple, readable code with comments where the logic is non-obvious; no dead code or TODO litter.
If requirements conflict, stop and ask one precise question.
Update this file whenever a decision changes (commands, schema names, assumptions).
