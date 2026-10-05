# AI 418 Project — [not yet]
 
## Team
| Name | Student ID | Role this milestone |

|Anas Mohammed Aljamil|4510440|leader|

|Abdulaziz Omar Ateeq|4320434|member|

|Abdullah Siddique|4412383|member|

 
## The problem
One paragraph. A real task that real people do badly today.
Not “we will build an app for X.”
 
## Who this is for
Who specifically. Not “everyone” or “users.”
 
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

Demo accounts (fictional) all use the password `Mawjood-Demo-2026`, for example `s.almutairi@university.example` (student), `n.alharbi@university.example` (professor) and `admin@university.example` (admin).

### Database documentation
- [ER diagram + Chen-notation description](docs/er-diagram.md) ([PNG](docs/er-diagram.png))
- [Normalization and MySQL design decisions](docs/normalization.md)
- [Phase plan and acceptance criteria](docs/plan.md)
