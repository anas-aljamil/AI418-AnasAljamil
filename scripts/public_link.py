"""Start Mawjood for everyone with one command: browser build, API and a free public link.

Usage:
    python3 scripts/public_link.py            # rebuild the browser version only if the app changed
    python3 scripts/public_link.py --build    # always rebuild it first
    python3 scripts/public_link.py --local    # no public link: this computer and its Wi-Fi only

What it does (docs/run-on-phone.md, Section 3b):
1. rebuilds app/dist when any app source file is newer than the last build;
2. uses the API already running on port 8000, or starts it;
3. starts a Cloudflare quick tunnel (cloudflared, free, no account) over HTTP/2, because many
   networks block its default QUIC (UDP), and prints the https://....trycloudflare.com link.
Ctrl+C stops what this script started. MySQL must already be running.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP, BACKEND = ROOT / "app", ROOT / "backend"
DIST_INDEX = APP / "dist" / "index.html"
# Everything the browser build is made from; a newer file means the build is out of date.
APP_SOURCES = [APP / "src", APP / "public", APP / "assets", APP / "app.json", APP / "package.json"]
API = "http://localhost:8000"
WINDOWS_CLOUDFLARED = Path(r"C:\Program Files (x86)\cloudflared\cloudflared.exe")
TUNNEL_URL = re.compile(r"https://[a-z0-9-]+\.trycloudflare\.com")


def say(text: str) -> None:
    print(f"[mawjood] {text}", flush=True)


def newest_source_time() -> float:
    times = [0.0]
    for source in APP_SOURCES:
        if source.is_file():
            times.append(source.stat().st_mtime)
        elif source.is_dir():
            times += [p.stat().st_mtime for p in source.rglob("*") if p.is_file()]
    return max(times)


def build_if_needed(force: bool) -> None:
    if not force and DIST_INDEX.is_file() and DIST_INDEX.stat().st_mtime >= newest_source_time():
        say("Browser version is up to date (app/dist).")
        return
    npm = shutil.which("npm")
    if npm is None:
        sys.exit("npm was not found. Install Node.js 22 LTS (docs/run-on-phone.md, Section 3).")
    say("Building the browser version (npm run export:web); this can take several minutes...")
    subprocess.run([npm, "run", "export:web"], cwd=APP, check=True)


def api_health() -> str | None:
    """'ok', the API's error message, or None when nothing answers on port 8000."""
    try:
        with urllib.request.urlopen(f"{API}/api/v1/health", timeout=5) as response:
            return json.load(response).get("status", "ok")
    except urllib.error.HTTPError as error:
        try:
            return json.load(error)["error"]["message"]
        except (ValueError, KeyError):
            return f"HTTP {error.code}"
    except OSError:
        return None


def start_api() -> subprocess.Popen:
    scripts = BACKEND / ".venv" / ("Scripts" if os.name == "nt" else "bin")
    uvicorn = scripts / ("uvicorn.exe" if os.name == "nt" else "uvicorn")
    if not uvicorn.is_file():
        sys.exit("The backend is not installed. Run the Backend dev command in CLAUDE.md, Section 12.")
    say("Starting the API on port 8000...")
    api = subprocess.Popen([str(uvicorn), "app.main:app", "--host", "0.0.0.0", "--port", "8000"], cwd=BACKEND)
    for _ in range(60):
        if api.poll() is not None:
            sys.exit("The API stopped while starting; see its messages above.")
        if api_health() is not None:
            return api
        time.sleep(0.5)
    sys.exit("The API did not answer on port 8000 within 30 seconds.")


def find_cloudflared() -> str:
    found = shutil.which("cloudflared")
    if found:
        return found
    if WINDOWS_CLOUDFLARED.is_file():  # installed, but this terminal predates the PATH change
        return str(WINDOWS_CLOUDFLARED)
    sys.exit(
        "cloudflared was not found. Install it once: winget install --id Cloudflare.cloudflared "
        "(Windows) or brew install cloudflared (macOS), then open a new terminal."
    )


def run_tunnel() -> subprocess.Popen:
    say("Opening the public link (Cloudflare quick tunnel)...")
    tunnel = subprocess.Popen(
        [find_cloudflared(), "tunnel", "--no-autoupdate", "--protocol", "http2", "--url", API],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    assert tunnel.stdout is not None
    link = None
    for line in tunnel.stdout:
        if link is None and (match := TUNNEL_URL.search(line)):
            link = match.group(0)
        elif link and "Registered tunnel connection" in line:
            print(
                "\n"
                "  Mawjood is public. Share this link (it changes every time this starts):\n"
                f"    {link}\n"
                "  On this computer: http://localhost:8000\n"
                "  Demo students and professors sign in through the link; the admin needs\n"
                "  a private password there: py scripts/set_password.py <admin email>\n"
                "  Keep this window open; Ctrl+C ends the link.\n",
                flush=True,
            )
        elif " ERR " in line:
            print(line.rstrip(), flush=True)
    return tunnel


def main() -> None:
    parser = argparse.ArgumentParser(description="Start Mawjood with a free public link.")
    parser.add_argument("--build", action="store_true", help="rebuild the browser version first")
    parser.add_argument("--local", action="store_true", help="no public link")
    args = parser.parse_args()

    build_if_needed(args.build)
    started: list[subprocess.Popen] = []
    try:
        health = api_health()
        if health is None:
            started.append(start_api())
            health = api_health()
        else:
            say("Using the API already running on port 8000.")
        if health != "ok":
            sys.exit(f"The API is not ready: {health}\nIs MySQL running? Check: python3 scripts/check_db.py")
        if args.local:
            say(f"Mawjood runs at {API} (Wi-Fi: http://<this computer's address>:8000). Ctrl+C stops it.")
            if started:
                started[0].wait()
            return
        tunnel = run_tunnel()
        started.append(tunnel)
        tunnel.wait()
        say("The tunnel stopped; the public link no longer works.")
    except KeyboardInterrupt:
        say("Stopping.")
    finally:
        for process in reversed(started):
            if process.poll() is None:
                process.terminate()


if __name__ == "__main__":
    main()
