from datetime import datetime, timedelta, timezone

import app.main as main_module
from app.models import SocialConnection, User
from app.schemas import SocialDraftContent
from app.social import SocialProviderError, encrypt_token, publish_social_content
from conftest import TestingSessionLocal


def create_org(client, headers, name="Publishing Diner"):
    response = client.post("/organizations", json={"name": name}, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def add_connection(
    *,
    organization_id: int,
    user_email: str,
    provider: str,
    account_id: str,
    account_name: str,
) -> None:
    with TestingSessionLocal() as db:
        user = db.query(User).filter_by(email=user_email).one()
        db.add(
            SocialConnection(
                organization_id=organization_id,
                provider=provider,
                status="connected",
                provider_account_id=account_id,
                provider_account_name=account_name,
                access_token_encrypted=encrypt_token(f"{provider}-access-token"),
                scopes=[],
                provider_data={
                    "auth_type": "facebook_login"
                    if provider in {"facebook", "instagram"}
                    else "oauth",
                    "facebook_page_name": account_name
                    if provider == "instagram"
                    else None,
                },
                connected_by=user.id,
            )
        )
        db.commit()


def test_provider_publish_requests_use_the_correct_graph_endpoints(monkeypatch):
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
            if url.endswith("/media_publish"):
                return main_module.httpx.Response(200, json={"id": "instagram-post"})
            if url.endswith("/media"):
                return main_module.httpx.Response(200, json={"id": "media-container"})
            if url.endswith("/photos"):
                return main_module.httpx.Response(200, json={"post_id": "facebook-photo"})
            return main_module.httpx.Response(200, json={"id": "facebook-post"})

    monkeypatch.setattr("app.social.httpx.Client", FakeClient)

    assert publish_social_content(
        "facebook",
        account_id="page-123",
        access_token="page-token",
        content="Facebook text post",
    ) == "facebook-post"
    assert publish_social_content(
        "facebook",
        account_id="page-123",
        access_token="page-token",
        content="Facebook photo post",
        media_urls=["https://images.example.com/facebook.jpg"],
    ) == "facebook-photo"
    assert publish_social_content(
        "instagram",
        account_id="ig-direct-123",
        access_token="instagram-token",
        content="Direct Instagram post",
        media_urls=["https://images.example.com/direct-instagram.jpg"],
        provider_data={"auth_type": "instagram_login"},
    ) == "instagram-post"
    assert publish_social_content(
        "instagram",
        account_id="ig-linked-456",
        access_token="page-token",
        content="Linked Instagram post",
        media_urls=["https://images.example.com/linked-instagram.jpg"],
        provider_data={"auth_type": "facebook_login"},
    ) == "instagram-post"

    request_urls = [call[1] for call in calls if call[0] == "post"]
    assert request_urls == [
        "https://graph.facebook.com/page-123/feed",
        "https://graph.facebook.com/page-123/photos",
        "https://graph.instagram.com/ig-direct-123/media",
        "https://graph.instagram.com/ig-direct-123/media_publish",
        "https://graph.facebook.com/ig-linked-456/media",
        "https://graph.facebook.com/ig-linked-456/media_publish",
    ]


def test_social_posts_require_admin_and_connected_destinations(
    client,
    auth_headers,
):
    owner_headers = auth_headers("post-owner@example.com")
    org = create_org(client, owner_headers)

    missing_connection = client.post(
        f"/organizations/{org['id']}/social-posts",
        json={
            "master_caption": "A new special",
            "targets": [{"provider": "facebook", "content": "A new special"}],
            "media_urls": [],
        },
        headers=owner_headers,
    )
    assert missing_connection.status_code == 409

    unsupported_provider = client.post(
        f"/organizations/{org['id']}/social-posts",
        json={
            "master_caption": "A new special",
            "targets": [{"provider": "tiktok", "content": "A new special"}],
            "media_urls": ["https://images.example.com/special.jpg"],
        },
        headers=owner_headers,
    )
    assert unsupported_provider.status_code == 422

    add_connection(
        organization_id=org["id"],
        user_email="post-owner@example.com",
        provider="instagram",
        account_id="ig-1",
        account_name="publishing_diner",
    )
    missing_instagram_media = client.post(
        f"/organizations/{org['id']}/social-posts",
        json={
            "master_caption": "A new special",
            "targets": [{"provider": "instagram", "content": "A new special"}],
            "media_urls": [],
        },
        headers=owner_headers,
    )
    assert missing_instagram_media.status_code == 422

    viewer_headers = auth_headers("post-viewer@example.com")
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
        f"/organizations/{org['id']}/social-posts",
        headers=viewer_headers,
    )
    assert denied.status_code == 403


