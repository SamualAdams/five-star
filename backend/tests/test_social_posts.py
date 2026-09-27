
import app.main as main_module
from app.models import Organization
from app.schemas import WordsmithOption, WordsmithResponse
from conftest import TestingSessionLocal


def create_org(client, headers, name="Publishing Diner"):
    response = client.post("/organizations", json={"name": name}, headers=headers)
    assert response.status_code == 201, response.text
    organization = response.json()
    with TestingSessionLocal() as db:
        db.get(Organization, organization["id"]).feed_enabled = True
        db.commit()
    return organization


def test_feed_posts_require_an_organization_admin(client, auth_headers):
    owner_headers = auth_headers("post-owner@example.com")
    org = create_org(client, owner_headers)

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


def test_wordsmithing_targets_selected_text_or_the_whole_caption(
    client,
    auth_headers,
    monkeypatch,
):
    headers = auth_headers("wordsmith-owner@example.com")
    org = create_org(client, headers, "Wordsmith Diner")
    monkeypatch.setattr(main_module.settings, "openai_api_key", "test-key")
    calls = []

    def fake_wordsmith(*, api_key, content, style, scope):
        calls.append((api_key, content, style, scope))
        return WordsmithResponse(
            options=[
                WordsmithOption(label="Option one", text="First rewrite"),
                WordsmithOption(label="Option two", text="Second rewrite"),
                WordsmithOption(label="Option three", text="Third rewrite"),
            ]
        )

    monkeypatch.setattr(main_module, "generate_wordsmith_options", fake_wordsmith)
    response = client.post(
        f"/organizations/{org['id']}/social-posts/wordsmith",
        json={"text": "new patio", "style": "polish", "scope": "selection"},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    assert [option["text"] for option in response.json()["options"]] == [
        "First rewrite",
        "Second rewrite",
        "Third rewrite",
    ]
    assert calls == [("test-key", "new patio", "polish", "selection")]


def test_uploaded_image_is_served_and_appears_on_the_public_feed(client, auth_headers):
    headers = auth_headers("image-publisher@example.com")
    org = create_org(client, headers, "Image Publisher")
    image_bytes = b"\x89PNG\r\n\x1a\n" + b"five-star-image"

    upload = client.post(
        f"/organizations/{org['id']}/media",
        files={"file": ("patio photo.png", image_bytes, "image/png")},
        headers=headers,
    )
    assert upload.status_code == 201, upload.text
    assert upload.json()["content_type"] == "image/png"
    assert upload.json()["byte_size"] == len(image_bytes)

    served = client.get(upload.json()["url"])
    assert served.status_code == 200
    assert served.headers["content-type"] == "image/png"
    assert served.content == image_bytes

    created = client.post(
        f"/organizations/{org['id']}/social-posts",
        json={
            "master_caption": "Our new patio",
            "media_urls": [upload.json()["url"]],
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text
    published = client.post(
        f"/organizations/{org['id']}/social-posts/{created.json()['id']}/publish",
        headers=headers,
    )
    assert published.status_code == 200, published.text

    public_feed = client.get(f"/api/hubs/{org['feedback_token']}/feed")
    assert public_feed.status_code == 200, public_feed.text
    assert public_feed.json()[0]["media_urls"] == [upload.json()["url"]]


def test_published_five_star_posts_can_be_edited_and_deleted(client, auth_headers):
    headers = auth_headers("post-editor@example.com")
    org = create_org(client, headers, "Editable Feed")
    created = client.post(
        f"/organizations/{org['id']}/social-posts",
        json={"master_caption": "Original caption"},
        headers=headers,
    )
    assert created.status_code == 201, created.text
    post_id = created.json()["id"]
    published = client.post(
        f"/organizations/{org['id']}/social-posts/{post_id}/publish",
        headers=headers,
    )
    assert published.status_code == 200, published.text

    updated = client.patch(
        f"/organizations/{org['id']}/social-posts/{post_id}",
        json={"master_caption": "Updated Five* caption"},
        headers=headers,
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["master_caption"] == "Updated Five* caption"

    public_feed = client.get(f"/api/hubs/{org['feedback_token']}/feed")
    assert public_feed.status_code == 200, public_feed.text
    assert public_feed.json()[0]["master_caption"] == "Updated Five* caption"

    deleted = client.delete(
        f"/organizations/{org['id']}/social-posts/{post_id}",
        headers=headers,
    )
    assert deleted.status_code == 204, deleted.text
    assert client.get(f"/api/hubs/{org['feedback_token']}/feed").json() == []
    assert client.get(
        f"/organizations/{org['id']}/social-posts",
        headers=headers,
    ).json() == []


def test_disabled_feed_blocks_post_apis(client, auth_headers):
    headers = auth_headers("locked-feed-owner@example.com")
    org = create_org(client, headers, "Locked Feed Diner")
    with TestingSessionLocal() as db:
        db.get(Organization, org["id"]).feed_enabled = False
        db.commit()

    assert client.get(
        f"/organizations/{org['id']}/social-posts",
        headers=headers,
    ).status_code == 403

    with TestingSessionLocal() as db:
        db.get(Organization, org["id"]).feed_enabled = True
        db.commit()
    assert client.get(
        f"/organizations/{org['id']}/social-posts",
        headers=headers,
    ).status_code == 200


def test_social_account_endpoints_are_gone(client, auth_headers):
    headers = auth_headers("no-social-owner@example.com")
    org = create_org(client, headers, "No Social Diner")
    assert client.get(f"/organizations/{org['id']}/social-connections", headers=headers).status_code == 404


def test_feed_posts_cannot_be_scheduled(client, auth_headers):
    """The Feed scheduler was removed; a scheduled_at in the request is ignored."""
    headers = auth_headers("no-scheduler@example.com")
    org = create_org(client, headers, "No Scheduler Diner")
    created = client.post(
        f"/organizations/{org['id']}/social-posts",
        json={"master_caption": "Now", "scheduled_at": "2099-01-01T12:00:00Z"},
        headers=headers,
    )
    assert created.status_code == 201, created.text
    assert created.json()["status"] == "draft"
    assert created.json()["scheduled_at"] is None
