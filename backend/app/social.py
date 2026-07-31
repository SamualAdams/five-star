import base64
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Any
from urllib.parse import urlencode

import httpx
from cryptography.fernet import Fernet, InvalidToken

from .config import Settings, get_settings


SUPPORTED_PROVIDERS = ("facebook", "instagram", "tiktok")

PROVIDER_DETAILS = {
    "facebook": {
        "name": "Facebook",
        "description": "Pages and business profiles",
        "publishing_enabled": True,
        "scopes": [
            "pages_show_list",
            "pages_read_engagement",
            "pages_manage_posts",
            "instagram_basic",
            "instagram_content_publish",
        ],
    },
    "instagram": {
        "name": "Instagram",
        "description": "Professional accounts",
        "publishing_enabled": True,
        "scopes": [
            "instagram_business_basic",
            "instagram_business_content_publish",
        ],
    },
    "tiktok": {
        "name": "TikTok",
        "description": "Business and creator accounts",
        "publishing_enabled": False,
        "scopes": ["user.info.basic", "video.publish"],
    },
}


class SocialProviderError(RuntimeError):
    pass


def validate_provider(provider: str) -> str:
    provider = provider.lower()
    if provider not in SUPPORTED_PROVIDERS:
        raise ValueError("Unsupported social provider")
    return provider


def provider_configured(provider: str, settings: Settings | None = None) -> bool:
    settings = settings or get_settings()
    provider = validate_provider(provider)
    if provider == "facebook":
        return bool(settings.meta_client_id and settings.meta_client_secret)
    if provider == "instagram":
        return bool(settings.instagram_client_id and settings.instagram_client_secret)
    if provider == "tiktok":
        return bool(settings.tiktok_client_key and settings.tiktok_client_secret)
    raise ValueError("Unsupported social provider")


def callback_url(provider: str, settings: Settings | None = None) -> str:
    settings = settings or get_settings()
    return f"{settings.api_base_url.rstrip('/')}/oauth/social/{provider}/callback"


def generate_oauth_state() -> str:
    return secrets.token_urlsafe(32)


def hash_oauth_state(raw_state: str) -> str:
    return hashlib.sha256(raw_state.encode("utf-8")).hexdigest()


def build_authorization_url(
    provider: str,
    state: str,
    settings: Settings | None = None,
) -> str:
    settings = settings or get_settings()
    provider = validate_provider(provider)
    redirect_uri = callback_url(provider, settings)
    scopes = PROVIDER_DETAILS[provider]["scopes"]

    if provider == "facebook":
        query = urlencode(
            {
                "client_id": settings.meta_client_id,
                "redirect_uri": redirect_uri,
                "response_type": "code",
                "scope": ",".join(scopes),
                "state": state,
            }
        )
        return f"https://www.facebook.com/dialog/oauth?{query}"

    if provider == "instagram":
        query = urlencode(
            {
                "force_reauth": "true",
                "client_id": settings.instagram_client_id,
                "redirect_uri": redirect_uri,
                "response_type": "code",
                "scope": ",".join(scopes),
                "state": state,
            }
        )
        return f"https://www.instagram.com/oauth/authorize?{query}"

    if provider == "tiktok":
        query = urlencode(
            {
                "client_key": settings.tiktok_client_key,
                "redirect_uri": redirect_uri,
                "response_type": "code",
                "scope": ",".join(scopes),
                "state": state,
            }
        )
        return f"https://www.tiktok.com/v2/auth/authorize/?{query}"

    raise ValueError("Unsupported social provider")


def _response_json(response: httpx.Response, provider: str) -> dict[str, Any]:
    try:
        payload = response.json()
    except ValueError as exc:
        raise SocialProviderError(f"{provider.title()} returned an invalid response") from exc
    if response.is_error:
        error = payload.get("error")
        error_detail = error.get("message") if isinstance(error, dict) else error
        detail = payload.get("error_description") or payload.get("message") or error_detail
        raise SocialProviderError(
            str(detail) if detail else f"{provider.title()} rejected the connection"
        )
    return payload


