"""Regression tests for how the SPA shell and its build assets are served.

A stale `index.html` names build assets that no longer exist. If those requests
fall back to the SPA shell, the browser parses HTML as JavaScript and the whole
app renders blank, so missing files must 404 and index.html must be revalidated.
"""

import pytest

from app.main import FRONTEND_DIST_DIR


requires_build = pytest.mark.skipif(
    not (FRONTEND_DIST_DIR / "index.html").exists(),
    reason="frontend has not been built",
)


@requires_build
def test_missing_build_asset_returns_404_instead_of_the_spa_shell(client):
    response = client.get("/assets/index-staleHash1.js")

    assert response.status_code == 404
    assert "<!doctype html" not in response.text.lower()


@requires_build
def test_missing_file_with_an_extension_never_falls_back_to_html(client):
    for path in ("/favicon-does-not-exist.ico", "/brand/missing-image.png"):
        response = client.get(path)
        assert response.status_code == 404, path


@requires_build
def test_index_html_is_revalidated_so_asset_hashes_cannot_go_stale(client):
    response = client.get("/dashboard")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert response.headers["cache-control"] == "no-cache"


@requires_build
def test_spa_routes_without_an_extension_still_serve_the_shell(client):
    for path in ("/dashboard", "/org/2/feed", "/auth"):
        response = client.get(path)
        assert response.status_code == 200, path
        assert response.headers["content-type"].startswith("text/html"), path


@requires_build
def test_hashed_build_assets_are_cached_immutably(client):
    asset = next((FRONTEND_DIST_DIR / "assets").glob("*.js"), None)
    assert asset is not None, "expected at least one built JS asset"

    response = client.get(f"/assets/{asset.name}")

    assert response.status_code == 200
    assert response.headers["cache-control"] == "public, max-age=31536000, immutable"
