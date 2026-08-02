"""Allow feedback at the organization level.

Revision ID: 0014
Revises: 0013
"""

import sqlalchemy as sa
from alembic import op


revision = "0014"
down_revision = "0013"


def upgrade() -> None:
    op.alter_column(
        "feedback",
        "location_id",
        existing_type=sa.Integer(),
        nullable=True,
    )


def downgrade() -> None:
    # Organization-wide feedback cannot be represented by the legacy schema.
    op.execute("DELETE FROM feedback WHERE location_id IS NULL")
    op.alter_column(
        "feedback",
        "location_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
