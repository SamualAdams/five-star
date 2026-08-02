from sqlalchemy import select

from app.models import Organization, OrganizationMember, User
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
    assert org["five_star_status"] == 1

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


def test_superuser_manages_inherited_organization_and_location_five_star_status(
    client,
    auth_headers,
):
    owner_headers = auth_headers("status-owner@example.com")
    org = create_org(client, owner_headers, "Status Diner")
    second_location = client.post(
        f"/organizations/{org['id']}/locations",
        json={"name": "Downtown"},
        headers=owner_headers,
    ).json()

    superuser_headers = auth_headers("jon@fivestar.fyi")
    with TestingSessionLocal() as db:
        superuser = db.scalar(select(User).where(User.email == "jon@fivestar.fyi"))
        superuser.is_superuser = True
        db.commit()

    forbidden = client.patch(
        f"/organizations/{org['id']}/five-star-status",
        json={"status": 4},
        headers=owner_headers,
    )
    assert forbidden.status_code == 403

    updated_org = client.patch(
        f"/organizations/{org['id']}/five-star-status",
        json={"status": 4},
        headers=superuser_headers,
    )
    assert updated_org.status_code == 200, updated_org.text
    assert updated_org.json()["five_star_status"] == 4

    inherited_locations = client.get(
        f"/organizations/{org['id']}/locations",
        headers=superuser_headers,
    ).json()
    assert {location["five_star_status"] for location in inherited_locations} == {4}
    assert all(location["five_star_status_override"] is None for location in inherited_locations)

    forbidden_location = client.patch(
        f"/organizations/{org['id']}/locations/{second_location['id']}/five-star-status",
        json={"status": 2},
        headers=owner_headers,
    )
    assert forbidden_location.status_code == 403

    overridden = client.patch(
        f"/organizations/{org['id']}/locations/{second_location['id']}/five-star-status",
        json={"status": 2},
        headers=superuser_headers,
    )
    assert overridden.status_code == 200, overridden.text
    assert overridden.json()["five_star_status"] == 2
    assert overridden.json()["five_star_status_override"] == 2

    client.patch(
        f"/organizations/{org['id']}/five-star-status",
        json={"status": 5},
        headers=superuser_headers,
    )
    locations_after_org_change = client.get(
        f"/organizations/{org['id']}/locations",
        headers=superuser_headers,
    ).json()
    status_by_id = {location["id"]: location["five_star_status"] for location in locations_after_org_change}
    assert status_by_id[second_location["id"]] == 2
    assert 5 in status_by_id.values()

    inherited_again = client.patch(
        f"/organizations/{org['id']}/locations/{second_location['id']}/five-star-status",
        json={"status": None},
        headers=superuser_headers,
    )
    assert inherited_again.status_code == 200, inherited_again.text
    assert inherited_again.json()["five_star_status"] == 5
    assert inherited_again.json()["five_star_status_override"] is None

    invalid = client.patch(
        f"/organizations/{org['id']}/five-star-status",
        json={"status": 6},
        headers=superuser_headers,
    )
    assert invalid.status_code == 422


def test_non_member_cannot_access_organization(client, auth_headers):
    org = create_org(client, auth_headers("owner@example.com"))
    outsider = auth_headers("outsider@example.com")
    assert client.get(f"/organizations/{org['id']}", headers=outsider).status_code == 404


