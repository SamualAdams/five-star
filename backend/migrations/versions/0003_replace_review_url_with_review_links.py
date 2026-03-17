"""Replace review_url with review_links on organizations

Revision ID: 0003
Revises: 0002
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0003"
down_revision = "0002"


def upgrade():
    op.drop_column("organizations", "review_url")
    op.add_column("organizations", sa.Column("review_links", postgresql.JSONB(), nullable=True))


def downgrade():
    op.drop_column("organizations", "review_links")
    op.add_column("organizations", sa.Column("review_url", sa.String(2048), nullable=True))
