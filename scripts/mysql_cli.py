"""Run SQL through the `mysql` command-line client (standard library only).

Connection settings come from the repository's .env file, overridden by
environment variables of the same name:
    DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
    MYSQL_CLI   path to the mysql client (default: "mysql" on PATH)

The password is passed through a temporary option file readable only by the
current user, never on the command line.
"""

from __future__ import annotations

import atexit
import os
import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IDENTIFIER = re.compile(r"^[A-Za-z0-9_]{1,64}$")


class MySQLError(Exception):
    """A statement failed; .code holds the MySQL error number (e.g. 3819)."""

    def __init__(self, message: str):
        super().__init__(message)
        match = re.search(r"ERROR (\d+)", message)
        self.code = int(match.group(1)) if match else None


@dataclass(frozen=True)
class Config:
    host: str
    port: str
    user: str
    password: str
    database: str
    cli: str


def load_config() -> Config:
    values: dict[str, str] = {}
    env_file = ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                values[key.strip()] = value.strip().strip('"').strip("'")
    values.update({k: v for k, v in os.environ.items() if k.startswith(("DB_", "MYSQL_CLI"))})
    config = Config(
        host=values.get("DB_HOST", "127.0.0.1"),
        port=values.get("DB_PORT", "3306"),
        user=values.get("DB_USER", "root"),
        password=values.get("DB_PASSWORD", ""),
        database=values.get("DB_NAME", "mawjood"),
        cli=find_cli(values.get("MYSQL_CLI", "")),
    )
    check_identifier(config.database)
    return config


def find_cli(configured: str) -> str:
    """MYSQL_CLI if set, else mysql on PATH, else the default Windows install folder."""
    if configured:
        return configured
    if shutil.which("mysql"):
        return "mysql"
    for base in (os.environ.get("ProgramFiles"), os.environ.get("ProgramW6432")):
        if base:
            # MySQL Installer's default location, e.g. C:\Program Files\MySQL\MySQL Server 8.0
            found = sorted(Path(base, "MySQL").glob("MySQL Server 8.0*/bin/mysql.exe"))
            if found:
                return str(found[-1])
    return "mysql"


def check_identifier(name: str) -> str:
    """Database names are interpolated into DDL, so allow only safe characters."""
    if not IDENTIFIER.match(name):
        raise ValueError(f"unsafe database name: {name!r}")
    return name


_option_file: str | None = None


def _options_path(config: Config) -> str:
    global _option_file
    if _option_file is None:
        fd, path = tempfile.mkstemp(prefix="mawjood-", suffix=".cnf")
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write("[client]\n")
            handle.write(f"host={config.host}\nport={config.port}\nuser={config.user}\n")
            handle.write(f'password="{config.password}"\n')
        os.chmod(path, 0o600)
        atexit.register(os.remove, path)
        _option_file = path
    return _option_file


def run(sql: str, config: Config, database: str | None = None,
        show_warnings: bool = False) -> list[list[str]]:
    """Execute SQL (any number of statements, DELIMITER allowed).

    Returns the rows printed by the last result set(s) as lists of strings
    (NULL comes back as "NULL"). Raises MySQLError if any statement fails.
    """
    command = [
        config.cli,
        f"--defaults-extra-file={_options_path(config)}",
        "--batch", "--skip-column-names", "--raw",
        "--default-character-set=utf8mb4",
        "--init-command=SET time_zone = '+00:00'",
    ]
    if show_warnings:
        command.append("--show-warnings")
    if database:
        command.append(check_identifier(database))
    try:
        result = subprocess.run(command, input=sql, capture_output=True, text=True, encoding="utf-8")
    except FileNotFoundError:
        raise MySQLError(
            f"the MySQL client '{config.cli}' was not found. Install MySQL 8.0, then add its bin "
            "folder to PATH or set MYSQL_CLI in .env (see docs/run-on-phone.md, Section 1)."
        ) from None
    if result.returncode != 0:
        raise MySQLError(result.stderr.strip() or f"mysql exited with {result.returncode}")
    return [line.split("\t") for line in result.stdout.splitlines()]


def scalar(sql: str, config: Config, database: str | None = None) -> str:
    rows = run(sql, config, database)
    return rows[-1][0] if rows else ""
