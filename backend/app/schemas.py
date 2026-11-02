"""Pydantic request/response models for the KOVA API."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

Role = Literal["student", "admin"]
ProjectSource = Literal["github", "zip"]
DeploymentStatus = Literal["queued", "building", "ready", "failed", "canceled", "expired"]


class UserPublic(BaseModel):
    id: str
    email: str
    name: str
    role: Role
    status: Literal["active", "suspended"]
    university: Optional[str] = None
    bio: Optional[str] = None
    avatar_color: str = "violet"
    notify_deployments: bool = True
    notify_product: bool = True
    is_demo: bool = False
    created_at: str
    last_login_at: Optional[str] = None


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    university: str = Field(default="", max_length=120)

    @field_validator("name", "university")
    @classmethod
    def strip(cls, value: str) -> str:
        return value.strip()

    @field_validator("password")
    @classmethod
    def password_strength(cls, value: str) -> str:
        if not any(ch.isalpha() for ch in value) or not any(ch.isdigit() for ch in value):
            raise ValueError("Password must include at least one letter and one number")
        return value


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 604800
    user: UserPublic


class ProfileUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=80)
    university: Optional[str] = Field(default=None, max_length=120)
    bio: Optional[str] = Field(default=None, max_length=400)
    notify_deployments: Optional[bool] = None
    notify_product: Optional[bool] = None
    avatar_color: Optional[str] = None


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, value: str) -> str:
        if not any(ch.isalpha() for ch in value) or not any(ch.isdigit() for ch in value):
            raise ValueError("Password must include at least one letter and one number")
        return value


class ProjectCreateGithub(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    repo_url: str = Field(min_length=10, max_length=300)
    branch: str = Field(default="main", max_length=80)
    description: str = Field(default="", max_length=400)


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=80)
    description: Optional[str] = Field(default=None, max_length=400)
    branch: Optional[str] = Field(default=None, max_length=80)
    status: Optional[Literal["active", "archived"]] = None


class ProjectOut(BaseModel):
    id: str
    owner_id: str
    owner_name: str = ""
    owner_email: str = ""
    name: str
    slug: str
    description: str
    source_type: ProjectSource
    repo_url: Optional[str] = None
    repo_branch: Optional[str] = None
    framework: Optional[str] = None
    zip_filename: Optional[str] = None
    archive_entries: int = 0
    status: str = "active"
    is_demo: bool = False
    created_at: str
    updated_at: str
    deployment_count: int = 0
    last_deployment_status: Optional[str] = None
    last_deployment_at: Optional[str] = None


class DeploymentOut(BaseModel):
    id: str
    project_id: str
    project_name: str = ""
    owner_id: str
    owner_name: str = ""
    status: DeploymentStatus
    environment: str = "preview"
    commit_ref: Optional[str] = None
    source_label: str = ""
    provider: str = "cloudflare"
    provider_state: str = "not_configured"
    blocked_reason: Optional[str] = None
    preview_url: Optional[str] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    created_at: str
    updated_at: str
    expires_at: Optional[str] = None
    queue_position: Optional[int] = None
    is_demo: bool = False


class LogEntry(BaseModel):
    id: str
    ts: str
    level: Literal["info", "warn", "error"]
    step: str
    message: str


class DeploymentDetail(DeploymentOut):
    logs: list[LogEntry] = []


class NewDeploymentRequest(BaseModel):
    project_id: str
    commit_ref: Optional[str] = Field(default=None, max_length=120)
    environment: Literal["preview", "production"] = "preview"


class NotificationOut(BaseModel):
    id: str
    type: str
    title: str
    body: str
    link: Optional[str] = None
    is_read: bool
    created_at: str


class ContactRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    topic: Literal["general", "support", "bug", "accessibility", "partnership"] = "general"
    message: str = Field(min_length=20, max_length=2000)


class ContactOut(BaseModel):
    id: str
    name: str
    email: str
    topic: str
    message: str
    status: str
    created_at: str


class ActivityOut(BaseModel):
    id: str
    actor_name: str
    action: str
    target_type: Optional[str] = None
    target_id: Optional[str] = None
    detail: str = ""
    created_at: str


class StudentAdminOut(UserPublic):
    project_count: int = 0
    deployment_count: int = 0
    queued_count: int = 0


class AdminUpdateStudent(BaseModel):
    status: Optional[Literal["active", "suspended"]] = None
    role: Optional[Role] = None


class AdminOverview(BaseModel):
    totals: dict
    status_breakdown: dict
    source_breakdown: dict
    recent_deployments: list[DeploymentOut]
    recent_activity: list[ActivityOut]
    queue: list[DeploymentOut]


class UsageStats(BaseModel):
    range_days: int
    deployments_by_day: list[dict]
    projects_by_source: dict
    top_students: list[dict]
    limits: dict


class SystemStatus(BaseModel):
    version: str
    environment: str
    database: str
    deploy_provider: dict
    preview_ttl_hours: int
    messaging: dict
    storage: dict


class PlatformMeta(BaseModel):
    name: str
    version: str
    stage: str
    preview_ttl_hours: int
    deploy_provider: dict
    demo_enabled: bool
    features: dict