def test_update_review_links(client, auth_headers):
    headers = auth_headers()
    org = create_org(client, headers)

    default_location = client.get(
        f"/organizations/{org['id']}/locations",
        headers=headers,
    ).json()[0]
    organization_default = [{"platform": "google", "url": "https://g.page/acme"}]
    response = client.patch(
        f"/organizations/{org['id']}/review-links",
        json={"review_links": organization_default},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["review_links"] == organization_default

    inherited = client.get(
        f"/organizations/{org['id']}/locations",
        headers=headers,
    ).json()[0]
    assert inherited["review_links"] == organization_default
    assert inherited["review_links_override"] is None
    assert client.get(f"/api/feedback/{default_location['feedback_token']}").json()["review_links"] == organization_default

    second_location = client.post(
        f"/organizations/{org['id']}/locations",
        json={"name": "Downtown"},
        headers=headers,
    ).json()
    assert second_location["review_links"] == organization_default
    assert second_location["review_links_override"] is None

    location_override = [{"platform": "yelp", "url": "https://yelp.com/biz/acme-downtown"}]
    overridden = client.patch(
        f"/organizations/{org['id']}/locations/{second_location['id']}/review-links",
        json={"review_links": location_override},
        headers=headers,
    )
    assert overridden.status_code == 200, overridden.text
    assert overridden.json()["review_links"] == location_override
    assert overridden.json()["review_links_override"] == location_override
    assert client.get(f"/api/feedback/{second_location['feedback_token']}").json()["review_links"] == location_override

    new_organization_default = [{"platform": "tripadvisor", "url": "https://tripadvisor.com/acme"}]
    client.patch(
        f"/organizations/{org['id']}/review-links",
        json={"review_links": new_organization_default},
        headers=headers,
    )
    locations = client.get(f"/organizations/{org['id']}/locations", headers=headers).json()
    default_after_update = next(location for location in locations if location["id"] == default_location["id"])
    overridden_after_update = next(location for location in locations if location["id"] == second_location["id"])
    assert default_after_update["review_links"] == new_organization_default
    assert overridden_after_update["review_links"] == location_override

    reset = client.patch(
        f"/organizations/{org['id']}/locations/{second_location['id']}/review-links",
        json={"review_links": None},
        headers=headers,
    )
    assert reset.status_code == 200, reset.text
    assert reset.json()["review_links"] == new_organization_default
    assert reset.json()["review_links_override"] is None


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


def test_search_and_organization_wide_feedback_for_multiple_locations(client, auth_headers):
    headers = auth_headers("multi-location-owner@example.com")
    org = create_org(client, headers, "Multi Location Diner")
    default_location = client.get(
        f"/organizations/{org['id']}/locations",
        headers=headers,
    ).json()[0]
    second_location = client.post(
        f"/organizations/{org['id']}/locations",
        json={"name": "Downtown", "address": "12 Main Street"},
        headers=headers,
    ).json()

    search = client.get("/organizations/search?q=Multi")
    assert search.status_code == 200
    assert search.json() == [{
        "name": "Multi Location Diner",
        "feedback_token": org["feedback_token"],
        "landing_enabled": False,
    }]

    info = client.get(f"/api/feedback/organization/{org['feedback_token']}")
    assert info.status_code == 200, info.text
    assert info.json()["organization_name"] == "Multi Location Diner"
    assert [location["id"] for location in info.json()["locations"]] == [
        default_location["id"],
        second_location["id"],
    ]

    submitted = client.post(
        f"/api/feedback/organization/{org['feedback_token']}/submit",
        json={"content": "This is about the organization overall."},
    )
    assert submitted.status_code == 201, submitted.text

    all_feedback = client.get(
        f"/organizations/{org['id']}/feedback",
        headers=headers,
    )
    assert all_feedback.status_code == 200
    assert all_feedback.json()[0]["location_id"] is None

    location_feedback = client.get(
        f"/organizations/{org['id']}/feedback?location_id={default_location['id']}",
        headers=headers,
    )
    assert location_feedback.status_code == 200
    assert location_feedback.json() == []

    all_stats = client.get(
        f"/organizations/{org['id']}/feedback/stats?days=1",
        headers=headers,
    )
    assert all_stats.status_code == 200
    assert all_stats.json()["data"][0]["count"] == 1
    location_stats = client.get(
        f"/organizations/{org['id']}/feedback/stats?days=1&location_id={default_location['id']}",
        headers=headers,
    )
    assert location_stats.status_code == 200
    assert location_stats.json()["data"][0]["count"] == 0

    with TestingSessionLocal() as db:
        organization = db.get(Organization, org["id"])
        organization.feed_enabled = True
        db.commit()
    assert client.get("/organizations/search?q=Multi").json()[0]["landing_enabled"] is True


def test_feedback_form_unknown_token(client):
    assert client.get("/api/feedback/not-a-real-token").status_code == 404
