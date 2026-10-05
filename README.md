# AI 418 Project — Mawjood (موجود): is the professor in?
 
## Team
| Name | Student ID | Role this milestone |

|Anas Mohammed Aljamil|4510440|leader|

|Abdulaziz Omar Ateeq|4320434|member|

|Abdullah Siddique|4412383|member|

 
## The problem
Students walk to a professor's office during the posted office hours and find it empty: the professor is in a meeting, running late, or has moved the hours, and nothing told the student before the trip. Office hours on a door or a syllabus say when a professor should be in, not whether they are in right now. Any fix also has to cost professors almost nothing. A status that needs constant updating will not be kept up to date, so it must take one tap, or none at all when the weekly timetable is right.
 
## Who this is for
- **Students first:** undergraduates at a Saudi university (the app is Arabic first, with English), who want to know before they walk over whether a professor is in the office, then book a slot or send a short message.
- **Professors:** faculty who hold weekly office hours and want to tell students where they are with one tap, or not at all (the timetable answers for them), and who approve or decline booking requests.
- **Department administrators:** they keep departments, offices and accounts up to date.
 
## Milestones
- [ ] M1 (Week 5) — Understand: interviews, personas, storyboard, requirements
- [ ] M2 (Week 8) — Design & audit: wireframes to Figma prototype, WCAG 2.2 audit (AR + EN)
- [ ] M3 (Week 11) — Intelligence: one adaptive layer + honest uncertainty
- [ ] Week 14 — Final report (8%) + Demo Day presentation (7%). There is no M4; the spatial layer is optional and built in Week 13 if your team takes it.
 
## Decision log
| Date | Decision | Why | Who disagreed |
|---|---|---|---|

## Run it locally

Full step-by-step guide (Windows and macOS, including the phone): [docs/run-on-phone.md](docs/run-on-phone.md).

### Database: MySQL 8.0
1. Install MySQL 8.0:
   - **Windows:** with [MySQL Installer](https://dev.mysql.com/downloads/installer/) (Server 8.0 + Workbench), then add `C:\Program Files\MySQL\MySQL Server 8.0\bin` to PATH.
   - **macOS:** run `brew install mysql@8.0 && brew services start mysql@8.0`.
2. Load the database, in this order and in one session: `db/create_database.sql`, `db/schema.sql`, `db/seed.sql`.
   - **MySQL Workbench:** open each file and Execute.
   - **CLI:** run `mysql -u root -p`, then `SOURCE db/create_database.sql; SOURCE db/schema.sql; SOURCE db/seed.sql;`.
3. Or let the scripts do it and verify:
   - copy `.env.example` to `.env` and set `DB_PASSWORD`;
   - run `python3 scripts/reset_db.py`;
   - run `python3 scripts/check_db.py`.
4. The graded SQL is in [`db/queries.sql`](db/queries.sql): 85 queries, three views and a double-booking trigger demo. It runs in the mawjood database with no errors and changes no data: `mysql -u root -p mawjood < db/queries.sql`, or open it in Workbench and run it all. `python3 scripts/check_sql.py` runs it on a throwaway copy and prints the coverage per table.

Demo accounts (fictional) all use the password `Mawjood-Demo-2026`, for example `s.almutairi@university.example` (student), `n.alharbi@university.example` (professor) and `admin@university.example` (admin).

### Backend API (FastAPI)
1. Add a `JWT_SECRET` (a long random string) to `.env`.
2. Run:
   ```bash
   cd backend
   python3.12 -m venv .venv && source .venv/bin/activate   # Windows: py -3.12 -m venv .venv && .venv\Scripts\activate
   pip install -e ".[dev]"
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload   # API docs: http://localhost:8000/docs
   pytest                                                     # 124 tests against a throwaway MySQL database
   ```

### App (Expo: Android and iOS through Expo Go, plus the web build)
Needs Node.js 22 LTS and the **Expo Go** app on your phone. The phone and computer must be on the same Wi-Fi.
```bash
cd app
npm install
npx expo start        # scan the QR code with Expo Go (Android) or the Camera app (iPhone); press w for the web build
```
The app finds the backend on the same computer by itself (details and fixes for university Wi-Fi: [docs/run-on-phone.md](docs/run-on-phone.md), Sections 3-4). The first launch asks for the language, then you sign in with a demo account (below). What each role gets:
- **Students:**
  - Home: pinned professors with their live door status, the next appointment and their department; refreshed every 20 seconds and still readable offline;
  - Search, professor profiles and booking in 4 steps;
  - Appointments, Messages and notifications.
- **Professors:**
  - My status: one tap, with presets and a note;
  - Requests, Schedule, Messages with quick replies, and notifications.
- **Admins:** departments, offices, professors and students (create, edit, delete).
- **Settings for everyone:** language, theme and text size.
- **New users:** "Create an account" on the sign-in screen with a university email (`@upm.edu.sa`; students use their university number, like `4510440@upm.edu.sa`).
  - Students start at once.
  - A professor's account waits until an admin sets it active.

Checks:
```bash
npm run typecheck && npm run lint && npm run format && npm test      # TypeScript, ESLint, Prettier, Jest
npm run export:web && npx expo serve --port 8081                      # web build (test harness only); then, in a second terminal:
npm run screenshots                                                   # Playwright -> docs/screenshots/ (API with DEMO_NOW, see CLAUDE.md)
```
What can only be checked on a real phone (haptics, TalkBack/VoiceOver, 200% text, safe areas, Android back, keyboard): [docs/phone-checklist.md](docs/phone-checklist.md).

### Documentation
- [ER diagram + Chen-notation description](docs/er-diagram.md) ([PNG](docs/er-diagram.png))
- [Normalization and MySQL design decisions](docs/normalization.md)
- [Phase plan and acceptance criteria](docs/plan.md)
- [Security: sign-in, tokens, CSRF, rate limits](docs/security.md)
- [Design system](docs/DESIGN.md) and [design plan with the chosen direction](docs/design-plan.md)
- [Test plan, traceability and results](docs/test-plan.md); [design QA per screen](docs/design-qa.md); [real-phone checklist](docs/phone-checklist.md)
- Screenshots:
  - [styleguide](docs/screenshots/p3b/);
  - [language, sign-in and home](docs/screenshots/p3c/);
  - [search, profile, booking, appointments, professor and admin screens](docs/screenshots/p4/);
  - [chat, notifications and settings](docs/screenshots/p5/);
  - [final QA at 320 px, dark theme](docs/screenshots/final/).
