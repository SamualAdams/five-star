def create_org(client, headers, name="Acme Diner"):
    response = client.post("/organizations", json={"name": name}, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def test_create_and_list_organization(client, auth_headers):
    headers = auth_headers()
    org = create_org(client, headers)
    assert org["name"] == "Acme Diner"
    assert org["role"] == "admin"
    assert org["feedback_token"]

    listing = client.get("/organizations", headers=headers)
    assert listing.status_code == 200
    assert [o["id"] for o in listing.json()] == [org["id"]]


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
