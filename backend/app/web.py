"""Serves the exported browser version (app/dist, from npm run export:web) from the API itself.

One address for the page and the API means no CORS and a refresh cookie that stays
same-site, which is what makes the public link work (docs/run-on-phone.md, Section 3b).
Expo's static export writes one HTML file per route: /home -> home.html,
/professors/12 -> professors/[id].html; anything else gets +not-found.html with a 404.
"""

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, Response
from starlette.exceptions import HTTPException as StarletteHTTPException

# Hashed bundle files never change, so browsers may keep them; pages are always re-checked.
IMMUTABLE = {"Cache-Control": "public, max-age=31536000, immutable"}
REVALIDATE = {"Cache-Control": "no-cache"}


def find_page(root: Path, path: str) -> Path | None:
    """The export file for a URL path, matching [param] folders and files for dynamic routes."""
    segments = [s for s in path.split("/") if s]
    if not segments:
        return root / "index.html"
    if any(s in (".", "..") or "\\" in s for s in segments):
        return None
    exact = root.joinpath(*segments)
    if exact.is_file():
        return exact
    folder = root
    for i, segment in enumerate(segments):
        last = i == len(segments) - 1
        if last:
            for candidate in (folder / f"{segment}.html", folder / segment / "index.html"):
                if candidate.is_file():
                    return candidate
            dynamic = sorted(folder.glob("[[]*[]].html"))
            return dynamic[0] if dynamic else None
        if (folder / segment).is_dir():
            folder = folder / segment
            continue
        dynamic_dirs = sorted(p for p in folder.glob("[[]*[]]") if p.is_dir())
        if not dynamic_dirs:
            return None
        folder = dynamic_dirs[0]
    return None


def mount_web_build(app: FastAPI, root: Path) -> None:
    """Answer unmatched GET requests outside /api with the export's pages.

    It works as the fallback for "no route matched" (a 404) rather than as a catch-all route,
    so every API route, added before or after, keeps priority, and a wrong method on an API
    path stays a 405. Call after install_error_handlers, whose JSON 404 it wraps.
    """
    if not (root / "index.html").is_file():
        return  # no export yet: the API runs alone (Expo Go, the dev server, tests)
    root = root.resolve()
    not_found = root / "+not-found.html"
    json_error = app.exception_handlers[StarletteHTTPException]

    async def page_or_error(request: Request, exc: StarletteHTTPException) -> Response:
        path = request.url.path.lstrip("/")
        is_api = path == "api" or path.startswith("api/")
        if exc.status_code != 404 or request.method not in ("GET", "HEAD") or is_api:
            return await json_error(request, exc)
        page = find_page(root, path)
        if page is None or root not in page.resolve().parents:
            if not not_found.is_file():
                return await json_error(request, exc)
            return FileResponse(not_found, status_code=404, headers=REVALIDATE)
        headers = IMMUTABLE if path.startswith("_expo/static/") else REVALIDATE
        return FileResponse(page, headers=headers)

    app.add_exception_handler(StarletteHTTPException, page_or_error)
