from datetime import date as Date, datetime

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: EmailStr
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
    review_url: str | None = Field(None, max_length=2048)


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


# Member schemas


class MemberOut(BaseModel):
    user_id: int
    email: str
    role: str
    joined_at: datetime


class MemberUpdateRole(BaseModel):
    role: str = Field(pattern="^(admin|viewer)$")


# Invite schemas


class InviteCreate(BaseModel):
    role: str = Field(pattern="^(admin|viewer)$")
    expires_in_hours: int = Field(default=168, ge=1, le=720)


class InviteOut(BaseModel):
    id: int
    token: str
    role: str
    created_at: datetime
    expires_at: datetime
    used_at: datetime | None
    invite_url: str


class InviteInfo(BaseModel):
    organization_name: str
    role: str
    expires_at: datetime


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
    content: str
    submitter_email: str | None
    submitter_name: str | None
    is_anonymous: bool
    created_at: datetime


class FeedbackFormInfo(BaseModel):
    organization_name: str
    organization_id: int
    review_links: list[ReviewLink] | None = None


class FeedbackSubmitResponse(BaseModel):
    success: bool
    message: str


class ReviewPolishRequest(BaseModel):
    content: str = Field(min_length=1, max_length=5000)
    style: str = Field(pattern="^(shorten|polish|simplify)$")


class ReviewPolishResponse(BaseModel):
    draft: str


# Organization Search


class OrganizationSearchResult(BaseModel):
    name: str
    feedback_token: str


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
