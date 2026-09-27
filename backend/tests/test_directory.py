from app.directory_text import norm_name, split_query, street_core
from app.models import DirectoryPlace

from conftest import TestingSessionLocal


def _place(i, name, street, city="Baton Rouge", lat=30.4, lon=-91.1, **extra):
    street_name = street.split(" ", 1)[1] if street[0].isdigit() else street
    return DirectoryPlace(
        source="overture",
        source_id=f"test-{i}",
        source_release="test",
        name=name,
        street=street,
        city=city,
        state="LA",
        lat=lat,
        lon=lon,
        name_search=f" {norm_name(name)} ",
        street_search=f" {street_core(street_name)} ",
        **extra,
    )


def _seed(*places):
    db = TestingSessionLocal()
    db.add_all(places)
    db.commit()
    ids = [p.id for p in places]
    db.close()
    return ids


def _names(client, q, **params):
    response = client.get("/directory/search", params={"q": q, **params})
    assert response.status_code == 200, response.text
    return [(r["name"], r["street"]) for r in response.json()]


def test_split_query_readings():
    assert split_query("canes on lee") == [("canes", "lee")]
    assert split_query("Rouses Bluebonnet Blvd") == [
        ("rouses bluebonnet blvd", ""),
        ("rouses bluebonnet", "blvd"),
        ("rouses", "bluebonnet"),
    ]
    assert street_core("S Sherwood Forest Blvd") == "sherwood forest"
    assert norm_name("Chick-fil-A #0123") == "chick fil a"


def test_name_and_street_search(client):
    _seed(
        _place(1, "Raising Cane's", "202 W. Lee Dr"),
        _place(2, "Raising Cane's", "10020 Perkins Rd"),
        _place(3, "Chick-fil-A", "5919 Ben Hur Rd"),
        _place(4, "Cost Plus World Market", "5919 Bluebonnet Blvd"),
        _place(5, "Costco", "10000 Dawnadele Ave"),
    )

    assert _names(client, "canes on lee") == [("Raising Cane's", "202 W. Lee Dr")]
    assert _names(client, "chick fil a ben hur") == [("Chick-fil-A", "5919 Ben Hur Rd")]
    assert len(_names(client, "raising canes")) == 2
    # a query word only matches the start of a word, never a shorter word
    assert _names(client, "costco") == [("Costco", "10000 Dawnadele Ave")]


def test_search_skips_inactive_and_claimed_and_orders_by_distance(client):
    _seed(
        _place(1, "Starbucks", "1 Far Rd", lat=30.9, lon=-91.9),
        _place(2, "Starbucks", "2 Near Rd", lat=30.41, lon=-91.11),
        _place(3, "Starbucks", "3 Gone Rd", active=False),
    )

    results = _names(client, "starbucks", lat=30.4, lon=-91.1)
    assert results == [("Starbucks", "2 Near Rd"), ("Starbucks", "1 Far Rd")]


def _make_superuser(email):
    from app.models import User

    db = TestingSessionLocal()
    db.query(User).filter(User.email == email).update({"is_superuser": True})
    db.commit()
    db.close()


def _leave(client, place_id, content):
    response = client.post(
        "/api/feedback/unlisted",
        json={"business_name": "xx", "location_hint": "xx", "content": content, "directory_place_id": place_id},
    )
    assert response.status_code == 201, response.text


def test_directory_feedback_creates_unclaimed_business_staff_can_see(client, auth_headers):
    lee, perkins, coffee = _seed(
        _place(1, "Raising Cane's", "202 W. Lee Dr", brand="Raising Cane's Chicken Fingers"),
        _place(2, "Raising Canes", "10020 Perkins Rd", brand="Raising Cane's Chicken Fingers"),
        _place(3, "Coffee Call", "3132 College Dr"),
    )
    _leave(client, lee, "Fast drive-thru")
    _leave(client, perkins, "Out of sauce")
    _leave(client, lee, "Again great")
    _leave(client, coffee, "Beignets!")

    staff = auth_headers("staff@fivestar.fyi")
    _make_superuser("staff@fivestar.fyi")
    orgs = {o["name"]: o for o in client.get("/organizations", headers=staff).json()}
    assert set(orgs) == {"Raising Cane's Chicken Fingers", "Coffee Call"}
    canes = orgs["Raising Cane's Chicken Fingers"]
    assert canes["is_claimed"] is False and canes["created_by"] is None

    locations = client.get(f"/organizations/{canes['id']}/locations", headers=staff).json()
    assert sorted(l["address"] for l in locations) == [
        "10020 Perkins Rd, Baton Rouge, LA",
        "202 W. Lee Dr, Baton Rouge, LA",
    ]
    feedback = client.get(f"/organizations/{canes['id']}/feedback", headers=staff).json()
    assert sorted(f["content"] for f in feedback) == ["Again great", "Fast drive-thru", "Out of sauce"]

    # a regular business owner can't see unclaimed businesses
    owner = auth_headers("owner@example.com")
    assert client.get("/organizations", headers=owner).json() == []
    assert client.get(f"/organizations/{canes['id']}/feedback", headers=owner).status_code == 404

    # still searchable after becoming a business
    assert len(_names(client, "canes on lee")) == 1


