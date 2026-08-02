"""Add anonymous reactions to Five Star feed posts.

Revision ID: 0016
Revises: 0015
"""

import sqlalchemy as sa
from alembic import op


revision = "0016"
down_revision = "0015"


def upgrade() -> None:
    op.create_table(
        "social_post_reactions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("post_id", sa.Integer(), nullable=False),
        sa.Column("visitor_id", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["post_id"], ["social_posts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("post_id", "visitor_id", name="uq_social_post_reaction_visitor"),
    )
    op.create_index(op.f("ix_social_post_reactions_id"), "social_post_reactions", ["id"], unique=False)
    op.create_index(op.f("ix_social_post_reactions_post_id"), "social_post_reactions", ["post_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_social_post_reactions_post_id"), table_name="social_post_reactions")
    op.drop_index(op.f("ix_social_post_reactions_id"), table_name="social_post_reactions")
    op.drop_table("social_post_reactions")
