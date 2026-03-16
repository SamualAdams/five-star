"""Add review_url to organizations

Revision ID: 0002
Revises: 0001
"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"


def upgrade():
    op.add_column("organizations", sa.Column("review_url", sa.String(2048), nullable=True))


def downgrade():
    op.drop_column("organizations", "review_url")
