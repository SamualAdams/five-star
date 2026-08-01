from urllib.parse import parse_qs, urlparse

import httpx

import app.main as main_module
import app.social as social_module
from app.config import Settings
from app.models import SocialConnection
from app.social import (
    PROVIDER_DETAILS,
    build_authorization_url,
    exchange_social_code,
    fetch_social_identity,
    provider_configured,
)
from conftest import TestingSessionLocal


def create_org(client, headers, name="Connected Diner"):
    response = client.post("/organizations", json={"name": name}, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def test_facebook_uses_page_login_and_exchanges_for_a_long_lived_token(monkeypatch):
    calls = []

    class FakeClient:
        def __init__(self, **kwargs):
            calls.append(("client", kwargs))

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, traceback):
            return False

        def get(self, url, **kwargs):
            calls.append(("get", url, kwargs))
            if kwargs["params"].get("grant_type") == "fb_exchange_token":
                return httpx.Response(
                    200,
                    json={"access_token": "long-facebook-token", "expires_in": 5_184_000},
                )
            return httpx.Response(
                200,
                json={"access_token": "short-facebook-token", "token_type": "bearer"},
            )

    monkeypatch.setattr(social_module.httpx, "Client", FakeClient)
    settings = Settings(
        api_base_url="https://fivestar.fyi",
        meta_client_id="facebook-client",
        meta_client_secret="facebook-secret",
    )

    authorization_url = build_authorization_url("facebook", "oauth-state", settings)
    parsed = urlparse(authorization_url)
    query = parse_qs(parsed.query)
    assert parsed.netloc == "www.facebook.com"
    assert parsed.path == "/dialog/oauth"
    assert query["client_id"] == ["facebook-client"]
    assert query["redirect_uri"] == [
        "https://fivestar.fyi/oauth/social/facebook/callback"
    ]
    assert query["auth_type"] == ["rerequest"]
    assert query["return_scopes"] == ["true"]
    assert query["scope"] == [",".join(PROVIDER_DETAILS["facebook"]["scopes"])]

    token_data = exchange_social_code("facebook", "authorization-code", settings)
    assert token_data["access_token"] == "long-facebook-token"
    assert token_data["expires_in"] == 5_184_000
    exchange_request = calls[-1]
    assert exchange_request[:2] == (
        "get",
        "https://graph.facebook.com/oauth/access_token",
    )
    assert exchange_request[2]["params"] == {
        "grant_type": "fb_exchange_token",
        "client_id": "facebook-client",
        "client_secret": "facebook-secret",
        "fb_exchange_token": "short-facebook-token",
    }


def test_instagram_uses_direct_business_login_configuration():
    settings = Settings(
        api_base_url="https://api.fivestar.fyi",
        meta_client_id="facebook-client",
        meta_client_secret="facebook-secret",
        instagram_client_id="instagram-client",
        instagram_client_secret="instagram-secret",
    )

    assert provider_configured("facebook", settings) is True
    assert provider_configured("instagram", settings) is True
    assert PROVIDER_DETAILS["instagram"]["scopes"] == [
        "instagram_business_basic",
        "instagram_business_content_publish",
    ]

    authorization_url = build_authorization_url("instagram", "oauth-state", settings)
    parsed = urlparse(authorization_url)
    query = parse_qs(parsed.query)

    assert parsed.netloc == "www.instagram.com"
    assert parsed.path == "/oauth/authorize"
    assert query["client_id"] == ["instagram-client"]
    assert query["redirect_uri"] == [
        "https://api.fivestar.fyi/oauth/social/instagram/callback"
    ]
    assert query["scope"] == [
        "instagram_business_basic,instagram_business_content_publish"
    ]
    assert query["force_reauth"] == ["true"]
    assert query["state"] == ["oauth-state"]


