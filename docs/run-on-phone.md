# Running Mawjood on your computer and phone

This guide takes you from a fresh computer to the app running on your phone. It has four parts:

1. **MySQL 8.0** on your computer, holding the Mawjood database.
2. **The backend API** (Python), which reads MySQL. *Available from P2.*
3. **The app** (Expo), served from your computer to **Expo Go** on your phone over the same Wi-Fi. *Available from P3b.*
4. **How the app finds the backend.**

Parts 1 and 4 apply today. Parts 2 and 3 describe the planned commands; they are filled in and tested when those phases are delivered.

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
5. Refresh the *Schemas* panel: `mawjood` shows 12 tables. Check with `SELECT COUNT(*) FROM mawjood.users;`, which returns 16.

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

## 2. Backend API (available from P2)

From the repository folder:
```bash
cd backend
python3 -m venv .venv
# Windows: .venv\Scripts\activate      macOS: source .venv/bin/activate
pip install -e .
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
- `--host 0.0.0.0` is required: it lets your **phone** reach the API, not just your computer.
- Open <http://localhost:8000/docs> on the computer to confirm the API is running.

**Firewall:**
- **Windows:** the first run shows a Windows Defender Firewall prompt. Allow **Private networks**. If you missed it, allow Python in *Windows Security → Firewall → Allow an app through firewall*.
- **macOS:** allow incoming connections for Python when asked (*System Settings → Network → Firewall → Options* if you need to change it later).

## 3. The app on your phone (available from P3b)

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
   - **iPhone:** with the Camera app.
5. The app opens in Expo Go. Press `w` in the terminal to open the web build in a browser too.

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
