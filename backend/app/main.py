import asyncio
import json
import secrets
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from urllib.parse import urlencode
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx
from fastapi import Depends, FastAPI, File, Header, HTTPException, Query, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse, Response
from pydantic import ValidationError
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from sqlalchemy import case, delete, func, or_, select, update
from sqlalchemy.orm import Session, joinedload

from .ai import generate_digest_content, generate_social_drafts, generate_wordsmith_options, polish_review
from .config import get_settings
from .database import Base, SessionLocal, engine, get_db
from .dependencies import (
    get_accessible_locations,
    get_current_user,
    get_user_org_membership,
    require_location_access,
    require_module_enabled,
    require_org_admin,
    resolve_location_scope,
)
from .models import (
    Digest,
    DigestStatus,
    Feedback,
    Initiative,
    InitiativeStatus,
    InitiativeVote,
    Invite,
    Location,
    LocationMembership,
    LocationRole,
    MediaAsset,
    Organization,
    OrganizationMember,
    PasswordResetToken,
    Role,
    SocialConnection,
    SocialConnectionSetup,
    SocialOAuthState,
    SocialPost,
    SocialPostReaction,
    SocialPostTarget,
    User,
)
from .schemas import (
    AuthResponse,
    BoardOut,
    DigestContent,
    DigestGenerate,
    DigestOut,
    DigestUpdate,
    FeedbackFormInfo,
    FeedbackOut,
    FeedbackStatPoint,
    FeedbackStatsOut,
    FeedbackSubmit,
    FeedbackSubmitResponse,
    InviteAccept,
    InviteCreate,
    InviteInfo,
    InviteOut,
    InitiativeCreate,
    InitiativeOut,
    InitiativeUpdate,
    InitiativeVoteUpdate,
    LocationAssignment,
    LocationCreate,
    LocationDeleteRequest,
    LocationDeletionImpact,
    LocationFiveStarStatusUpdate,
    LocationOut,
    LocationReviewLinksUpdate,
    LocationUpdate,
    MemberOut,
    MemberLocationAssignmentsUpdate,
    MemberUpdateRole,
    MediaAssetOut,
    MetaConnectionComplete,
    MetaConnectionOptionsOut,
    MetaInstagramAccountOut,
    MetaPageOptionOut,
    OrganizationCreate,
    OrganizationFiveStarStatusUpdate,
    OrganizationFeedbackFormInfo,
    OrganizationModulesOut,
    OrganizationModulesUpdate,
    OrganizationOut,
    OrganizationReviewLinksUpdate,
    OrganizationSearchResult,
    OrganizationUpdate,
    PublicLocationOut,
    PublicOrganizationHubOut,
    PublicInitiativeOut,
    PublicSocialPostOut,
    ReviewLink,
    ReviewPolishRequest,
    ReviewPolishResponse,
    SocialAuthorizationOut,
    SocialConnectionOut,
    SocialDraftContent,
    SocialDraftGenerate,
    SocialPostCreate,
    SocialPostOut,
    SocialPostReactionUpdate,
    SocialPostTargetOut,
    SocialPostUpdate,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    Token,
    UserCreate,
    UserLogin,
    UserOut,
    WordsmithRequest,
    WordsmithResponse,
)
from .email import send_password_reset_email
from .ratelimit import limiter
from .security import (
    create_access_token,
    generate_feedback_token,
    generate_invite_token,
    generate_reset_token,
    hash_password,
    hash_reset_token,
    is_invite_valid,
    verify_password,
)
from .social import (
    PROVIDER_DETAILS,
    SUPPORTED_PROVIDERS,
    SocialProviderError,
    build_authorization_url,
    decrypt_token,
    encrypt_token,
    exchange_social_code,
    fetch_facebook_pages,
    fetch_social_identity,
    generate_oauth_state,
    hash_oauth_state,
    provider_configured,
    publish_social_content,
    requested_scopes,
    revoke_social_token,
    token_expiry,
    validate_provider,
)

settings = get_settings()

if settings.sentry_dsn:
    import sentry_sdk

    sentry_sdk.init(dsn=settings.sentry_dsn, traces_sample_rate=0.1)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_DIST_DIR = PROJECT_ROOT / "frontend" / "dist"
RESERVED_PATH_PREFIXES = (
    "api",
    "auth",
    "organizations",
    "invites",
    "health",
    "ready",
    "docs",
    "redoc",
    "openapi.json",
)


def _location_timezone(location: Location) -> ZoneInfo:
    try:
        return ZoneInfo(location.timezone)
    except ZoneInfoNotFoundError:
        return ZoneInfo("UTC")


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


app = FastAPI(title=settings.app_name)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_origin,
        settings.frontend_origin.replace("localhost", "127.0.0.1"),
        settings.frontend_origin.replace("127.0.0.1", "localhost"),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup() -> None:
    # Schema is managed by Alembic migrations (run before app starts).
    if settings.social_scheduler_enabled:
        app.state.social_scheduler_task = asyncio.create_task(
            _social_scheduler_loop()
        )


@app.on_event("shutdown")
async def on_shutdown() -> None:
    task = getattr(app.state, "social_scheduler_task", None)
    if task:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/ready")
def ready(db: Session = Depends(get_db)) -> dict[str, str]:
    try:
        db.execute(select(1))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database not ready") from exc
    return {"status": "ready"}


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


