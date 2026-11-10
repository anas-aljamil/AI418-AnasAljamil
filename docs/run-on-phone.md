# Running Mawjood on your computer and phone

This guide takes you from a fresh computer to the app running on your phone. It has four parts:

1. **MySQL 8.0** on your computer, holding the Mawjood database.
2. **The backend API** (Python), which reads MySQL.
3. **The app** (Expo), served from your computer over the same Wi-Fi: in the phone's **browser** (any iPhone or Android, no install; Section 3a) or in **Expo Go**.
4. **How the app finds the backend.**

All four parts work today.

---

## 1. MySQL 8.0

Use **MySQL 8.0**, not MariaDB and not MySQL 9 (the schema is written and tested for 8.0).

### Windows
1. Download **MySQL Installer for Windows** from <https://dev.mysql.com/downloads/installer/> and run it.
2. Choose **Custom** and add these three products:
   - MySQL Server 8.0.x;
   - MySQL Workbench 8.0.x;
   - MySQL Shell (optional).
3. Accept the defaults:
   - Development Computer;
   - port 3306;
   - **Use Strong Password Encryption**.
4. Set a **root password** and write it down.
5. Leave **Configure MySQL Server as a Windows Service** ticked, so MySQL starts with Windows.
6. Add the client to your PATH so the scripts can find `mysql.exe`:
   - Start → "Edit the system environment variables" → Environment Variables;
   - under **Path**, add `C:\Program Files\MySQL\MySQL Server 8.0\bin`;
   - open a new terminal and check with `mysql --version`.
   - If you can't edit PATH, put `MYSQL_CLI=C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe` in `.env` instead.
   - The project scripts also look in `C:\Program Files\MySQL\MySQL Server 8.0\bin` on their own. PATH is still needed to type `mysql` in a terminal.

### macOS (Homebrew)
```bash
brew install mysql@8.0
brew services start mysql@8.0
echo 'export PATH="$(brew --prefix mysql@8.0)/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
mysql_secure_installation     # set the root password; answer the other questions as you like
mysql --version               # should print 8.0.x
```
MySQL Workbench for macOS: download it from <https://dev.mysql.com/downloads/workbench/>, or run `brew install --cask mysqlworkbench`.

### Load the database

The three files must run in this order, in one session:
1. `db/create_database.sql` (drops and recreates the `mawjood` database);
2. `db/schema.sql`;
3. `db/seed.sql`.

**Option A: MySQL Workbench**
1. Open your local connection (root).
2. *File → Open SQL Script…* → `db/create_database.sql` → click the lightning bolt (Execute). The `USE mawjood;` at its end makes `mawjood` the default schema.
3. Open `db/schema.sql` in the same connection and execute it.
4. Open `db/seed.sql` and execute it.
5. Refresh the *Schemas* panel: `mawjood` shows 15 tables. Check with `SELECT COUNT(*) FROM mawjood.users;`, which returns 16.

Workbench understands the `DELIMITER $$` lines around the triggers; don't remove them.

**Option B: command line** (from the repository folder)
```bash
mysql -u root -p
```
then at the `mysql>` prompt:
```sql
SOURCE db/create_database.sql;
SOURCE db/schema.sql;
SOURCE db/seed.sql;
```

**Option C: the project scripts** (rebuild and verify in one step; needs Python 3.12)
1. Copy `.env.example` to `.env` and put your root password in `DB_PASSWORD`.
2. Run:
   ```bash
   python3 scripts/reset_db.py            # Windows: py scripts\reset_db.py
   python3 scripts/check_db.py            # 63 checks; all should PASS
   ```
`python3 scripts/reset_db.py --rebase` moves the demo appointments to the current week, so "upcoming" bookings are really upcoming on demo day.

