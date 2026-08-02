"""Normalize copied location review links into inherited defaults.

Revision ID: 0012
Revises: 0011
"""

from alembic import op


revision = "0012"
down_revision = "0011"


def upgrade() -> None:
    # Earlier versions copied the organization defaults onto its default
    # location. Equal values are not meaningful overrides, so convert them to
    # NULL and let them inherit the organization value going forward.
    op.execute(
        """
        UPDATE locations
        SET review_links = NULL
        FROM organizations
        WHERE locations.organization_id = organizations.id
          AND locations.review_links IS NOT NULL
          AND organizations.review_links IS NOT NULL
          AND locations.review_links::jsonb = organizations.review_links::jsonb
        """
    )


def downgrade() -> None:
    # A NULL location value remains a valid representation of inherited links.
    pass
