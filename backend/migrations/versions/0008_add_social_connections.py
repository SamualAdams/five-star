"""Add organization social connections and OAuth state.

Revision ID: 0008
Revises: 0007
"""

import sqlalchemy as sa
from alembic import op


revision = "0008"
down_revision = "0007"


def upgrade() -> None:
    op.create_table(
        "social_connections",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="connected"),
        sa.Column("provider_account_id", sa.String(255), nullable=True),
        sa.Column("provider_account_name", sa.String(255), nullable=True),
        sa.Column("access_token_encrypted", sa.Text(), nullable=False),
        sa.Column("refresh_token_encrypted", sa.Text(), nullable=True),
        sa.Column("scopes", sa.JSON(), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("provider_data", sa.JSON(), nullable=True),
        sa.Column("connected_by", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["connected_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "organization_id",
            "provider",
            name="uq_social_connection_org_provider",
        ),
    )
    op.create_index("ix_social_connections_id", "social_connections", ["id"])
    op.create_index(
        "ix_social_connections_organization_id",
        "social_connections",
        ["organization_id"],
    )

    op.create_table(
        "social_oauth_states",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("state_hash", sa.String(64), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("used_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_social_oauth_states_id", "social_oauth_states", ["id"])
    op.create_index(
        "ix_social_oauth_states_organization_id",
        "social_oauth_states",
        ["organization_id"],
    )
    op.create_index(
        "ix_social_oauth_states_state_hash",
        "social_oauth_states",
        ["state_hash"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_social_oauth_states_state_hash", table_name="social_oauth_states")
    op.drop_index("ix_social_oauth_states_organization_id", table_name="social_oauth_states")
    op.drop_index("ix_social_oauth_states_id", table_name="social_oauth_states")
    op.drop_table("social_oauth_states")
    op.drop_index("ix_social_connections_organization_id", table_name="social_connections")
    op.drop_index("ix_social_connections_id", table_name="social_connections")
    op.drop_table("social_connections")
