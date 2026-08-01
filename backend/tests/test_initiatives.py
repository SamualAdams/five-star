from app.models import Organization
from conftest import TestingSessionLocal


def create_org(client, headers, name="Acme Diner"):
    response = client.post("/organizations", json={"name": name}, headers=headers)
    assert response.status_code == 201, response.text
    organization = response.json()
    with TestingSessionLocal() as db:
        db.get(Organization, organization["id"]).roadmap_enabled = True
        db.commit()
    return organization


def create_initiative(client, headers, org_id, title, description="Details", status="gathering_feedback"):
    response = client.post(
        f"/organizations/{org_id}/initiatives",
        json={"title": title, "description": description, "status": status},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_initiative_admin_crud_and_viewer_read_access(client, auth_headers):
    owner_headers = auth_headers("owner@example.com")
    org = create_org(client, owner_headers)
    initiative = create_initiative(client, owner_headers, org["id"], "Online booking")

    assert initiative["status"] == "gathering_feedback"
    assert initiative["score"] == 0

    updated = client.patch(
        f"/organizations/{org['id']}/initiatives/{initiative['id']}",
        json={"title": "Online booking for groups", "status": "planned"},
        headers=owner_headers,
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["title"] == "Online booking for groups"
    assert updated.json()["status"] == "planned"

    viewer_headers = auth_headers("viewer@example.com")
    invite = client.post(
        f"/organizations/{org['id']}/invites",
        json={"role": "organization_viewer"},
        headers=owner_headers,
    )
    assert invite.status_code == 201, invite.text
    accepted = client.post("/invites/accept", json={"token": invite.json()["token"]}, headers=viewer_headers)
    assert accepted.status_code == 200, accepted.text

    listed = client.get(f"/organizations/{org['id']}/initiatives", headers=viewer_headers)
    assert listed.status_code == 200
    assert listed.json()[0]["id"] == initiative["id"]

    forbidden = client.post(
        f"/organizations/{org['id']}/initiatives",
        json={"title": "Not allowed", "description": "A viewer cannot post this."},
        headers=viewer_headers,
    )
    assert forbidden.status_code == 403

    deleted = client.delete(
        f"/organizations/{org['id']}/initiatives/{initiative['id']}",
        headers=owner_headers,
    )
    assert deleted.status_code == 204
    assert client.get(f"/organizations/{org['id']}/initiatives", headers=owner_headers).json() == []


def test_public_board_filters_sorts_and_tracks_one_anonymous_vote(client, auth_headers):
    owner_headers = auth_headers()
    org = create_org(client, owner_headers)
    low_priority = create_initiative(client, owner_headers, org["id"], "New loyalty card", status="planned")
    high_priority = create_initiative(client, owner_headers, org["id"], "Online booking", status="in_progress")
    board_url = f"/api/boards/{org['feedback_token']}"
    voter_one = {"X-Visitor-ID": "7a8d7f1b-e1dd-48f6-9dcb-1f773c2d957e"}
    voter_two = {"X-Visitor-ID": "75e6d350-10a5-4dbe-bd9a-1e87d7dd8f38"}

    first_vote = client.put(
        f"{board_url}/initiatives/{high_priority['id']}/vote",
        json={"value": 1},
        headers=voter_one,
    )
    assert first_vote.status_code == 200, first_vote.text
    assert first_vote.json()["upvotes"] == 1
    assert first_vote.json()["viewer_vote"] == 1

    repeated_vote = client.put(
        f"{board_url}/initiatives/{high_priority['id']}/vote",
        json={"value": 1},
        headers=voter_one,
    )
    assert repeated_vote.status_code == 200
    assert repeated_vote.json()["upvotes"] == 1

    changed_vote = client.put(
        f"{board_url}/initiatives/{high_priority['id']}/vote",
        json={"value": -1},
        headers=voter_one,
    )
    assert changed_vote.status_code == 200
    assert changed_vote.json()["upvotes"] == 0
    assert changed_vote.json()["downvotes"] == 1
    assert changed_vote.json()["viewer_vote"] == -1

    client.put(
        f"{board_url}/initiatives/{high_priority['id']}/vote",
        json={"value": 1},
        headers=voter_two,
    )
    top_board = client.get(board_url, headers=voter_one)
    assert top_board.status_code == 200, top_board.text
    assert top_board.json()["organization_name"] == "Acme Diner"
    assert top_board.json()["initiatives"][0]["id"] == high_priority["id"]
    assert top_board.json()["initiatives"][0]["score"] == 0
    assert top_board.json()["initiatives"][0]["viewer_vote"] == -1

    filtered = client.get(f"{board_url}?status=planned&q=loyalty", headers=voter_one)
    assert filtered.status_code == 200
    assert [item["id"] for item in filtered.json()["initiatives"]] == [low_priority["id"]]

    removed_vote = client.put(
        f"{board_url}/initiatives/{high_priority['id']}/vote",
        json={"value": None},
        headers=voter_one,
    )
    assert removed_vote.status_code == 200
    assert removed_vote.json()["downvotes"] == 0
    assert removed_vote.json()["viewer_vote"] is None


def test_public_vote_requires_a_browser_identifier(client, auth_headers):
    headers = auth_headers()
    org = create_org(client, headers)
    initiative = create_initiative(client, headers, org["id"], "Online booking")

    response = client.put(
        f"/api/boards/{org['feedback_token']}/initiatives/{initiative['id']}/vote",
        json={"value": 1},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Missing visitor identifier"


def test_disabled_roadmap_blocks_private_and_public_access_without_deleting_data(
    client,
    auth_headers,
):
    headers = auth_headers("module-owner@example.com")
    org = create_org(client, headers, "Module Diner")
    initiative = create_initiative(client, headers, org["id"], "Keep this item")

    with TestingSessionLocal() as db:
        db.get(Organization, org["id"]).roadmap_enabled = False
        db.commit()

    private_listing = client.get(
        f"/organizations/{org['id']}/initiatives",
        headers=headers,
    )
    assert private_listing.status_code == 403
    assert client.get(f"/api/boards/{org['feedback_token']}").status_code == 404

    with TestingSessionLocal() as db:
        db.get(Organization, org["id"]).roadmap_enabled = True
        db.commit()

    restored = client.get(
        f"/organizations/{org['id']}/initiatives",
        headers=headers,
    )
    assert restored.status_code == 200
    assert [item["id"] for item in restored.json()] == [initiative["id"]]
