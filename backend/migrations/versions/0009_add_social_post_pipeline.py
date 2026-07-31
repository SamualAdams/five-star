"""Add Meta connection setup and persisted social posts.

Revision ID: 0009
Revises: 0008
"""

import sqlalchemy as sa
from alembic import op


revision = "0009"
down_revision = "0008"


def upgrade() -> None:
    op.create_table(
        "social_connection_setups",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("access_token_encrypted", sa.Text(), nullable=False),
        sa.Column("scopes", sa.JSON(), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("used_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_social_connection_setups_id",
        "social_connection_setups",
        ["id"],
    )
    op.create_index(
        "ix_social_connection_setups_organization_id",
        "social_connection_setups",
        ["organization_id"],
    )
    op.create_index(
        "ix_social_connection_setups_token_hash",
        "social_connection_setups",
        ["token_hash"],
        unique=True,
    )

    op.create_table(
        "social_posts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column("master_caption", sa.Text(), nullable=False),
        sa.Column("media_urls", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="draft"),
        sa.Column("scheduled_at", sa.DateTime(), nullable=True),
        sa.Column("published_at", sa.DateTime(), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_social_posts_id", "social_posts", ["id"])
    op.create_index(
        "ix_social_posts_organization_id",
        "social_posts",
        ["organization_id"],
    )
    op.create_index(
        "ix_social_posts_scheduled_at",
        "social_posts",
        ["scheduled_at"],
    )

    op.create_table(
        "social_post_targets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("post_id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("remote_post_id", sa.String(255), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("published_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["post_id"],
            ["social_posts.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "post_id",
            "provider",
            name="uq_social_post_target_provider",
        ),
    )
    op.create_index(
        "ix_social_post_targets_id",
        "social_post_targets",
        ["id"],
    )
    op.create_index(
        "ix_social_post_targets_post_id",
        "social_post_targets",
        ["post_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_social_post_targets_post_id", table_name="social_post_targets")
    op.drop_index("ix_social_post_targets_id", table_name="social_post_targets")
    op.drop_table("social_post_targets")
    op.drop_index("ix_social_posts_scheduled_at", table_name="social_posts")
    op.drop_index("ix_social_posts_organization_id", table_name="social_posts")
    op.drop_index("ix_social_posts_id", table_name="social_posts")
    op.drop_table("social_posts")
    op.drop_index(
        "ix_social_connection_setups_token_hash",
        table_name="social_connection_setups",
    )
    op.drop_index(
        "ix_social_connection_setups_organization_id",
        table_name="social_connection_setups",
    )
    op.drop_index(
        "ix_social_connection_setups_id",
        table_name="social_connection_setups",
    )
    op.drop_table("social_connection_setups")
