"""Allow feedback reports to be generated at the organization level.

Revision ID: 0017
Revises: 0016
"""

import sqlalchemy as sa
from alembic import op


revision = "0017"
down_revision = "0016"


def upgrade() -> None:
    op.alter_column(
        "digests",
        "location_id",
        existing_type=sa.Integer(),
        nullable=True,
    )


def downgrade() -> None:
    # Organization-wide digests cannot be represented by the legacy schema.
    op.execute("DELETE FROM digests WHERE location_id IS NULL")
    op.alter_column(
        "digests",
        "location_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
