from datetime import date as Date, datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=128)


class UserOut(BaseModel):
    id: int
    email: EmailStr
    is_superuser: bool = False
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AuthResponse(BaseModel):
    token: Token
    user: UserOut


# Organization schemas


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class OrganizationUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)


class OrganizationModulesOut(BaseModel):
    feedback: bool = True
    roadmap: bool
    feed: bool


class OrganizationModulesUpdate(BaseModel):
    roadmap: bool | None = None
    feed: bool | None = None


class OrganizationFiveStarStatusUpdate(BaseModel):
    status: int = Field(ge=1, le=5)


class LocationFiveStarStatusUpdate(BaseModel):
    status: int | None = Field(default=None, ge=1, le=5)


class ReviewLink(BaseModel):
    platform: str = Field(pattern="^(google|yelp|tripadvisor)$")
    url: str = Field(min_length=1, max_length=2048)


class OrganizationReviewLinksUpdate(BaseModel):
    review_links: list[ReviewLink]


class OrganizationOut(BaseModel):
    id: int
    name: str
    created_at: datetime
    created_by: int
    role: str
    feedback_token: str
    review_links: list[ReviewLink] | None = None
    can_view_all_locations: bool = False
    can_manage_organization: bool = False
    modules: OrganizationModulesOut
    five_star_status: int = 1


# Location schemas


class LocationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    address: str | None = Field(None, max_length=500)
    timezone: str = Field(default="America/Chicago", min_length=1, max_length=64)


class LocationUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    address: str | None = Field(None, max_length=500)
    timezone: str | None = Field(None, min_length=1, max_length=64)


class LocationOut(BaseModel):
    id: int
    organization_id: int
    name: str
    address: str | None
    timezone: str
    is_default: bool
    feedback_token: str
    review_links: list[ReviewLink] | None = None
    review_links_override: list[ReviewLink] | None = None
    access_role: str
    can_manage: bool
    five_star_status: int = 1
    five_star_status_override: int | None = None
    created_at: datetime


class LocationReviewLinksUpdate(BaseModel):
    review_links: list[ReviewLink] | None = None


class LocationDeletionImpact(BaseModel):
    feedback: int = 0
    roadmap_items: int = 0
    feed_posts: int = 0
    reports: int = 0
    social_connections: int = 0
    team_assignments: int = 0
    pending_invites: int = 0


class LocationDeleteRequest(BaseModel):
    destination: Literal["organization", "location"] | None = None
    destination_location_id: int | None = None
    delete_reports: bool = False


class LocationAssignment(BaseModel):
    location_id: int
    role: Literal["manager", "viewer"] = "viewer"


class MemberLocationAssignmentsUpdate(BaseModel):
    assignments: list[LocationAssignment]


# Member schemas


class MemberOut(BaseModel):
    user_id: int
    email: str
    role: str
    joined_at: datetime
    location_assignments: list[LocationAssignment] = Field(default_factory=list)


class MemberUpdateRole(BaseModel):
    role: Literal[
        "organization_admin",
        "organization_viewer",
        "location_admin",
        "location_viewer",
    ]


# Invite schemas


class InviteCreate(BaseModel):
    role: Literal[
        "organization_admin",
        "organization_viewer",
        "location_admin",
        "location_viewer",
    ]
    location_id: int | None = None
    expires_in_hours: int = Field(default=168, ge=1, le=720)


class InviteOut(BaseModel):
    id: int
    token: str
    role: str
    created_at: datetime
    expires_at: datetime
    used_at: datetime | None
    invite_url: str
    location_id: int | None = None
    location_name: str | None = None
    location_role: str | None = None


class InviteInfo(BaseModel):
    organization_name: str
    role: str
    expires_at: datetime
    location_name: str | None = None
    location_role: str | None = None


class InviteAccept(BaseModel):
    token: str


# Feedback schemas


class FeedbackSubmit(BaseModel):
    content: str = Field(min_length=1, max_length=5000)
    submitter_email: EmailStr | None = None
    submitter_name: str | None = Field(None, max_length=255)


class FeedbackOut(BaseModel):
    id: int
    organization_id: int
    location_id: int | None
    content: str
    submitter_email: str | None
    submitter_name: str | None
    is_anonymous: bool
    created_at: datetime


class FeedbackFormInfo(BaseModel):
    organization_name: str
    organization_id: int
    organization_token: str
    location_name: str
    location_id: int
    review_links: list[ReviewLink] | None = None


class FeedbackSubmitResponse(BaseModel):
    success: bool
    message: str


class InitiativeCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(min_length=1, max_length=5000)
    status: Literal["gathering_feedback", "planned", "in_progress", "shipped"] = "gathering_feedback"
    location_id: int | None = None


class InitiativeUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=160)
    description: str | None = Field(None, min_length=1, max_length=5000)
    status: Literal["gathering_feedback", "planned", "in_progress", "shipped"] | None = None


class InitiativeOut(BaseModel):
    id: int
    organization_id: int
    location_id: int | None
    location_name: str | None
    title: str
    description: str
    status: str
    created_at: datetime
    updated_at: datetime
    upvotes: int
    downvotes: int
    score: int


class PublicInitiativeOut(InitiativeOut):
    viewer_vote: Literal[-1, 1] | None = None


class BoardOut(BaseModel):
    organization_name: str
    organization_id: int
    location_name: str | None
    location_id: int | None
    initiatives: list[PublicInitiativeOut]


class InitiativeVoteUpdate(BaseModel):
    value: Literal[-1, 1] | None = None


class ReviewPolishRequest(BaseModel):
    content: str = Field(min_length=1, max_length=5000)
    style: str = Field(pattern="^(shorten|polish|simplify)$")


