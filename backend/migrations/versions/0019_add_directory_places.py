"""Directory of businesses not yet on five*, seeded from open data.

Also lets organizations/locations have no creator: five* creates them for
directory businesses that receive feedback before they join.

Revision ID: 0019
Revises: 0018
"""

import sqlalchemy as sa
from alembic import op


revision = "0019"
down_revision = "0018"


def upgrade() -> None:
    op.create_table(
        "directory_places",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("source_id", sa.String(length=64), nullable=False),
        sa.Column("source_release", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("street", sa.String(length=255), nullable=True),
        sa.Column("city", sa.String(length=128), nullable=True),
        sa.Column("state", sa.String(length=32), nullable=True),
        sa.Column("zip", sa.String(length=10), nullable=True),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lon", sa.Float(), nullable=True),
        sa.Column("category", sa.String(length=64), nullable=True),
        sa.Column("brand", sa.String(length=255), nullable=True),
        sa.Column("name_search", sa.String(length=300), nullable=False),
        sa.Column("street_search", sa.String(length=300), nullable=True),
        sa.Column("active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("location_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["location_id"], ["locations.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("source", "source_id", name="uq_directory_places_source"),
    )

    # Word-prefix search is LIKE '% word%' over the normalized columns; trigram
    # GIN indexes make that fast at millions of rows. They are an optimization
    # only: if the database role may not create pg_trgm, skip them (inside a
    # savepoint, so the rest of the migration still applies) rather than fail
    # the deploy. Search still works, just without the index.
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        try:
            with bind.begin_nested():
                bind.exec_driver_sql("CREATE EXTENSION IF NOT EXISTS pg_trgm")
                bind.exec_driver_sql(
                    "CREATE INDEX ix_directory_places_name_search ON directory_places "
                    "USING gin (name_search gin_trgm_ops) WHERE active"
                )
                bind.exec_driver_sql(
                    "CREATE INDEX ix_directory_places_street_search ON directory_places "
                    "USING gin (street_search gin_trgm_ops) WHERE active"
                )
        except sa.exc.DBAPIError as exc:
            print(f"Skipping directory search indexes (pg_trgm unavailable): {exc}")

    # Directory places that get feedback become unclaimed organizations with no creator.
    op.alter_column("organizations", "created_by", existing_type=sa.Integer(), nullable=True)
    op.alter_column("locations", "created_by", existing_type=sa.Integer(), nullable=True)


def downgrade() -> None:
    op.alter_column("locations", "created_by", existing_type=sa.Integer(), nullable=False)
    op.alter_column("organizations", "created_by", existing_type=sa.Integer(), nullable=False)
    if op.get_bind().dialect.name == "postgresql":
        op.execute("DROP INDEX IF EXISTS ix_directory_places_street_search")
        op.execute("DROP INDEX IF EXISTS ix_directory_places_name_search")
    op.drop_table("directory_places")
