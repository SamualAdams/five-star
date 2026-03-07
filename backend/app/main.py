from datetime import datetime, timedelta, timezone

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from .config import get_settings
from .database import Base, engine, get_db
from .dependencies import get_current_user, get_user_org_membership, require_org_admin
from .models import Invite, Organization, OrganizationMember, Role, User
from .schemas import (
    AuthResponse,
    InviteAccept,
    InviteCreate,
    InviteInfo,
    InviteOut,
    MemberOut,
    MemberUpdateRole,
    OrganizationCreate,
    OrganizationOut,
    OrganizationUpdate,
    Token,
    UserCreate,
    UserLogin,
    UserOut,
)
from .security import (
    create_access_token,
    generate_invite_token,
    hash_password,
    is_invite_valid,
    verify_password,
)

settings = get_settings()

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)


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
    org = Organization(name=payload.name, created_by=user.id)
    db.add(org)
    db.flush()

    membership = OrganizationMember(user_id=user.id, organization_id=org.id, role=Role.ADMIN)
    db.add(membership)
    db.commit()
    db.refresh(org)

    return OrganizationOut(
        id=org.id, name=org.name, created_at=org.created_at, created_by=org.created_by, role=Role.ADMIN.value
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
        )
        for m in memberships
    ]


@app.get("/organizations/{org_id}", response_model=OrganizationOut)
def get_organization(
    org_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OrganizationOut:
    membership = get_user_org_membership(db, user, org_id)
    org = membership.organization
    return OrganizationOut(
        id=org.id, name=org.name, created_at=org.created_at, created_by=org.created_by, role=membership.role.value
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
        id=org.id, name=org.name, created_at=org.created_at, created_by=org.created_by, role=membership.role.value
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
    )