class ReviewPolishResponse(BaseModel):
    draft: str


# Social connection schemas


class SocialConnectionOut(BaseModel):
    provider: Literal["facebook", "instagram", "tiktok"]
    name: str
    description: str
    configured: bool
    connected: bool
    publishing_enabled: bool
    status: str
    provider_account_id: str | None = None
    provider_account_name: str | None = None
    scopes: list[str] = Field(default_factory=list)
    expires_at: datetime | None = None
    connected_at: datetime | None = None
    connection_method: str | None = None
    linked_page_name: str | None = None
    diagnostic: str | None = None
    location_id: int | None = None
    inherited: bool = False


class SocialAuthorizationOut(BaseModel):
    authorization_url: str


class MetaInstagramAccountOut(BaseModel):
    id: str
    username: str | None = None
    name: str | None = None
    profile_picture_url: str | None = None


class MetaPageOptionOut(BaseModel):
    id: str
    name: str
    tasks: list[str] = Field(default_factory=list)
    instagram: MetaInstagramAccountOut | None = None


class MetaConnectionOptionsOut(BaseModel):
    pages: list[MetaPageOptionOut]


class MetaConnectionComplete(BaseModel):
    setup_token: str = Field(min_length=20, max_length=200)
    page_id: str = Field(min_length=1, max_length=255)


class SocialPostTargetCreate(BaseModel):
    provider: Literal["facebook", "instagram", "tiktok"]
    content: str = Field(min_length=1, max_length=10000)


class SocialDraftGenerate(BaseModel):
    master_caption: str = Field(min_length=1, max_length=10000)


class SocialDraftContent(BaseModel):
    facebook: str = Field(min_length=1, max_length=10000)
    instagram: str = Field(min_length=1, max_length=10000)
    tiktok: str = Field(min_length=1, max_length=10000)


class WordsmithRequest(BaseModel):
    text: str = Field(min_length=1, max_length=10000)
    style: Literal["polish", "shorten", "warmer"]
    scope: Literal["selection", "caption"] = "caption"


class WordsmithOption(BaseModel):
    label: str = Field(min_length=1, max_length=80)
    text: str = Field(min_length=1, max_length=10000)


class WordsmithResponse(BaseModel):
    options: list[WordsmithOption] = Field(min_length=3, max_length=3)


class SocialPostCreate(BaseModel):
    master_caption: str = Field(min_length=1, max_length=10000)
    targets: list[SocialPostTargetCreate] = Field(default_factory=list, max_length=4)
    media_urls: list[str] = Field(default_factory=list, max_length=10)
    scheduled_at: datetime | None = None
    location_id: int | None = None


class SocialPostUpdate(BaseModel):
    master_caption: str = Field(min_length=1, max_length=10000)


class MediaAssetOut(BaseModel):
    url: str
    filename: str
    content_type: str
    byte_size: int


class SocialPostTargetOut(BaseModel):
    id: int
    # Old saved posts can retain a now-hidden provider; keep their history readable.
    provider: str
    content: str
    status: str
    remote_post_id: str | None = None
    error: str | None = None
    published_at: datetime | None = None


class SocialPostOut(BaseModel):
    id: int
    organization_id: int
    location_id: int | None = None
    location_name: str | None = None
    master_caption: str
    media_urls: list[str] = Field(default_factory=list)
    status: str
    scheduled_at: datetime | None = None
    published_at: datetime | None = None
    created_by: int
    created_at: datetime
    updated_at: datetime
    targets: list[SocialPostTargetOut] = Field(default_factory=list)


class PublicLocationOut(BaseModel):
    id: int
    name: str
    address: str | None = None
    is_default: bool
    feedback_token: str


class OrganizationFeedbackFormInfo(BaseModel):
    organization_name: str
    organization_id: int
    organization_token: str
    review_links: list[ReviewLink] | None = None
    locations: list[PublicLocationOut]


class PublicOrganizationHubOut(BaseModel):
    organization_name: str
    organization_token: str
    five_star_status: int
    modules: OrganizationModulesOut
    locations: list[PublicLocationOut]


class PublicSocialPostOut(BaseModel):
    id: int
    master_caption: str
    media_urls: list[str] = Field(default_factory=list)
    published_at: datetime
    location_id: int | None = None
    location_name: str | None = None
    reaction_count: int = 0
    viewer_reacted: bool = False


class SocialPostReactionUpdate(BaseModel):
    active: bool


# Organization Search


class OrganizationSearchResult(BaseModel):
    name: str
    feedback_token: str
    landing_enabled: bool


# Feedback Stats


class FeedbackStatPoint(BaseModel):
    date: str
    count: int


class FeedbackStatsOut(BaseModel):
    data: list[FeedbackStatPoint]


# Digest schemas


class DigestGenerate(BaseModel):
    period_start: Date
    period_end: Date
    location_id: int | None = None


class DigestContent(BaseModel):
    """Used internally to validate the AI's JSON output."""
    summary: str
    insights: list[str]
    immediate_actions: list[str]
    long_term_goals: list[str]


class DigestUpdate(BaseModel):
    summary: str | None = None
    insights: list[str] | None = None
    immediate_actions: list[str] | None = None
    long_term_goals: list[str] | None = None


class DigestOut(BaseModel):
    id: int
    organization_id: int
    location_id: int
    location_name: str
    status: str
    period_start: Date
    period_end: Date
    summary: str
    insights: list[str]
    immediate_actions: list[str]
    long_term_goals: list[str]
    feedback_count: int
    generated_at: datetime
    published_at: datetime | None
    generated_by: int
    published_by: int | None

    model_config = {"from_attributes": True}
