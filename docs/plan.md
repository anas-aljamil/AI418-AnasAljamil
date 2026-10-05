# Mawjood: phase plan, acceptance criteria and dependencies

Revised 2026-10-05 for two changes: the client is an Expo (React Native) app, and the database is MySQL 8.0. This file is the detailed companion to CLAUDE.md Section 11. Every phase ends with a commit and a pull request into `main`; the next phase starts only after approval.

## Phases and acceptance criteria

### P1: Database schema and seed (MySQL 8.0)
- `db/create_database.sql`, `db/schema.sql` (tables, indexes, triggers) and `db/seed.sql` load into MySQL 8.0 with no errors and no warnings.
- Every table is InnoDB, utf8mb4 / utf8mb4_0900_ai_ci; no identifier is a MySQL reserved word.
- `scripts/check_db.py` passes. It covers:
  - constraint tests (bad data rejected, each with the *expected* MySQL error code; valid edge cases accepted);
  - seed invariants for the CLAUDE.md Section 4 rules;
  - an Arabic round-trip;
  - the rebase;
  - ER-diagram sync.
- `docs/er-diagram.md` has the Mermaid diagram and a Chen-notation description; `docs/normalization.md` explains 3NF and every MySQL-specific choice.
- `docs/run-on-phone.md` and the README explain MySQL setup on Windows and macOS (MySQL Installer / Homebrew) and loading the files from Workbench or the CLI.

