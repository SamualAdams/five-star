"""Add platform superusers and organization modules.

Revision ID: 0010
Revises: 0009
"""

import sqlalchemy as sa
from alembic import op


revision = "0010"
down_revision = "0009"


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_superuser", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "organizations",
        sa.Column("roadmap_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "organizations",
        sa.Column("feed_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
    )

    op.execute(
        sa.text("UPDATE users SET is_superuser = true WHERE lower(email) = :email")
        .bindparams(email="jon@fivestar.fyi")
    )

    # Existing organizations keep their current modules. New organizations
    # start with the core Feedback module only.
    op.alter_column("organizations", "roadmap_enabled", server_default=sa.false())
    op.alter_column("organizations", "feed_enabled", server_default=sa.false())


def downgrade() -> None:
    op.drop_column("organizations", "feed_enabled")
    op.drop_column("organizations", "roadmap_enabled")
    op.drop_column("users", "is_superuser")