def exchange_social_code(
    provider: str,
    code: str,
    settings: Settings | None = None,
) -> dict[str, Any]:
    settings = settings or get_settings()
    provider = validate_provider(provider)
    redirect_uri = callback_url(provider, settings)

    with httpx.Client(timeout=20.0) as client:
        if provider == "facebook":
            response = client.get(
                "https://graph.facebook.com/oauth/access_token",
                params={
                    "client_id": settings.meta_client_id,
                    "client_secret": settings.meta_client_secret,
                    "redirect_uri": redirect_uri,
                    "code": code,
                },
            )
        elif provider == "instagram":
            response = client.post(
                "https://api.instagram.com/oauth/access_token",
                data={
                    "client_id": settings.instagram_client_id,
                    "client_secret": settings.instagram_client_secret,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri,
                    "code": code,
                },
            )
            short_lived = _response_json(response, provider)
            short_lived_token = short_lived.get("access_token")
            if not short_lived_token:
                raise SocialProviderError("Instagram did not return an access token")
            response = client.get(
                "https://graph.instagram.com/access_token",
                params={
                    "grant_type": "ig_exchange_token",
                    "client_secret": settings.instagram_client_secret,
                    "access_token": short_lived_token,
                },
            )
            return {**short_lived, **_response_json(response, provider)}
        elif provider == "tiktok":
            response = client.post(
                "https://open.tiktokapis.com/v2/oauth/token/",
                data={
                    "client_key": settings.tiktok_client_key,
                    "client_secret": settings.tiktok_client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        else:
            raise ValueError("Unsupported social provider")
    return _response_json(response, provider)


def fetch_social_identity(provider: str, token_data: dict[str, Any]) -> dict[str, Any]:
    provider = validate_provider(provider)
    access_token = token_data.get("access_token")
    if not access_token:
        raise SocialProviderError(f"{provider.title()} did not return an access token")

    headers = {"Authorization": f"Bearer {access_token}"}
    with httpx.Client(timeout=20.0) as client:
        if provider == "facebook":
            pages = fetch_facebook_pages(access_token, client=client)
            if not pages:
                raise SocialProviderError(
                    "No Facebook Pages are available for this account"
                )
            identity = pages[0]
            return {
                "id": str(identity.get("id", "")),
                "name": identity.get("name") or "Facebook Page",
                "data": {
                    "auth_type": "facebook_login",
                    "page_id": str(identity.get("id", "")),
                    "tasks": identity.get("tasks") or [],
                    "instagram": identity.get("instagram"),
                },
            }
        if provider == "instagram":
            response = client.get(
                "https://graph.instagram.com/me",
                params={
                    "fields": "user_id,username,name,account_type,profile_picture_url",
                    "access_token": access_token,
                },
            )
            identity = _response_json(response, provider)
            username = identity.get("username")
            return {
                "id": str(identity.get("user_id") or identity.get("id") or ""),
                "name": username or identity.get("name") or "Instagram account",
                "data": {
                    "username": username,
                    "account_type": identity.get("account_type"),
                    "profile_picture_url": identity.get("profile_picture_url"),
                },
            }
        if provider == "tiktok":
            response = client.get(
                "https://open.tiktokapis.com/v2/user/info/",
                params={"fields": "open_id,display_name,avatar_url"},
                headers=headers,
            )
            payload = _response_json(response, provider)
            identity = payload.get("data", {}).get("user", {})
            return {
                "id": str(identity.get("open_id") or token_data.get("open_id", "")),
                "name": identity.get("display_name") or "TikTok account",
                "data": {"avatar_url": identity.get("avatar_url")},
            }

        raise ValueError("Unsupported social provider")


def fetch_facebook_pages(
    access_token: str,
    *,
    client: httpx.Client | None = None,
) -> list[dict[str, Any]]:
    """Return Pages available to the user, including linked Instagram accounts.

    Page access tokens are intentionally returned only to server-side callers and
    must never be serialized into API responses or provider_data.
    """

    owns_client = client is None
    graph_client = client or httpx.Client(timeout=20.0)
    try:
        response = graph_client.get(
            "https://graph.facebook.com/me/accounts",
            params={
                "fields": (
                    "id,name,access_token,tasks,"
                    "instagram_business_account"
                    "{id,username,name,profile_picture_url}"
                ),
                "access_token": access_token,
            },
        )
        payload = _response_json(response, "facebook")
    finally:
        if owns_client:
            graph_client.close()

    pages: list[dict[str, Any]] = []
    for raw_page in payload.get("data") or []:
        page_id = raw_page.get("id")
        page_token = raw_page.get("access_token")
        if not page_id or not page_token:
            continue
        raw_instagram = raw_page.get("instagram_business_account")
        instagram = None
        if isinstance(raw_instagram, dict) and raw_instagram.get("id"):
            instagram = {
                "id": str(raw_instagram["id"]),
                "username": raw_instagram.get("username"),
                "name": raw_instagram.get("name"),
                "profile_picture_url": raw_instagram.get("profile_picture_url"),
            }
        pages.append(
            {
                "id": str(page_id),
                "name": raw_page.get("name") or "Facebook Page",
                "access_token": str(page_token),
                "tasks": [str(task) for task in (raw_page.get("tasks") or [])],
                "instagram": instagram,
            }
        )
    return pages


def publish_social_content(
    provider: str,
    *,
    account_id: str,
    access_token: str,
    content: str,
    media_urls: list[str] | None = None,
    provider_data: dict[str, Any] | None = None,
) -> str:
    """Publish one target and return the provider's post identifier.

    Facebook supports text-only posts and a single remotely hosted image in V1.
    Instagram requires one publicly reachable image URL.
    """

    provider = validate_provider(provider)
    media_urls = media_urls or []
    provider_data = provider_data or {}

    with httpx.Client(timeout=30.0) as client:
        if provider == "facebook":
            if media_urls:
                response = client.post(
                    f"https://graph.facebook.com/{account_id}/photos",
                    data={
                        "url": media_urls[0],
                        "caption": content,
                        "access_token": access_token,
                    },
                )
            else:
                response = client.post(
                    f"https://graph.facebook.com/{account_id}/feed",
                    data={"message": content, "access_token": access_token},
                )
            payload = _response_json(response, provider)
            remote_id = payload.get("post_id") or payload.get("id")
        elif provider == "instagram":
            if not media_urls:
                raise SocialProviderError(
                    "Instagram requires a publicly reachable image before publishing"
                )
            graph_host = (
                "graph.facebook.com"
                if provider_data.get("auth_type") == "facebook_login"
                else "graph.instagram.com"
            )
            container_response = client.post(
                f"https://{graph_host}/{account_id}/media",
                data={
                    "image_url": media_urls[0],
                    "caption": content,
                    "access_token": access_token,
                },
            )
            container = _response_json(container_response, provider)
            creation_id = container.get("id")
            if not creation_id:
                raise SocialProviderError(
                    "Instagram did not return a media container"
                )
            publish_response = client.post(
                f"https://{graph_host}/{account_id}/media_publish",
                data={
                    "creation_id": creation_id,
                    "access_token": access_token,
                },
            )
            payload = _response_json(publish_response, provider)
            remote_id = payload.get("id")
        else:
            raise SocialProviderError(
                f"{PROVIDER_DETAILS[provider]['name']} publishing is not enabled yet"
            )

    if not remote_id:
        raise SocialProviderError(
            f"{PROVIDER_DETAILS[provider]['name']} did not return a post identifier"
        )
    return str(remote_id)


def requested_scopes(provider: str, token_data: dict[str, Any]) -> list[str]:
    raw_scopes = token_data.get("scope")
    if isinstance(raw_scopes, str):
        normalized = raw_scopes.replace(",", " ").split()
        return list(dict.fromkeys(normalized))
    if isinstance(raw_scopes, list):
        return [str(scope) for scope in raw_scopes]
    return list(PROVIDER_DETAILS[provider]["scopes"])


def token_expiry(token_data: dict[str, Any]) -> datetime | None:
    raw_seconds = token_data.get("expires_in")
    if raw_seconds is None:
        return None
    try:
        return datetime.utcnow() + timedelta(seconds=max(0, int(raw_seconds)))
    except (TypeError, ValueError):
        return None


def _fernet(settings: Settings | None = None) -> Fernet:
    settings = settings or get_settings()
    secret = settings.oauth_token_encryption_key or settings.jwt_secret_key
    key = base64.urlsafe_b64encode(hashlib.sha256(secret.encode("utf-8")).digest())
    return Fernet(key)


def encrypt_token(token: str, settings: Settings | None = None) -> str:
    return _fernet(settings).encrypt(token.encode("utf-8")).decode("ascii")


def decrypt_token(token: str, settings: Settings | None = None) -> str:
    try:
        return _fernet(settings).decrypt(token.encode("ascii")).decode("utf-8")
    except InvalidToken as exc:
        raise SocialProviderError("Stored social credentials could not be decrypted") from exc


def revoke_social_token(
    provider: str,
    encrypted_access_token: str,
    settings: Settings | None = None,
) -> None:
    provider = validate_provider(provider)
    access_token = decrypt_token(encrypted_access_token, settings)
    try:
        with httpx.Client(timeout=10.0) as client:
            if provider == "facebook":
                client.delete(
                    "https://graph.facebook.com/me/permissions",
                    params={"access_token": access_token},
                )
            elif provider == "tiktok":
                client.post(
                    "https://open.tiktokapis.com/v2/oauth/revoke/",
                    data={"token": access_token},
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                )
    except httpx.HTTPError:
        # Local disconnect must still succeed if the provider is unavailable.
        return