def test_instagram_exchanges_for_long_lived_token_and_loads_identity(monkeypatch):
    calls = []

    class FakeClient:
        def __init__(self, **kwargs):
            calls.append(("client", kwargs))

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, traceback):
            return False

        def post(self, url, **kwargs):
            calls.append(("post", url, kwargs))
            return httpx.Response(
                200,
                json={"access_token": "short-token", "user_id": "ig-123"},
            )

        def get(self, url, **kwargs):
            calls.append(("get", url, kwargs))
            if url.endswith("/access_token"):
                return httpx.Response(
                    200,
                    json={"access_token": "long-token", "expires_in": 5_184_000},
                )
            return httpx.Response(
                200,
                json={
                    "user_id": "ig-123",
                    "username": "fivestar",
                    "account_type": "BUSINESS",
                },
            )

    monkeypatch.setattr(social_module.httpx, "Client", FakeClient)
    settings = Settings(
        api_base_url="https://fivestar.fyi",
        instagram_client_id="instagram-client",
        instagram_client_secret="instagram-secret",
    )

    token_data = exchange_social_code(
        "instagram",
        "authorization-code",
        settings,
    )
    identity = fetch_social_identity("instagram", token_data)

    assert token_data["access_token"] == "long-token"
    assert token_data["expires_in"] == 5_184_000
    assert identity == {
        "id": "ig-123",
        "name": "fivestar",
        "data": {
            "username": "fivestar",
            "account_type": "BUSINESS",
            "profile_picture_url": None,
        },
    }
    token_request = next(call for call in calls if call[:2] == ("post", "https://api.instagram.com/oauth/access_token"))
    assert token_request[2]["data"]["client_id"] == "instagram-client"
    assert token_request[2]["data"]["redirect_uri"] == (
        "https://fivestar.fyi/oauth/social/instagram/callback"
    )
    long_lived_request = next(
        call
        for call in calls
        if call[:2] == ("get", "https://graph.instagram.com/access_token")
    )
    assert long_lived_request[2]["params"] == {
        "grant_type": "ig_exchange_token",
        "client_secret": "instagram-secret",
        "access_token": "short-token",
    }


def test_instagram_oauth_callback_persists_and_disconnects_direct_connection(
    client,
    auth_headers,
    monkeypatch,
):
    headers = auth_headers("instagram-owner@example.com")
    org = create_org(client, headers, name="Instagram Diner")
    monkeypatch.setattr(main_module.settings, "instagram_client_id", "instagram-client")
    monkeypatch.setattr(main_module.settings, "instagram_client_secret", "instagram-secret")
    monkeypatch.setattr(main_module.settings, "api_base_url", "http://testserver")
    monkeypatch.setattr(
        main_module,
        "exchange_social_code",
        lambda provider, code, settings: {
            "access_token": "long-instagram-token",
            "expires_in": 5_184_000,
        },
    )
    monkeypatch.setattr(
        main_module,
        "fetch_social_identity",
        lambda provider, token_data: {
            "id": "ig-direct-123",
            "name": "instagram_diner",
            "data": {
                "username": "instagram_diner",
                "account_type": "BUSINESS",
                "profile_picture_url": None,
            },
        },
    )

    authorization = client.post(
        f"/organizations/{org['id']}/social-connections/instagram/authorize",
        headers=headers,
    )
    assert authorization.status_code == 200, authorization.text
    authorization_url = authorization.json()["authorization_url"]
    parsed = urlparse(authorization_url)
    assert parsed.netloc == "www.instagram.com"
    state_value = parse_qs(parsed.query)["state"][0]

    callback = client.get(
        "/oauth/social/instagram/callback",
        params={
            "state": state_value,
            "code": "provider-code",
            "granted_scopes": (
                "instagram_business_basic,instagram_business_content_publish"
            ),
        },
        follow_redirects=False,
    )
    assert callback.status_code == 303, callback.text
    assert "social=connected" in callback.headers["location"]

    listing = client.get(
        f"/organizations/{org['id']}/social-connections",
        headers=headers,
    )
    instagram = listing.json()[1]
    assert instagram["connected"] is True
    assert instagram["status"] == "connected"
    assert instagram["provider_account_id"] == "ig-direct-123"
    assert instagram["provider_account_name"] == "instagram_diner"
    assert instagram["connection_method"] == "instagram_login"
    assert instagram["scopes"] == [
        "instagram_business_basic",
        "instagram_business_content_publish",
    ]
    assert instagram["expires_at"] is not None

    with TestingSessionLocal() as db:
        saved_instagram = db.query(SocialConnection).filter_by(
            organization_id=org["id"],
            provider="instagram",
        ).one()
        assert saved_instagram.access_token_encrypted != "long-instagram-token"
        assert "long-instagram-token" not in saved_instagram.access_token_encrypted

    revoked = []
    monkeypatch.setattr(
        main_module,
        "revoke_social_token",
        lambda provider, encrypted_token, settings: revoked.append(provider),
    )
    disconnected = client.delete(
        f"/organizations/{org['id']}/social-connections/instagram",
        headers=headers,
    )
    assert disconnected.status_code == 204
    assert revoked == ["instagram"]

    listing = client.get(
        f"/organizations/{org['id']}/social-connections",
        headers=headers,
    )
    assert listing.json()[1]["connected"] is False