### Optional: a dedicated database user instead of root
```sql
CREATE USER 'mawjood'@'localhost' IDENTIFIED BY 'choose-a-password';
GRANT ALL PRIVILEGES ON `mawjood%`.* TO 'mawjood'@'localhost';
-- MySQL 8 has binary logging on, so a non-root user may only create the
-- double-booking triggers if this is enabled (run once as root):
SET PERSIST log_bin_trust_function_creators = 1;
```
Then set `DB_USER=mawjood` and the password in `.env`. The `mawjood%` pattern also covers `mawjood_check`, the scratch database used by `check_db.py`.

### Demo accounts
Every seed account uses the password `Mawjood-Demo-2026` (fictional demo data only). For example:

| Role | Email |
|---|---|
| Professor | `n.alharbi@university.example` |
| Student | `s.almutairi@university.example` |
| Admin | `admin@university.example` |

---

## 2. Backend API

Needs Python 3.12 and the database from Part 1. The API reads the same `.env` file as the scripts (`DB_*` settings). It also needs a `JWT_SECRET`: a long random string that signs sign-in tokens. Generate one and paste it into `.env`:
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"     # Windows: py -c "..."
```

From the repository folder:
```bash
cd backend
python3.12 -m venv .venv            # Windows: py -3.12 -m venv .venv
source .venv/bin/activate           # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
- `--host 0.0.0.0` is required: it lets your **phone** reach the API, not just your computer.
- Open <http://localhost:8000/docs> on the computer. The interactive API documentation lets you sign in and try every endpoint with the demo accounts.
- From the phone's browser, `http://<your computer's address>:8000/api/v1/health` should show `{"status":"ok"}` (Part 4 explains how to find the address). If it doesn't, check the firewall below.

Run the backend tests (they build and drop a separate `mawjood_test` database):
```bash
pytest
```

**Firewall:**
- **Windows:** the first run shows a Windows Defender Firewall prompt. Allow **Private networks**. If you missed it, allow Python in *Windows Security → Firewall → Allow an app through firewall*.
- **macOS:** allow incoming connections for Python when asked (*System Settings → Network → Firewall → Options* if you need to change it later).

## 3a. The app in the phone's browser (any iPhone or Android, no Expo Go)

The same app runs in Safari or Chrome, and can be saved to the home screen, where it opens full screen with the Mawjood icon. Nothing to install and no Expo account (owner decision 2026-11-10).

1. Connect the phone and the computer to the **same Wi-Fi network**.
2. Start the API (Section 2).
3. Build and serve the browser version (rebuild after every code change):
   ```bash
   cd app
   npm run phones
   ```
4. Find the computer's Wi-Fi address: on Windows run `ipconfig` and read *IPv4 Address* under the Wi-Fi adapter (not a VMware one); on macOS run `ipconfig getifaddr en0`.
5. On the phone, open `http://<that address>:8081`, for example `http://10.1.214.168:8081`.
6. Optional, to use it like an app: on iPhone tap **Share, Add to Home Screen**; on Android tap **⋮, Add to Home screen** (or **Install app**).

The API accepts the browser version from any private network address on port 8081 (10.x, 172.16-31.x, 192.168.x; `CORS_ORIGIN_REGEX`), so it keeps working when the computer's address changes. Not available in the browser: vibration (haptics). The refresh token is kept in an httpOnly cookie instead of the phone's secure storage (docs/security.md).

## 3b. A public link anyone can open (free, any network)

Anyone with the link can use Mawjood from any phone or computer, on any network, for free and without an account anywhere (owner decision 2026-11-10: "something that can work with anyone", free). The API serves the browser version itself, and a free Cloudflare quick tunnel gives this computer a public `https://` address. MySQL stays on this computer.

It works only while this computer is on and steps 2-4 keep running. The link changes every time the tunnel starts, so share the new one each time.

**One command** (after the one-time install in step 1, with MySQL running):
```bash
python scripts/public_link.py
```
It rebuilds the browser version only when the app changed (`--build` forces it), uses the API already running on port 8000 or starts it, opens the tunnel over HTTP/2 and prints the link. Ctrl+C stops what it started. `--local` skips the public link. On Windows use `py` instead of `python` if `python` is not found.

