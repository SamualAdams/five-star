"""Add organization initiatives and anonymous votes

Revision ID: 0005
Revises: 0004
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0005"
down_revision = "0004"


def upgrade():
    initiative_status = postgresql.ENUM(
        "gathering_feedback",
        "planned",
        "in_progress",
        "shipped",
        name="initiative_status",
        create_type=False,
    )
    initiative_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "initiatives",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("status", initiative_status, nullable=False, server_default="gathering_feedback"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_initiatives_id", "initiatives", ["id"])
    op.create_index("ix_initiatives_organization_id", "initiatives", ["organization_id"])

    op.create_table(
        "initiative_votes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("initiative_id", sa.Integer(), sa.ForeignKey("initiatives.id", ondelete="CASCADE"), nullable=False),
        sa.Column("visitor_id", sa.String(64), nullable=False),
        sa.Column("value", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint("value IN (-1, 1)", name="ck_initiative_vote_value"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("initiative_id", "visitor_id", name="uq_initiative_vote_visitor"),
    )
    op.create_index("ix_initiative_votes_id", "initiative_votes", ["id"])
    op.create_index("ix_initiative_votes_initiative_id", "initiative_votes", ["initiative_id"])


def downgrade():
    op.drop_table("initiative_votes")
    op.drop_table("initiatives")
    sa.Enum(name="initiative_status").drop(op.get_bind(), checkfirst=True)
