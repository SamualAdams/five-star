"""Add location tenancy and scoped member access.

Revision ID: 0006
Revises: 0005
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0006"
down_revision = "0005"


def upgrade() -> None:
    location_role = postgresql.ENUM(
        "manager",
        "viewer",
        name="location_role",
        create_type=False,
    )
    location_role.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "locations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("address", sa.String(500), nullable=True),
        sa.Column("timezone", sa.String(64), nullable=False, server_default="America/Chicago"),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("feedback_token", sa.String(64), nullable=False),
        sa.Column("review_links", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("feedback_token"),
        sa.UniqueConstraint("id", "organization_id", name="uq_location_id_organization"),
    )
    op.create_index("ix_locations_id", "locations", ["id"])
    op.create_index("ix_locations_organization_id", "locations", ["organization_id"])
    op.create_index("ix_locations_feedback_token", "locations", ["feedback_token"], unique=True)
    op.create_index(
        "uq_locations_default_per_org",
        "locations",
        ["organization_id"],
        unique=True,
        postgresql_where=sa.text("is_default"),
    )

    op.execute(
        """
        INSERT INTO locations (
            organization_id,
            name,
            address,
            timezone,
            is_default,
            feedback_token,
            review_links,
            created_at,
            created_by
        )
        SELECT
            id,
            name,
            NULL,
            'America/Chicago',
            TRUE,
            feedback_token,
            review_links,
            created_at,
            created_by
        FROM organizations
        """
    )

    op.create_table(
        "location_memberships",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column("location_id", sa.Integer(), nullable=False),
        sa.Column("role", location_role, nullable=False, server_default="viewer"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(
            ["user_id", "organization_id"],
            ["organization_members.user_id", "organization_members.organization_id"],
            ondelete="CASCADE",
            name="fk_location_membership_organization_member",
        ),
        sa.ForeignKeyConstraint(
            ["location_id", "organization_id"],
            ["locations.id", "locations.organization_id"],
            ondelete="CASCADE",
            name="fk_location_membership_location",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "location_id", name="uq_user_location"),
    )
    op.create_index("ix_location_memberships_id", "location_memberships", ["id"])
    op.create_index("ix_location_memberships_location_id", "location_memberships", ["location_id"])

    op.execute(
        """
        INSERT INTO location_memberships (
            user_id,
            organization_id,
            location_id,
            role,
            created_at
        )
        SELECT
            member.user_id,
            member.organization_id,
            location.id,
            'viewer',
            member.joined_at
        FROM organization_members AS member
        JOIN locations AS location
          ON location.organization_id = member.organization_id
         AND location.is_default = TRUE
        WHERE lower(member.role::text) = 'viewer'
        """
    )

    for table_name in ("feedback", "initiatives", "digests"):
        op.add_column(table_name, sa.Column("location_id", sa.Integer(), nullable=True))
        op.execute(
            f"""
            UPDATE {table_name} AS item
            SET location_id = location.id
            FROM locations AS location
            WHERE location.organization_id = item.organization_id
              AND location.is_default = TRUE
            """
        )
        op.alter_column(table_name, "location_id", nullable=False)
        op.create_foreign_key(
            f"fk_{table_name}_location",
            table_name,
            "locations",
            ["location_id"],
            ["id"],
            ondelete="RESTRICT",
        )
        op.create_index(f"ix_{table_name}_location_id", table_name, ["location_id"])

    op.add_column("invites", sa.Column("location_id", sa.Integer(), nullable=True))
    op.add_column("invites", sa.Column("location_role", location_role, nullable=True))
    op.create_foreign_key(
        "fk_invites_location",
        "invites",
        "locations",
        ["location_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.execute(
        """
        UPDATE invites AS invite
        SET
            location_id = location.id,
            location_role = 'viewer'
        FROM locations AS location
        WHERE location.organization_id = invite.organization_id
          AND location.is_default = TRUE
          AND lower(invite.role::text) = 'viewer'
        """
    )


def downgrade() -> None:
    op.drop_constraint("fk_invites_location", "invites", type_="foreignkey")
    op.drop_column("invites", "location_role")
    op.drop_column("invites", "location_id")

    for table_name in ("digests", "initiatives", "feedback"):
        op.drop_index(f"ix_{table_name}_location_id", table_name=table_name)
        op.drop_constraint(f"fk_{table_name}_location", table_name, type_="foreignkey")
        op.drop_column(table_name, "location_id")

    op.drop_table("location_memberships")
    op.drop_index("uq_locations_default_per_org", table_name="locations")
    op.drop_table("locations")
    sa.Enum(name="location_role").drop(op.get_bind(), checkfirst=True)
