import json
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from .ai import generate_digest_content, polish_review
from .config import get_settings
from .database import Base, engine, get_db
from .dependencies import get_current_user, get_user_org_membership, require_org_admin
from .models import Digest, DigestStatus, Feedback, Invite, Organization, OrganizationMember, Role, User
from .schemas import (
    AuthResponse,
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
    MemberOut,
    MemberUpdateRole,
    OrganizationCreate,
    OrganizationOut,
    OrganizationReviewLinksUpdate,
    OrganizationSearchResult,
    OrganizationUpdate,
    ReviewLink,
    ReviewPolishRequest,
    ReviewPolishResponse,
    Token,
    UserCreate,
    UserLogin,
    UserOut,
)
from .security import (
    create_access_token,
    generate_feedback_token,
    generate_invite_token,
    hash_password,
    is_invite_valid,
    verify_password,
)

settings = get_settings()
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

app = FastAPI(title=settings.app_name)

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
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    # Idempotent migration: add review_links column if not present
    with engine.connect() as conn:
        conn.execute(
            __import__("sqlalchemy").text(
                "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS review_links JSONB"
            )
        )
        conn.commit()


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
def signup(payload: UserCreate, db: Session = Depends(get_db)) -> AuthResponse:
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
def login(payload: UserLogin, db: Session = Depends(get_db)) -> AuthResponse:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = Token(access_token=create_access_token(subject=user.email))
    return AuthResponse(token=token, user=UserOut.model_validate(user, from_attributes=True))


