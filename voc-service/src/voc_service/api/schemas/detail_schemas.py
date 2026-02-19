"""Voice/Unit 详情响应模型。"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class UnitTagInfo(BaseModel):
    """语义单元关联的标签信息。"""

    tag_id: UUID
    tag_name: str
    relevance: float
    is_primary: bool


class VoiceBrief(BaseModel):
    """Voice 简要信息（用于 Unit 详情中的关联展示）。"""

    id: UUID
    source: str
    raw_text: str
    metadata: dict | None = None
    created_at: datetime


class UnitDetail(BaseModel):
    """语义单元详情。"""

    id: UUID
    voice_id: UUID
    text: str
    summary: str | None = None
    intent: str | None = None
    sentiment: str | None = None
    confidence: float | None = None
    confidence_tier: str = Field(description="high/medium/low")
    sequence_index: int
    tags: list[UnitTagInfo] = Field(default_factory=list)
    voice: VoiceBrief
    created_at: datetime


class VoiceUnitItem(BaseModel):
    """Voice 详情中的语义单元项。"""

    id: UUID
    text: str
    summary: str | None = None
    intent: str | None = None
    sentiment: str | None = None
    confidence: float | None = None
    confidence_tier: str = Field(description="high/medium/low")
    sequence_index: int
    tags: list[UnitTagInfo] = Field(default_factory=list)


class VoiceDetail(BaseModel):
    """Voice 详情。"""

    id: UUID
    source: str
    raw_text: str
    content_hash: str
    batch_id: UUID | None = None
    processed_status: str
    metadata: dict | None = None
    units: list[VoiceUnitItem] = Field(default_factory=list)
    created_at: datetime
