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

from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from .models import DirectoryPlace, Location, Organization, OrganizationMember
from .security import generate_feedback_token


def is_claimed(db: Session, organization_id: int) -> bool:
    return bool(db.scalar(select(exists().where(OrganizationMember.organization_id == organization_id))))


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
