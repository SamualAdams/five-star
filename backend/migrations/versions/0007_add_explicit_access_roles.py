"""Add explicit organization and location access levels.

Revision ID: 0007
Revises: 0006
"""

import sqlalchemy as sa
from alembic import op


revision = "0007"
down_revision = "0006"


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    # Older local databases were initialized from SQLAlchemy metadata, which
    # used uppercase enum labels. Normalize those values before adding the new
    # lower-case label used by the migrations and application model.
    labels = set(
        bind.execute(
            sa.text(
                """
                SELECT enumlabel
                FROM pg_enum
                WHERE enumtypid = 'role'::regtype
                """
            )
        ).scalars()
    )
    # PostgreSQL requires an enum value to be committed before it can be used
    # by the data migration below, so these type changes need their own block.
    with op.get_context().autocommit_block():
        for legacy, normalized in (("ADMIN", "admin"), ("VIEWER", "viewer"), ("LOCATION", "location")):
            if legacy in labels and normalized not in labels:
                op.execute(f"ALTER TYPE role RENAME VALUE '{legacy}' TO '{normalized}'")
                labels.remove(legacy)
                labels.add(normalized)
        op.execute("ALTER TYPE role ADD VALUE IF NOT EXISTS 'location'")

    # Before this migration, every viewer was location-scoped when a location
    # assignment existed. Preserve that behavior while reserving `viewer` for
    # the new organization-wide read-only role.
    op.execute(
        """
        UPDATE organization_members AS member
        SET role = 'location'
        WHERE role = 'viewer'
          AND EXISTS (
              SELECT 1
              FROM location_memberships AS assignment
              WHERE assignment.user_id = member.user_id
                AND assignment.organization_id = member.organization_id
          )
        """
    )
    op.execute(
        """
        UPDATE invites
        SET role = 'location'
        WHERE role = 'viewer'
          AND location_id IS NOT NULL
        """
    )


def downgrade() -> None:
    # PostgreSQL enum values cannot be safely removed in place. Downgrades keep
    # the value but map location-scoped rows back to the legacy viewer role.
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    op.execute("UPDATE organization_members SET role = 'viewer' WHERE role = 'location'")
    op.execute("UPDATE invites SET role = 'viewer' WHERE role = 'location'")
