"""Capture feedback for businesses not yet in the catalog.

Revision ID: 0017
Revises: 0016
"""

import sqlalchemy as sa
from alembic import op


revision = "0017"
down_revision = "0016"


def upgrade() -> None:
    op.create_table(
        "unlisted_business_feedback",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("business_name", sa.String(length=255), nullable=False),
        sa.Column("location_hint", sa.String(length=500), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("submitter_email", sa.String(length=255), nullable=True),
        sa.Column("submitter_name", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=32), server_default="pending", nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_unlisted_business_feedback_business_name"),
        "unlisted_business_feedback",
        ["business_name"],
        unique=False,
    )
    op.create_index(
        op.f("ix_unlisted_business_feedback_id"),
        "unlisted_business_feedback",
        ["id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_unlisted_business_feedback_id"), table_name="unlisted_business_feedback")
    op.drop_index(
        op.f("ix_unlisted_business_feedback_business_name"),
        table_name="unlisted_business_feedback",
    )
    op.drop_table("unlisted_business_feedback")
