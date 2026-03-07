#!/usr/bin/env python3
import json
import os
import sys
import time
import urllib.error
import urllib.request


API_BASE_URL = os.environ.get("API_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
EMAIL = f"smoke_{int(time.time())}@example.com"
PASSWORD = "Password123!"


def request_json(path: str, method: str = "GET", payload: dict | None = None, token: str | None = None) -> tuple[int, dict]:
    body = None
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")

    req = urllib.request.Request(f"{API_BASE_URL}{path}", data=body, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")

    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            raw = response.read().decode("utf-8") or "{}"
            try:
                parsed = json.loads(raw) if raw else {}
            except json.JSONDecodeError:
                parsed = {"raw": raw}
            return response.getcode(), parsed
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8") or "{}"
        try:
            parsed = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            parsed = {"raw": raw}
        return exc.code, parsed


def assert_status(actual: int, expected: int, context: str, payload: dict) -> None:
    if actual != expected:
        print(f"[FAIL] {context}: expected {expected}, got {actual}. payload={payload}", file=sys.stderr)
        sys.exit(1)


def main() -> None:
    status, health = request_json("/health")
    assert_status(status, 200, "health", health)
    if health.get("status") != "ok":
        print(f"[FAIL] health response unexpected: {health}", file=sys.stderr)
        sys.exit(1)

    signup_status, signup_payload = request_json(
        "/auth/signup",
        method="POST",
        payload={"email": EMAIL, "password": PASSWORD},
    )
    assert_status(signup_status, 201, "signup", signup_payload)

    signup_token = signup_payload.get("token", {}).get("access_token")
    signup_user_email = signup_payload.get("user", {}).get("email")
    if not signup_token or signup_user_email != EMAIL:
        print(f"[FAIL] signup payload unexpected: {signup_payload}", file=sys.stderr)
        sys.exit(1)

    login_status, login_payload = request_json(
        "/auth/login",
        method="POST",
        payload={"email": EMAIL, "password": PASSWORD},
    )
    assert_status(login_status, 200, "login", login_payload)
    login_token = login_payload.get("token", {}).get("access_token")
    if not login_token:
        print(f"[FAIL] login payload missing token: {login_payload}", file=sys.stderr)
        sys.exit(1)

    me_status, me_payload = request_json("/auth/me", token=login_token)
    assert_status(me_status, 200, "me", me_payload)
    if me_payload.get("email") != EMAIL:
        print(f"[FAIL] me payload unexpected: {me_payload}", file=sys.stderr)
        sys.exit(1)

    print("[PASS] Happy-path auth smoke test passed.")


if __name__ == "__main__":
    main()
