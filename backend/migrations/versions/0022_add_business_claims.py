"""Record requests from people who want to claim a directory business.

Revision ID: 0022
Revises: 0021
"""

import sqlalchemy as sa
from alembic import op


revision = "0022"
down_revision = "0021"


def upgrade() -> None:
    op.create_table(
        "business_claims",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("directory_place_id", sa.Integer(), nullable=True),
        sa.Column("business_name", sa.String(length=255), nullable=False),
        sa.Column("business_address", sa.String(length=500), nullable=True),
        sa.Column("contact_name", sa.String(length=255), nullable=False),
        sa.Column("contact_role", sa.String(length=255), nullable=True),
        sa.Column("contact_email", sa.String(length=255), nullable=False),
        sa.Column("contact_phone", sa.String(length=40), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=32), server_default="pending", nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["directory_place_id"], ["directory_places.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_business_claims_id"), "business_claims", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_business_claims_id"), table_name="business_claims")
    op.drop_table("business_claims")
