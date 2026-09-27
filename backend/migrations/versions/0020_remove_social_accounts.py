"""Remove social account connections and publishing to Facebook/Instagram.

Feed posts (social_posts, social_post_reactions) stay: they are five*'s own
public feed. What goes is everything used to connect outside social accounts
and push posts to them, including the stored (encrypted) provider tokens.

Downgrade recreates the tables empty; the dropped connection data is not
restored.

Revision ID: 0020
Revises: 0019
"""

import sqlalchemy as sa
from alembic import op


revision = "0020"
down_revision = "0019"


def upgrade() -> None:
    op.drop_table("social_post_targets")
    op.drop_table("social_connection_setups")
    op.drop_table("social_oauth_states")
    op.drop_table("social_connections")


def downgrade() -> None:
    op.create_table(
        "social_connections",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), server_default="connected", nullable=False),
        sa.Column("provider_account_id", sa.String(length=255), nullable=True),
        sa.Column("provider_account_name", sa.String(length=255), nullable=True),
        sa.Column("access_token_encrypted", sa.Text(), nullable=False),
        sa.Column("refresh_token_encrypted", sa.Text(), nullable=True),
        sa.Column("scopes", sa.JSON(), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("provider_data", sa.JSON(), nullable=True),
        sa.Column("connected_by", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("location_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["connected_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["location_id"], ["locations.id"], ondelete="CASCADE",
            name="fk_social_connections_location_id_locations",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "organization_id", "location_id", "provider",
            name="uq_social_connection_org_location_provider",
        ),
    )
    op.create_index("ix_social_connections_id", "social_connections", ["id"])
    op.create_index("ix_social_connections_organization_id", "social_connections", ["organization_id"])
    op.create_index("ix_social_connections_location_id", "social_connections", ["location_id"])
    op.create_index(
        "uq_social_connection_org_provider_default",
        "social_connections",
        ["organization_id", "provider"],
        unique=True,
        postgresql_where=sa.text("location_id IS NULL"),
        sqlite_where=sa.text("location_id IS NULL"),
    )

    op.create_table(
        "social_oauth_states",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("state_hash", sa.String(length=64), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("used_at", sa.DateTime(), nullable=True),
        sa.Column("location_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(
            ["location_id"], ["locations.id"], ondelete="CASCADE",
            name="fk_social_oauth_states_location_id_locations",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_social_oauth_states_id", "social_oauth_states", ["id"])
    op.create_index("ix_social_oauth_states_state_hash", "social_oauth_states", ["state_hash"], unique=True)
    op.create_index("ix_social_oauth_states_organization_id", "social_oauth_states", ["organization_id"])
    op.create_index("ix_social_oauth_states_location_id", "social_oauth_states", ["location_id"])

    op.create_table(
        "social_connection_setups",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("access_token_encrypted", sa.Text(), nullable=False),
        sa.Column("scopes", sa.JSON(), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("used_at", sa.DateTime(), nullable=True),
        sa.Column("location_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(
            ["location_id"], ["locations.id"], ondelete="CASCADE",
            name="fk_social_connection_setups_location_id_locations",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_social_connection_setups_id", "social_connection_setups", ["id"])
    op.create_index("ix_social_connection_setups_token_hash", "social_connection_setups", ["token_hash"], unique=True)
    op.create_index("ix_social_connection_setups_organization_id", "social_connection_setups", ["organization_id"])
    op.create_index("ix_social_connection_setups_location_id", "social_connection_setups", ["location_id"])

    op.create_table(
        "social_post_targets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("post_id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=32), server_default="pending", nullable=False),
        sa.Column("remote_post_id", sa.String(length=255), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("published_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["post_id"], ["social_posts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("post_id", "provider", name="uq_social_post_target_provider"),
    )
    op.create_index("ix_social_post_targets_id", "social_post_targets", ["id"])
    op.create_index("ix_social_post_targets_post_id", "social_post_targets", ["post_id"])
