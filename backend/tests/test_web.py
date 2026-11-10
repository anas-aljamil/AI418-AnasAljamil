"""The API serves the exported browser version, so the public link is one address."""

from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.errors import install_error_handlers
from app.web import find_page, mount_web_build

PAGES = ["index.html", "home.html", "+not-found.html", "professors/[id].html", "_expo/static/js/app-1a2b.js"]


@pytest.fixture
def site(tmp_path: Path) -> Path:
    for name in PAGES:
        (tmp_path / name).parent.mkdir(parents=True, exist_ok=True)
        (tmp_path / name).write_text(name, encoding="utf-8")
    return tmp_path


@pytest.fixture
def web(site: Path) -> TestClient:
    app = FastAPI()
    install_error_handlers(app)
    mount_web_build(app, site)
    return TestClient(app)


def test_routes_map_to_their_export_files(site):
    assert find_page(site, "") == site / "index.html"
    assert find_page(site, "home") == site / "home.html"
    assert find_page(site, "professors/12") == site / "professors/[id].html"
    assert find_page(site, "nothing/here") is None
    assert find_page(site, "../secret") is None


def test_pages_bundles_and_unknown_paths(web):
    assert web.get("/professors/3").text == "professors/[id].html"
    assert web.get("/home").headers["cache-control"] == "no-cache"
    assert "immutable" in web.get("/_expo/static/js/app-1a2b.js").headers["cache-control"]
    missing = web.get("/no-such-page")
    assert missing.status_code == 404 and missing.text == "+not-found.html"


def test_unknown_api_paths_keep_the_json_error_shape(web):
    for response in (web.get("/api/v1/nothing"), web.post("/api/v1/nothing")):
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "NOT_FOUND"


def test_api_routes_keep_priority_and_their_405(site):
    app = FastAPI()
    install_error_handlers(app)
    mount_web_build(app, site)
    app.add_api_route("/api/v1/thing", lambda: {"ok": True})
    app.add_api_route("/home", lambda: {"route": True})  # added after the pages
    web = TestClient(app)
    assert web.get("/home").json() == {"route": True}
    wrong = web.delete("/api/v1/thing")
    assert wrong.status_code == 405 and wrong.json()["error"]["code"] == "METHOD_NOT_ALLOWED"


def test_without_an_export_the_api_runs_alone(tmp_path):
    app = FastAPI()
    install_error_handlers(app)
    mount_web_build(app, tmp_path)
    missing = TestClient(app).get("/home")
    assert missing.status_code == 404 and missing.json()["error"]["code"] == "NOT_FOUND"