The same steps by hand:

1. Once: install the tunnel tool with `winget install --id Cloudflare.cloudflared` (Windows) or `brew install cloudflared` (macOS), then open a new terminal.
2. Build the browser version (again after every code change):
   ```bash
   cd app
   npm run export:web
   ```
3. Start the API (Section 2). It now also serves the app: `http://localhost:8000` opens Mawjood on this computer.
4. In another terminal, start the tunnel:
   ```bash
   cloudflared tunnel --protocol http2 --url http://localhost:8000
   ```
   `--protocol http2` uses ordinary HTTPS. Without it cloudflared first tries QUIC (UDP), which many networks block ("failed to dial to edge with quic"). If the terminal says `cloudflared` is not recognised, open a new terminal after installing, or run `& "C:\Program Files (x86)\cloudflared\cloudflared.exe"` instead.
5. Copy the `https://….trycloudflare.com` address it prints and share it. On a phone it can be saved to the home screen (Section 3a, step 6).

Demo accounts (Section 1) share a published password, the admin included, so they sign in only on this computer or its Wi-Fi, never through the public link (`DEMO_ACCOUNT_LOCAL_ONLY`). People on the link create their own account (sign-up, @upm.edu.sa). An admin activates professors from this computer at `http://localhost:8000`. Over the link the refresh cookie is `Secure` automatically, and rate limits count each visitor's own address (docs/security.md).

## 3. The app on your phone (Expo Go)

1. Install **Expo Go** from the Play Store or the App Store.
2. Connect the phone and the computer to the **same Wi-Fi network**.
3. Start the app's development server:
   ```bash
   cd app
   npm install
   npx expo start
   ```
4. Scan the QR code:
   - **Android:** with the Expo Go app;
   - **iPhone:** with the Camera app. If Expo Go says you are signed in to Expo Go but not to Expo CLI, sign out in Expo Go (account icon, Log out) or run `npx expo login` with the same account on the computer. Also allow **Local Network** for Expo Go in the iPhone's Settings.
5. The app opens in Expo Go on sign-in, in the phone's language (the button in the top corner switches it). Use a demo account (Section 1, *Demo accounts*); students land on Home. If sign-in says it can't reach the server, see Section 4.
6. Press `w` in the terminal to open the web build in a browser too.

What to try on the phone, step by step: [phone-checklist.md](phone-checklist.md).

The app needs Node.js 22 LTS (22.13 or later; 20.19.4+ and 24.3+ also work, as React Native 0.86 requires): [nodejs.org](https://nodejs.org) on Windows, `brew install node` on macOS.

If the phone can't connect, University and other public Wi-Fi often blocks device-to-device traffic. Try these in order:
- use your phone's hotspot and connect the computer to it;
- run `npx expo start --tunnel`. This serves the app over the internet, but the API still has to be reachable, so also set the address by hand (Section 4).

## 4. How the app finds the backend

The app works out the API address in this order:

1. **`EXPO_PUBLIC_API_URL`**, if set. Put it in `app/.env`, for example `EXPO_PUBLIC_API_URL=http://192.168.1.20:8000`. Use this with `--tunnel`, a hotspot or any unusual network.
2. **Otherwise, the address of the computer running Expo.** When Expo Go loads the app, Expo tells it the computer's LAN address (`Constants.expoConfig.hostUri`, for example `192.168.1.20:8081`). The app keeps the host part and uses port 8000: `http://192.168.1.20:8000/api/v1`. Because the backend runs on the same computer as Expo, this works with no configuration on a normal home Wi-Fi.
3. **On the web build in a browser** on the same computer: `http://localhost:8000/api/v1`.

To find your computer's address by hand:
- **Windows:** run `ipconfig` and read the **IPv4 Address** of your Wi-Fi adapter.
- **macOS:** run `ipconfig getifaddr en0`.
