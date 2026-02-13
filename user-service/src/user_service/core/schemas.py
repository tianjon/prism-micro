"""请求/响应 Pydantic 模型。"""

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

# ---- 请求模型 ----


class RegisterRequest(BaseModel):
    """用户注册请求。"""

    email: EmailStr
    username: str = Field(min_length=2, max_length=100)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    """用户登录请求。"""

    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    """Token 刷新请求。"""

    refresh_token: str


class CreateAPIKeyRequest(BaseModel):
    """创建 API Key 请求。"""

    name: str = Field(min_length=1, max_length=100)
    expires_at: datetime | None = None


# ---- 响应模型 ----


class UserOut(BaseModel):
    """用户信息（对外）。"""

    id: uuid.UUID
    email: str
    username: str
    is_active: bool
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TokensOut(BaseModel):
    """Token 对。"""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LoginOut(BaseModel):
    """登录响应：用户信息 + Token。"""

    user: UserOut
    tokens: TokensOut


class APIKeyOut(BaseModel):
    """API Key 信息（对外，不含完整 key）。"""

    id: uuid.UUID
    name: str
    key_prefix: str
    is_active: bool
    expires_at: datetime | None
    last_used_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class APIKeyCreatedOut(BaseModel):
    """API Key 创建响应（含完整明文 key，仅此一次）。"""

    id: uuid.UUID
    name: str
    key: str
    key_prefix: str
    expires_at: datetime | None
    created_at: datetime
