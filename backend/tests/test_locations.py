from datetime import date

from sqlalchemy import select

from app.models import Digest, DigestStatus, User
from conftest import TestingSessionLocal


def create_org(client, headers, name="Diner Group"):
    response = client.post("/organizations", json={"name": name}, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def test_new_organization_gets_a_default_location_and_preserves_public_token(client, auth_headers):
    headers = auth_headers()
    org = create_org(client, headers)

    locations = client.get(f"/organizations/{org['id']}/locations", headers=headers)
    assert locations.status_code == 200, locations.text
    assert len(locations.json()) == 1
    default_location = locations.json()[0]
    assert default_location["name"] == org["name"]
    assert default_location["is_default"] is True
    assert default_location["feedback_token"] == org["feedback_token"]
    assert default_location["access_role"] == "organization_admin"

    public_info = client.get(f"/api/feedback/{org['feedback_token']}")
    assert public_info.status_code == 200, public_info.text
    assert public_info.json()["location_id"] == default_location["id"]
    assert public_info.json()["location_name"] == org["name"]


def test_location_manager_only_sees_and_manages_assigned_location(client, auth_headers):
    owner_headers = auth_headers("owner@example.com")
    org = create_org(client, owner_headers)
    default_location = client.get(
        f"/organizations/{org['id']}/locations",
        headers=owner_headers,
    ).json()[0]
    second_response = client.post(
        f"/organizations/{org['id']}/locations",
        json={
            "name": "Downtown",
            "address": "123 Main Street",
            "timezone": "America/Chicago",
        },
        headers=owner_headers,
    )
    assert second_response.status_code == 201, second_response.text
    second_location = second_response.json()

    manager_headers = auth_headers("manager@example.com")
    invite = client.post(
        f"/organizations/{org['id']}/invites",
        json={
            "role": "location_admin",
            "location_id": second_location["id"],
        },
        headers=owner_headers,
    )
    assert invite.status_code == 201, invite.text
    accepted = client.post(
        "/invites/accept",
        json={"token": invite.json()["token"]},
        headers=manager_headers,
    )
    assert accepted.status_code == 200, accepted.text

    visible_locations = client.get(
        f"/organizations/{org['id']}/locations",
        headers=manager_headers,
    )
    assert visible_locations.status_code == 200
    assert [location["id"] for location in visible_locations.json()] == [second_location["id"]]
    assert visible_locations.json()[0]["access_role"] == "location_admin"

    created = client.post(
        f"/organizations/{org['id']}/initiatives",
        json={
            "title": "Downtown patio",
            "description": "Add shaded seating.",
            "location_id": second_location["id"],
        },
        headers=manager_headers,
    )
    assert created.status_code == 201, created.text
    assert created.json()["location_id"] == second_location["id"]

    denied = client.post(
        f"/organizations/{org['id']}/initiatives",
        json={
            "title": "Private default item",
            "description": "Should not be visible.",
            "location_id": default_location["id"],
        },
        headers=manager_headers,
    )
    assert denied.status_code == 404

    aggregate = client.get(
        f"/organizations/{org['id']}/initiatives",
        headers=owner_headers,
    )
    assert aggregate.status_code == 200
    assert [item["id"] for item in aggregate.json()] == [created.json()["id"]]


def test_members_can_use_each_explicit_organization_or_location_access_level(client, auth_headers):
    owner_headers = auth_headers("roles-owner@example.com")
    org = create_org(client, owner_headers)
    second_location = client.post(
        f"/organizations/{org['id']}/locations",
        json={"name": "Northside"},
        headers=owner_headers,
    ).json()

    member_headers = auth_headers("roles-member@example.com")
    invite = client.post(
        f"/organizations/{org['id']}/invites",
        json={"role": "organization_viewer"},
        headers=owner_headers,
    )
    assert invite.status_code == 201, invite.text
    accepted = client.post("/invites/accept", json={"token": invite.json()["token"]}, headers=member_headers)
    assert accepted.status_code == 200
    assert accepted.json()["role"] == "organization_viewer"

    members = client.get(f"/organizations/{org['id']}/members", headers=owner_headers).json()
    member = next(item for item in members if item["email"] == "roles-member@example.com")
    assert member["role"] == "organization_viewer"
    assert len(client.get(f"/organizations/{org['id']}/locations", headers=member_headers).json()) == 2

    location_admin = client.patch(
        f"/organizations/{org['id']}/members/{member['user_id']}",
        json={"role": "location_admin"},
        headers=owner_headers,
    )
    assert location_admin.status_code == 200, location_admin.text
    assert location_admin.json()["role"] == "location_admin"
    assert location_admin.json()["location_assignments"][0]["role"] == "manager"

    assignments = client.put(
        f"/organizations/{org['id']}/members/{member['user_id']}/locations",
        json={"assignments": [{"location_id": second_location["id"], "role": "manager"}]},
        headers=owner_headers,
    )
    assert assignments.status_code == 200, assignments.text
    assert assignments.json()["role"] == "location_admin"

    location_viewer = client.patch(
        f"/organizations/{org['id']}/members/{member['user_id']}",
        json={"role": "location_viewer"},
        headers=owner_headers,
    )
    assert location_viewer.status_code == 200
    assert location_viewer.json()["location_assignments"][0]["role"] == "viewer"

    organization_admin = client.patch(
        f"/organizations/{org['id']}/members/{member['user_id']}",
        json={"role": "organization_admin"},
        headers=owner_headers,
    )
    assert organization_admin.status_code == 200
    assert organization_admin.json()["role"] == "organization_admin"
    assert organization_admin.json()["location_assignments"] == []


def test_public_roadmaps_are_isolated_by_location_token(client, auth_headers):
    headers = auth_headers()
    org = create_org(client, headers)
    default_location = client.get(
        f"/organizations/{org['id']}/locations",
        headers=headers,
    ).json()[0]
    second_location = client.post(
        f"/organizations/{org['id']}/locations",
        json={"name": "Uptown"},
        headers=headers,
    ).json()

    default_item = client.post(
        f"/organizations/{org['id']}/initiatives",
        json={
            "title": "Default item",
            "description": "Default only",
            "location_id": default_location["id"],
        },
        headers=headers,
    ).json()
    second_item = client.post(
        f"/organizations/{org['id']}/initiatives",
        json={
            "title": "Uptown item",
            "description": "Uptown only",
            "location_id": second_location["id"],
        },
        headers=headers,
    ).json()

    default_board = client.get(f"/api/boards/{default_location['feedback_token']}")
    second_board = client.get(f"/api/boards/{second_location['feedback_token']}")
    assert [item["id"] for item in default_board.json()["initiatives"]] == [default_item["id"]]
    assert [item["id"] for item in second_board.json()["initiatives"]] == [second_item["id"]]
    assert second_board.json()["location_name"] == "Uptown"

    voter = {"X-Visitor-ID": "7a8d7f1b-e1dd-48f6-9dcb-1f773c2d957e"}
    cross_location_vote = client.put(
        f"/api/boards/{default_location['feedback_token']}/initiatives/{second_item['id']}/vote",
        json={"value": 1},
        headers=voter,
    )
    assert cross_location_vote.status_code == 404


def test_location_manager_can_reopen_drafts_while_viewer_waits_for_publish(client, auth_headers):
    owner_headers = auth_headers("digest-owner@example.com")
    org = create_org(client, owner_headers)
    location = client.post(
        f"/organizations/{org['id']}/locations",
        json={"name": "Downtown"},
        headers=owner_headers,
    ).json()

    manager_headers = auth_headers("digest-manager@example.com")
    manager_invite = client.post(
        f"/organizations/{org['id']}/invites",
        json={
            "role": "location_admin",
            "location_id": location["id"],
        },
        headers=owner_headers,
    ).json()
    client.post(
        "/invites/accept",
        json={"token": manager_invite["token"]},
        headers=manager_headers,
    )

    viewer_headers = auth_headers("digest-viewer@example.com")
    viewer_invite = client.post(
        f"/organizations/{org['id']}/invites",
        json={
            "role": "location_viewer",
            "location_id": location["id"],
        },
        headers=owner_headers,
    ).json()
    client.post(
        "/invites/accept",
        json={"token": viewer_invite["token"]},
        headers=viewer_headers,
    )

    with TestingSessionLocal() as db:
        manager = db.scalar(select(User).where(User.email == "digest-manager@example.com"))
        digest = Digest(
            organization_id=org["id"],
            location_id=location["id"],
            status=DigestStatus.DRAFT,
            period_start=date(2026, 7, 20),
            period_end=date(2026, 7, 26),
            summary="A draft location summary.",
            insights=["Guests want online booking."],
            immediate_actions=["Add a reservation link."],
            long_term_goals=["Launch online reservations."],
            feedback_count=1,
            generated_by=manager.id,
        )
        db.add(digest)
        db.commit()
        digest_id = digest.id

    manager_list = client.get(
        f"/organizations/{org['id']}/digests",
        params={"location_id": location["id"]},
        headers=manager_headers,
    )
    assert manager_list.status_code == 200, manager_list.text
    assert [item["id"] for item in manager_list.json()] == [digest_id]
    assert manager_list.json()[0]["location_name"] == "Downtown"

    manager_detail = client.get(
        f"/organizations/{org['id']}/digests/{digest_id}",
        headers=manager_headers,
    )
    assert manager_detail.status_code == 200, manager_detail.text

    viewer_list = client.get(
        f"/organizations/{org['id']}/digests",
        params={"location_id": location["id"]},
        headers=viewer_headers,
    )
    assert viewer_list.status_code == 200
    assert viewer_list.json() == []

    viewer_detail = client.get(
        f"/organizations/{org['id']}/digests/{digest_id}",
        headers=viewer_headers,
    )
    assert viewer_detail.status_code == 404

    published = client.post(
        f"/organizations/{org['id']}/digests/{digest_id}/publish",
        headers=manager_headers,
    )
    assert published.status_code == 200, published.text

    viewer_list = client.get(
        f"/organizations/{org['id']}/digests",
        params={"location_id": location["id"]},
        headers=viewer_headers,
    )
    assert [item["id"] for item in viewer_list.json()] == [digest_id]
