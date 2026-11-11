"""Give an account a new password, typed hidden, so it never appears on screen or in a file.

Usage:
    python3 scripts/set_password.py admin@university.example

Meant above all for the admin: every seed account shares the published demo password, and an
admin still on it cannot sign in through the public link (docs/security.md). After
scripts/reset_db.py the seed passwords are back, so run this again then.

Runs with the backend's own Python environment (backend/.venv) for its password hashing and
database settings; started with another Python, it restarts itself there.
"""

from __future__ import annotations

import getpass
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
VENV_PYTHON = BACKEND / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
MIN_LENGTH = 8  # the same rule as accounts created by the admin


def in_backend_env() -> bool:
    return Path(sys.executable).resolve() == VENV_PYTHON.resolve()


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__.split("\n\n")[1])
        return 2
    if not in_backend_env():
        if not VENV_PYTHON.is_file():
            sys.exit("The backend is not installed. Run the Backend dev command in CLAUDE.md, Section 12.")
        return subprocess.call([str(VENV_PYTHON), __file__, *sys.argv[1:]])

    sys.path.insert(0, str(BACKEND))
    from app.core.security import hash_password
    from app.db import get_engine
    from sqlalchemy import text

    email = sys.argv[1].strip().lower()
    with get_engine().connect() as connection:
        found = connection.execute(
            text("SELECT role FROM users WHERE email = :email"), {"email": email}
        ).first()
    if found is None:
        sys.exit(f"No account with the email {email}.")

    password = getpass.getpass(f"New password for {email} ({found.role}): ")
    if len(password) < MIN_LENGTH:
        sys.exit(f"Too short: use at least {MIN_LENGTH} characters. Nothing changed.")
    if getpass.getpass("Type it again: ") != password:
        sys.exit("The two did not match. Nothing changed.")

    with get_engine().begin() as connection:
        connection.execute(
            text("UPDATE users SET password_hash = :hash WHERE email = :email"),
            {"hash": hash_password(password), "email": email},
        )
    print(f"Done: {email} has its new password. Sign in with it, also through the public link.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
