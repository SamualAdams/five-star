def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_signup_and_login(client):
    signup = client.post("/auth/signup", json={"email": "a@example.com", "password": "Password123!"})
    assert signup.status_code == 201
    assert signup.json()["user"]["email"] == "a@example.com"

    login = client.post("/auth/login", json={"email": "a@example.com", "password": "Password123!"})
    assert login.status_code == 200
    assert login.json()["token"]["access_token"]


def test_signup_duplicate_email(client):
    payload = {"email": "dup@example.com", "password": "Password123!"}
    assert client.post("/auth/signup", json=payload).status_code == 201
    assert client.post("/auth/signup", json=payload).status_code == 409


def test_login_wrong_password(client):
    client.post("/auth/signup", json={"email": "b@example.com", "password": "Password123!"})
    login = client.post("/auth/login", json={"email": "b@example.com", "password": "wrong-password"})
    assert login.status_code == 401


def test_me_requires_token(client):
    assert client.get("/auth/me").status_code == 401


def test_me_returns_current_user(client, auth_headers):
    headers = auth_headers("me@example.com")
    response = client.get("/auth/me", headers=headers)
    assert response.status_code == 200
    assert response.json()["email"] == "me@example.com"


def test_forgot_password_does_not_reveal_missing_email(client):
    response = client.post("/auth/forgot-password", json={"email": "nobody@example.com"})
    assert response.status_code == 204


def test_reset_password_rejects_bad_token(client):
    response = client.post("/auth/reset-password", json={"token": "bogus", "password": "NewPassword1!"})
    assert response.status_code == 400
