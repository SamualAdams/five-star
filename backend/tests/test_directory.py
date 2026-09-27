from app.directory_text import norm_name, split_query, street_core
from app.models import BusinessClaim, DirectoryPlace, Location, OrganizationMember, Role

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


def test_claim_request_is_saved_and_emailed(client, monkeypatch):
    sent = []
    monkeypatch.setattr("app.main.send_claim_notification", lambda **kw: sent.append(kw))
    (place_id,) = _seed(_place(1, "Coffee Call", "3132 College Dr"))
    claim = {
        "directory_place_id": place_id,
        "contact_name": "Pat Owner",
        "contact_role": "Owner",
        "contact_email": "Pat@Example.com",
        "contact_phone": "225-555-0100",
        "message": "Our hours are wrong",
    }

    response = client.post("/api/business-claims", json=claim)

    assert response.status_code == 201, response.text
    assert sent == [
        {
            "listed": True,
            "business_name": "Coffee Call",
            "business_address": "3132 College Dr, Baton Rouge, LA",
            "contact_name": "Pat Owner",
            "contact_role": "Owner",
            "contact_email": "pat@example.com",
            "contact_phone": "225-555-0100",
            "message": "Our hours are wrong",
        }
    ]
    db = TestingSessionLocal()
    assert db.query(BusinessClaim).count() == 1
    db.close()


def test_claim_request_requires_contact_info(client, monkeypatch):
    monkeypatch.setattr("app.main.send_claim_notification", lambda **kw: None)
    (place_id,) = _seed(_place(1, "Coffee Call", "3132 College Dr"))

    missing_phone = client.post(
        "/api/business-claims",
        json={"directory_place_id": place_id, "contact_name": "Pat", "contact_email": "pat@example.com"},
    )
    unknown_place = client.post(
        "/api/business-claims",
        json={
            "directory_place_id": place_id + 999,
            "contact_name": "Pat",
            "contact_email": "pat@example.com",
            "contact_phone": "225-555-0100",
        },
    )

    assert missing_phone.status_code == 422
    assert unknown_place.status_code == 404


def test_businesses_five_star_is_in_touch_with_cannot_be_claimed(client, auth_headers, monkeypatch):
    monkeypatch.setattr("app.main.send_feedback_notification", lambda **kw: None)
    monkeypatch.setattr("app.main.send_claim_notification", lambda **kw: None)
    lee, perkins, cafe, deli = _seed(
        _place(1, "Raising Cane's", "202 W Lee Dr", brand="Raising Cane's"),
        _place(2, "Raising Cane's", "7575 Perkins Rd", brand="Raising Cane's"),
        _place(3, "Coffee Call", "3132 College Dr"),
        _place(4, "Tony's Deli", "100 Main St"),
    )
    # Feedback turns places into unclaimed organizations (0 stars, no members).
    for place_id in (lee, cafe, deli):
        client.post(
            "/api/feedback/unlisted",
            json={"business_name": "xx", "location_hint": "xx", "content": "Hi", "directory_place_id": place_id},
        )
    db = TestingSessionLocal()
    org_of = lambda place_id: db.get(Location, db.get(DirectoryPlace, place_id).location_id).organization
    org_of(lee).five_star_status = 1  # five* staff are in touch with the chain
    deli_org_id = org_of(deli).id
    db.commit()
    db.close()
    headers = auth_headers()
    user_id = client.get("/auth/me", headers=headers).json()["id"]
    db = TestingSessionLocal()
    db.add(OrganizationMember(organization_id=deli_org_id, user_id=user_id, role=Role.ADMIN))
    db.commit()
    db.close()

    def claimed(q):
        return {r["id"]: r["claimed"] for r in client.get("/directory/search", params={"q": q}).json()}

    contact = {"contact_name": "Pat", "contact_email": "pat@example.com", "contact_phone": "225-555-0100"}

    assert claimed("canes") == {lee: True, perkins: True}  # 1 star covers the whole chain
    assert claimed("coffee call") == {cafe: False}  # has feedback, still 0 stars
    assert claimed("tonys deli") == {deli: True}  # someone already runs it on five*
    assert client.post("/api/business-claims", json={"directory_place_id": perkins, **contact}).status_code == 409
    assert client.post("/api/business-claims", json={"directory_place_id": cafe, **contact}).status_code == 201


