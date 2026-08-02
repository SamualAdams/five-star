import enum
from datetime import date, datetime

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, Enum as SQLEnum, ForeignKey, ForeignKeyConstraint, Index, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Role(str, enum.Enum):
    ADMIN = "admin"
    VIEWER = "viewer"
    LOCATION = "location"


class LocationRole(str, enum.Enum):
    MANAGER = "manager"
    VIEWER = "viewer"


class DigestStatus(str, enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"


class InitiativeStatus(str, enum.Enum):
    GATHERING_FEEDBACK = "gathering_feedback"
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    SHIPPED = "shipped"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_superuser: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    memberships: Mapped[list["OrganizationMember"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    location_memberships: Mapped[list["LocationMembership"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    feedback_token: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    review_links: Mapped[list | None] = mapped_column(JSON, nullable=True, default=None)
    roadmap_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    feed_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    five_star_status: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")

    members: Mapped[list["OrganizationMember"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    invites: Mapped[list["Invite"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    feedback: Mapped[list["Feedback"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    digests: Mapped[list["Digest"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    initiatives: Mapped[list["Initiative"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    locations: Mapped[list["Location"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    social_connections: Mapped[list["SocialConnection"]] = relationship(
        back_populates="organization",
        cascade="all, delete-orphan",
    )
    social_oauth_states: Mapped[list["SocialOAuthState"]] = relationship(
        back_populates="organization",
        cascade="all, delete-orphan",
    )
    social_connection_setups: Mapped[list["SocialConnectionSetup"]] = relationship(
        back_populates="organization",
        cascade="all, delete-orphan",
    )
    social_posts: Mapped[list["SocialPost"]] = relationship(
        back_populates="organization",
        cascade="all, delete-orphan",
    )
    creator: Mapped["User"] = relationship(foreign_keys=[created_by])

    __table_args__ = (
        CheckConstraint("five_star_status BETWEEN 1 AND 5", name="ck_organizations_five_star_status"),
    )


class OrganizationMember(Base):
    __tablename__ = "organization_members"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    role: Mapped[Role] = mapped_column(
        SQLEnum(Role, values_callable=lambda enum_class: [member.value for member in enum_class]),
        nullable=False,
    )
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    user: Mapped["User"] = relationship(back_populates="memberships")
    organization: Mapped["Organization"] = relationship(back_populates="members")
    location_memberships: Mapped[list["LocationMembership"]] = relationship(
        back_populates="organization_membership",
        cascade="all, delete-orphan",
        overlaps="location_memberships,user",
    )

    __table_args__ = (
        UniqueConstraint("user_id", "organization_id", name="uq_user_organization"),
    )


class Location(Base):
    __tablename__ = "locations"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="America/Chicago")
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    feedback_token: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    review_links: Mapped[list | None] = mapped_column(JSON, nullable=True, default=None)
    five_star_status_override: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    organization: Mapped["Organization"] = relationship(back_populates="locations")
    creator: Mapped["User"] = relationship(foreign_keys=[created_by])
    memberships: Mapped[list["LocationMembership"]] = relationship(
        back_populates="location",
        cascade="all, delete-orphan",
        overlaps="location_memberships,organization_membership",
    )
    feedback: Mapped[list["Feedback"]] = relationship(back_populates="location")
    initiatives: Mapped[list["Initiative"]] = relationship(back_populates="location")
    digests: Mapped[list["Digest"]] = relationship(back_populates="location")

    __table_args__ = (
        UniqueConstraint("id", "organization_id", name="uq_location_id_organization"),
        CheckConstraint(
            "five_star_status_override IS NULL OR five_star_status_override BETWEEN 1 AND 5",
            name="ck_locations_five_star_status_override",
        ),
    )


class LocationMembership(Base):
    __tablename__ = "location_memberships"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    organization_id: Mapped[int] = mapped_column(nullable=False)
    location_id: Mapped[int] = mapped_column(nullable=False, index=True)
    role: Mapped[LocationRole] = mapped_column(
        SQLEnum(
            LocationRole,
            name="location_role",
            values_callable=lambda enum_class: [member.value for member in enum_class],
        ),
        nullable=False,
        default=LocationRole.VIEWER,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    user: Mapped["User"] = relationship(back_populates="location_memberships", overlaps="location_memberships,organization_membership")
    location: Mapped["Location"] = relationship(
        back_populates="memberships",
        overlaps="location_memberships,organization_membership",
    )
    organization_membership: Mapped["OrganizationMember"] = relationship(
        back_populates="location_memberships",
        overlaps="location,location_memberships,memberships,user",
    )

    __table_args__ = (
        ForeignKeyConstraint(
            ["user_id", "organization_id"],
            ["organization_members.user_id", "organization_members.organization_id"],
            ondelete="CASCADE",
            name="fk_location_membership_organization_member",
        ),
        ForeignKeyConstraint(
            ["location_id", "organization_id"],
            ["locations.id", "locations.organization_id"],
            ondelete="CASCADE",
            name="fk_location_membership_location",
        ),
        UniqueConstraint("user_id", "location_id", name="uq_user_location"),
    )


class Invite(Base):
    __tablename__ = "invites"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    role: Mapped[Role] = mapped_column(
        SQLEnum(Role, values_callable=lambda enum_class: [member.value for member in enum_class]),
        nullable=False,
    )
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    used_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    location_id: Mapped[int | None] = mapped_column(ForeignKey("locations.id", ondelete="CASCADE"), nullable=True)
    location_role: Mapped[LocationRole | None] = mapped_column(
        SQLEnum(
            LocationRole,
            name="location_role",
            values_callable=lambda enum_class: [member.value for member in enum_class],
        ),
        nullable=True,
    )

    organization: Mapped["Organization"] = relationship(back_populates="invites")
    creator: Mapped["User"] = relationship(foreign_keys=[created_by])
    redeemer: Mapped["User | None"] = relationship(foreign_keys=[used_by])
    location: Mapped["Location | None"] = relationship()


class Feedback(Base):
    __tablename__ = "feedback"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    location_id: Mapped[int | None] = mapped_column(ForeignKey("locations.id", ondelete="RESTRICT"), nullable=True, index=True)
    content: Mapped[str] = mapped_column(String, nullable=False)
    submitter_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    submitter_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_anonymous: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    organization: Mapped["Organization"] = relationship(back_populates="feedback")
    location: Mapped["Location | None"] = relationship(back_populates="feedback")


class Initiative(Base):
    __tablename__ = "initiatives"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    location_id: Mapped[int | None] = mapped_column(ForeignKey("locations.id", ondelete="RESTRICT"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[InitiativeStatus] = mapped_column(
        SQLEnum(
            InitiativeStatus,
            name="initiative_status",
            values_callable=lambda enum_class: [member.value for member in enum_class],
        ),
        nullable=False,
        default=InitiativeStatus.GATHERING_FEEDBACK,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    organization: Mapped["Organization"] = relationship(back_populates="initiatives")
    location: Mapped["Location"] = relationship(back_populates="initiatives")
    votes: Mapped[list["InitiativeVote"]] = relationship(back_populates="initiative", cascade="all, delete-orphan")


class InitiativeVote(Base):
    __tablename__ = "initiative_votes"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    initiative_id: Mapped[int] = mapped_column(ForeignKey("initiatives.id", ondelete="CASCADE"), nullable=False, index=True)
    visitor_id: Mapped[str] = mapped_column(String(64), nullable=False)
    value: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    initiative: Mapped["Initiative"] = relationship(back_populates="votes")

    __table_args__ = (
        UniqueConstraint("initiative_id", "visitor_id", name="uq_initiative_vote_visitor"),
        CheckConstraint("value IN (-1, 1)", name="ck_initiative_vote_value"),
    )


class Digest(Base):
    __tablename__ = "digests"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    location_id: Mapped[int] = mapped_column(ForeignKey("locations.id", ondelete="RESTRICT"), nullable=False, index=True)
    status: Mapped[DigestStatus] = mapped_column(SQLEnum(DigestStatus), nullable=False, default=DigestStatus.DRAFT)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    insights: Mapped[list] = mapped_column(JSON, nullable=False)
    immediate_actions: Mapped[list] = mapped_column(JSON, nullable=False)
    long_term_goals: Mapped[list] = mapped_column(JSON, nullable=False)
    feedback_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    generated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    generated_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    published_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    organization: Mapped["Organization"] = relationship(back_populates="digests")
    location: Mapped["Location"] = relationship(back_populates="digests")
    generator: Mapped["User"] = relationship(foreign_keys=[generated_by])
    publisher: Mapped["User | None"] = relationship(foreign_keys=[published_by])

    @property
    def location_name(self) -> str:
        return self.location.name


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    user: Mapped["User"] = relationship()


class SocialConnection(Base):
    __tablename__ = "social_connections"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    location_id: Mapped[int | None] = mapped_column(
        ForeignKey("locations.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="connected")
    provider_account_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    provider_account_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    access_token_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    refresh_token_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    scopes: Mapped[list | None] = mapped_column(JSON, nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    provider_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    connected_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    organization: Mapped["Organization"] = relationship(back_populates="social_connections")
    location: Mapped["Location | None"] = relationship()
    connected_user: Mapped["User"] = relationship(foreign_keys=[connected_by])

    __table_args__ = (
        Index(
            "uq_social_connection_org_provider_default",
            "organization_id",
            "provider",
            unique=True,
            postgresql_where=location_id.is_(None),
            sqlite_where=location_id.is_(None),
        ),
        UniqueConstraint(
            "organization_id",
            "location_id",
            "provider",
            name="uq_social_connection_org_location_provider",
        ),
    )


class SocialOAuthState(Base):
    __tablename__ = "social_oauth_states"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    state_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    location_id: Mapped[int | None] = mapped_column(
        ForeignKey("locations.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    organization: Mapped["Organization"] = relationship(back_populates="social_oauth_states")
    user: Mapped["User"] = relationship(foreign_keys=[user_id])


class SocialConnectionSetup(Base):
    __tablename__ = "social_connection_setups"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    location_id: Mapped[int | None] = mapped_column(
        ForeignKey("locations.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    access_token_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    scopes: Mapped[list | None] = mapped_column(JSON, nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    organization: Mapped["Organization"] = relationship(
        back_populates="social_connection_setups",
    )
    user: Mapped["User"] = relationship(foreign_keys=[user_id])


class SocialPost(Base):
    __tablename__ = "social_posts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    location_id: Mapped[int | None] = mapped_column(
        ForeignKey("locations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    master_caption: Mapped[str] = mapped_column(Text, nullable=False)
    media_urls: Mapped[list | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    organization: Mapped["Organization"] = relationship(back_populates="social_posts")
    location: Mapped["Location | None"] = relationship()
    creator: Mapped["User"] = relationship(foreign_keys=[created_by])
    targets: Mapped[list["SocialPostTarget"]] = relationship(
        back_populates="post",
        cascade="all, delete-orphan",
        order_by="SocialPostTarget.id",
    )


class SocialPostTarget(Base):
    __tablename__ = "social_post_targets"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    post_id: Mapped[int] = mapped_column(
        ForeignKey("social_posts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    remote_post_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    post: Mapped["SocialPost"] = relationship(back_populates="targets")

    __table_args__ = (
        UniqueConstraint("post_id", "provider", name="uq_social_post_target_provider"),
    )