### P2: Backend API, auth, tests
- FastAPI under `/api/v1`, SQLAlchemy 2.x on MySQL via PyMySQL; every connection sets `time_zone = '+00:00'` and utf8mb4.
- Endpoints:
  - auth (login, refresh, logout, me);
  - departments;
  - professors (list/search with Arabic normalization, filters, pagination, profile with effective status and today's timeline, free slots);
  - status override set/clear;
  - schedule CRUD;
  - appointments (book, list, approve, decline, cancel, complete, no-show);
  - pins;
  - admin CRUD for departments, professors, students and offices (create, edit, deactivate, delete).
- Refresh token on the web build: httpOnly SameSite=Strict cookie plus a custom header (CSRF). On native: secure-store, token in the request body. Both are covered by tests.
- pytest runs against a throwaway MySQL database. It includes:
  - at least one named test per Section 4 rule, with edge cases at exactly 4 h, exactly 1 h and override expiry, and a fake clock;
  - ownership and role tests;
  - the shared error shape;
  - a 429 on login (the same limiter covers messages since P5);
  - CORS for the Expo web dev server.
- `/docs` loads; ruff is clean; `.env.example` is complete; CLAUDE.md commands are filled in.

### P3a: Design plan (stop for your choice)
- `docs/design-plan.md`: two directions per DESIGN.md Section 10. Each has 4-6 named colors for light and dark, typeface and scale, ASCII wireframes of Student Home and Professor Status, how the door is drawn (react-native-svg) and animated (Reanimated), and a motion plan with haptics.
- Each direction is critiqued against Section 3 and revised. No code.

### P3b: Expo foundations and /styleguide (stop for your review)
- Expo SDK 57 app in `app/` (Expo Router, TypeScript strict) that opens in Expo Go on Android and iOS and as a web build.
- Typed theme module (both palettes, type scale with per-script line heights, spacing, radii, elevation, durations); fonts bundled; theme switching (system/light/dark); i18n scaffold (ar.json, en.json); RTL with the I18nManager reload flow; backend URL discovery (see run-on-phone.md).
- A `/styleguide` screen shows every token and component in Arabic and English, light and dark: buttons, chips, inputs, all door states with animation, list rows, cards, bottom sheet, toast, skeletons, empty state.
- Evidence:
  - Jest + RNTL green;
  - a script checks WCAG AA contrast for every text/background token pair in both themes;
  - Playwright screenshots of the web build at 360/768/1280 in Arabic-light and English-dark, reviewed;
  - typecheck and lint clean.
- Real-phone checklist delivered (see below) with exact steps.

### P3c: Language choice, sign-in, student home (stop for your review)
- First-launch language screen, sign-in with a seed account, then Student Home (DESIGN.md 7.2) on real API data with polling every 20 s.
- Loading, empty, error and offline states are built, with last known data persisted and an offline notice.
- "Is Dr. X in?" is answerable within 3 s and a professor's status is reachable in at most 2 taps, both demonstrated (screen recording or timed Playwright run on web).
- DESIGN.md Section 12 checklist reported per item as verified or needs-a-phone.
- **Result (2026-10-05):** met on the web build; timed Playwright run: pinned status visible about 300 ms after opening, 0 taps. Section 12 report: [design-qa.md](design-qa.md); phone checks #14-#26 in [phone-checklist.md](phone-checklist.md). Screenshots at 360 px only, since the phone app is now the product (CLAUDE.md Section 14, product focus).

### P4: Remaining screens and admin area
- Search (Arabic normalization), professor profile, booking sheet with the signature moment and haptic, my appointments, and the professor tabs (Status, Requests, Schedule editor). Professor status change takes 1 tap; booking takes at most 4 steps (counted).
- **Admin area (web layout)**: list, create, edit and deactivate/delete for departments, professors, students and offices through the real API, with validation errors shown inline and destructive actions confirmed. Full CRUD is demonstrated on the real MySQL database: a Playwright run creates, edits and deletes a row of each type and verifies it in MySQL.
- Playwright end-to-end tests on the web build:
  - student books → professor approves → student sees Approved;
  - professor taps a status → the student view updates within one poll.
- Jest tests for the booking flow (selection kept on error), cancel-window logic and Arabic normalization. Section 12 checklist per screen.

- **Result (2026-10-05):** met on the web build against the real API and MySQL (`app/e2e/p4.spec.ts`):
  - booking takes 4 steps (Book, day, time, confirm); a student books, the professor approves, and the student's list shows Approved at the next poll;
  - a professor's one-tap status change reaches the student's open profile within one poll (20 s);
  - the admin creates, edits and deletes a department, an office, a professor and a student, each checked in MySQL.
  - **Admin area:** phone screens instead of a desktop web layout (product focus). Jest covers the booking sheet (selection kept on error), the cancel window, search filters and admin validation. Section 12 report: [design-qa.md](design-qa.md); phone checks #27-#40 in [phone-checklist.md](phone-checklist.md).

### P5: Chat, notifications, settings
- Conversations and messages:
  - eligibility rule;
  - rate limit;
  - read receipts;
  - quick replies;
  - bubbles correct in both reading directions;
  - the chat composer stays above the keyboard.
- In-app notifications (polling): grouped by today/earlier, linked to their source, with an unread badge on the tab. Settings: language (with reload), theme, text size, in-app notification preferences.
- Backend tests for chat eligibility and notification creation; Jest tests for the thread and list; screenshots; Section 12 checklist.

- **Result (2026-10-05):** met on the web build against the real API and MySQL (`app/e2e/p5.spec.ts`):
  - a student writes to Dr. Noura; she sees "Messages, 1 unread" and "Notifications, 2 new", opens the message from the bell and answers with one quick reply; the student's open thread shows the reply and "Read" within one poll (15 s); each step is checked in MySQL;
  - a student without a booking cannot open a chat with a professor who does not accept messages from everyone (no conversation row is created);
  - "Larger" text makes the Profile text 1.3 times bigger, and turning off message notifications hides them under the bell;
  - Arabic screens: conversations, both sides of a thread, notifications.
  - Backend: 11 new tests (eligibility, participants only, receipts, merged notifications, validation, the 20-per-minute message limit); 106 in total. Jest: thread (optimistic send, failure and retry, quick replies) and notifications (grouping, hidden by settings). Section 12 report: [design-qa.md](design-qa.md); phone checks #41-#50 in [phone-checklist.md](phone-checklist.md).

### P6: SQL deliverables, docs, final QA
- `db/queries.sql` meets CLAUDE.md Section 6 per table, with at least 2 views (`v_professors_in_office_now`, `v_professor_current_status`, `v_upcoming_appointments`) and a demonstration of the double-booking trigger firing.
- `scripts/check_sql.py` runs every statement against MySQL 8 only and prints per-table coverage (queries, aggregates, joins, GROUP BY…HAVING, UNION, LIKE, BETWEEN, IN, IS NULL, DISTINCT).
- README with setup and demo accounts; `docs/test-plan.md`; final design QA with screenshots; Lighthouse on the web build if available; final real-phone checklist results.

- **Result (2026-10-05):** met, except the real-phone results, which need you.
  - **`db/queries.sql`:**
    - 85 queries and views in 93 statements, at least 5 queries and 2 aggregates for each of the 12 tables;
    - views `v_professor_current_status`, `v_professors_in_office_now` and `v_upcoming_appointments`;
    - a trigger demo that runs five booking attempts in a rolled-back transaction: three rejected with SLOT_TAKEN, two accepted.
  - **`scripts/check_sql.py`:** 38/38. It runs every statement on MySQL 8.0.46, checks the coverage and checks the results at the demo moment.
  - **`test_sql_views.py`:** the status view agrees with the API's status logic every 15 minutes for a whole week, overrides included. A deliberately broken staleness rule makes it fail.
  - **Final design QA:** every tab of every role, plus the profile, the booking sheet, notifications and a conversation, fits 320 px in Arabic (light) and English (dark). Playwright `e2e/final.spec.ts`; screenshots in `docs/screenshots/final/`.
  - **Test plan with traceability:** [test-plan.md](test-plan.md). Lighthouse was not run (web build is the test harness only).

### After P6: Sign-up (owner request, 2026-10-05)
- **Decisions (owner):** students and professors may sign up; only university email addresses; a student is signed in at once; a professor waits for an admin to activate the account.
- **Acceptance criteria:**
  - a student creates an account from the sign-in screen and lands on Home, checked in MySQL;
  - a professor's request creates an inactive account, which cannot sign in until the admin sets it active;
  - other domains and `admin` are refused; field errors show next to the field; sign-up is rate-limited.
- **Result (2026-10-05):** met.
  - `POST /api/v1/auth/signup`: 14 backend tests.
  - Sign-up screen with field checks: 4 Jest tests.
  - `app/e2e/signup.spec.ts`: student signs up; professor request, admin activation and the professor's first sign-in; Arabic form and the domain rule; each checked in MySQL.
  - The department list (`GET /api/v1/departments`) is now public, because the form needs it before sign-in.
  - Found on the way: the admin forms showed a generic server error for a taken email or university number. Those codes now have their own messages.

## Checks that need a real phone

These cannot be verified in this cloud sandbox (no phone or emulator) or by web screenshots. Each phase lists the relevant ones with exact steps, and they are reported as "needs a real phone" until you confirm them.

| Check | Why web screenshots can't show it |
|---|---|
| Haptics on status change and booking confirmation | Web has no haptics |
| TalkBack and VoiceOver reading order, labels and live announcements | Native accessibility APIs |
| System font scale at 200% (Android "Font size", iOS "Larger Text") | Native font scaling differs from browser zoom |
| RTL switch with app reload (I18nManager) | Web switches `dir` without reloading |
| Safe areas (notch, home indicator, Android navigation bar) | Device-specific insets |
| Android back button behavior | No hardware back on web |
| Keyboard covering inputs (sign-in, booking note, chat) | Native soft keyboards |
| Reduce-motion system setting honored | OS setting |
| Secure storage of the refresh token, staying signed in after restart | expo-secure-store is native-only |
| Cold start under 2 s and 60 fps scrolling | Needs a release build on a mid-range Android phone; Expo Go development mode is slower and is reported only as indicative |
| Expo Go reaching the backend over Wi-Fi | Depends on your network and firewall |

## Dependencies

### Backend

| Package | Purpose | Status |
|---|---|---|
| fastapi, sqlalchemy, pydantic | Stack from CLAUDE.md Section 5 | In the stack |
| uvicorn, argon2-cffi, PyJWT, pydantic-settings, httpx (tests), ruff, pytest | Server, password hashing, JWT, settings, tests, lint | Approved |
| **PyMySQL[rsa] 1.2.x** | MySQL driver. Pure Python, so it installs on Windows and macOS with no compiler or MySQL client libraries (mysqlclient needs both on macOS). The `rsa` extra adds `cryptography`, required for MySQL 8's default `caching_sha2_password` login over a non-TLS connection | Approved 2026-10-05 |

P1 adds no dependency: its scripts use only the Python standard library and the `mysql` command-line client that ships with MySQL.

### Client (Expo SDK 57; every native module below is included in Expo Go, so no custom build is needed)

Versions are pinned by `npx expo install`, which picks the ones matching SDK 57. Each package is installed in the phase that first uses it: P3b installed the app, navigation, SVG, icons, Reanimated, i18n, fonts, haptics, system UI, AsyncStorage and the dev tools; TanStack Query, NetInfo and expo-secure-store come in P3c, gesture-handler with the first draggable sheet in P4.

| Package | Purpose |
|---|---|
| expo, react, react-native, expo-router, react-native-screens, react-native-safe-area-context, expo-linking, expo-constants, expo-status-bar | App, navigation (tabs, stacks, `/styleguide`), safe areas; `expo-constants` gives the dev machine's address for backend discovery |
| react-dom, react-native-web | The Expo web build |
| typescript, @types/react | Strict TypeScript |
| react-native-svg | Door icons, logo, empty-state line drawings |
| lucide-react-native | UI icons (uses react-native-svg) |
| react-native-reanimated, react-native-worklets | The door animation, sheets, press feedback, reduced-motion hook (the only animation library) |
| react-native-gesture-handler | Bottom-sheet drag and swipe shortcuts (each has a visible button too) |
| @tanstack/react-query | Server state, polling, optimistic updates |
| @tanstack/react-query-persist-client, @tanstack/query-async-storage-persister, @react-native-async-storage/async-storage | Persist last known data for the offline state; remember language and theme |
| @react-native-community/netinfo | Offline detection and notice |
| i18next, react-i18next, expo-localization | Arabic/English strings; preselect the device language on first launch. The clean reload after an RTL/LTR switch uses `reloadAppAsync()` from `expo` itself, so expo-updates is not needed (removed in P3b) |
| expo-secure-store | Refresh token storage on Android/iOS |
| expo-haptics | Light haptics on status change and booking confirmation |
| expo-font, expo-splash-screen, @expo-google-fonts/ibm-plex-sans-arabic and @expo-google-fonts/ibm-plex-sans (chosen in P3a) | Bundled fonts; the splash screen stays until fonts load |
| expo-system-ui | Root background matches the theme (no white flash in dark mode) |
| **Dev:** jest, jest-expo, @testing-library/react-native, eslint, eslint-config-expo, prettier, @playwright/test | Tests, lint, format, web screenshots |

Not used, deliberately:
- **NativeWind or other styling libraries:** the typed theme module + StyleSheet is enough (decision logged in DESIGN.md Section 11).
- **Moti:** Reanimated alone.
- **A bottom-sheet library:** a small sheet built on React Native's Modal and Reanimated, with `accessibilityViewIsModal` and Android back handling.
- **Dropped from the earlier web plan:** react-router, @fontsource/* and Radix.

## Risks specific to the new stack
- **Expo Go supports only the newest SDK.** If Expo releases SDK 58 during the term, the store version of Expo Go may stop opening an SDK 57 project. Mitigation: upgrade with `npx expo install --fix` (usually small), or install the matching Expo Go build from expo.dev.
- **Phone and computer must share a network.** University Wi-Fi often blocks device-to-device traffic. Fallback: a phone hotspot, or `npx expo start --tunnel` for the app (the API URL then has to be set by hand; see run-on-phone.md).
- **The RTL reload behaves differently on web and native.** It is verified on a real phone in P3b.
- **MySQL 8's binary logging blocks trigger creation for users without SUPER.** Documented: load the schema as root, or set `log_bin_trust_function_creators = 1`.
