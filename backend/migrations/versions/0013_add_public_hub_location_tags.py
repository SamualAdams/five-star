"""Add optional location tags for public hub content.

Revision ID: 0013
Revises: 0012
"""

import sqlalchemy as sa
from alembic import op


revision = "0013"
down_revision = "0012"


def upgrade() -> None:
    op.alter_column(
        "initiatives",
        "location_id",
        existing_type=sa.Integer(),
        nullable=True,
    )
    op.add_column(
        "social_posts",
        sa.Column("location_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        "ix_social_posts_location_id",
        "social_posts",
        ["location_id"],
    )
    op.create_foreign_key(
        "fk_social_posts_location_id_locations",
        "social_posts",
        "locations",
        ["location_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.drop_constraint(
        "uq_social_connection_org_provider",
        "social_connections",
        type_="unique",
    )
    for table_name in (
        "social_connections",
        "social_oauth_states",
        "social_connection_setups",
    ):
        op.add_column(
            table_name,
            sa.Column("location_id", sa.Integer(), nullable=True),
        )
        op.create_index(
            f"ix_{table_name}_location_id",
            table_name,
            ["location_id"],
        )
        op.create_foreign_key(
            f"fk_{table_name}_location_id_locations",
            table_name,
            "locations",
            ["location_id"],
            ["id"],
            ondelete="CASCADE",
        )
    op.create_index(
        "uq_social_connection_org_provider_default",
        "social_connections",
        ["organization_id", "provider"],
        unique=True,
        postgresql_where=sa.text("location_id IS NULL"),
    )
    op.create_unique_constraint(
        "uq_social_connection_org_location_provider",
        "social_connections",
        ["organization_id", "location_id", "provider"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_social_connection_org_location_provider",
        "social_connections",
        type_="unique",
    )
    op.drop_index(
        "uq_social_connection_org_provider_default",
        table_name="social_connections",
    )
    op.execute("DELETE FROM social_connections WHERE location_id IS NOT NULL")
    for table_name in (
        "social_connection_setups",
        "social_oauth_states",
        "social_connections",
    ):
        op.drop_constraint(
            f"fk_{table_name}_location_id_locations",
            table_name,
            type_="foreignkey",
        )
        op.drop_index(f"ix_{table_name}_location_id", table_name=table_name)
        op.drop_column(table_name, "location_id")
    op.create_unique_constraint(
        "uq_social_connection_org_provider",
        "social_connections",
        ["organization_id", "provider"],
    )
    op.drop_constraint(
        "fk_social_posts_location_id_locations",
        "social_posts",
        type_="foreignkey",
    )
    op.drop_index("ix_social_posts_location_id", table_name="social_posts")
    op.drop_column("social_posts", "location_id")
    # Organization-wide roadmap items cannot be represented by the legacy
    # schema, so downgrade removes them before restoring the constraint.
    op.execute("DELETE FROM initiatives WHERE location_id IS NULL")
    op.alter_column(
        "initiatives",
        "location_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
