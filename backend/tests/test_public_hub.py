import app.main as main_module
from app.models import Organization, SocialConnection, User
from app.social import encrypt_token
from conftest import TestingSessionLocal


def create_org(client, headers, name="Public Hub Diner"):
    response = client.post("/organizations", json={"name": name}, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def enable_modules(org_id, *, feed=True, roadmap=True, five_star_status=3):
    with TestingSessionLocal() as db:
        organization = db.get(Organization, org_id)
        organization.feed_enabled = feed
        organization.roadmap_enabled = roadmap
        organization.five_star_status = five_star_status
        db.commit()


def test_public_hub_requires_an_optional_module_and_lists_locations(client, auth_headers):
    headers = auth_headers("hub-owner@example.com")
    org = create_org(client, headers)
    assert client.get(f"/api/hubs/{org['feedback_token']}").status_code == 404

    second_location = client.post(
        f"/organizations/{org['id']}/locations",
        json={"name": "Uptown", "address": "12 Main Street"},
        headers=headers,
    )
    assert second_location.status_code == 201
    enable_modules(org["id"], feed=False, roadmap=True, five_star_status=4)

    response = client.get(f"/api/hubs/{org['feedback_token']}")
    assert response.status_code == 200, response.text
    hub = response.json()
    assert hub["organization_name"] == "Public Hub Diner"
    assert hub["five_star_status"] == 4
    assert hub["modules"] == {"feedback": True, "roadmap": True, "feed": False}
    assert [location["name"] for location in hub["locations"]] == [
        "Public Hub Diner",
        "Uptown",
    ]
    assert hub["locations"][1]["address"] == "12 Main Street"


def test_public_roadmap_is_organization_wide_with_location_filters(client, auth_headers):
    headers = auth_headers("roadmap-hub-owner@example.com")
    org = create_org(client, headers, "Roadmap Hub")
    location = client.post(
        f"/organizations/{org['id']}/locations",
        json={"name": "Downtown"},
        headers=headers,
    ).json()
    enable_modules(org["id"])

    organization_item = client.post(
        f"/organizations/{org['id']}/initiatives",
        json={"title": "Organization item", "description": "For everyone"},
        headers=headers,
    ).json()
    location_item = client.post(
        f"/organizations/{org['id']}/initiatives",
        json={
            "title": "Downtown item",
            "description": "For downtown",
            "location_id": location["id"],
        },
        headers=headers,
    ).json()
    assert organization_item["location_id"] is None
    assert organization_item["location_name"] is None

    board_url = f"/api/hubs/{org['feedback_token']}/roadmap"
    all_items = client.get(board_url).json()["initiatives"]
    assert {item["id"] for item in all_items} == {
        organization_item["id"],
        location_item["id"],
    }
    downtown_items = client.get(
        f"{board_url}?location_id={location['id']}"
    ).json()["initiatives"]
    assert [item["id"] for item in downtown_items] == [location_item["id"]]

    vote = client.put(
        f"{board_url}/initiatives/{organization_item['id']}/vote",
        json={"value": 1},
        headers={"X-Visitor-ID": "7a8d7f1b-e1dd-48f6-9dcb-1f773c2d957e"},
    )
    assert vote.status_code == 200
    assert vote.json()["score"] == 1


def test_five_star_only_feed_posts_and_location_filters(client, auth_headers):
    headers = auth_headers("feed-hub-owner@example.com")
    org = create_org(client, headers, "Feed Hub")
    location = client.post(
        f"/organizations/{org['id']}/locations",
        json={"name": "Lakeside"},
        headers=headers,
    ).json()
    enable_modules(org["id"], roadmap=False)

    organization_post = client.post(
        f"/organizations/{org['id']}/social-posts",
        json={"master_caption": "Organization news"},
        headers=headers,
    )
    assert organization_post.status_code == 201, organization_post.text
    organization_post = client.post(
        f"/organizations/{org['id']}/social-posts/{organization_post.json()['id']}/publish",
        headers=headers,
    )
    assert organization_post.status_code == 200
    assert organization_post.json()["status"] == "published"
    assert organization_post.json()["targets"] == []

    location_post = client.post(
        f"/organizations/{org['id']}/social-posts",
        json={
            "master_caption": "Lakeside news",
            "location_id": location["id"],
        },
        headers=headers,
    ).json()
    client.post(
        f"/organizations/{org['id']}/social-posts/{location_post['id']}/publish",
        headers=headers,
    )

    feed_url = f"/api/hubs/{org['feedback_token']}/feed"
    assert [post["master_caption"] for post in client.get(feed_url).json()] == [
        "Lakeside news",
        "Organization news",
    ]
    location_feed = client.get(
        f"{feed_url}?location_id={location['id']}"
    ).json()
    assert [post["master_caption"] for post in location_feed] == ["Lakeside news"]
    assert location_feed[0]["location_name"] == "Lakeside"


def test_location_social_connections_override_organization_defaults(
    client,
    auth_headers,
    monkeypatch,
):
    email = "scoped-social-owner@example.com"
    headers = auth_headers(email)
    org = create_org(client, headers, "Scoped Social Hub")
    location = client.post(
        f"/organizations/{org['id']}/locations",
        json={"name": "Mid City"},
        headers=headers,
    ).json()
    enable_modules(org["id"], roadmap=False)

    with TestingSessionLocal() as db:
        user = db.query(User).filter_by(email=email).one()
        db.add_all([
            SocialConnection(
                organization_id=org["id"],
                location_id=None,
                provider="facebook",
                status="connected",
                provider_account_id="org-page",
                provider_account_name="Organization Page",
                access_token_encrypted=encrypt_token("org-token"),
                scopes=[],
                provider_data={"auth_type": "facebook_login"},
                connected_by=user.id,
            ),
            SocialConnection(
                organization_id=org["id"],
                location_id=location["id"],
                provider="facebook",
                status="connected",
                provider_account_id="local-page",
                provider_account_name="Mid City Page",
                access_token_encrypted=encrypt_token("local-token"),
                scopes=[],
                provider_data={"auth_type": "facebook_login"},
                connected_by=user.id,
            ),
            SocialConnection(
                organization_id=org["id"],
                location_id=None,
                provider="instagram",
                status="connected",
                provider_account_id="org-instagram",
                provider_account_name="organization_updates",
                access_token_encrypted=encrypt_token("instagram-token"),
                scopes=[],
                provider_data={"auth_type": "instagram_login"},
                connected_by=user.id,
            ),
        ])
        db.commit()

    organization_accounts = client.get(
        f"/organizations/{org['id']}/social-connections",
        headers=headers,
    ).json()
    organization_facebook = next(
        account for account in organization_accounts if account["provider"] == "facebook"
    )
    assert organization_facebook["provider_account_name"] == "Organization Page"
    assert organization_facebook["inherited"] is False

    accounts = client.get(
        f"/organizations/{org['id']}/social-connections?location_id={location['id']}",
        headers=headers,
    ).json()
    facebook = next(account for account in accounts if account["provider"] == "facebook")
    assert facebook["provider_account_name"] == "Mid City Page"
    assert facebook["inherited"] is False
    instagram = next(account for account in accounts if account["provider"] == "instagram")
    assert instagram["provider_account_name"] == "organization_updates"
    assert instagram["inherited"] is True

    calls = []
    monkeypatch.setattr(
        main_module,
        "publish_social_content",
        lambda provider, **kwargs: calls.append(kwargs["account_id"]) or "remote-id",
    )
    post = client.post(
        f"/organizations/{org['id']}/social-posts",
        json={
            "master_caption": "Local social news",
            "location_id": location["id"],
            "targets": [{"provider": "facebook", "content": "Local social news"}],
        },
        headers=headers,
    ).json()
    published = client.post(
        f"/organizations/{org['id']}/social-posts/{post['id']}/publish",
        headers=headers,
    )
    assert published.status_code == 200, published.text
    assert calls == ["local-page"]
