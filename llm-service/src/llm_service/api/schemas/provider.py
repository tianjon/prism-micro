"""Provider 相关的请求/响应模型。"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

# --- 请求 ---


class ProviderCreate(BaseModel):
    """创建 Provider 请求。"""

    name: str = Field(max_length=100, description="显示名称")
    slug: str = Field(max_length=50, pattern=r"^[a-z0-9][a-z0-9_-]*$", description="标识符（小写字母、数字、连字符）")
    provider_type: str = Field(max_length=50, description="LiteLLM provider 类型，如 openai")
    base_url: str = Field(max_length=500, description="API Base URL")
    api_key: str = Field(min_length=1, description="API Key（明文，存储时加密）")
    config: dict = Field(default_factory=dict, description="额外配置")


class ProviderUpdate(BaseModel):
    """更新 Provider 请求（部分更新）。"""

    name: str | None = Field(None, max_length=100)
    slug: str | None = Field(None, max_length=50, pattern=r"^[a-z0-9][a-z0-9_-]*$")
    provider_type: str | None = Field(None, max_length=50)
    base_url: str | None = Field(None, max_length=500)
    api_key: str | None = Field(None, min_length=1, description="新 API Key，不传则不更新")
    is_enabled: bool | None = None
    config: dict | None = None


class ProviderTestRequest(BaseModel):
    """测试 Provider 连通性请求。"""

    test_type: str = Field(default="chat", pattern=r"^(chat|embedding|rerank)$", description="测试类型")
    test_model_id: str | None = Field(None, description="测试用模型 ID")


# --- 响应 ---


class ProviderResponse(BaseModel):
    """Provider 响应（不包含 api_key）。"""

    model_config = {"from_attributes": True}

    id: UUID
    name: str
    slug: str
    provider_type: str
    base_url: str
    is_enabled: bool
    config: dict
    created_at: datetime
    updated_at: datetime


class ProviderTestResponse(BaseModel):
    """Provider 连通性测试响应。"""

    provider_id: UUID
    status: str  # "ok" | "error"
    latency_ms: int | None = None
    test_type: str
    test_model_id: str | None = None
    message: str
    error_detail: str | None = None