@app.get("/auth/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(user, from_attributes=True)


# ---------------------------------------------------------------------------
# Organizations
# ---------------------------------------------------------------------------


@app.post("/organizations", response_model=OrganizationOut, status_code=status.HTTP_201_CREATED)
def create_organization(
    payload: OrganizationCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OrganizationOut:
    org = Organization(name=payload.name, created_by=user.id, feedback_token=generate_feedback_token())
    db.add(org)
    db.flush()

    membership = OrganizationMember(user_id=user.id, organization_id=org.id, role=Role.ADMIN)
    db.add(membership)
    db.commit()
    db.refresh(org)

    return OrganizationOut(
        id=org.id,
        name=org.name,
        created_at=org.created_at,
        created_by=org.created_by,
        role=Role.ADMIN.value,
        feedback_token=org.feedback_token,
        review_links=org.review_links,
    )


@app.get("/organizations", response_model=list[OrganizationOut])
def list_organizations(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[OrganizationOut]:
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

    return [
        OrganizationOut(
            id=m.organization.id,
            name=m.organization.name,
            created_at=m.organization.created_at,
            created_by=m.organization.created_by,
            role=m.role.value,
            feedback_token=m.organization.feedback_token,
            review_links=m.organization.review_links,
        )
        for m in memberships
    ]


@app.get("/organizations/search", response_model=list[OrganizationSearchResult])
def search_organizations(q: str, db: Session = Depends(get_db)) -> list[OrganizationSearchResult]:
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

    return [OrganizationSearchResult(name=org.name, feedback_token=org.feedback_token) for org in orgs]


@app.get("/organizations/{org_id}", response_model=OrganizationOut)
def get_organization(
    org_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OrganizationOut:
    membership = get_user_org_membership(db, user, org_id)
    org = membership.organization
    return OrganizationOut(
        id=org.id,
        name=org.name,
        created_at=org.created_at,
        created_by=org.created_by,
        role=membership.role.value,
        feedback_token=org.feedback_token,
        review_links=org.review_links,
    )


@app.patch("/organizations/{org_id}", response_model=OrganizationOut)
def update_organization(
    org_id: int,
    payload: OrganizationUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OrganizationOut:
    membership = require_org_admin(db, user, org_id)
    org = membership.organization
    org.name = payload.name
    db.commit()
    db.refresh(org)

    return OrganizationOut(
        id=org.id,
        name=org.name,
        created_at=org.created_at,
        created_by=org.created_by,
        role=membership.role.value,
        feedback_token=org.feedback_token,
        review_links=org.review_links,
    )


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

    return OrganizationOut(
        id=org.id,
        name=org.name,
        created_at=org.created_at,
        created_by=org.created_by,
        role=membership.role.value,
        feedback_token=org.feedback_token,
        review_links=org.review_links,
    )


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
# Members
# ---------------------------------------------------------------------------


@app.get("/organizations/{org_id}/members", response_model=list[MemberOut])
def list_members(
    org_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[MemberOut]:
    get_user_org_membership(db, user, org_id)

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

    return [
        MemberOut(user_id=m.user.id, email=m.user.email, role=m.role.value, joined_at=m.joined_at) for m in members
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

    if member.role == Role.ADMIN and payload.role != "admin":
        admin_count = db.scalar(
            select(func.count()).select_from(OrganizationMember).where(
                OrganizationMember.organization_id == org_id, OrganizationMember.role == Role.ADMIN
            )
        )
        if admin_count <= 1:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot remove last admin")

    member.role = Role(payload.role)
    db.commit()
    db.refresh(member)

    return MemberOut(user_id=member.user.id, email=member.user.email, role=member.role.value, joined_at=member.joined_at)


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

    token = generate_invite_token()
    expires_at = datetime.now(timezone.utc) + timedelta(hours=payload.expires_in_hours)

    invite = Invite(
        organization_id=org_id,
        token=token,
        role=Role(payload.role),
        created_by=user.id,
        expires_at=expires_at,
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)

    invite_url = f"{settings.frontend_origin}/invite/{invite.token}"

    return InviteOut(
        id=invite.id,
        token=invite.token,
        role=invite.role.value,
        created_at=invite.created_at,
        expires_at=invite.expires_at,
        used_at=invite.used_at,
        invite_url=invite_url,
    )


@app.get("/organizations/{org_id}/invites", response_model=list[InviteOut])
def list_invites(
    org_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[InviteOut]:
    require_org_admin(db, user, org_id)

    invites = db.scalars(
        select(Invite).where(Invite.organization_id == org_id).order_by(Invite.created_at.desc())
    ).all()

    return [
        InviteOut(
            id=inv.id,
            token=inv.token,
            role=inv.role.value,
            created_at=inv.created_at,
            expires_at=inv.expires_at,
            used_at=inv.used_at,
            invite_url=f"{settings.frontend_origin}/invite/{inv.token}",
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
        role=invite.role.value,
        expires_at=invite.expires_at,
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
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already a member of this organization")

    membership = OrganizationMember(
        user_id=user.id,
        organization_id=invite.organization_id,
        role=invite.role,
    )
    db.add(membership)

    invite.used_at = datetime.now(timezone.utc)
    invite.used_by = user.id

    db.commit()

    return OrganizationOut(
        id=invite.organization.id,
        name=invite.organization.name,
        created_at=invite.organization.created_at,
        created_by=invite.organization.created_by,
        role=membership.role.value,
        feedback_token=invite.organization.feedback_token,
        review_links=invite.organization.review_links,
    )


# ---------------------------------------------------------------------------
# Feedback (Public)
# ---------------------------------------------------------------------------


@app.get("/api/feedback/{feedback_token}", response_model=FeedbackFormInfo)
def get_feedback_form_info(feedback_token: str, db: Session = Depends(get_db)) -> FeedbackFormInfo:
    """Public endpoint - get org info for feedback form"""
    org = db.scalar(select(Organization).where(Organization.feedback_token == feedback_token))
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feedback form not found")
    return FeedbackFormInfo(organization_name=org.name, organization_id=org.id, review_links=org.review_links)


@app.post("/api/feedback/{feedback_token}/submit", response_model=FeedbackSubmitResponse, status_code=status.HTTP_201_CREATED)
def submit_feedback(feedback_token: str, payload: FeedbackSubmit, db: Session = Depends(get_db)) -> FeedbackSubmitResponse:
    """Public endpoint - submit anonymous feedback"""
    org = db.scalar(select(Organization).where(Organization.feedback_token == feedback_token))
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feedback form not found")

    is_anonymous = not payload.submitter_email and not payload.submitter_name

    feedback = Feedback(
        organization_id=org.id,
        content=payload.content,
        submitter_email=payload.submitter_email.lower() if payload.submitter_email else None,
        submitter_name=payload.submitter_name,
        is_anonymous=is_anonymous,
    )
    db.add(feedback)
    db.commit()

    return FeedbackSubmitResponse(success=True, message="Thank you for your feedback!")


@app.post("/api/feedback/{feedback_token}/polish", response_model=ReviewPolishResponse)
def polish_feedback_for_review(
    feedback_token: str,
    payload: ReviewPolishRequest,
    db: Session = Depends(get_db),
) -> ReviewPolishResponse:
    """Public endpoint - AI-polish feedback text into a public review draft."""
    org = db.scalar(select(Organization).where(Organization.feedback_token == feedback_token))
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feedback form not found")

    if not settings.openai_api_key:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="AI not configured")

    try:
        draft = polish_review(api_key=settings.openai_api_key, content=payload.content, style=payload.style)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"AI generation failed: {exc}")

    return ReviewPolishResponse(draft=draft)


@app.get("/organizations/{org_id}/feedback", response_model=list[FeedbackOut])
def list_organization_feedback(
    org_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[FeedbackOut]:
    """Admin-only endpoint to list feedback (not exposed in UI yet)"""
    require_org_admin(db, user, org_id)
    feedback_list = db.scalars(
        select(Feedback).where(Feedback.organization_id == org_id).order_by(Feedback.created_at.desc())
    ).all()
    return [FeedbackOut.model_validate(f, from_attributes=True) for f in feedback_list]


# ---------------------------------------------------------------------------
# Feedback Stats (for digest chart)
# ---------------------------------------------------------------------------


@app.get("/organizations/{org_id}/feedback/stats", response_model=FeedbackStatsOut)
def get_feedback_stats(
    org_id: int,
    days: int = Query(default=7, ge=1, le=365),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FeedbackStatsOut:
    """Return daily feedback submission counts over the past N days (zero-filled)."""
    get_user_org_membership(db, user, org_id)

    since = datetime.now(timezone.utc) - timedelta(days=days)

    rows = db.execute(
        select(
            func.date(Feedback.created_at).label("day"),
            func.count(Feedback.id).label("cnt"),
        )
        .where(Feedback.organization_id == org_id)
        .where(Feedback.created_at >= since)
        .group_by(func.date(Feedback.created_at))
        .order_by(func.date(Feedback.created_at))
    ).all()

    # Build a zero-filled lookup
    counts: dict[str, int] = {str(row.day): row.cnt for row in rows}

    today = date.today()
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
    """Admin triggers AI generation of a digest for a date range."""
    membership = require_org_admin(db, user, org_id)
    org = membership.organization

    if not settings.openai_api_key:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="AI generation not configured")

    if payload.period_start > payload.period_end:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="period_start must be on or before period_end")

    # Fetch feedback in the date range (inclusive)
    feedback_rows = db.scalars(
        select(Feedback)
        .where(Feedback.organization_id == org_id)
        .where(func.date(Feedback.created_at) >= payload.period_start)
        .where(func.date(Feedback.created_at) <= payload.period_end)
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
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[DigestOut]:
    """Admins see all digests; non-admins see only published ones."""
    membership = get_user_org_membership(db, user, org_id)
    is_admin = membership.role == Role.ADMIN

    query = select(Digest).where(Digest.organization_id == org_id)
    if not is_admin:
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
    """Get a single digest. Non-admins can only see published ones."""
    membership = get_user_org_membership(db, user, org_id)
    is_admin = membership.role == Role.ADMIN

    digest = db.scalar(
        select(Digest).where(Digest.id == digest_id, Digest.organization_id == org_id)
    )
    if not digest:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Digest not found")

    if not is_admin and digest.status != DigestStatus.PUBLISHED:
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
    require_org_admin(db, user, org_id)

    digest = db.scalar(
        select(Digest).where(Digest.id == digest_id, Digest.organization_id == org_id)
    )
    if not digest:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Digest not found")

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
    require_org_admin(db, user, org_id)

    digest = db.scalar(
        select(Digest).where(Digest.id == digest_id, Digest.organization_id == org_id)
    )
    if not digest:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Digest not found")

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
    require_org_admin(db, user, org_id)

    digest = db.scalar(
        select(Digest).where(Digest.id == digest_id, Digest.organization_id == org_id)
    )
    if not digest:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Digest not found")

    db.delete(digest)
    db.commit()


@app.get("/{full_path:path}", include_in_schema=False)
def serve_frontend(full_path: str) -> FileResponse:
    if not FRONTEND_DIST_DIR.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Frontend assets not available")

    if any(full_path == prefix or full_path.startswith(f"{prefix}/") for prefix in RESERVED_PATH_PREFIXES):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    asset_path = (FRONTEND_DIST_DIR / full_path).resolve()
    if full_path and FRONTEND_DIST_DIR in asset_path.parents and asset_path.is_file():
        return FileResponse(asset_path)

    index_file = FRONTEND_DIST_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Frontend assets not available")
