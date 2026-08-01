"""Add organization Five Star status and location overrides.

Revision ID: 0011
Revises: 0010
"""

import sqlalchemy as sa
from alembic import op


revision = "0011"
down_revision = "0010"


def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column("five_star_status", sa.Integer(), nullable=False, server_default="1"),
    )
    op.create_check_constraint(
        "ck_organizations_five_star_status",
        "organizations",
        "five_star_status BETWEEN 1 AND 5",
    )
    op.add_column(
        "locations",
        sa.Column("five_star_status_override", sa.Integer(), nullable=True),
    )
    op.create_check_constraint(
        "ck_locations_five_star_status_override",
        "locations",
        "five_star_status_override IS NULL OR five_star_status_override BETWEEN 1 AND 5",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_locations_five_star_status_override",
        "locations",
        type_="check",
    )
    op.drop_column("locations", "five_star_status_override")
    op.drop_constraint(
        "ck_organizations_five_star_status",
        "organizations",
        type_="check",
    )
    op.drop_column("organizations", "five_star_status")