@app.post("/auth/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
def signup(request: Request, payload: UserCreate, db: Session = Depends(get_db)) -> AuthResponse:
    existing_user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if existing_user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")

    user = User(email=payload.email.lower(), password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)

    token = Token(access_token=create_access_token(subject=user.email))
    return AuthResponse(token=token, user=UserOut.model_validate(user, from_attributes=True))


@app.post("/auth/login", response_model=AuthResponse)
@limiter.limit("20/minute")
def login(request: Request, payload: UserLogin, db: Session = Depends(get_db)) -> AuthResponse:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = Token(access_token=create_access_token(subject=user.email))
    return AuthResponse(token=token, user=UserOut.model_validate(user, from_attributes=True))


@app.get("/auth/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(user, from_attributes=True)


@app.post("/auth/forgot-password", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("5/minute")
def forgot_password(request: Request, payload: ForgotPasswordRequest, db: Session = Depends(get_db)) -> None:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user:
        return  # don't reveal whether the email exists

    raw_token = generate_reset_token()
    reset_record = PasswordResetToken(
        user_id=user.id,
        token_hash=hash_reset_token(raw_token),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )
    db.add(reset_record)
    db.commit()

    reset_url = f"{settings.app_base_url}/reset-password?token={raw_token}"
    send_password_reset_email(user.email, reset_url)


@app.post("/auth/reset-password", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("10/minute")
def reset_password(request: Request, payload: ResetPasswordRequest, db: Session = Depends(get_db)) -> None:
    token_hash = hash_reset_token(payload.token)
    record = db.scalar(select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash))

    now = datetime.now(timezone.utc)
    if (
        not record
        or record.used_at is not None
        or record.expires_at.replace(tzinfo=timezone.utc) < now
    ):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset link")

    record.user.password_hash = hash_password(payload.password)
    record.used_at = now
    db.commit()


# ---------------------------------------------------------------------------
# Organizations
# ---------------------------------------------------------------------------


def _access_role_from_membership(
    membership: OrganizationMember,
    location_roles: list[LocationRole] | None = None,
) -> str:
    """Return the unambiguous access level shown in the product UI."""
    if membership.role == Role.ADMIN:
        return "organization_admin"
    if membership.role == Role.VIEWER:
        return "organization_viewer"
    if LocationRole.MANAGER in (location_roles or []):
        return "location_admin"
    return "location_viewer"


def _organization_out(db: Session, membership: OrganizationMember) -> OrganizationOut:
    org = membership.organization
    location_roles: list[LocationRole] = []
    if membership.role == Role.LOCATION:
        location_roles = list(
            db.scalars(
                select(LocationMembership.role).where(
                    LocationMembership.user_id == membership.user_id,
                    LocationMembership.organization_id == membership.organization_id,
                )
            ).all()
        )
    return OrganizationOut(
        id=org.id,
        name=org.name,
        created_at=org.created_at,
        created_by=org.created_by,
        role=_access_role_from_membership(membership, location_roles),
        feedback_token=org.feedback_token,
        review_links=org.review_links,
        can_view_all_locations=membership.role in {Role.ADMIN, Role.VIEWER},
        can_manage_organization=membership.role == Role.ADMIN,
        modules=OrganizationModulesOut(
            feedback=True,
            roadmap=org.roadmap_enabled,
            feed=org.feed_enabled,
        ),
        five_star_status=org.five_star_status,
    )


@app.post("/organizations", response_model=OrganizationOut, status_code=status.HTTP_201_CREATED)
def create_organization(
    payload: OrganizationCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OrganizationOut:
    org = Organization(
        name=payload.name,
        created_by=user.id,
        feedback_token=generate_feedback_token(),
        roadmap_enabled=False,
        feed_enabled=False,
    )
    db.add(org)
    db.flush()

    membership = None if user.is_superuser else OrganizationMember(
        user_id=user.id,
        organization_id=org.id,
        role=Role.ADMIN,
    )
    default_location = Location(
        organization_id=org.id,
        name=org.name,
        is_default=True,
        feedback_token=org.feedback_token,
        created_by=user.id,
    )
    db.add(default_location)
    if membership:
        db.add(membership)
    db.commit()
    db.refresh(org)

    return _organization_out(db, membership or get_user_org_membership(db, user, org.id))


@app.get("/organizations", response_model=list[OrganizationOut])
def list_organizations(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[OrganizationOut]:
    if user.is_superuser:
        organizations = list(db.scalars(select(Organization).order_by(Organization.name)).all())
        return [
            _organization_out(db, get_user_org_membership(db, user, organization.id))
            for organization in organizations
        ]
    memberships = (
        db.execute(
            select(OrganizationMember)
            .where(OrganizationMember.user_id == user.id)
            .options(joinedload(OrganizationMember.organization))
        )
        .scalars()
        .unique()
        .all()
    )

    return [_organization_out(db, membership) for membership in memberships]


@app.get("/organizations/search", response_model=list[OrganizationSearchResult])
@limiter.limit("30/minute")
def search_organizations(request: Request, q: str, db: Session = Depends(get_db)) -> list[OrganizationSearchResult]:
    """Public endpoint - search for organizations by name"""
    if not q or len(q.strip()) < 2:
        return []

    # Case-insensitive partial match search
    search_pattern = f"%{q.strip()}%"
    orgs = db.scalars(
        select(Organization)
        .where(Organization.name.ilike(search_pattern))
        .order_by(Organization.name)
        .limit(20)
    ).all()

    return [
        OrganizationSearchResult(
            name=org.name,
            feedback_token=org.feedback_token,
            landing_enabled=org.feed_enabled or org.roadmap_enabled,
        )
        for org in orgs
    ]


@app.get("/organizations/{org_id}", response_model=OrganizationOut)
def get_organization(
    org_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OrganizationOut:
    membership = get_user_org_membership(db, user, org_id)
    return _organization_out(db, membership)


@app.patch("/organizations/{org_id}", response_model=OrganizationOut)
def update_organization(
    org_id: int,
    payload: OrganizationUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OrganizationOut:
    membership = require_org_admin(db, user, org_id)
    org = membership.organization
    if payload.name is not None:
        org.name = payload.name
    db.commit()
    db.refresh(org)

    return _organization_out(db, membership)


@app.patch("/organizations/{org_id}/modules", response_model=OrganizationOut)
def update_organization_modules(
    org_id: int,
    payload: OrganizationModulesUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OrganizationOut:
    if not user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform superuser access required",
        )
    membership = require_org_admin(db, user, org_id)
    organization = membership.organization
    if payload.roadmap is not None:
        organization.roadmap_enabled = payload.roadmap
    if payload.feed is not None:
        organization.feed_enabled = payload.feed
    db.commit()
    db.refresh(organization)
    return _organization_out(db, membership)


@app.patch("/organizations/{org_id}/five-star-status", response_model=OrganizationOut)
def update_organization_five_star_status(
    org_id: int,
    payload: OrganizationFiveStarStatusUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OrganizationOut:
    if not user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform superuser access required",
        )
    membership = require_org_admin(db, user, org_id)
    membership.organization.five_star_status = payload.status
    db.commit()
    db.refresh(membership.organization)
    return _organization_out(db, membership)


@app.patch("/organizations/{org_id}/review-links", response_model=OrganizationOut)
def update_review_links(
    org_id: int,
    payload: OrganizationReviewLinksUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OrganizationOut:
    membership = require_org_admin(db, user, org_id)
    org = membership.organization
    org.review_links = [link.model_dump() for link in payload.review_links]
    db.commit()
    db.refresh(org)

    return _organization_out(db, membership)


@app.delete("/organizations/{org_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_organization(
    org_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    membership = require_org_admin(db, user, org_id)
    db.delete(membership.organization)
    db.commit()


# ---------------------------------------------------------------------------
# Organization social connections
# ---------------------------------------------------------------------------


def _validated_social_provider(provider: str) -> str:
    try:
        return validate_provider(provider)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Social provider not found",
        ) from exc


def _social_connection_out(
    provider: str,
    connection: SocialConnection | None,
    *,
    inherited: bool = False,
) -> SocialConnectionOut:
    details = PROVIDER_DETAILS[provider]
    connection_status = connection.status if connection else "not_connected"
    provider_data = connection.provider_data or {} if connection else {}
    diagnostic = None
    if connection and connection.expires_at and connection.expires_at <= datetime.utcnow():
        connection_status = "reconnect_required"
        diagnostic = "The saved authorization expired. Reconnect this destination."
    if (
        provider == "facebook"
        and connection
        and provider_data.get("auth_type") != "facebook_login"
    ):
        connection_status = "reconnect_required"
        diagnostic = (
            "Reconnect Facebook to choose the Page this organization should publish to."
        )
    if provider == "instagram" and not connection:
        diagnostic = (
            "Use Instagram Connect to add an account directly. Or use Facebook Connect "
            "to add a Page and, if one is linked, its professional Instagram account."
        )
    return SocialConnectionOut(
        provider=provider,
        name=details["name"],
        description=details["description"],
        configured=provider_configured(provider, settings),
        connected=connection is not None,
        publishing_enabled=bool(details["publishing_enabled"]),
        status=connection_status,
        provider_account_id=connection.provider_account_id if connection else None,
        provider_account_name=connection.provider_account_name if connection else None,
        scopes=connection.scopes or [] if connection else [],
        expires_at=connection.expires_at if connection else None,
        connected_at=connection.created_at if connection else None,
        connection_method=provider_data.get("auth_type"),
        linked_page_name=provider_data.get("facebook_page_name"),
        diagnostic=diagnostic,
        location_id=connection.location_id if connection else None,
        inherited=inherited,
    )


def _effective_social_connections(
    db: Session,
    organization_id: int,
    location_id: int | None,
) -> tuple[dict[str, SocialConnection], set[str]]:
    query = select(SocialConnection).where(
        SocialConnection.organization_id == organization_id
    )
    if location_id is None:
        query = query.where(SocialConnection.location_id.is_(None))
    else:
        query = query.where(
            or_(
                SocialConnection.location_id.is_(None),
                SocialConnection.location_id == location_id,
            )
        )
    defaults: dict[str, SocialConnection] = {}
    overrides: dict[str, SocialConnection] = {}
    for connection in db.scalars(query).all():
        if connection.location_id is None:
            defaults[connection.provider] = connection
        else:
            overrides[connection.provider] = connection
    if location_id is None:
        return defaults, set()
    return {**defaults, **overrides}, set(defaults).difference(overrides)


def _upsert_social_connection(
    db: Session,
    *,
    organization_id: int,
    location_id: int | None,
    provider: str,
    connected_by: int,
    access_token: str,
    provider_account_id: str,
    provider_account_name: str,
    provider_data: dict | None,
    scopes: list[str],
    expires_at: datetime | None = None,
    refresh_token: str | None = None,
) -> SocialConnection:
    connection = db.scalar(
        select(SocialConnection).where(
            SocialConnection.organization_id == organization_id,
            SocialConnection.provider == provider,
            SocialConnection.location_id.is_(None)
            if location_id is None
            else SocialConnection.location_id == location_id,
        )
    )
    if not connection:
        connection = SocialConnection(
            organization_id=organization_id,
            location_id=location_id,
            provider=provider,
            access_token_encrypted=encrypt_token(access_token, settings),
            connected_by=connected_by,
        )
        db.add(connection)
    else:
        connection.access_token_encrypted = encrypt_token(access_token, settings)
        connection.connected_by = connected_by

    connection.refresh_token_encrypted = (
        encrypt_token(refresh_token, settings) if refresh_token else None
    )
    connection.status = "connected"
    connection.provider_account_id = provider_account_id or None
    connection.provider_account_name = provider_account_name or None
    connection.provider_data = provider_data or {}
    connection.scopes = scopes
    connection.expires_at = expires_at
    connection.updated_at = datetime.utcnow()
    return connection


@app.get(
    "/organizations/{org_id}/social-connections",
    response_model=list[SocialConnectionOut],
)
def list_social_connections(
    org_id: int,
    location_id: int | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[SocialConnectionOut]:
    require_org_admin(db, user, org_id)
    require_module_enabled(db, org_id, "feed")
    if location_id is not None:
        require_location_access(db, user, org_id, location_id, manage=True)
    connections, inherited_providers = _effective_social_connections(
        db,
        org_id,
        location_id,
    )
    return [
        _social_connection_out(
            provider,
            connections.get(provider),
            inherited=provider in inherited_providers,
        )
        for provider in SUPPORTED_PROVIDERS
    ]


@app.post(
    "/organizations/{org_id}/social-connections/{provider}/authorize",
    response_model=SocialAuthorizationOut,
)
def authorize_social_connection(
    org_id: int,
    provider: str,
    location_id: int | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SocialAuthorizationOut:
    provider = _validated_social_provider(provider)
    require_org_admin(db, user, org_id)
    require_module_enabled(db, org_id, "feed")
    if location_id is not None:
        require_location_access(db, user, org_id, location_id, manage=True)
    if not provider_configured(provider, settings):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"{PROVIDER_DETAILS[provider]['name']} app credentials are not configured",
        )

    raw_state = generate_oauth_state()
    now = datetime.utcnow()
    db.add(
        SocialOAuthState(
            state_hash=hash_oauth_state(raw_state),
            organization_id=org_id,
            location_id=location_id,
            provider=provider,
            user_id=user.id,
            created_at=now,
            expires_at=now + timedelta(minutes=10),
        )
    )
    db.commit()
    return SocialAuthorizationOut(
        authorization_url=build_authorization_url(provider, raw_state, settings)
    )


def _social_callback_redirect(
    org_id: int,
    provider: str,
    result: str,
    message: str | None = None,
    location_id: int | None = None,
    **extra: str,
) -> RedirectResponse:
    query = {"social": result, "provider": provider}
    if message:
        query["message"] = message
    if location_id is not None:
        query["location_id"] = str(location_id)
    query.update(extra)
    destination = (
        f"{settings.frontend_origin.rstrip('/')}/org/{org_id}/social?{urlencode(query)}"
    )
    return RedirectResponse(destination, status_code=status.HTTP_303_SEE_OTHER)


@app.get("/oauth/social/{provider}/callback")
def social_oauth_callback(
    provider: str,
    state_value: str | None = Query(default=None, alias="state"),
    code: str | None = None,
    granted_scopes: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
    db: Session = Depends(get_db),
) -> RedirectResponse:
    provider = _validated_social_provider(provider)
    if not state_value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing OAuth state",
        )

    oauth_state = db.scalar(
        select(SocialOAuthState).where(
            SocialOAuthState.state_hash == hash_oauth_state(state_value),
            SocialOAuthState.provider == provider,
        )
    )
    now = datetime.utcnow()
    if not oauth_state or oauth_state.used_at or oauth_state.expires_at <= now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OAuth state",
        )

    oauth_state.used_at = now
    db.commit()
    try:
        require_module_enabled(db, oauth_state.organization_id, "feed")
    except HTTPException as exc:
        return _social_callback_redirect(
            oauth_state.organization_id,
            provider,
            "error",
            str(exc.detail),
            location_id=oauth_state.location_id,
        )
    if error or not code:
        return _social_callback_redirect(
            oauth_state.organization_id,
            provider,
            "error",
            error_description or error or "Authorization was cancelled",
            location_id=oauth_state.location_id,
        )

    try:
        token_data = exchange_social_code(provider, code, settings)
        if granted_scopes:
            token_data["scope"] = granted_scopes
        access_token = token_data.get("access_token")
        if not access_token:
            raise SocialProviderError("The provider did not return an access token")
        if provider == "facebook":
            setup_token = generate_oauth_state()
            db.add(
                SocialConnectionSetup(
                    token_hash=hash_oauth_state(setup_token),
                    organization_id=oauth_state.organization_id,
                    location_id=oauth_state.location_id,
                    provider=provider,
                    user_id=oauth_state.user_id,
                    access_token_encrypted=encrypt_token(access_token, settings),
                    scopes=requested_scopes(provider, token_data),
                    created_at=now,
                    expires_at=now + timedelta(minutes=15),
                )
            )
            db.commit()
            return _social_callback_redirect(
                oauth_state.organization_id,
                provider,
                "selection_required",
                location_id=oauth_state.location_id,
                setup=setup_token,
            )
        identity = fetch_social_identity(provider, token_data)
    except (SocialProviderError, httpx.HTTPError) as exc:
        return _social_callback_redirect(
            oauth_state.organization_id,
            provider,
            "error",
            str(exc),
            location_id=oauth_state.location_id,
        )

    refresh_token = token_data.get("refresh_token")
    identity_data = identity.get("data") or {}
    if provider == "instagram":
        identity_data.setdefault("auth_type", "instagram_login")
    _upsert_social_connection(
        db,
        organization_id=oauth_state.organization_id,
        location_id=oauth_state.location_id,
        provider=provider,
        connected_by=oauth_state.user_id,
        access_token=access_token,
        provider_account_id=identity.get("id") or "",
        provider_account_name=identity.get("name") or "",
        provider_data=identity_data,
        scopes=requested_scopes(provider, token_data),
        expires_at=token_expiry(token_data),
        refresh_token=refresh_token,
    )
    db.commit()

    return _social_callback_redirect(
        oauth_state.organization_id,
        provider,
        "connected",
        location_id=oauth_state.location_id,
    )


def _get_social_connection_setup(
    db: Session,
    *,
    organization_id: int,
    user_id: int,
    provider: str,
    setup_token: str,
) -> SocialConnectionSetup:
    setup = db.scalar(
        select(SocialConnectionSetup).where(
            SocialConnectionSetup.token_hash == hash_oauth_state(setup_token),
            SocialConnectionSetup.organization_id == organization_id,
            SocialConnectionSetup.user_id == user_id,
            SocialConnectionSetup.provider == provider,
        )
    )
    now = datetime.utcnow()
    if not setup or setup.used_at or setup.expires_at <= now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This connection setup expired. Start the connection again.",
        )
    return setup


@app.get(
    "/organizations/{org_id}/social-connections/facebook/options",
    response_model=MetaConnectionOptionsOut,
)
def list_facebook_page_options(
    org_id: int,
    setup: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MetaConnectionOptionsOut:
    require_org_admin(db, user, org_id)
    require_module_enabled(db, org_id, "feed")
    connection_setup = _get_social_connection_setup(
        db,
        organization_id=org_id,
        user_id=user.id,
        provider="facebook",
        setup_token=setup,
    )
    try:
        pages = fetch_facebook_pages(
            decrypt_token(connection_setup.access_token_encrypted, settings)
        )
    except (SocialProviderError, httpx.HTTPError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    return MetaConnectionOptionsOut(
        pages=[
            MetaPageOptionOut(
                id=page["id"],
                name=page["name"],
                tasks=page.get("tasks") or [],
                instagram=(
                    MetaInstagramAccountOut(**page["instagram"])
                    if page.get("instagram")
                    else None
                ),
            )
            for page in pages
        ]
    )


@app.post(
    "/organizations/{org_id}/social-connections/facebook/complete",
    response_model=list[SocialConnectionOut],
)
def complete_facebook_page_connection(
    org_id: int,
    payload: MetaConnectionComplete,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[SocialConnectionOut]:
    require_org_admin(db, user, org_id)
    require_module_enabled(db, org_id, "feed")
    connection_setup = _get_social_connection_setup(
        db,
        organization_id=org_id,
        user_id=user.id,
        provider="facebook",
        setup_token=payload.setup_token,
    )
    user_access_token = decrypt_token(
        connection_setup.access_token_encrypted,
        settings,
    )
    try:
        pages = fetch_facebook_pages(user_access_token)
    except (SocialProviderError, httpx.HTTPError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    selected_page = next(
        (page for page in pages if page["id"] == payload.page_id),
        None,
    )
    if not selected_page:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The selected Facebook Page is no longer available to this account.",
        )

    granted_scopes = connection_setup.scopes or list(
        PROVIDER_DETAILS["facebook"]["scopes"]
    )
    page_data = {
        "auth_type": "facebook_login",
        "page_id": selected_page["id"],
        "tasks": selected_page.get("tasks") or [],
        "instagram": selected_page.get("instagram"),
    }
    _upsert_social_connection(
        db,
        organization_id=org_id,
        location_id=connection_setup.location_id,
        provider="facebook",
        connected_by=user.id,
        access_token=selected_page["access_token"],
        refresh_token=user_access_token,
        provider_account_id=selected_page["id"],
        provider_account_name=selected_page["name"],
        provider_data=page_data,
        scopes=granted_scopes,
    )

    instagram = selected_page.get("instagram")
    linked_instagram_connection = db.scalar(
        select(SocialConnection).where(
            SocialConnection.organization_id == org_id,
            SocialConnection.provider == "instagram",
            SocialConnection.location_id.is_(None)
            if connection_setup.location_id is None
            else SocialConnection.location_id == connection_setup.location_id,
        )
    )
    if instagram:
        _upsert_social_connection(
            db,
            organization_id=org_id,
            location_id=connection_setup.location_id,
            provider="instagram",
            connected_by=user.id,
            access_token=selected_page["access_token"],
            provider_account_id=instagram["id"],
            provider_account_name=(
                instagram.get("username")
                or instagram.get("name")
                or "Instagram account"
            ),
            provider_data={
                "auth_type": "facebook_login",
                "facebook_page_id": selected_page["id"],
                "facebook_page_name": selected_page["name"],
                "username": instagram.get("username"),
                "profile_picture_url": instagram.get("profile_picture_url"),
            },
            scopes=granted_scopes,
        )
    elif (
        linked_instagram_connection
        and (linked_instagram_connection.provider_data or {}).get("auth_type")
        == "facebook_login"
    ):
        db.delete(linked_instagram_connection)

    connection_setup.used_at = datetime.utcnow()
    db.commit()

    connections, inherited_providers = _effective_social_connections(
        db,
        org_id,
        connection_setup.location_id,
    )
    return [
        _social_connection_out(
            provider,
            connections.get(provider),
            inherited=provider in inherited_providers,
        )
        for provider in SUPPORTED_PROVIDERS
    ]


@app.delete(
    "/organizations/{org_id}/social-connections/{provider}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def disconnect_social_connection(
    org_id: int,
    provider: str,
    location_id: int | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    provider = _validated_social_provider(provider)
    require_org_admin(db, user, org_id)
    require_module_enabled(db, org_id, "feed")
    if location_id is not None:
        require_location_access(db, user, org_id, location_id, manage=True)
    connection = db.scalar(
        select(SocialConnection).where(
            SocialConnection.organization_id == org_id,
            SocialConnection.provider == provider,
            SocialConnection.location_id.is_(None)
            if location_id is None
            else SocialConnection.location_id == location_id,
        )
    )
    if not connection:
        return
    token_to_revoke = (
        connection.refresh_token_encrypted
        if provider == "facebook" and connection.refresh_token_encrypted
        else connection.access_token_encrypted
    )
    revoke_social_token(provider, token_to_revoke, settings)
    if provider == "facebook":
        linked_instagram = db.scalar(
            select(SocialConnection).where(
                SocialConnection.organization_id == org_id,
                SocialConnection.provider == "instagram",
                SocialConnection.location_id.is_(None)
                if location_id is None
                else SocialConnection.location_id == location_id,
            )
        )
        if (
            linked_instagram
            and (linked_instagram.provider_data or {}).get("auth_type")
            == "facebook_login"
        ):
            db.delete(linked_instagram)
    db.delete(connection)
    db.commit()


def _social_post_out(post: SocialPost) -> SocialPostOut:
    return SocialPostOut(
        id=post.id,
        organization_id=post.organization_id,
        location_id=post.location_id,
        location_name=post.location.name if post.location else None,
        master_caption=post.master_caption,
        media_urls=post.media_urls or [],
        status=post.status,
        scheduled_at=post.scheduled_at,
        published_at=post.published_at,
        created_by=post.created_by,
        created_at=post.created_at,
        updated_at=post.updated_at,
        targets=[
            SocialPostTargetOut(
                id=target.id,
                provider=target.provider,
                content=target.content,
                status=target.status,
                remote_post_id=target.remote_post_id,
                error=target.error,
                published_at=target.published_at,
            )
            for target in post.targets
        ],
    )


def _load_social_post(
    db: Session,
    *,
    organization_id: int,
    post_id: int,
) -> SocialPost:
    post = (
        db.execute(
            select(SocialPost)
            .options(joinedload(SocialPost.targets))
            .where(
                SocialPost.id == post_id,
                SocialPost.organization_id == organization_id,
            )
        )
        .unique()
        .scalar_one_or_none()
    )
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Social post not found",
        )
    return post


MAX_MEDIA_UPLOAD_BYTES = 8 * 1024 * 1024


def _image_content_type(data: bytes) -> str | None:
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


@app.post(
    "/organizations/{org_id}/media",
    response_model=MediaAssetOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_organization_media(
    org_id: int,
    request: Request,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MediaAssetOut:
    require_org_admin(db, user, org_id)
    require_module_enabled(db, org_id, "feed")
    data = await file.read(MAX_MEDIA_UPLOAD_BYTES + 1)
    if not data:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Choose an image to upload")
    if len(data) > MAX_MEDIA_UPLOAD_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Images must be 8 MB or smaller")
    content_type = _image_content_type(data)
    if not content_type:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Upload a JPEG, PNG, or WebP image",
        )

    original_filename = Path(file.filename or "image").name[:255]
    safe_filename = "".join(
        character
        for character in original_filename
        if character.isascii() and (character.isalnum() or character in "._-")
    ) or "image"
    asset = MediaAsset(
        organization_id=org_id,
        token=secrets.token_urlsafe(32),
        filename=safe_filename,
        content_type=content_type,
        byte_size=len(data),
        data=data,
        uploaded_by=user.id,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return MediaAssetOut(
        url=str(request.url_for("get_media_asset", media_token=asset.token)),
        filename=asset.filename,
        content_type=asset.content_type,
        byte_size=asset.byte_size,
    )


@app.get("/api/media/{media_token}", name="get_media_asset")
def get_media_asset(media_token: str, db: Session = Depends(get_db)) -> Response:
    asset = db.scalar(select(MediaAsset).where(MediaAsset.token == media_token))
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")
    return Response(
        content=asset.data,
        media_type=asset.content_type,
        headers={
            "Cache-Control": "public, max-age=31536000, immutable",
            "Content-Disposition": f'inline; filename="{asset.filename}"',
        },
    )


@app.post(
    "/organizations/{org_id}/social-posts/drafts/generate",
    response_model=SocialDraftContent,
)
def generate_social_post_drafts(
    org_id: int,
    payload: SocialDraftGenerate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SocialDraftContent:
    require_org_admin(db, user, org_id)
    require_module_enabled(db, org_id, "feed")
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI generation is not configured",
        )
    try:
        return generate_social_drafts(
            api_key=settings.openai_api_key,
            content=payload.master_caption,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI generation failed: {exc}",
        ) from exc


@app.post(
    "/organizations/{org_id}/social-posts/wordsmith",
    response_model=WordsmithResponse,
)
def wordsmith_social_post_text(
    org_id: int,
    payload: WordsmithRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WordsmithResponse:
    require_org_admin(db, user, org_id)
    require_module_enabled(db, org_id, "feed")
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI wordsmithing is not configured",
        )
    try:
        return generate_wordsmith_options(
            api_key=settings.openai_api_key,
            content=payload.text,
            style=payload.style,
            scope=payload.scope,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI wordsmithing failed: {exc}",
        ) from exc


def _publish_social_post(db: Session, post: SocialPost) -> SocialPost:
    if post.status == "published":
        return post

    if not post.targets:
        post.status = "published"
        post.published_at = datetime.utcnow()
        db.commit()
        db.refresh(post)
        return post

    connections, _ = _effective_social_connections(
        db,
        post.organization_id,
        post.location_id,
    )
    post.status = "publishing"
    db.commit()

    for target in post.targets:
        if target.status == "published":
            continue
        target.status = "publishing"
        target.error = None
        db.commit()

        connection = connections.get(target.provider)
        try:
            if not connection:
                raise SocialProviderError(
                    f"{PROVIDER_DETAILS[target.provider]['name']} is not connected"
                )
            if connection.expires_at and connection.expires_at <= datetime.utcnow():
                raise SocialProviderError(
                    f"{PROVIDER_DETAILS[target.provider]['name']} must be reconnected"
                )
            if not connection.provider_account_id:
                raise SocialProviderError(
                    f"{PROVIDER_DETAILS[target.provider]['name']} has no publishing account selected"
                )
            if (
                target.provider == "facebook"
                and (connection.provider_data or {}).get("auth_type")
                != "facebook_login"
            ):
                raise SocialProviderError(
                    "Reconnect Facebook and choose a Page before publishing"
                )

            remote_id = publish_social_content(
                target.provider,
                account_id=connection.provider_account_id,
                access_token=decrypt_token(
                    connection.access_token_encrypted,
                    settings,
                ),
                content=target.content,
                media_urls=post.media_urls or [],
                provider_data=connection.provider_data or {},
            )
        except (SocialProviderError, httpx.HTTPError) as exc:
            target.status = "failed"
            target.error = str(exc)
            target.remote_post_id = None
            target.published_at = None
        else:
            target.status = "published"
            target.error = None
            target.remote_post_id = remote_id
            target.published_at = datetime.utcnow()
        db.commit()

    target_statuses = {target.status for target in post.targets}
    now = datetime.utcnow()
    if target_statuses == {"published"}:
        post.status = "published"
    else:
        # The Five* feed is the primary destination and is independent of the
        # optional social copies. A provider failure must never hide the Five*
        # post that the user just published.
        post.status = "partial_failure"
    post.published_at = now
    db.commit()
    db.refresh(post)
    return post


@app.get(
    "/organizations/{org_id}/social-posts",
    response_model=list[SocialPostOut],
)
def list_social_posts(
    org_id: int,
    limit: int = Query(default=25, ge=1, le=100),
    location_id: int | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[SocialPostOut]:
    require_org_admin(db, user, org_id)
    require_module_enabled(db, org_id, "feed")
    query = (
        select(SocialPost)
        .options(joinedload(SocialPost.targets), joinedload(SocialPost.location))
        .where(SocialPost.organization_id == org_id)
    )
    if location_id is not None:
        require_location_access(db, user, org_id, location_id)
        query = query.where(SocialPost.location_id == location_id)
    posts = (
        db.execute(
            query.order_by(SocialPost.created_at.desc()).limit(limit)
        )
        .unique()
        .scalars()
        .all()
    )
    return [_social_post_out(post) for post in posts]


@app.post(
    "/organizations/{org_id}/social-posts",
    response_model=SocialPostOut,
    status_code=status.HTTP_201_CREATED,
)
def create_social_post(
    org_id: int,
    payload: SocialPostCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SocialPostOut:
    require_org_admin(db, user, org_id)
    require_module_enabled(db, org_id, "feed")
    if payload.location_id is not None:
        require_location_access(db, user, org_id, payload.location_id, manage=True)
    providers = [target.provider for target in payload.targets]
    if len(providers) != len(set(providers)):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Choose each social destination only once",
        )
    unsupported = [
        PROVIDER_DETAILS[provider]["name"]
        for provider in providers
        if not PROVIDER_DETAILS[provider]["publishing_enabled"]
    ]
    if unsupported:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Publishing is not enabled yet for: "
                f"{', '.join(unsupported)}"
            ),
        )
    if any(
        not media_url.startswith(("https://", "http://"))
        for media_url in payload.media_urls
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Media must use a publicly reachable HTTP or HTTPS URL",
        )
    if "instagram" in providers and not payload.media_urls:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Instagram requires an uploaded image before publishing",
        )

    connections, _ = _effective_social_connections(db, org_id, payload.location_id)
    unavailable = [
        PROVIDER_DETAILS[provider]["name"]
        for provider in providers
        if provider not in connections
    ]
    if unavailable:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Connect these destinations first: {', '.join(unavailable)}",
        )

    scheduled_at = None
    post_status = "draft"
    if payload.scheduled_at:
        scheduled_at = _as_utc(payload.scheduled_at).replace(tzinfo=None)
        if scheduled_at <= datetime.utcnow():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Scheduled time must be in the future",
            )
        post_status = "scheduled"

    post = SocialPost(
        organization_id=org_id,
        location_id=payload.location_id,
        master_caption=payload.master_caption,
        media_urls=payload.media_urls or None,
        status=post_status,
        scheduled_at=scheduled_at,
        created_by=user.id,
        targets=[
            SocialPostTarget(
                provider=target.provider,
                content=target.content,
                status="pending",
            )
            for target in payload.targets
        ],
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return _social_post_out(post)


@app.patch(
    "/organizations/{org_id}/social-posts/{post_id}",
    response_model=SocialPostOut,
)
def update_social_post(
    org_id: int,
    post_id: int,
    payload: SocialPostUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SocialPostOut:
    require_org_admin(db, user, org_id)
    require_module_enabled(db, org_id, "feed")
    post = _load_social_post(db, organization_id=org_id, post_id=post_id)
    if post.status == "publishing":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This post is currently publishing and cannot be edited",
        )
    caption = payload.master_caption.strip()
    if not caption:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Post caption cannot be empty",
        )
    post.master_caption = caption
    db.commit()
    db.refresh(post)
    return _social_post_out(post)


@app.delete(
    "/organizations/{org_id}/social-posts/{post_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_social_post(
    org_id: int,
    post_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    require_org_admin(db, user, org_id)
    require_module_enabled(db, org_id, "feed")
    post = _load_social_post(db, organization_id=org_id, post_id=post_id)
    if post.status == "publishing":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This post is currently publishing and cannot be deleted",
        )
    db.delete(post)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.post(
    "/organizations/{org_id}/social-posts/{post_id}/publish",
    response_model=SocialPostOut,
)
def publish_social_post_now(
    org_id: int,
    post_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SocialPostOut:
    require_org_admin(db, user, org_id)
    require_module_enabled(db, org_id, "feed")
    post = _load_social_post(
        db,
        organization_id=org_id,
        post_id=post_id,
    )
    if post.status == "publishing":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This post is already publishing",
        )
    return _social_post_out(_publish_social_post(db, post))


def _publish_due_social_posts_once() -> None:
    with SessionLocal() as db:
        due_post_ids = list(
            db.scalars(
                select(SocialPost.id).where(
                    SocialPost.status == "scheduled",
                    SocialPost.scheduled_at.is_not(None),
                    SocialPost.scheduled_at <= datetime.utcnow(),
                    SocialPost.organization_id.in_(
                        select(Organization.id).where(Organization.feed_enabled.is_(True))
                    ),
                )
            ).all()
        )
        for post_id in due_post_ids:
            post = (
                db.execute(
                    select(SocialPost)
                    .options(joinedload(SocialPost.targets))
                    .where(SocialPost.id == post_id)
                )
                .unique()
                .scalar_one_or_none()
            )
            if post and post.status == "scheduled":
                _publish_social_post(db, post)


async def _social_scheduler_loop() -> None:
    interval = max(10, settings.social_scheduler_interval_seconds)
    while True:
        try:
            await asyncio.to_thread(_publish_due_social_posts_once)
        except Exception as exc:  # pragma: no cover - production resilience
            if settings.sentry_dsn:
                import sentry_sdk

                sentry_sdk.capture_exception(exc)
        await asyncio.sleep(interval)


# ---------------------------------------------------------------------------
# Locations
# ---------------------------------------------------------------------------


def _location_out(
    location: Location,
    *,
    membership: OrganizationMember,
    location_role: LocationRole | None = None,
) -> LocationOut:
    is_org_admin = membership.role == Role.ADMIN
    return LocationOut(
        id=location.id,
        organization_id=location.organization_id,
        name=location.name,
        address=location.address,
        timezone=location.timezone,
        is_default=location.is_default,
        feedback_token=location.feedback_token,
        review_links=(
            location.review_links
            if location.review_links is not None
            else location.organization.review_links
        ),
        review_links_override=location.review_links,
        access_role=_access_role_from_membership(
            membership,
            [location_role] if location_role else None,
        ),
        can_manage=is_org_admin or location_role == LocationRole.MANAGER,
        five_star_status=(
            location.five_star_status_override
            if location.five_star_status_override is not None
            else location.organization.five_star_status
        ),
        five_star_status_override=location.five_star_status_override,
        created_at=location.created_at,
    )


@app.get("/organizations/{org_id}/locations", response_model=list[LocationOut])
def list_locations(
    org_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[LocationOut]:
    membership, locations = get_accessible_locations(db, user, org_id)
    location_roles: dict[int, LocationRole] = {}
    if membership.role == Role.LOCATION:
        location_roles = {
            row.location_id: row.role
            for row in db.scalars(
                select(LocationMembership).where(
                    LocationMembership.user_id == user.id,
                    LocationMembership.organization_id == org_id,
                )
            ).all()
        }
    return [
        _location_out(location, membership=membership, location_role=location_roles.get(location.id))
        for location in locations
    ]


@app.post("/organizations/{org_id}/locations", response_model=LocationOut, status_code=status.HTTP_201_CREATED)
def create_location(
    org_id: int,
    payload: LocationCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LocationOut:
    membership = require_org_admin(db, user, org_id)
    location = Location(
        organization_id=org_id,
        name=payload.name.strip(),
        address=payload.address.strip() if payload.address else None,
        timezone=payload.timezone.strip(),
        feedback_token=generate_feedback_token(),
        is_default=False,
        created_by=user.id,
    )
    db.add(location)
    db.commit()
    db.refresh(location)
    return _location_out(location, membership=membership)


@app.patch("/organizations/{org_id}/locations/{location_id}", response_model=LocationOut)
def update_location(
    org_id: int,
    location_id: int,
    payload: LocationUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LocationOut:
    membership = require_org_admin(db, user, org_id)
    location = db.scalar(
        select(Location).where(Location.id == location_id, Location.organization_id == org_id)
    )
    if not location:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")
    if payload.name is not None:
        location.name = payload.name.strip()
    if payload.address is not None:
        location.address = payload.address.strip() or None
    if payload.timezone is not None:
        location.timezone = payload.timezone.strip()
    db.commit()
    db.refresh(location)
    return _location_out(location, membership=membership)


@app.patch(
    "/organizations/{org_id}/locations/{location_id}/five-star-status",
    response_model=LocationOut,
)
def update_location_five_star_status(
    org_id: int,
    location_id: int,
    payload: LocationFiveStarStatusUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LocationOut:
    if not user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform superuser access required",
        )
    membership = require_org_admin(db, user, org_id)
    location = db.scalar(
        select(Location).where(Location.id == location_id, Location.organization_id == org_id)
    )
    if not location:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")
    location.five_star_status_override = payload.status
    db.commit()
    db.refresh(location)
    return _location_out(location, membership=membership)


@app.patch("/organizations/{org_id}/locations/{location_id}/review-links", response_model=LocationOut)
def update_location_review_links(
    org_id: int,
    location_id: int,
    payload: LocationReviewLinksUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LocationOut:
    membership, location, location_role = require_location_access(
        db,
        user,
        org_id,
        location_id,
        manage=True,
    )
    location.review_links = (
        [link.model_dump() for link in payload.review_links]
        if payload.review_links is not None
        else None
    )
    db.commit()
    db.refresh(location)
    return _location_out(location, membership=membership, location_role=location_role)


@app.delete("/organizations/{org_id}/locations/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_location(
    org_id: int,
    location_id: int,
    payload: LocationDeleteRequest | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    require_org_admin(db, user, org_id)
    location = db.scalar(
        select(Location).where(Location.id == location_id, Location.organization_id == org_id)
    )
    if not location:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")
    if location.is_default:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="The default location cannot be deleted")

    impact = _location_deletion_impact(db, location_id)
    movable_count = impact.feedback + impact.roadmap_items + impact.feed_posts + impact.reports
    if movable_count:
        if not payload or not payload.destination:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Choose where to move this location's content before deleting it",
            )

        destination_location_id: int | None = None
        if payload.destination == "location":
            if payload.destination_location_id is None or payload.destination_location_id == location_id:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Choose another location")
            destination = db.scalar(
                select(Location).where(
                    Location.id == payload.destination_location_id,
                    Location.organization_id == org_id,
                )
            )
            if not destination:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Destination location not found")
            destination_location_id = destination.id
        elif impact.reports and not payload.delete_reports:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Reports cannot be organization-wide. Move them to another location or confirm their deletion.",
            )

        for model in (Feedback, Initiative, SocialPost):
            db.execute(
                update(model)
                .where(model.location_id == location_id)
                .values(location_id=destination_location_id)
            )
        if destination_location_id is not None:
            db.execute(
                update(Digest)
                .where(Digest.location_id == location_id)
                .values(location_id=destination_location_id)
            )
        elif impact.reports:
            db.execute(delete(Digest).where(Digest.location_id == location_id))

    db.delete(location)
    db.commit()


def _location_deletion_impact(db: Session, location_id: int) -> LocationDeletionImpact:
    def count(model) -> int:
        return int(
            db.scalar(select(func.count()).select_from(model).where(model.location_id == location_id))
            or 0
        )

    return LocationDeletionImpact(
        feedback=count(Feedback),
        roadmap_items=count(Initiative),
        feed_posts=count(SocialPost),
        reports=count(Digest),
        social_connections=count(SocialConnection),
        team_assignments=count(LocationMembership),
        pending_invites=int(
            db.scalar(
                select(func.count())
                .select_from(Invite)
                .where(
                    Invite.location_id == location_id,
                    Invite.used_at.is_(None),
                )
            )
            or 0
        ),
    )


@app.get(
    "/organizations/{org_id}/locations/{location_id}/deletion-impact",
    response_model=LocationDeletionImpact,
)
def get_location_deletion_impact(
    org_id: int,
    location_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LocationDeletionImpact:
    require_org_admin(db, user, org_id)
    location = db.scalar(
        select(Location).where(Location.id == location_id, Location.organization_id == org_id)
    )
    if not location:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")
    if location.is_default:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="The default location cannot be deleted")
    return _location_deletion_impact(db, location_id)


# ---------------------------------------------------------------------------
# Members
# ---------------------------------------------------------------------------


@app.get("/organizations/{org_id}/members", response_model=list[MemberOut])
def list_members(
    org_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[MemberOut]:
    require_org_admin(db, user, org_id)

    members = (
        db.execute(
            select(OrganizationMember)
            .where(OrganizationMember.organization_id == org_id)
            .options(joinedload(OrganizationMember.user))
        )
        .scalars()
        .unique()
        .all()
    )

    assignments = db.scalars(
        select(LocationMembership).where(LocationMembership.organization_id == org_id)
    ).all()
    by_user: dict[int, list[LocationAssignment]] = {}
    for assignment in assignments:
        by_user.setdefault(assignment.user_id, []).append(
            LocationAssignment(location_id=assignment.location_id, role=assignment.role.value)
        )
    return [_member_out(member, by_user.get(member.user_id, [])) for member in members]


def _member_out(member: OrganizationMember, assignments: list[LocationAssignment]) -> MemberOut:
    return MemberOut(
        user_id=member.user.id,
        email=member.user.email,
        role=_access_role_from_membership(
            member,
            [LocationRole(assignment.role) for assignment in assignments],
        ),
        joined_at=member.joined_at,
        location_assignments=assignments,
    )


def _access_role_configuration(access_role: str) -> tuple[Role, LocationRole | None]:
    configurations = {
        "organization_admin": (Role.ADMIN, None),
        "organization_viewer": (Role.VIEWER, None),
        "location_admin": (Role.LOCATION, LocationRole.MANAGER),
        "location_viewer": (Role.LOCATION, LocationRole.VIEWER),
    }
    return configurations[access_role]


def _member_assignments(db: Session, member: OrganizationMember) -> list[LocationAssignment]:
    return [
        LocationAssignment(location_id=row.location_id, role=row.role.value)
        for row in db.scalars(
            select(LocationMembership).where(
                LocationMembership.user_id == member.user_id,
                LocationMembership.organization_id == member.organization_id,
            )
        ).all()
    ]


@app.patch("/organizations/{org_id}/members/{user_id}", response_model=MemberOut)
def update_member_role(
    org_id: int,
    user_id: int,
    payload: MemberUpdateRole,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MemberOut:
    require_org_admin(db, user, org_id)

    member = db.scalar(
        select(OrganizationMember)
        .where(OrganizationMember.organization_id == org_id, OrganizationMember.user_id == user_id)
        .options(joinedload(OrganizationMember.user))
    )
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    new_membership_role, new_location_role = _access_role_configuration(payload.role)
    if member.role == Role.ADMIN and new_membership_role != Role.ADMIN:
        admin_count = db.scalar(
            select(func.count()).select_from(OrganizationMember).where(
                OrganizationMember.organization_id == org_id, OrganizationMember.role == Role.ADMIN
            )
        )
        if admin_count <= 1:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot remove last admin")

    member.role = new_membership_role
    if new_membership_role != Role.LOCATION:
        db.query(LocationMembership).filter(
            LocationMembership.user_id == user_id,
            LocationMembership.organization_id == org_id,
        ).delete(synchronize_session=False)
    else:
        current_assignments = db.scalars(
            select(LocationMembership).where(
                LocationMembership.user_id == user_id,
                LocationMembership.organization_id == org_id,
            )
        ).all()
        if current_assignments:
            for assignment in current_assignments:
                assignment.role = new_location_role
        else:
            default_location = db.scalar(
                select(Location).where(
                    Location.organization_id == org_id,
                    Location.is_default.is_(True),
                )
            )
            if default_location:
                db.add(
                    LocationMembership(
                        user_id=user_id,
                        organization_id=org_id,
                        location_id=default_location.id,
                        role=new_location_role,
                    )
                )
    db.commit()
    db.refresh(member)

    return _member_out(member, _member_assignments(db, member))


@app.put("/organizations/{org_id}/members/{user_id}/locations", response_model=MemberOut)
def update_member_location_assignments(
    org_id: int,
    user_id: int,
    payload: MemberLocationAssignmentsUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MemberOut:
    require_org_admin(db, user, org_id)
    member = db.scalar(
        select(OrganizationMember)
        .where(
            OrganizationMember.organization_id == org_id,
            OrganizationMember.user_id == user_id,
        )
        .options(joinedload(OrganizationMember.user))
    )
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    if member.role != Role.LOCATION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only location-level users can be assigned to individual locations",
        )

    location_ids = {assignment.location_id for assignment in payload.assignments}
    valid_location_ids = set(
        db.scalars(
            select(Location.id).where(
                Location.organization_id == org_id,
                Location.id.in_(location_ids) if location_ids else False,
            )
        ).all()
    )
    if valid_location_ids != location_ids:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid location assignment")
    if not payload.assignments:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Assign at least one location")

    expected_location_role = (
        LocationRole.MANAGER
        if _access_role_from_membership(
            member,
            [LocationRole(assignment.role) for assignment in _member_assignments(db, member)],
        ) == "location_admin"
        else LocationRole.VIEWER
    )
    if any(assignment.role != expected_location_role.value for assignment in payload.assignments):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Location assignments must match the user's access level")

    db.query(LocationMembership).filter(
        LocationMembership.user_id == user_id,
        LocationMembership.organization_id == org_id,
    ).delete(synchronize_session=False)
    for assignment in payload.assignments:
        db.add(
            LocationMembership(
                user_id=user_id,
                organization_id=org_id,
                location_id=assignment.location_id,
                role=expected_location_role,
            )
        )
    db.commit()
    return _member_out(member, payload.assignments)


@app.delete("/organizations/{org_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    org_id: int,
    user_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    membership = get_user_org_membership(db, user, org_id)

    if user_id != user.id and membership.role != Role.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")

    member_to_remove = db.scalar(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == org_id, OrganizationMember.user_id == user_id
        )
    )
    if not member_to_remove:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    if member_to_remove.role == Role.ADMIN:
        admin_count = db.scalar(
            select(func.count()).select_from(OrganizationMember).where(
                OrganizationMember.organization_id == org_id, OrganizationMember.role == Role.ADMIN
            )
        )
        if admin_count <= 1:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot remove last admin")

    db.delete(member_to_remove)
    db.commit()


# ---------------------------------------------------------------------------
# Invites
# ---------------------------------------------------------------------------


@app.post("/organizations/{org_id}/invites", response_model=InviteOut, status_code=status.HTTP_201_CREATED)
def create_invite(
    org_id: int,
    payload: InviteCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InviteOut:
    require_org_admin(db, user, org_id)

    invite_membership_role, invite_location_role = _access_role_configuration(payload.role)
    invite_location = None
    if invite_membership_role == Role.LOCATION:
        if payload.location_id is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Choose a location for a location-level invite")
        invite_location = db.scalar(
            select(Location).where(
                Location.id == payload.location_id,
                Location.organization_id == org_id,
            )
        )
        if not invite_location:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Choose a valid location")
    elif payload.location_id is not None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Organization-level invites cannot be scoped to one location")

    token = generate_invite_token()
    expires_at = datetime.now(timezone.utc) + timedelta(hours=payload.expires_in_hours)

    invite = Invite(
        organization_id=org_id,
        token=token,
        role=invite_membership_role,
        created_by=user.id,
        expires_at=expires_at,
        location_id=invite_location.id if invite_location else None,
        location_role=invite_location_role,
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)

    invite_url = f"{settings.frontend_origin}/invite/{invite.token}"

    return InviteOut(
        id=invite.id,
        token=invite.token,
        role=_access_role_from_membership(
            invite,
            [invite.location_role] if invite.location_role else None,
        ),
        created_at=invite.created_at,
        expires_at=invite.expires_at,
        used_at=invite.used_at,
        invite_url=invite_url,
        location_id=invite.location_id,
        location_name=invite_location.name if invite_location else None,
        location_role=invite.location_role.value if invite.location_role else None,
    )


@app.get("/organizations/{org_id}/invites", response_model=list[InviteOut])
def list_invites(
    org_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[InviteOut]:
    require_org_admin(db, user, org_id)

    invites = db.scalars(
        select(Invite)
        .where(Invite.organization_id == org_id)
        .options(joinedload(Invite.location))
        .order_by(Invite.created_at.desc())
    ).all()

    return [
        InviteOut(
            id=inv.id,
            token=inv.token,
            role=_access_role_from_membership(
                inv,
                [inv.location_role] if inv.location_role else None,
            ),
            created_at=inv.created_at,
            expires_at=inv.expires_at,
            used_at=inv.used_at,
            invite_url=f"{settings.frontend_origin}/invite/{inv.token}",
            location_id=inv.location_id,
            location_name=inv.location.name if inv.location else None,
            location_role=inv.location_role.value if inv.location_role else None,
        )
        for inv in invites
    ]


@app.get("/invites/{token}", response_model=InviteInfo)
def get_invite_info(token: str, db: Session = Depends(get_db)) -> InviteInfo:
    invite = db.scalar(
        select(Invite).where(Invite.token == token).options(joinedload(Invite.organization))
    )
    if not invite:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found")

    if not is_invite_valid(invite):
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Invite expired or already used")

    return InviteInfo(
        organization_name=invite.organization.name,
        role=_access_role_from_membership(
            invite,
            [invite.location_role] if invite.location_role else None,
        ),
        expires_at=invite.expires_at,
        location_name=invite.location.name if invite.location else None,
        location_role=invite.location_role.value if invite.location_role else None,
    )


@app.post("/invites/accept", response_model=OrganizationOut)
def accept_invite(
    payload: InviteAccept,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OrganizationOut:
    invite = db.scalar(
        select(Invite).where(Invite.token == payload.token).options(joinedload(Invite.organization))
    )
    if not invite:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found")

    if not is_invite_valid(invite):
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Invite expired or already used")

    existing = db.scalar(
        select(OrganizationMember).where(
            OrganizationMember.user_id == user.id,
            OrganizationMember.organization_id == invite.organization_id,
        )
    )
    if existing and invite.location_id is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already a member of this organization")

    membership = existing
    if not membership:
        membership = OrganizationMember(
            user_id=user.id,
            organization_id=invite.organization_id,
            role=invite.role,
        )
        db.add(membership)
        db.flush()

    if invite.location_id is not None:
        if membership.role != Role.LOCATION:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This user already has organization-wide access")
        existing_location_access = db.scalar(
            select(LocationMembership).where(
                LocationMembership.user_id == user.id,
                LocationMembership.location_id == invite.location_id,
            )
        )
        if existing_location_access:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already assigned to this location")
        db.add(
            LocationMembership(
                user_id=user.id,
                organization_id=invite.organization_id,
                location_id=invite.location_id,
                role=invite.location_role or LocationRole.VIEWER,
            )
        )

    invite.used_at = datetime.now(timezone.utc)
    invite.used_by = user.id

    db.commit()

    return _organization_out(db, membership)


# ---------------------------------------------------------------------------
# Feedback (Public)
# ---------------------------------------------------------------------------


def _get_public_location(db: Session, feedback_token: str) -> Location:
    location = db.scalar(
        select(Location)
        .where(Location.feedback_token == feedback_token)
        .options(joinedload(Location.organization))
    )
    if location:
        return location

    legacy_org = db.scalar(select(Organization).where(Organization.feedback_token == feedback_token))
    if legacy_org:
        location = db.scalar(
            select(Location)
            .where(Location.organization_id == legacy_org.id, Location.is_default.is_(True))
            .options(joinedload(Location.organization))
        )
    if not location:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feedback form not found")
    return location


def _get_public_organization(db: Session, organization_token: str) -> Organization:
    organization = db.scalar(
        select(Organization).where(Organization.feedback_token == organization_token)
    )
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Public page not found")
    return organization


def _require_public_hub(db: Session, organization_token: str) -> Organization:
    organization = _get_public_organization(db, organization_token)
    if not (organization.feed_enabled or organization.roadmap_enabled):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Public page not enabled")
    return organization


def _public_hub_location(db: Session, organization_id: int, location_id: int) -> Location:
    location = db.scalar(
        select(Location).where(
            Location.id == location_id,
            Location.organization_id == organization_id,
        )
    )
    if not location:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")
    return location


@app.get("/api/hubs/{organization_token}", response_model=PublicOrganizationHubOut)
def get_public_organization_hub(
    organization_token: str,
    db: Session = Depends(get_db),
) -> PublicOrganizationHubOut:
    organization = _require_public_hub(db, organization_token)
    locations = db.scalars(
        select(Location)
        .where(Location.organization_id == organization.id)
        .order_by(Location.is_default.desc(), Location.name)
    ).all()
    return PublicOrganizationHubOut(
        organization_name=organization.name,
        organization_token=organization.feedback_token,
        five_star_status=organization.five_star_status,
        modules=OrganizationModulesOut(
            feedback=True,
            roadmap=organization.roadmap_enabled,
            feed=organization.feed_enabled,
        ),
        locations=[
            PublicLocationOut(
                id=location.id,
                name=location.name,
                address=location.address,
                is_default=location.is_default,
                feedback_token=location.feedback_token,
            )
            for location in locations
        ],
    )


@app.get(
    "/api/feedback/organization/{organization_token}",
    response_model=OrganizationFeedbackFormInfo,
)
def get_organization_feedback_form_info(
    organization_token: str,
    db: Session = Depends(get_db),
) -> OrganizationFeedbackFormInfo:
    """Public endpoint for organization-wide feedback and location choice."""
    organization = _get_public_organization(db, organization_token)
    locations = db.scalars(
        select(Location)
        .where(Location.organization_id == organization.id)
        .order_by(Location.is_default.desc(), Location.name)
    ).all()
    return OrganizationFeedbackFormInfo(
        organization_name=organization.name,
        organization_id=organization.id,
        organization_token=organization.feedback_token,
        review_links=organization.review_links,
        locations=[
            PublicLocationOut(
                id=location.id,
                name=location.name,
                address=location.address,
                is_default=location.is_default,
                feedback_token=location.feedback_token,
            )
            for location in locations
        ],
    )


@app.post(
    "/api/feedback/organization/{organization_token}/submit",
    response_model=FeedbackSubmitResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("10/minute")
def submit_organization_feedback(
    request: Request,
    organization_token: str,
    payload: FeedbackSubmit,
    db: Session = Depends(get_db),
) -> FeedbackSubmitResponse:
    """Submit feedback about the organization as a whole."""
    organization = _get_public_organization(db, organization_token)
    feedback = Feedback(
        organization_id=organization.id,
        location_id=None,
        content=payload.content,
        submitter_email=payload.submitter_email.lower() if payload.submitter_email else None,
        submitter_name=payload.submitter_name,
        is_anonymous=not payload.submitter_email and not payload.submitter_name,
    )
    db.add(feedback)
    db.commit()
    return FeedbackSubmitResponse(success=True, message="Thank you for your feedback!")


def _polished_review(payload: ReviewPolishRequest) -> ReviewPolishResponse:
    if not settings.openai_api_key:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="AI not configured")
    try:
        draft = polish_review(api_key=settings.openai_api_key, content=payload.content, style=payload.style)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"AI generation failed: {exc}")
    return ReviewPolishResponse(draft=draft)


@app.post(
    "/api/feedback/organization/{organization_token}/polish",
    response_model=ReviewPolishResponse,
)
@limiter.limit("5/minute")
def polish_organization_feedback_for_review(
    request: Request,
    organization_token: str,
    payload: ReviewPolishRequest,
    db: Session = Depends(get_db),
) -> ReviewPolishResponse:
    """AI-polish organization-wide feedback into a public review draft."""
    _get_public_organization(db, organization_token)
    return _polished_review(payload)


@app.get("/api/feedback/{feedback_token}", response_model=FeedbackFormInfo)
def get_feedback_form_info(feedback_token: str, db: Session = Depends(get_db)) -> FeedbackFormInfo:
    """Public endpoint - get location info for feedback form."""
    location = _get_public_location(db, feedback_token)
    return FeedbackFormInfo(
        organization_name=location.organization.name,
        organization_id=location.organization_id,
        organization_token=location.organization.feedback_token,
        location_name=location.name,
        location_id=location.id,
        review_links=(
            location.review_links
            if location.review_links is not None
            else location.organization.review_links
        ),
    )


@app.post("/api/feedback/{feedback_token}/submit", response_model=FeedbackSubmitResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
def submit_feedback(request: Request, feedback_token: str, payload: FeedbackSubmit, db: Session = Depends(get_db)) -> FeedbackSubmitResponse:
    """Public endpoint - submit anonymous feedback"""
    location = _get_public_location(db, feedback_token)

    is_anonymous = not payload.submitter_email and not payload.submitter_name

    feedback = Feedback(
        organization_id=location.organization_id,
        location_id=location.id,
        content=payload.content,
        submitter_email=payload.submitter_email.lower() if payload.submitter_email else None,
        submitter_name=payload.submitter_name,
        is_anonymous=is_anonymous,
    )
    db.add(feedback)
    db.commit()

    return FeedbackSubmitResponse(success=True, message="Thank you for your feedback!")


@app.post("/api/feedback/{feedback_token}/polish", response_model=ReviewPolishResponse)
@limiter.limit("5/minute")
def polish_feedback_for_review(
    request: Request,
    feedback_token: str,
    payload: ReviewPolishRequest,
    db: Session = Depends(get_db),
) -> ReviewPolishResponse:
    """Public endpoint - AI-polish feedback text into a public review draft."""
    _get_public_location(db, feedback_token)
    return _polished_review(payload)


@app.get("/organizations/{org_id}/feedback", response_model=list[FeedbackOut])
def list_organization_feedback(
    org_id: int,
    location_id: int | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[FeedbackOut]:
    """List feedback across the caller's authorized location scope."""
    membership, locations = resolve_location_scope(db, user, org_id, location_id, manage=True)
    location_ids = [location.id for location in locations]
    location_filter = Feedback.location_id.in_(location_ids)
    if location_id is None and membership.role != Role.LOCATION:
        location_filter = or_(location_filter, Feedback.location_id.is_(None))
    feedback_list = db.scalars(
        select(Feedback)
        .where(
            Feedback.organization_id == org_id,
            location_filter,
        )
        .order_by(Feedback.created_at.desc())
    ).all()
    return [FeedbackOut.model_validate(f, from_attributes=True) for f in feedback_list]


# ---------------------------------------------------------------------------
# Organization voting board
# ---------------------------------------------------------------------------


def _valid_visitor_id(visitor_id: str | None, *, required: bool = False) -> str | None:
    """Validate the browser-scoped identifier used for anonymous votes."""
    normalized = (visitor_id or "").strip()
    if not normalized:
        if required:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing visitor identifier")
        return None
    if (
        len(normalized) < 16
        or len(normalized) > 64
        or any(not (character.isalnum() or character in "-_") for character in normalized)
    ):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid visitor identifier")
    return normalized


def _initiative_rows_query(
    organization_id: int,
    visitor_id: str | None = None,
    location_ids: list[int] | None = None,
):
    vote_totals = (
        select(
            InitiativeVote.initiative_id.label("initiative_id"),
            func.coalesce(func.sum(case((InitiativeVote.value == 1, 1), else_=0)), 0).label("upvotes"),
            func.coalesce(func.sum(case((InitiativeVote.value == -1, 1), else_=0)), 0).label("downvotes"),
        )
        .group_by(InitiativeVote.initiative_id)
        .subquery()
    )
    viewer_vote = (
        select(InitiativeVote.value)
        .where(
            InitiativeVote.initiative_id == Initiative.id,
            InitiativeVote.visitor_id == (visitor_id or ""),
        )
        .scalar_subquery()
    )
    query = (
        select(
            Initiative,
            func.coalesce(vote_totals.c.upvotes, 0).label("upvotes"),
            func.coalesce(vote_totals.c.downvotes, 0).label("downvotes"),
            viewer_vote.label("viewer_vote"),
        )
        .outerjoin(vote_totals, vote_totals.c.initiative_id == Initiative.id)
        .where(Initiative.organization_id == organization_id)
    )
    if location_ids is not None:
        query = query.where(Initiative.location_id.in_(location_ids))
    return query


def _initiative_out(row, *, include_viewer_vote: bool) -> InitiativeOut | PublicInitiativeOut:
    initiative, upvotes, downvotes, viewer_vote = row
    values = {
        "id": initiative.id,
        "organization_id": initiative.organization_id,
        "location_id": initiative.location_id,
        "location_name": initiative.location.name if initiative.location else None,
        "title": initiative.title,
        "description": initiative.description,
        "status": initiative.status.value,
        "created_at": initiative.created_at,
        "updated_at": initiative.updated_at,
        "upvotes": int(upvotes),
        "downvotes": int(downvotes),
        "score": int(upvotes) - int(downvotes),
    }
    if include_viewer_vote:
        values["viewer_vote"] = int(viewer_vote) if viewer_vote is not None else None
        return PublicInitiativeOut(**values)
    return InitiativeOut(**values)


def _get_initiative_or_404(
    db: Session,
    org_id: int,
    initiative_id: int,
    location_ids: list[int] | None = None,
) -> Initiative:
    query = select(Initiative).where(
        Initiative.id == initiative_id,
        Initiative.organization_id == org_id,
    )
    if location_ids is not None:
        query = query.where(Initiative.location_id.in_(location_ids))
    initiative = db.scalar(
        query
    )
    if not initiative:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Initiative not found")
    return initiative


def _clean_initiative_text(value: str, field_name: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"{field_name} cannot be blank")
    return cleaned


@app.get("/organizations/{org_id}/initiatives", response_model=list[InitiativeOut])
def list_organization_initiatives(
    org_id: int,
    location_id: int | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[InitiativeOut]:
    _, locations = resolve_location_scope(db, user, org_id, location_id)
    require_module_enabled(db, org_id, "roadmap")
    location_ids = [location.id for location in locations]
    query = _initiative_rows_query(org_id)
    if location_id is not None:
        query = query.where(Initiative.location_id.in_(location_ids))
    else:
        query = query.where(
            or_(Initiative.location_id.in_(location_ids), Initiative.location_id.is_(None))
        )
    rows = db.execute(
        query.order_by(Initiative.updated_at.desc())
    ).all()
    return [_initiative_out(row, include_viewer_vote=False) for row in rows]


@app.post("/organizations/{org_id}/initiatives", response_model=InitiativeOut, status_code=status.HTTP_201_CREATED)
def create_organization_initiative(
    org_id: int,
    payload: InitiativeCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InitiativeOut:
    require_module_enabled(db, org_id, "roadmap")
    if payload.location_id is None:
        require_org_admin(db, user, org_id)
        location = None
    else:
        _, location, _ = require_location_access(
            db,
            user,
            org_id,
            payload.location_id,
            manage=True,
        )
    initiative = Initiative(
        organization_id=org_id,
        location_id=location.id if location else None,
        title=_clean_initiative_text(payload.title, "Title"),
        description=_clean_initiative_text(payload.description, "Description"),
        status=InitiativeStatus(payload.status),
    )
    db.add(initiative)
    db.commit()
    row = db.execute(
        _initiative_rows_query(org_id).where(Initiative.id == initiative.id)
    ).one()
    return _initiative_out(row, include_viewer_vote=False)


@app.patch("/organizations/{org_id}/initiatives/{initiative_id}", response_model=InitiativeOut)
def update_organization_initiative(
    org_id: int,
    initiative_id: int,
    payload: InitiativeUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InitiativeOut:
    initiative = _get_initiative_or_404(db, org_id, initiative_id)
    if initiative.location_id is None:
        require_org_admin(db, user, org_id)
    else:
        require_location_access(db, user, org_id, initiative.location_id, manage=True)
    require_module_enabled(db, org_id, "roadmap")
    if payload.title is not None:
        initiative.title = _clean_initiative_text(payload.title, "Title")
    if payload.description is not None:
        initiative.description = _clean_initiative_text(payload.description, "Description")
    if payload.status is not None:
        initiative.status = InitiativeStatus(payload.status)
    db.commit()
    row = db.execute(
        _initiative_rows_query(org_id).where(Initiative.id == initiative_id)
    ).one()
    return _initiative_out(row, include_viewer_vote=False)


@app.delete("/organizations/{org_id}/initiatives/{initiative_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_organization_initiative(
    org_id: int,
    initiative_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    initiative = _get_initiative_or_404(db, org_id, initiative_id)
    if initiative.location_id is None:
        require_org_admin(db, user, org_id)
    else:
        require_location_access(db, user, org_id, initiative.location_id, manage=True)
    require_module_enabled(db, org_id, "roadmap")
    db.delete(initiative)
    db.commit()


@app.get("/api/boards/{feedback_token}", response_model=BoardOut)
def get_public_board(
    feedback_token: str,
    q: str = Query(default="", max_length=160),
    status_filter: InitiativeStatus | None = Query(default=None, alias="status"),
    sort: str = Query(default="top", pattern="^(top|new|updated)$"),
    visitor_id: str | None = Header(default=None, alias="X-Visitor-ID"),
    db: Session = Depends(get_db),
) -> BoardOut:
    location = _get_public_location(db, feedback_token)
    org = location.organization
    require_module_enabled(db, org.id, "roadmap", public=True)

    visitor_id = _valid_visitor_id(visitor_id)
    query = _initiative_rows_query(org.id, visitor_id, [location.id])
    trimmed_query = q.strip()
    if trimmed_query:
        search_pattern = f"%{trimmed_query}%"
        query = query.where(
            Initiative.title.ilike(search_pattern) | Initiative.description.ilike(search_pattern)
        )
    if status_filter is not None:
        query = query.where(Initiative.status == status_filter)

    score = func.coalesce(
        select(func.sum(InitiativeVote.value)).where(InitiativeVote.initiative_id == Initiative.id).scalar_subquery(),
        0,
    )
    if sort == "new":
        query = query.order_by(Initiative.created_at.desc())
    elif sort == "updated":
        query = query.order_by(Initiative.updated_at.desc())
    else:
        query = query.order_by(score.desc(), Initiative.updated_at.desc())

    rows = db.execute(query).all()
    return BoardOut(
        organization_name=org.name,
        organization_id=org.id,
        location_name=location.name,
        location_id=location.id,
        initiatives=[_initiative_out(row, include_viewer_vote=True) for row in rows],
    )


@app.put("/api/boards/{feedback_token}/initiatives/{initiative_id}/vote", response_model=PublicInitiativeOut)
@limiter.limit("60/minute")
def update_public_initiative_vote(
    request: Request,
    feedback_token: str,
    initiative_id: int,
    payload: InitiativeVoteUpdate,
    visitor_id: str | None = Header(default=None, alias="X-Visitor-ID"),
    db: Session = Depends(get_db),
) -> PublicInitiativeOut:
    location = _get_public_location(db, feedback_token)
    org = location.organization
    require_module_enabled(db, org.id, "roadmap", public=True)
    visitor_id = _valid_visitor_id(visitor_id, required=True)
    _get_initiative_or_404(db, org.id, initiative_id, [location.id])

    vote = db.scalar(
        select(InitiativeVote).where(
            InitiativeVote.initiative_id == initiative_id,
            InitiativeVote.visitor_id == visitor_id,
        )
    )
    if payload.value is None:
        if vote:
            db.delete(vote)
    elif vote:
        vote.value = payload.value
    else:
        db.add(InitiativeVote(initiative_id=initiative_id, visitor_id=visitor_id, value=payload.value))
    db.commit()

    row = db.execute(
        _initiative_rows_query(org.id, visitor_id, [location.id]).where(Initiative.id == initiative_id)
    ).one()
    return _initiative_out(row, include_viewer_vote=True)


@app.get("/api/hubs/{organization_token}/roadmap", response_model=BoardOut)
def get_public_organization_roadmap(
    organization_token: str,
    q: str = Query(default="", max_length=160),
    status_filter: InitiativeStatus | None = Query(default=None, alias="status"),
    sort: str = Query(default="top", pattern="^(top|new|updated)$"),
    location_id: int | None = Query(default=None),
    visitor_id: str | None = Header(default=None, alias="X-Visitor-ID"),
    db: Session = Depends(get_db),
) -> BoardOut:
    organization = _require_public_hub(db, organization_token)
    require_module_enabled(db, organization.id, "roadmap", public=True)
    selected_location = (
        _public_hub_location(db, organization.id, location_id)
        if location_id is not None
        else None
    )
    visitor_id = _valid_visitor_id(visitor_id)
    query = _initiative_rows_query(
        organization.id,
        visitor_id,
        [selected_location.id] if selected_location else None,
    )
    trimmed_query = q.strip()
    if trimmed_query:
        search_pattern = f"%{trimmed_query}%"
        query = query.where(
            Initiative.title.ilike(search_pattern) | Initiative.description.ilike(search_pattern)
        )
    if status_filter is not None:
        query = query.where(Initiative.status == status_filter)

    score = func.coalesce(
        select(func.sum(InitiativeVote.value))
        .where(InitiativeVote.initiative_id == Initiative.id)
        .scalar_subquery(),
        0,
    )
    if sort == "new":
        query = query.order_by(Initiative.created_at.desc())
    elif sort == "updated":
        query = query.order_by(Initiative.updated_at.desc())
    else:
        query = query.order_by(score.desc(), Initiative.updated_at.desc())

    rows = db.execute(query).all()
    return BoardOut(
        organization_name=organization.name,
        organization_id=organization.id,
        location_name=selected_location.name if selected_location else None,
        location_id=selected_location.id if selected_location else None,
        initiatives=[_initiative_out(row, include_viewer_vote=True) for row in rows],
    )


@app.put(
    "/api/hubs/{organization_token}/roadmap/initiatives/{initiative_id}/vote",
    response_model=PublicInitiativeOut,
)
@limiter.limit("60/minute")
def update_public_organization_initiative_vote(
    request: Request,
    organization_token: str,
    initiative_id: int,
    payload: InitiativeVoteUpdate,
    visitor_id: str | None = Header(default=None, alias="X-Visitor-ID"),
    db: Session = Depends(get_db),
) -> PublicInitiativeOut:
    organization = _require_public_hub(db, organization_token)
    require_module_enabled(db, organization.id, "roadmap", public=True)
    visitor_id = _valid_visitor_id(visitor_id, required=True)
    _get_initiative_or_404(db, organization.id, initiative_id)

    vote = db.scalar(
        select(InitiativeVote).where(
            InitiativeVote.initiative_id == initiative_id,
            InitiativeVote.visitor_id == visitor_id,
        )
    )
    if payload.value is None:
        if vote:
            db.delete(vote)
    elif vote:
        vote.value = payload.value
    else:
        db.add(
            InitiativeVote(
                initiative_id=initiative_id,
                visitor_id=visitor_id,
                value=payload.value,
            )
        )
    db.commit()
    row = db.execute(
        _initiative_rows_query(organization.id, visitor_id)
        .where(Initiative.id == initiative_id)
    ).one()
    return _initiative_out(row, include_viewer_vote=True)


@app.get(
    "/api/hubs/{organization_token}/feed",
    response_model=list[PublicSocialPostOut],
)
def get_public_organization_feed(
    organization_token: str,
    location_id: int | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    visitor_id: str | None = Header(default=None, alias="X-Visitor-ID"),
    db: Session = Depends(get_db),
) -> list[PublicSocialPostOut]:
    organization = _require_public_hub(db, organization_token)
    require_module_enabled(db, organization.id, "feed", public=True)
    visitor_id = _valid_visitor_id(visitor_id)
    selected_location = (
        _public_hub_location(db, organization.id, location_id)
        if location_id is not None
        else None
    )
    query = (
        select(SocialPost)
        .options(joinedload(SocialPost.location))
        .where(
            SocialPost.organization_id == organization.id,
            SocialPost.status.in_(("published", "partial_failure")),
            SocialPost.published_at.is_not(None),
        )
    )
    if selected_location:
        query = query.where(SocialPost.location_id == selected_location.id)
    posts = db.scalars(
        query.order_by(SocialPost.published_at.desc()).limit(limit)
    ).all()
    return [
        _public_social_post_out(db, post, visitor_id)
        for post in posts
    ]


def _public_social_post_out(
    db: Session,
    post: SocialPost,
    visitor_id: str | None,
) -> PublicSocialPostOut:
    reaction_count = int(
        db.scalar(
            select(func.count())
            .select_from(SocialPostReaction)
            .where(SocialPostReaction.post_id == post.id)
        )
        or 0
    )
    viewer_reacted = bool(
        visitor_id
        and db.scalar(
            select(SocialPostReaction.id).where(
                SocialPostReaction.post_id == post.id,
                SocialPostReaction.visitor_id == visitor_id,
            )
        )
    )
    return PublicSocialPostOut(
        id=post.id,
        master_caption=post.master_caption,
        media_urls=post.media_urls or [],
        published_at=post.published_at,
        location_id=post.location_id,
        location_name=post.location.name if post.location else None,
        reaction_count=reaction_count,
        viewer_reacted=viewer_reacted,
    )


@app.put(
    "/api/hubs/{organization_token}/feed/{post_id}/reaction",
    response_model=PublicSocialPostOut,
)
@limiter.limit("60/minute")
def update_public_social_post_reaction(
    request: Request,
    organization_token: str,
    post_id: int,
    payload: SocialPostReactionUpdate,
    visitor_id: str | None = Header(default=None, alias="X-Visitor-ID"),
    db: Session = Depends(get_db),
) -> PublicSocialPostOut:
    organization = _require_public_hub(db, organization_token)
    require_module_enabled(db, organization.id, "feed", public=True)
    visitor_id = _valid_visitor_id(visitor_id, required=True)
    post = db.scalar(
        select(SocialPost)
        .options(joinedload(SocialPost.location))
        .where(
            SocialPost.id == post_id,
            SocialPost.organization_id == organization.id,
            SocialPost.status.in_(("published", "partial_failure")),
            SocialPost.published_at.is_not(None),
        )
    )
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    reaction = db.scalar(
        select(SocialPostReaction).where(
            SocialPostReaction.post_id == post.id,
            SocialPostReaction.visitor_id == visitor_id,
        )
    )
    if payload.active and not reaction:
        db.add(SocialPostReaction(post_id=post.id, visitor_id=visitor_id))
    elif not payload.active and reaction:
        db.delete(reaction)
    db.commit()
    return _public_social_post_out(db, post, visitor_id)


# ---------------------------------------------------------------------------
# Feedback Stats (for digest chart)
# ---------------------------------------------------------------------------


@app.get("/organizations/{org_id}/feedback/stats", response_model=FeedbackStatsOut)
def get_feedback_stats(
    org_id: int,
    days: int = Query(default=7, ge=1, le=365),
    location_id: int | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FeedbackStatsOut:
    """Return daily feedback submission counts over the past N days (zero-filled)."""
    membership, locations = resolve_location_scope(db, user, org_id, location_id)
    location_ids = [location.id for location in locations]
    location_timezones = {
        location.id: _location_timezone(location)
        for location in locations
    }
    display_timezone = _location_timezone(locations[0])
    include_organization_feedback = location_id is None and membership.role != Role.LOCATION
    today = datetime.now(display_timezone).date()
    first_day = today - timedelta(days=days - 1)
    since = min(
        datetime.combine(first_day, time.min, tzinfo=location_timezone)
        .astimezone(timezone.utc)
        .replace(tzinfo=None)
        for location_timezone in location_timezones.values()
    )

    location_filter = Feedback.location_id.in_(location_ids)
    if include_organization_feedback:
        location_filter = or_(location_filter, Feedback.location_id.is_(None))
    rows = db.execute(
        select(Feedback.created_at, Feedback.location_id)
        .where(Feedback.organization_id == org_id)
        .where(location_filter)
        .where(Feedback.created_at >= since)
        .order_by(Feedback.created_at)
    ).all()

    counts: dict[str, int] = {}
    for created_at, row_location_id in rows:
        row_timezone = location_timezones.get(row_location_id, display_timezone)
        local_day = _as_utc(created_at).astimezone(row_timezone).date()
        if first_day <= local_day <= today:
            day_key = local_day.isoformat()
            counts[day_key] = counts.get(day_key, 0) + 1

    result: list[FeedbackStatPoint] = []
    for i in range(days - 1, -1, -1):
        day = today - timedelta(days=i)
        day_str = day.isoformat()
        result.append(FeedbackStatPoint(date=day_str, count=counts.get(day_str, 0)))

    return FeedbackStatsOut(data=result)


# ---------------------------------------------------------------------------
# Digests
# ---------------------------------------------------------------------------


@app.post("/organizations/{org_id}/digests/generate", response_model=DigestOut, status_code=status.HTTP_201_CREATED)
def generate_digest(
    org_id: int,
    payload: DigestGenerate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DigestOut:
    """Admin triggers AI generation of a digest for a date range.

    Omitting location_id generates an organization-wide digest that rolls
    up feedback across every accessible location (plus org-level feedback).
    """
    membership, locations = resolve_location_scope(
        db,
        user,
        org_id,
        payload.location_id,
        manage=True,
    )
    org = membership.organization
    is_org_wide = payload.location_id is None

    if not settings.openai_api_key:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="AI generation not configured")

    if payload.period_start > payload.period_end:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="period_start must be on or before period_end")

    # Use the widest inclusive window across every location's local timezone
    # so no feedback near the boundary is dropped due to timezone offsets.
    location_timezones = [_location_timezone(location) for location in locations]
    period_start_utc = min(
        datetime.combine(payload.period_start, time.min, tzinfo=tz).astimezone(timezone.utc).replace(tzinfo=None)
        for tz in location_timezones
    )
    period_end_utc = max(
        datetime.combine(payload.period_end + timedelta(days=1), time.min, tzinfo=tz).astimezone(timezone.utc).replace(tzinfo=None)
        for tz in location_timezones
    )

    location_ids = [location.id for location in locations]
    location_filter = Feedback.location_id.in_(location_ids)
    if is_org_wide and membership.role != Role.LOCATION:
        location_filter = or_(location_filter, Feedback.location_id.is_(None))

    # Fetch feedback in the location's local date range (inclusive).
    feedback_rows = db.scalars(
        select(Feedback)
        .where(Feedback.organization_id == org_id)
        .where(location_filter)
        .where(Feedback.created_at >= period_start_utc)
        .where(Feedback.created_at < period_end_utc)
        .order_by(Feedback.created_at)
    ).all()

    feedback_items = [f.content for f in feedback_rows]

    try:
        content = generate_digest_content(
            api_key=settings.openai_api_key,
            org_name=org.name,
            period_start=str(payload.period_start),
            period_end=str(payload.period_end),
            feedback_items=feedback_items,
        )
    except (json.JSONDecodeError, ValidationError):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="AI returned a malformed response; please retry")
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"AI generation failed: {exc}")

    digest = Digest(
        organization_id=org_id,
        location_id=None if is_org_wide else locations[0].id,
        status=DigestStatus.DRAFT,
        period_start=payload.period_start,
        period_end=payload.period_end,
        summary=content.summary,
        insights=content.insights,
        immediate_actions=content.immediate_actions,
        long_term_goals=content.long_term_goals,
        feedback_count=len(feedback_items),
        generated_by=user.id,
    )
    db.add(digest)
    db.commit()
    db.refresh(digest)
    return DigestOut.model_validate(digest)


@app.get("/organizations/{org_id}/digests", response_model=list[DigestOut])
def list_digests(
    org_id: int,
    location_id: int | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[DigestOut]:
    """Organization admins and location managers see drafts in the locations they manage."""
    membership, locations = resolve_location_scope(db, user, org_id, location_id)
    is_admin = membership.role == Role.ADMIN
    location_ids = [location.id for location in locations]

    digest_location_filter = Digest.location_id.in_(location_ids)
    if location_id is None and membership.role != Role.LOCATION:
        digest_location_filter = or_(digest_location_filter, Digest.location_id.is_(None))

    query = select(Digest).where(
        Digest.organization_id == org_id,
        digest_location_filter,
    )
    if not is_admin:
        manager_location_ids = list(
            db.scalars(
                select(LocationMembership.location_id).where(
                    LocationMembership.user_id == user.id,
                    LocationMembership.organization_id == org_id,
                    LocationMembership.location_id.in_(location_ids),
                    LocationMembership.role == LocationRole.MANAGER,
                )
            ).all()
        )
        if manager_location_ids:
            query = query.where(
                or_(
                    Digest.status == DigestStatus.PUBLISHED,
                    Digest.location_id.in_(manager_location_ids),
                )
            )
        else:
            query = query.where(Digest.status == DigestStatus.PUBLISHED)
    query = query.order_by(Digest.generated_at.desc())

    digests = db.scalars(query).all()
    return [DigestOut.model_validate(d) for d in digests]


@app.get("/organizations/{org_id}/digests/{digest_id}", response_model=DigestOut)
def get_digest(
    org_id: int,
    digest_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DigestOut:
    """Get a single digest, including drafts for its location managers."""
    membership = get_user_org_membership(db, user, org_id)
    is_admin = membership.role == Role.ADMIN

    digest = db.scalar(
        select(Digest).where(Digest.id == digest_id, Digest.organization_id == org_id)
    )
    if not digest:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Digest not found")

    if digest.location_id is not None:
        _, _, location_role = require_location_access(db, user, org_id, digest.location_id)
        can_view_draft = is_admin or location_role == LocationRole.MANAGER
    else:
        can_view_draft = is_admin

    if not can_view_draft and digest.status != DigestStatus.PUBLISHED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Digest not found")

    return DigestOut.model_validate(digest)


@app.patch("/organizations/{org_id}/digests/{digest_id}", response_model=DigestOut)
def update_digest(
    org_id: int,
    digest_id: int,
    payload: DigestUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DigestOut:
    """Admin can edit a draft digest. Published digests are immutable."""
    digest = db.scalar(
        select(Digest).where(Digest.id == digest_id, Digest.organization_id == org_id)
    )
    if not digest:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Digest not found")
    if digest.location_id is not None:
        require_location_access(db, user, org_id, digest.location_id, manage=True)
    else:
        require_org_admin(db, user, org_id)

    if digest.status == DigestStatus.PUBLISHED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Published digests cannot be edited")

    if payload.summary is not None:
        digest.summary = payload.summary
    if payload.insights is not None:
        digest.insights = payload.insights
    if payload.immediate_actions is not None:
        digest.immediate_actions = payload.immediate_actions
    if payload.long_term_goals is not None:
        digest.long_term_goals = payload.long_term_goals

    db.commit()
    db.refresh(digest)
    return DigestOut.model_validate(digest)


@app.post("/organizations/{org_id}/digests/{digest_id}/publish", response_model=DigestOut)
def publish_digest(
    org_id: int,
    digest_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DigestOut:
    """Admin publishes a draft digest, making it visible to all org members."""
    digest = db.scalar(
        select(Digest).where(Digest.id == digest_id, Digest.organization_id == org_id)
    )
    if not digest:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Digest not found")
    if digest.location_id is not None:
        require_location_access(db, user, org_id, digest.location_id, manage=True)
    else:
        require_org_admin(db, user, org_id)

    if digest.status == DigestStatus.PUBLISHED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Digest is already published")

    digest.status = DigestStatus.PUBLISHED
    digest.published_at = datetime.now(timezone.utc)
    digest.published_by = user.id

    db.commit()
    db.refresh(digest)
    return DigestOut.model_validate(digest)


@app.delete("/organizations/{org_id}/digests/{digest_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_digest(
    org_id: int,
    digest_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Admin deletes a digest (draft or published)."""
    digest = db.scalar(
        select(Digest).where(Digest.id == digest_id, Digest.organization_id == org_id)
    )
    if not digest:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Digest not found")
    if digest.location_id is not None:
        require_location_access(db, user, org_id, digest.location_id, manage=True)
    else:
        require_org_admin(db, user, org_id)

    db.delete(digest)
    db.commit()


@app.get("/{full_path:path}", include_in_schema=False)
def serve_frontend(full_path: str) -> FileResponse:
    if not FRONTEND_DIST_DIR.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Frontend assets not available")

    # `/auth` is the SPA's login/signup screen, while `/auth/*` remains reserved
    # for the backend authentication API.
    if full_path != "auth" and any(
        full_path == prefix or full_path.startswith(f"{prefix}/")
        for prefix in RESERVED_PATH_PREFIXES
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    asset_path = (FRONTEND_DIST_DIR / full_path).resolve()
    if full_path and FRONTEND_DIST_DIR in asset_path.parents and asset_path.is_file():
        return FileResponse(asset_path)

    index_file = FRONTEND_DIST_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Frontend assets not available")
