# Mawjood: test plan and results

This plan says what is tested, at which level, how to run it, and what passed. Every requirement in CLAUDE.md Sections 4, 6, 8 and 10 maps to at least one automated test or a numbered real-phone check (traceability table below).

## 1. Levels

| Level | Tool | What it proves | Where |
|---|---|---|---|
| Database | `scripts/check_db.py` (67 checks) | The schema rejects bad data with the expected MySQL error (CHECK, UNIQUE, foreign keys, subtype guard, triggers). The seed obeys the business rules. Character set, engine and reserved words are right. The ER diagram matches the schema. | throwaway `<DB_NAME>_check` database |
| SQL deliverables | `scripts/check_sql.py` (39 checks) | Every statement in `db/queries.sql` runs on MySQL 8. Each table has at least 5 queries and 2 aggregates, and every required clause is used. The views and the trigger demo give the results the seed implies. The data-quality queries return no rows. | throwaway `<DB_NAME>_sql` database |
| Backend | pytest (134 tests) | Every API rule at its exact boundary: status, booking, cancellation window, chat eligibility, roles and ownership, validation, error shape, pagination, rate limits, tokens and CSRF. The SQL views agree with the API's status logic every 15 minutes for a whole week. | `<DB_NAME>_test` (real MySQL, one rolled-back transaction per test, fixed clock) |
| App units | Jest + React Native Testing Library (131 tests) | Components are accessible (role, name, state). The screens handle loading, empty, error and offline states. Booking keeps the selection on error. The API client refreshes tokens. Riyadh time and Arabic plurals are formatted right. RTL helpers work. Both language files match. Colour tokens pass WCAG contrast. | in memory, mocked API |
| End to end | Playwright on the Expo web build (50 tests) | Real flows against the real API and MySQL, each checked in the database. Timed UX targets. Arabic and English screenshots, light and dark. Every tab of every role fits 320 px. Every screen of every role opens in both languages with no console error and no failed API request. | seeded dev database, API with `DEMO_NOW`, browser clock frozen at the same moment |
| Real phone | [phone-checklist.md](phone-checklist.md) (#1-#62) | What a web build cannot show: TalkBack/VoiceOver, the system font size at 200%, haptics, safe areas, Android back, the keyboard, Expo Go on Android and iOS. | needs a person with a phone |

The fixed moment for every automated level is **Monday 2026-10-05 10:00 Riyadh (07:00 UTC)**, in the week the seed is anchored on.

## 2. How to run

```bash
python3 scripts/reset_db.py && python3 scripts/check_db.py       # 67/67
python3 scripts/check_sql.py                                     # 39/39 (add --rows to see every result)
cd backend && .venv/bin/pytest && .venv/bin/ruff check . && .venv/bin/ruff format --check .
cd app && npm run typecheck && npm run lint && npm run format && npm test
# End to end: fresh seed, API with the demo clock, web build served on :8081
python3 scripts/reset_db.py
cd backend && DEMO_NOW=2026-10-05T07:00:00Z LOGIN_ATTEMPTS_PER_MINUTE=100 SIGNUPS_PER_MINUTE=100 .venv/bin/uvicorn app.main:app --port 8000
cd app && npm run export:web && npx expo serve --port 8081
cd app && npm run screenshots                                    # all specs, one at a time
```

The end-to-end specs share the database and change it (bookings, messages, admin rows, new accounts), so they run one at a time on a fresh seed. `flows.spec.ts` changes rows the later specs read, so it loads the seed again when it finishes. A second run needs `reset_db.py` first. The raised login and sign-up limits are for repeated test runs only: at the defaults (5 per minute), a second run within a minute is correctly refused with 429.

## 3. Traceability

### Business rules (CLAUDE.md Section 4)

| Rule | Automated evidence |
|---|---|
| Effective status = override > schedule > unknown | pytest `test_status_rules.py` (14 tests); `test_sql_views.py` compares the SQL view with the API every 15 minutes for a week; `test_clearing_after_several_updates_in_one_second_still_returns_to_the_schedule`; Playwright P4 one-tap status and `flows.spec.ts` (presets, note, back to the schedule, checked in MySQL) |
| Override return time; no return time ends at Riyadh midnight; only the latest counts | `test_override_expires_at_return_time_and_falls_back_to_schedule`, `test_override_without_return_time_ends_at_riyadh_midnight`, `test_newer_override_replaces_older_even_after_it_expires`, and the same cases in `test_sql_views.py` |
| Staleness: not confirmed after more than 4 hours | `test_stale_office_status_is_not_confirmed_after_more_than_4_hours`, `test_office_status_exactly_4_hours_old_is_still_confirmed`; Playwright P4 shows "In office (not confirmed)" |
| Asia/Riyadh schedules, UTC storage, Sunday-Thursday | `test_connections_use_utc_and_utf8mb4`, `test_friday_with_a_schedule_is_away`; Jest `format.test.ts` (Riyadh dates and booking days) |
| Any 5-minute start and any length in 5-minute steps inside one office-hours block (revised 2026-10-06) | `test_any_5_minute_start_and_length_that_fits_the_office_hours`, `test_start_and_length_must_stay_on_the_grid_inside_office_hours`, `test_slots_are_5_minute_starts_with_the_longest_free_length`; `check_db.py` seed rule; Jest `booking.test.tsx` (free stretches, length stepper); Playwright P4 and `flows.spec.ts` (30 minutes booked, checked in MySQL) |
| No double booking, in the database and the API | `test_a_longer_appointment_cannot_overlap_the_next_booking`, `test_slot_cannot_be_double_booked`, `test_database_rejects_double_booking_even_without_the_api`, `test_a_lost_race_is_caught_by_the_database_and_reported_as_slot_taken`; `check_db.py` trigger tests; `queries.sql` trigger demo (`check_sql.py`) |
| At most 2 active future appointments per professor | `test_student_cannot_hold_more_than_2_upcoming_appointments_per_professor`, `test_past_and_cancelled_appointments_do_not_count_toward_the_limit`; seed invariant in `check_db.py`; query A5 |
| Cancel until 1 hour before | `test_cancellation_is_allowed_until_exactly_1_hour_before_start`, `test_cancellation_closes_inside_the_last_hour`; Jest `cancel.test.ts` |
| Time freed before yours; moving earlier keeps length and status | `test_cancelling_tells_the_next_student_who_moves_earlier_and_stays_approved`, `test_no_notice_when_nobody_can_use_the_freed_time`, `test_moving_is_only_earlier_the_same_day_and_never_onto_another_booking`, `test_only_the_student_who_booked_can_move_an_active_appointment`; Jest `move.test.tsx`; Playwright `flows.spec.ts` (notice, one-tap move, checked in MySQL) |
| Lifecycle transitions | `test_invalid_transitions_are_refused`, `test_completed_and_no_show_only_after_the_start` |
| Chat only after a non-declined appointment, or with open messages | `test_chat.py` (eligibility on open and on every message); Playwright P5 "no booking means no chat" (no row in MySQL); query C3 (no seed conversation breaks the rule) |

### Database (CLAUDE.md Section 6)

| Requirement | Evidence |
|---|---|
| 3NF, documented | [normalization.md](normalization.md) |
| PK, FK with ON DELETE rules, NOT NULL, UNIQUE, CHECK, DEFAULT | `check_db.py` constraint tests (each must fail with its MySQL error code) |
| 5-10 fictional seed rows per table | `check_db.py` seed checks; `reset_db.py` prints row counts |
| `queries.sql`: 5 queries and 2 aggregates per table, every clause, joins, GROUP BY + HAVING, views, trigger | `check_sql.py` coverage section |
| Files in sync | `check_db.py` ER-diagram sync check; `test_models_match_the_mysql_schema` (ORM and schema agree) |
| Full CRUD from the UI on the real database | Playwright P4: the admin creates, edits and deletes a department, office, professor and student, each checked in MySQL; Playwright sign-up: a new professor activated from the admin overview in one tap; Jest `overview.test.tsx` (activation request, tiles, filters, professor quick view) |

### Security (CLAUDE.md Section 8)

| Requirement | Evidence |
|---|---|
| Hashed passwords (argon2id) | `test_auth.py` login tests against the argon2 seed hashes |
| Parameterized queries | All SQL goes through SQLAlchemy with bound parameters (review; [security.md](security.md)) |
| Short-lived access token; refresh token in the secure store (native) or an httpOnly SameSite=Strict cookie (web); CSRF | `test_access_token_expires_after_15_minutes`, `test_web_login_sets_httponly_strict_cookie_instead_of_body_token`, `test_web_refresh_needs_the_csrf_header`; Jest `client.test.ts` |
| Rate limits on login and messages (and sign-up) | `test_login_is_rate_limited_after_5_attempts_per_minute`, `test_sending_is_rate_limited`, `test_sign_up_is_rate_limited` |
| Sign-up: university domain only, never admin, professors wait for an admin | `test_only_the_university_domain_may_sign_up`, `test_nobody_can_sign_up_as_an_admin`, `test_a_professor_signs_up_and_waits_for_an_admin`; Playwright `signup.spec.ts` (checked in MySQL) |
| Roles and ownership on the server | `test_roles_are_enforced_server_side`, `test_other_professors_cannot_see_or_change_an_appointment`, `test_only_participants_see_a_conversation`, `test_non_admins_cannot_use_the_admin_api` |

### UX targets (CLAUDE.md Section 10)

| Target | Evidence |
|---|---|
| "Is Dr. X in?" within 3 s of opening | Playwright P3c, timed: about 300 ms with no taps (web build); phone check #19 |
| Professor's status in at most 2 taps from Home | Pinned statuses on Home (0 taps); profile in 1 tap (Playwright P4); phone check #27 |
| Professor changes status in 1 tap | Playwright P4 (one tap on Busy, seen by the student within one poll); phone check #35 |
| Booking in at most 4 steps | Playwright P4 (Book, day, time, confirm); phone check #29 |
| Screen reader, keyboard, labels | Jest queries every control by role and name; Playwright styleguide keyboard focus ring; phone checks #5, #22, #30, #46 |

## 4. Results (2026-10-05, MySQL 8.0.46, Chromium for Playwright)

| Suite | Result |
|---|---|
| `check_db.py` | 67/67 |
| `check_sql.py` | 39/39 |
| pytest | 134 passed; ruff clean |
| Jest | 131 passed; typecheck, lint and format clean |
| Playwright | 50 passed: styleguide 13, P3c 6, P4 4, P5 3, final QA 9, sign-up 3, screen sweep 7, everyday flows 5 |
| Real phone | #1-#62 not yet run (no phone in the cloud sandbox) |

## 5. Not covered, and why

- **Real phones.** Everything in [phone-checklist.md](phone-checklist.md) needs a person with Android and iOS phones and Expo Go.
- **Concurrency under load.** The race between two bookings is tested once, deterministically. The UNIQUE index is the guarantee; there is no load test.
- **Lighthouse.** Not run: the web build is only the test harness (product focus, CLAUDE.md Section 14).
- **Real time.** All automated runs use the frozen demo moment. With the real clock, `scripts/reset_db.py --rebase` moves the seed to the current week.
