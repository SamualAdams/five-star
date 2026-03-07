from datetime import datetime

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
    name: str = Field(min_length=1, max_length=255)


class OrganizationOut(BaseModel):
    id: int
    name: str
    created_at: datetime
    created_by: int
    role: str
    feedback_token: str


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


class FeedbackSubmitResponse(BaseModel):
    success: bool
    message: str