def test_social_draft_generation_is_authenticated_and_structured(
    client,
    auth_headers,
    monkeypatch,
):
    headers = auth_headers("draft-owner@example.com")
    org = create_org(client, headers)
    monkeypatch.setattr(main_module.settings, "openai_api_key", "test-key")
    calls = []

    def fake_generate(*, api_key, content):
        calls.append((api_key, content))
        return SocialDraftContent(
            facebook="Facebook version",
            instagram="Instagram version #local",
            tiktok="TikTok version",
        )

    monkeypatch.setattr(main_module, "generate_social_drafts", fake_generate)
    response = client.post(
        f"/organizations/{org['id']}/social-posts/drafts/generate",
        json={"master_caption": "We have a new patio."},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    assert response.json()["instagram"] == "Instagram version #local"
    assert calls == [("test-key", "We have a new patio.")]

    unauthenticated = client.post(
        f"/organizations/{org['id']}/social-posts/drafts/generate",
        json={"master_caption": "We have a new patio."},
    )
    assert unauthenticated.status_code == 401


def test_social_posts_schedule_and_publish_to_each_selected_destination(
    client,
    auth_headers,
    monkeypatch,
):
    email = "publisher@example.com"
    headers = auth_headers(email)
    org = create_org(client, headers)
    add_connection(
        organization_id=org["id"],
        user_email=email,
        provider="facebook",
        account_id="page-1",
        account_name="Publishing Diner",
    )
    add_connection(
        organization_id=org["id"],
        user_email=email,
        provider="instagram",
        account_id="ig-1",
        account_name="publishing_diner",
    )

    future = datetime.now(timezone.utc) + timedelta(hours=2)
    scheduled = client.post(
        f"/organizations/{org['id']}/social-posts",
        json={
            "master_caption": "Tomorrow's special",
            "targets": [
                {"provider": "facebook", "content": "Facebook special"},
            ],
            "media_urls": [],
            "scheduled_at": future.isoformat(),
        },
        headers=headers,
    )
    assert scheduled.status_code == 201, scheduled.text
    assert scheduled.json()["status"] == "scheduled"

    publish_calls = []

    def fake_publish(provider, **kwargs):
        publish_calls.append((provider, kwargs))
        return f"{provider}-post-123"

    monkeypatch.setattr(main_module, "publish_social_content", fake_publish)
    created = client.post(
        f"/organizations/{org['id']}/social-posts",
        json={
            "master_caption": "Our new summer menu",
            "targets": [
                {"provider": "facebook", "content": "Facebook menu post"},
                {"provider": "instagram", "content": "Instagram menu post"},
            ],
            "media_urls": ["https://images.example.com/menu.jpg"],
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text

    published = client.post(
        f"/organizations/{org['id']}/social-posts/{created.json()['id']}/publish",
        headers=headers,
    )
    assert published.status_code == 200, published.text
    assert published.json()["status"] == "published"
    assert {target["status"] for target in published.json()["targets"]} == {
        "published"
    }
    assert [call[0] for call in publish_calls] == ["facebook", "instagram"]
    assert publish_calls[0][1]["content"] == "Facebook menu post"
    assert publish_calls[1][1]["media_urls"] == [
        "https://images.example.com/menu.jpg"
    ]

    listing = client.get(
        f"/organizations/{org['id']}/social-posts",
        headers=headers,
    )
    assert listing.status_code == 200, listing.text
    assert [post["status"] for post in listing.json()] == [
        "published",
        "scheduled",
    ]


def test_social_post_reports_partial_provider_failure(
    client,
    auth_headers,
    monkeypatch,
):
    email = "partial-publisher@example.com"
    headers = auth_headers(email)
    org = create_org(client, headers)
    for provider, account_id, account_name in (
        ("facebook", "page-1", "Publishing Diner"),
        ("instagram", "ig-1", "publishing_diner"),
    ):
        add_connection(
            organization_id=org["id"],
            user_email=email,
            provider=provider,
            account_id=account_id,
            account_name=account_name,
        )

    def partially_failing_publish(provider, **kwargs):
        if provider == "instagram":
            raise SocialProviderError("Instagram rejected the media")
        return "facebook-post-123"

    monkeypatch.setattr(
        main_module,
        "publish_social_content",
        partially_failing_publish,
    )
    created = client.post(
        f"/organizations/{org['id']}/social-posts",
        json={
            "master_caption": "A shared update",
            "targets": [
                {"provider": "facebook", "content": "Facebook update"},
                {"provider": "instagram", "content": "Instagram update"},
            ],
            "media_urls": ["https://images.example.com/update.jpg"],
        },
        headers=headers,
    )
    published = client.post(
        f"/organizations/{org['id']}/social-posts/{created.json()['id']}/publish",
        headers=headers,
    )
    assert published.status_code == 200, published.text
    assert published.json()["status"] == "partial_failure"
    statuses = {
        target["provider"]: target["status"]
        for target in published.json()["targets"]
    }
    assert statuses == {"facebook": "published", "instagram": "failed"}
    instagram = next(
        target
        for target in published.json()["targets"]
        if target["provider"] == "instagram"
    )
    assert instagram["error"] == "Instagram rejected the media"