def test_unlisted_feedback_emails_the_team(client, monkeypatch):
    sent = []
    monkeypatch.setattr("app.main.send_feedback_notification", lambda **kw: sent.append(kw))
    (place_id,) = _seed(_place(1, "Coffee Call", "3132 College Dr"))

    client.post(
        "/api/feedback/unlisted",
        json={"business_name": "xx", "location_hint": "xx", "content": "Great beignets", "directory_place_id": place_id},
    )
    client.post(
        "/api/feedback/unlisted",
        json={
            "business_name": "Fuego Tortilla Grill",
            "location_hint": "Perkins Rd",
            "content": "Please add queso",
            "submitter_email": "Fan@Example.com",
        },
    )

    assert [(e["business_name"], e["kind"]) for e in sent] == [
        ("Coffee Call", "unclaimed"),
        ("Fuego Tortilla Grill", "not_found"),
    ]
    assert sent[1]["submitter_email"] == "fan@example.com"


def test_feedback_for_businesses_on_five_star_emails_the_team(client, auth_headers, monkeypatch):
    sent = []
    monkeypatch.setattr("app.main.send_feedback_notification", lambda **kw: sent.append(kw))
    headers = auth_headers()
    org = client.post("/organizations", json={"name": "Acme Diner"}, headers=headers).json()
    location = client.get(f"/organizations/{org['id']}/locations", headers=headers).json()[0]

    client.post(f"/api/feedback/{location['feedback_token']}/submit", json={"content": "Great service!"})
    client.post(f"/api/feedback/organization/{org['feedback_token']}/submit", json={"content": "Overall great"})

    assert [(e["kind"], e["business_name"], e["content"]) for e in sent] == [
        ("claimed", "Acme Diner", "Great service!"),
        ("claimed", "Acme Diner", "Overall great"),
    ]


def test_notification_email_variants(monkeypatch):
    from types import SimpleNamespace

    from app import email

    captured = []

    class FakeClient:
        def __init__(self, key):
            pass

        def send(self, message):
            captured.append(message.get())

    monkeypatch.setattr(email, "SendGridAPIClient", FakeClient)
    monkeypatch.setattr(
        email,
        "get_settings",
        lambda: SimpleNamespace(
            sendgrid_api_key="k", feedback_notify_email="team@example.com", sender_email="noreply@example.com"
        ),
    )
    common = dict(location="Perkins Rd", content="<b>hi</b>", submitter_name=None)
    email.send_feedback_notification(kind="unclaimed", business_name="Coffee Call", submitter_email=None, **common)
    email.send_feedback_notification(
        kind="not_found", business_name="Fuego", submitter_email="fan@example.com", **common
    )

    found, missing = captured
    assert found["subject"] == "[five*] Feedback: Coffee Call"
    assert "deliver it by hand" in found["content"][0]["value"]
    assert "&lt;b&gt;hi&lt;/b&gt;" in found["content"][0]["value"]
    assert missing["subject"] == "[five*] Business not found: Fuego"
    assert missing["reply_to"]["email"] == "fan@example.com"
    assert found["personalizations"][0]["to"][0]["email"] == "team@example.com"


def test_directory_businesses_start_unverified(client):
    (place_id,) = _seed(_place(1, "Coffee Call", "3132 College Dr"))
    _leave(client, place_id, "Beignets!")

    db = TestingSessionLocal()
    from app.models import Organization

    assert db.query(Organization).one().five_star_status == 0
    db.close()
