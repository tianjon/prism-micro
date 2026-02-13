"""Slot 相关的请求/响应模型。"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from llm_service.models.slot import SlotType

# --- 请求 ---


class FallbackItem(BaseModel):
    """降级链中的一个条目。"""

    provider_id: UUID
    model_id: str = Field(max_length=200)


class SlotConfigureRequest(BaseModel):
    """配置 Slot 请求。"""

    primary_provider_id: UUID
    primary_model_id: str = Field(max_length=200)
    fallback_chain: list[FallbackItem] = Field(default_factory=list)
    is_enabled: bool = True
    config: dict = Field(default_factory=dict)


# --- 响应 ---


class ProviderBrief(BaseModel):
    """Provider 简要信息（嵌套在 Slot 响应中）。"""

    model_config = {"from_attributes": True}

    id: UUID
    name: str
    slug: str


class FallbackItemResponse(BaseModel):
    """降级链条目响应。"""

    provider: ProviderBrief
    model_id: str


class SlotResponse(BaseModel):
    """Slot 响应。"""

    slot_type: SlotType
    is_enabled: bool
    primary_provider: ProviderBrief | None = None
    primary_model_id: str | None = None
    fallback_chain: list[FallbackItemResponse] = Field(default_factory=list)
    config: dict = Field(default_factory=dict)
    updated_at: datetime | None = None
