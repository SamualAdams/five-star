"""Store organization image uploads.

Revision ID: 0015
Revises: 0014
"""

import sqlalchemy as sa
from alembic import op


revision = "0015"
down_revision = "0014"


def upgrade() -> None:
    op.create_table(
        "media_assets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column("token", sa.String(length=64), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=100), nullable=False),
        sa.Column("byte_size", sa.Integer(), nullable=False),
        sa.Column("data", sa.LargeBinary(), nullable=False),
        sa.Column("uploaded_by", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_media_assets_id"), "media_assets", ["id"], unique=False)
    op.create_index(op.f("ix_media_assets_organization_id"), "media_assets", ["organization_id"], unique=False)
    op.create_index(op.f("ix_media_assets_token"), "media_assets", ["token"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_media_assets_token"), table_name="media_assets")
    op.drop_index(op.f("ix_media_assets_organization_id"), table_name="media_assets")
    op.drop_index(op.f("ix_media_assets_id"), table_name="media_assets")
    op.drop_table("media_assets")
