from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import get_db
from .models import Location, LocationMembership, LocationRole, OrganizationMember, Role, User
from .security import decode_token

security = HTTPBearer(auto_error=False)


def get_current_user(
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> User:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")

    subject = decode_token(credentials.credentials)
    if not subject:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = db.scalar(select(User).where(User.email == subject))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return user


def get_user_org_membership(db: Session, user: User, org_id: int) -> OrganizationMember:
    membership = db.scalar(
        select(OrganizationMember).where(
            OrganizationMember.user_id == user.id,
            OrganizationMember.organization_id == org_id,
        )
    )
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found or access denied",
        )
    return membership


def require_org_admin(db: Session, user: User, org_id: int) -> OrganizationMember:
    membership = get_user_org_membership(db, user, org_id)
    if membership.role != Role.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")
    return membership


def get_accessible_locations(
    db: Session,
    user: User,
    org_id: int,
) -> tuple[OrganizationMember, list[Location]]:
    membership = get_user_org_membership(db, user, org_id)
    query = select(Location).where(Location.organization_id == org_id).order_by(Location.is_default.desc(), Location.name)
    if membership.role == Role.LOCATION:
        query = (
            query.join(LocationMembership, LocationMembership.location_id == Location.id)
            .where(LocationMembership.user_id == user.id)
        )
    return membership, list(db.scalars(query).all())


def require_location_access(
    db: Session,
    user: User,
    org_id: int,
    location_id: int,
    *,
    manage: bool = False,
) -> tuple[OrganizationMember, Location, LocationRole | None]:
    membership = get_user_org_membership(db, user, org_id)
    location = db.scalar(
        select(Location).where(
            Location.id == location_id,
            Location.organization_id == org_id,
        )
    )
    if not location:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found or access denied")

    if membership.role == Role.ADMIN:
        return membership, location, None

    if membership.role == Role.VIEWER:
        if manage:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Location admin role required")
        return membership, location, None

    location_membership = db.scalar(
        select(LocationMembership).where(
            LocationMembership.user_id == user.id,
            LocationMembership.organization_id == org_id,
            LocationMembership.location_id == location_id,
        )
    )
    if not location_membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found or access denied")
    if manage and location_membership.role != LocationRole.MANAGER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Location manager role required")
    return membership, location, location_membership.role


def resolve_location_scope(
    db: Session,
    user: User,
    org_id: int,
    location_id: int | None,
    *,
    manage: bool = False,
    require_single: bool = False,
) -> tuple[OrganizationMember, list[Location]]:
    if location_id is not None:
        membership, location, _ = require_location_access(
            db,
            user,
            org_id,
            location_id,
            manage=manage,
        )
        return membership, [location]

    membership, locations = get_accessible_locations(db, user, org_id)
    if not locations:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No accessible locations")
    if manage and membership.role == Role.VIEWER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Location admin role required")
    if manage and membership.role == Role.LOCATION:
        manager_ids = set(
            db.scalars(
                select(LocationMembership.location_id).where(
                    LocationMembership.user_id == user.id,
                    LocationMembership.organization_id == org_id,
                    LocationMembership.role == LocationRole.MANAGER,
                )
            ).all()
        )
        locations = [location for location in locations if location.id in manager_ids]
        if not locations:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Location manager role required")
    if require_single and len(locations) != 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Choose a location")
    return membership, locations