def test_social_connections_are_admin_only_and_report_setup_state(
    client,
    auth_headers,
    monkeypatch,
):
    owner_headers = auth_headers("social-owner@example.com")
    org = create_org(client, owner_headers)
    monkeypatch.setattr(main_module.settings, "meta_client_id", "")
    monkeypatch.setattr(main_module.settings, "meta_client_secret", "")

    listing = client.get(
        f"/organizations/{org['id']}/social-connections",
        headers=owner_headers,
    )
    assert listing.status_code == 200, listing.text
    assert [item["provider"] for item in listing.json()] == [
        "facebook",
        "instagram",
        "tiktok",
    ]
    assert all(item["connected"] is False for item in listing.json())
    assert listing.json()[0]["configured"] is False
    assert [item["publishing_enabled"] for item in listing.json()] == [
        True,
        True,
        False,
    ]

    unconfigured = client.post(
        f"/organizations/{org['id']}/social-connections/facebook/authorize",
        headers=owner_headers,
    )
    assert unconfigured.status_code == 503

    viewer_headers = auth_headers("social-viewer@example.com")
    invite = client.post(
        f"/organizations/{org['id']}/invites",
        json={"role": "organization_viewer"},
        headers=owner_headers,
    ).json()
    accepted = client.post(
        "/invites/accept",
        json={"token": invite["token"]},
        headers=viewer_headers,
    )
    assert accepted.status_code == 200
    denied = client.get(
        f"/organizations/{org['id']}/social-connections",
        headers=viewer_headers,
    )
    assert denied.status_code == 403


