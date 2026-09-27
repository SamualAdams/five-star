"""Turn directory places into (unclaimed) five* organizations on first feedback.

Customers can leave feedback for any business in the directory. The first time a
place gets feedback, five* creates an Organization + Location for it with no
members and no creator, so the feedback lands in the normal dashboard where five*
staff (superusers) can see it. When the business joins, claiming is just adding
a member to that organization.

Places are grouped into one organization per business:
  - chains by brand ("Raising Cane's" on Lee Dr and on Perkins Rd -> one org)
  - everything else by the same normalized name in the same city and state
"""

from sqlalchemy import and_, exists, func, or_, select
from sqlalchemy.orm import Session

from .models import DirectoryPlace, Location, Organization, OrganizationMember
from .security import generate_feedback_token


def is_claimed(db: Session, organization_id: int) -> bool:
    return bool(db.scalar(select(exists().where(OrganizationMember.organization_id == organization_id))))


# A location's five* status: its own override, else its organization's.
EFFECTIVE_STATUS = func.coalesce(Location.five_star_status_override, Organization.five_star_status)


def place_statuses(db: Session, places: list[DirectoryPlace]) -> dict[int, int]:
    """five* status (0-5) for each place: its own location's, or - for a chain
    location nobody has left feedback for yet - its brand's organization."""
    location_ids = {p.location_id for p in places if p.location_id}
    by_location = dict(
        db.execute(
            select(Location.id, EFFECTIVE_STATUS)
            .join(Organization, Organization.id == Location.organization_id)
            .where(Location.id.in_(location_ids))
        ).all()
    ) if location_ids else {}
    brands = {p.brand for p in places if p.brand and not p.location_id}
    by_brand = dict(
        db.execute(
            select(DirectoryPlace.brand, func.max(Organization.five_star_status))
            .join(Location, Location.id == DirectoryPlace.location_id)
            .join(Organization, Organization.id == Location.organization_id)
            .where(DirectoryPlace.brand.in_(brands))
            .group_by(DirectoryPlace.brand)
        ).all()
    ) if brands else {}
    return {
        p.id: by_location.get(p.location_id, 0) if p.location_id else by_brand.get(p.brand, 0)
        for p in places
    }


def rated_at_least(min_stars: int):
    """SQL condition: the DirectoryPlace's five* status is at least `min_stars`."""
    rated_locations = (
        select(Location.id)
        .join(Organization, Organization.id == Location.organization_id)
        .where(EFFECTIVE_STATUS >= min_stars)
    )
    rated_brands = (
        select(DirectoryPlace.brand)
        .join(Location, Location.id == DirectoryPlace.location_id)
        .join(Organization, Organization.id == Location.organization_id)
        .where(DirectoryPlace.brand.is_not(None), Organization.five_star_status >= min_stars)
    )
    return or_(
        DirectoryPlace.location_id.in_(rated_locations),
        and_(DirectoryPlace.location_id.is_(None), DirectoryPlace.brand.in_(rated_brands)),
    )


def claimed_place_ids(db: Session, places: list[DirectoryPlace]) -> set[int]:
    """Which of `places` belong to a business five* is already in touch with:
    rated at least 1 star (staff set it once they have contact with the
    business; 0 means not verified), or an organization someone has joined -
    through the place's own location or a sibling of the same brand."""
    if not places:
        return set()
    statuses = place_statuses(db, places)
    has_member = exists().where(OrganizationMember.organization_id == Location.organization_id)
    location_ids = {p.location_id for p in places if p.location_id}
    joined_locations = set(
        db.scalars(select(Location.id).where(Location.id.in_(location_ids), has_member))
    ) if location_ids else set()
    brands = {p.brand for p in places if p.brand}
    joined_brands = set(
        db.scalars(
            select(DirectoryPlace.brand)
            .join(Location, Location.id == DirectoryPlace.location_id)
            .where(DirectoryPlace.brand.in_(brands), has_member)
            .distinct()
        )
    ) if brands else set()
    return {
        p.id
        for p in places
        if statuses[p.id] >= 1 or p.location_id in joined_locations or p.brand in joined_brands
    }


def _existing_organization(db: Session, place: DirectoryPlace) -> Organization | None:
    siblings = select(DirectoryPlace.location_id).where(
        DirectoryPlace.location_id.is_not(None), DirectoryPlace.id != place.id
    )
    if place.brand:
        siblings = siblings.where(DirectoryPlace.brand == place.brand)
    else:
        siblings = siblings.where(
            DirectoryPlace.brand.is_(None),
            DirectoryPlace.name_search == place.name_search,
            DirectoryPlace.city == place.city,
            DirectoryPlace.state == place.state,
        )
    return db.scalar(
        select(Organization)
        .join(Location, Location.organization_id == Organization.id)
        .where(Location.id.in_(siblings.limit(1)))
    )


def location_for_place(db: Session, place: DirectoryPlace) -> Location:
    """The Location that feedback for `place` belongs to, creating it if needed.

    Flushes but does not commit - the caller commits with the feedback.
    """
    if place.location_id:
        location = db.get(Location, place.location_id)
        if location:
            return location

    address = ", ".join(p for p in (place.street, place.city) if p)
    if place.state:
        address = f"{address}, {place.state}" if address else place.state
    if place.zip:
        address = f"{address} {place.zip}"
    location_name = place.street or place.city or place.name

    organization = _existing_organization(db, place)
    if organization is None:
        organization = Organization(
            name=place.brand or place.name,
            feedback_token=generate_feedback_token(),
            created_by=None,
            roadmap_enabled=False,
            feed_enabled=False,
        )
        db.add(organization)
        db.flush()
        # Mirrors create_organization: the first location shares the org's token.
        location = Location(
            organization_id=organization.id,
            name=location_name,
            address=address or None,
            is_default=True,
            feedback_token=organization.feedback_token,
            created_by=None,
        )
    else:
        location = Location(
            organization_id=organization.id,
            name=location_name,
            address=address or None,
            is_default=False,
            feedback_token=generate_feedback_token(),
            created_by=None,
        )
    db.add(location)
    db.flush()
    place.location_id = location.id
    return location