def test_owner_can_ask_to_list_a_business_that_is_not_in_the_directory(client, monkeypatch):
    sent = []
    monkeypatch.setattr("app.main.send_claim_notification", lambda **kw: sent.append(kw))
    contact = {"contact_name": "Sam Roaster", "contact_email": "sam@example.com", "contact_phone": "225-555-0199"}

    no_address = client.post("/api/business-claims", json={"business_name": "Cherry Bomb Coffee", **contact})
    response = client.post(
        "/api/business-claims",
        json={"business_name": "Cherry Bomb Coffee", "business_address": "4200 Government St", **contact},
    )

    assert no_address.status_code == 422
    assert response.status_code == 201, response.text
    assert [(e["listed"], e["business_name"], e["business_address"]) for e in sent] == [
        (False, "Cherry Bomb Coffee", "4200 Government St")
    ]


def test_search_shows_five_star_status_and_filters_by_it(client, monkeypatch):
    monkeypatch.setattr("app.main.send_feedback_notification", lambda **kw: None)
    lee, perkins, cafe = _seed(
        _place(1, "Raising Cane's", "202 W Lee Dr", brand="Raising Cane's"),
        _place(2, "Raising Cane's", "7575 Perkins Rd", brand="Raising Cane's"),
        _place(3, "Cane Syrup Cafe", "3132 College Dr"),
    )
    client.post(
        "/api/feedback/unlisted",
        json={"business_name": "xx", "location_hint": "xx", "content": "Hi", "directory_place_id": lee},
    )
    db = TestingSessionLocal()
    location = db.get(Location, db.get(DirectoryPlace, lee).location_id)
    location.organization.five_star_status = 2
    db.commit()
    db.close()

    def stars(**params):
        return {r["id"]: r["five_star_status"] for r in client.get("/directory/search", params=params).json()}

    assert stars(q="cane") == {lee: 2, perkins: 2, cafe: 0}
    assert stars(q="cane", min_stars=2) == {lee: 2, perkins: 2}
    assert stars(q="cane", min_stars=3) == {}
    assert set(stars(min_stars=1)) == {lee, perkins}  # no query: every rated business
    orgs = client.get("/organizations/search", params={"q": "cane", "min_stars": 2}).json()
    assert [(o["name"], o["five_star_status"]) for o in orgs] == [("Raising Cane's", 2)]


def test_map_dots_businesses_in_view_rated_first(client, monkeypatch):
    monkeypatch.setattr("app.main.send_feedback_notification", lambda **kw: None)
    monkeypatch.setattr("app.main.MAP_PIN_LIMIT", 2)
    cafe, rated, bakery, far = _seed(
        _place(1, "Coffee Call", "3132 College Dr"),
        _place(2, "Raising Cane's", "202 W Lee Dr"),
        _place(3, "Ambrosia Bakery", "8546 Siegen Ln"),
        _place(4, "Far Away Diner", "1 Main St", lat=31.5, lon=-92.5),
    )
    client.post(
        "/api/feedback/unlisted",
        json={"business_name": "xx", "location_hint": "xx", "content": "Hi", "directory_place_id": rated},
    )
    db = TestingSessionLocal()
    db.get(Location, db.get(DirectoryPlace, rated).location_id).organization.five_star_status = 3
    db.commit()
    db.close()

    def pins(bbox):
        response = client.get("/directory/map", params={"bbox": bbox})
        assert response.status_code == 200, response.text
        return [(r["id"], r["five_star_status"]) for r in response.json()]

    in_view = pins("-91.2,30.3,-91.0,30.5")
    assert len(in_view) == 2 and in_view[0] == (rated, 3)
    assert {i for i, _ in in_view} <= {cafe, rated, bakery}
    assert pins("-91.2,30.3,-91.0,30.5") == in_view  # same view, same pins
    assert pins("-92.6,31.4,-92.4,31.6") == [(far, 0)]
    assert client.get("/directory/map", params={"bbox": "nope"}).status_code == 422
