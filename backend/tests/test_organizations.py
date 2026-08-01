from sqlalchemy import select

from app.models import OrganizationMember, User
from conftest import TestingSessionLocal


def create_org(client, headers, name="Acme Diner"):
    response = client.post("/organizations", json={"name": name}, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def test_create_and_list_organization(client, auth_headers):
    headers = auth_headers()
    org = create_org(client, headers)
    assert org["name"] == "Acme Diner"
    assert org["role"] == "organization_admin"
    assert org["feedback_token"]
    assert org["modules"] == {"feedback": True, "roadmap": False, "feed": False}

    listing = client.get("/organizations", headers=headers)
    assert listing.status_code == 200
    assert [o["id"] for o in listing.json()] == [org["id"]]


def test_superuser_sees_every_organization_without_membership_and_manages_modules(
    client,
    auth_headers,
):
    first_owner = auth_headers("first-owner@example.com")
    second_owner = auth_headers("second-owner@example.com")
    first = create_org(client, first_owner, "Alpha Diner")
    second = create_org(client, second_owner, "Bravo Diner")

    superuser_headers = auth_headers("jon@fivestar.fyi")
    with TestingSessionLocal() as db:
        superuser = db.scalar(select(User).where(User.email == "jon@fivestar.fyi"))
        superuser.is_superuser = True
        db.commit()

    profile = client.get("/auth/me", headers=superuser_headers)
    assert profile.status_code == 200
    assert profile.json()["is_superuser"] is True

    listing = client.get("/organizations", headers=superuser_headers)
    assert listing.status_code == 200, listing.text
    assert [organization["name"] for organization in listing.json()] == [
        "Alpha Diner",
        "Bravo Diner",
    ]
    assert all(organization["can_manage_organization"] for organization in listing.json())

    locations = client.get(
        f"/organizations/{first['id']}/locations",
        headers=superuser_headers,
    )
    assert locations.status_code == 200, locations.text
    assert locations.json()[0]["can_manage"] is True

    members = client.get(
        f"/organizations/{first['id']}/members",
        headers=superuser_headers,
    )
    assert members.status_code == 200, members.text
    assert "jon@fivestar.fyi" not in {member["email"] for member in members.json()}
    with TestingSessionLocal() as db:
        superuser = db.scalar(select(User).where(User.email == "jon@fivestar.fyi"))
        assert db.scalar(
            select(OrganizationMember).where(
                OrganizationMember.user_id == superuser.id,
                OrganizationMember.organization_id.in_([first["id"], second["id"]]),
            )
        ) is None

    forbidden = client.patch(
        f"/organizations/{first['id']}/modules",
        json={"roadmap": True},
        headers=first_owner,
    )
    assert forbidden.status_code == 403

    updated = client.patch(
        f"/organizations/{first['id']}/modules",
        json={"roadmap": True, "feed": True},
        headers=superuser_headers,
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["modules"] == {
        "feedback": True,
        "roadmap": True,
        "feed": True,
    }


def test_update_organization_name(client, auth_headers):
    """Regression: PATCH /organizations/{id} 500'd when the handler wrote the removed review_url column."""
    headers = auth_headers()
    org = create_org(client, headers)

    response = client.patch(
        f"/organizations/{org['id']}",
        json={"name": "New Name", "review_url": "https://example.com/ignored"},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["name"] == "New Name"


def test_non_member_cannot_access_organization(client, auth_headers):
    org = create_org(client, auth_headers("owner@example.com"))
    outsider = auth_headers("outsider@example.com")
    assert client.get(f"/organizations/{org['id']}", headers=outsider).status_code == 404


def test_update_review_links(client, auth_headers):
    headers = auth_headers()
    org = create_org(client, headers)

    response = client.patch(
        f"/organizations/{org['id']}/review-links",
        json={"review_links": [{"platform": "google", "url": "https://g.page/acme"}]},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["review_links"] == [{"platform": "google", "url": "https://g.page/acme"}]


def test_public_feedback_flow(client, auth_headers):
    headers = auth_headers()
    org = create_org(client, headers)
    token = org["feedback_token"]

    info = client.get(f"/api/feedback/{token}")
    assert info.status_code == 200
    assert info.json()["organization_name"] == "Acme Diner"

    submit = client.post(f"/api/feedback/{token}/submit", json={"content": "Great service!"})
    assert submit.status_code == 201

    feedback = client.get(f"/organizations/{org['id']}/feedback", headers=headers)
    assert feedback.status_code == 200
    assert feedback.json()[0]["content"] == "Great service!"
    assert feedback.json()[0]["is_anonymous"] is True


def test_feedback_form_unknown_token(client):
    assert client.get("/api/feedback/not-a-real-token").status_code == 404
