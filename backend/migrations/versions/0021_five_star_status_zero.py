"""Add five* status 0 (not verified) and reset every business to it.

five* now lists businesses before they sign up, so nothing about them is
verified yet. Status 0 is the new default; five* staff raise it as a business
engages. Every organization is reset to 0 and location overrides are cleared,
so every location shows 0.

Downgrade restores the 1-5 range (0 becomes 1); the statuses and overrides that
existed before this migration are not restored.

Revision ID: 0021
Revises: 0020
"""

import sqlalchemy as sa
from alembic import op


revision = "0021"
down_revision = "0020"


def upgrade() -> None:
    op.drop_constraint("ck_organizations_five_star_status", "organizations", type_="check")
    op.drop_constraint("ck_locations_five_star_status_override", "locations", type_="check")
    op.alter_column(
        "organizations", "five_star_status", existing_type=sa.Integer(), server_default="0"
    )
    op.execute("UPDATE organizations SET five_star_status = 0")
    op.execute("UPDATE locations SET five_star_status_override = NULL")
    op.create_check_constraint(
        "ck_organizations_five_star_status", "organizations", "five_star_status BETWEEN 0 AND 5"
    )
    op.create_check_constraint(
        "ck_locations_five_star_status_override",
        "locations",
        "five_star_status_override IS NULL OR five_star_status_override BETWEEN 0 AND 5",
    )


def downgrade() -> None:
    op.drop_constraint("ck_organizations_five_star_status", "organizations", type_="check")
    op.drop_constraint("ck_locations_five_star_status_override", "locations", type_="check")
    op.execute("UPDATE organizations SET five_star_status = 1 WHERE five_star_status = 0")
    op.execute("UPDATE locations SET five_star_status_override = 1 WHERE five_star_status_override = 0")
    op.alter_column(
        "organizations", "five_star_status", existing_type=sa.Integer(), server_default="1"
    )
    op.create_check_constraint(
        "ck_organizations_five_star_status", "organizations", "five_star_status BETWEEN 1 AND 5"
    )
    op.create_check_constraint(
        "ck_locations_five_star_status_override",
        "locations",
        "five_star_status_override IS NULL OR five_star_status_override BETWEEN 1 AND 5",
    )