def test_social_oauth_callback_persists_encrypted_connection_and_disconnects(
    client,
    auth_headers,
    monkeypatch,
):
    headers = auth_headers("oauth-owner@example.com")
    org = create_org(client, headers)
    monkeypatch.setattr(main_module.settings, "meta_client_id", "meta-client")
    monkeypatch.setattr(main_module.settings, "meta_client_secret", "meta-secret")
    monkeypatch.setattr(main_module.settings, "api_base_url", "http://testserver")
    monkeypatch.setattr(
        main_module,
        "exchange_social_code",
        lambda provider, code, settings: {
            "access_token": "plain-access-token",
            "expires_in": 3600,
            "scope": "pages_show_list,pages_manage_posts",
        },
    )
    available_pages = [
        {
            "id": "page-123",
            "name": "Connected Diner",
            "access_token": "page-access-token",
            "tasks": ["CREATE_CONTENT", "MANAGE"],
            "instagram": {
                "id": "ig-456",
                "username": "connected_diner",
                "name": "Connected Diner",
                "profile_picture_url": None,
            },
        }
    ]
    monkeypatch.setattr(
        main_module,
        "fetch_facebook_pages",
        lambda access_token: available_pages,
    )

    authorization = client.post(
        f"/organizations/{org['id']}/social-connections/facebook/authorize",
        headers=headers,
    )
    assert authorization.status_code == 200, authorization.text
    authorization_url = authorization.json()["authorization_url"]
    parsed = urlparse(authorization_url)
    assert parsed.netloc == "www.facebook.com"
    state_value = parse_qs(parsed.query)["state"][0]

    callback = client.get(
        "/oauth/social/facebook/callback",
        params={"state": state_value, "code": "provider-code"},
        follow_redirects=False,
    )
    assert callback.status_code == 303, callback.text
    assert f"/org/{org['id']}/social" in callback.headers["location"]
    assert "social=selection_required" in callback.headers["location"]
    setup_token = parse_qs(urlparse(callback.headers["location"]).query)["setup"][0]

    options = client.get(
        f"/organizations/{org['id']}/social-connections/facebook/options",
        params={"setup": setup_token},
        headers=headers,
    )
    assert options.status_code == 200, options.text
    assert options.json() == {
        "pages": [
            {
                "id": "page-123",
                "name": "Connected Diner",
                "tasks": ["CREATE_CONTENT", "MANAGE"],
                "instagram": {
                    "id": "ig-456",
                    "username": "connected_diner",
                    "name": "Connected Diner",
                    "profile_picture_url": None,
                },
            }
        ]
    }

    completed = client.post(
        f"/organizations/{org['id']}/social-connections/facebook/complete",
        json={"setup_token": setup_token, "page_id": "page-123"},
        headers=headers,
    )
    assert completed.status_code == 200, completed.text

    listing = client.get(
        f"/organizations/{org['id']}/social-connections",
        headers=headers,
    )
    facebook = listing.json()[0]
    instagram = listing.json()[1]
    assert facebook["connected"] is True
    assert facebook["status"] == "connected"
    assert facebook["provider_account_name"] == "Connected Diner"
    assert facebook["provider_account_id"] == "page-123"
    assert facebook["connection_method"] == "facebook_login"
    assert facebook["scopes"] == ["pages_show_list", "pages_manage_posts"]
    assert instagram["connected"] is True
    assert instagram["provider_account_name"] == "connected_diner"
    assert instagram["provider_account_id"] == "ig-456"
    assert instagram["linked_page_name"] == "Connected Diner"

    with TestingSessionLocal() as db:
        saved_facebook = db.query(SocialConnection).filter_by(
            organization_id=org["id"],
            provider="facebook",
        ).one()
        saved_instagram = db.query(SocialConnection).filter_by(
            organization_id=org["id"],
            provider="instagram",
        ).one()
        assert saved_facebook.access_token_encrypted != "page-access-token"
        assert "page-access-token" not in saved_facebook.access_token_encrypted
        assert saved_facebook.refresh_token_encrypted != "plain-access-token"
        assert "plain-access-token" not in saved_facebook.refresh_token_encrypted
        assert saved_instagram.access_token_encrypted != "page-access-token"

    setup_replay = client.post(
        f"/organizations/{org['id']}/social-connections/facebook/complete",
        json={"setup_token": setup_token, "page_id": "page-123"},
        headers=headers,
    )
    assert setup_replay.status_code == 400

    replay = client.get(
        "/oauth/social/facebook/callback",
        params={"state": state_value, "code": "provider-code"},
        follow_redirects=False,
    )
    assert replay.status_code == 400

    revoked = []
    monkeypatch.setattr(
        main_module,
        "revoke_social_token",
        lambda provider, encrypted_token, settings: revoked.append(provider),
    )
    disconnected = client.delete(
        f"/organizations/{org['id']}/social-connections/facebook",
        headers=headers,
    )
    assert disconnected.status_code == 204
    assert revoked == ["facebook"]
    listing = client.get(
        f"/organizations/{org['id']}/social-connections",
        headers=headers,
    )
    assert listing.json()[0]["connected"] is False
    assert listing.json()[1]["connected"] is False
