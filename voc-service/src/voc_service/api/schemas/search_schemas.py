"""语义搜索请求/响应模型。"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    """语义搜索请求。"""

    query: str = Field(min_length=1, max_length=500, description="搜索查询文本")
    top_k: int = Field(default=20, ge=1, le=100, description="返回结果数量")
    min_confidence: float = Field(default=0.0, ge=0, le=1, description="最低置信度过滤")
    rerank: bool = Field(default=False, description="是否启用 rerank 重排序")


class TagBrief(BaseModel):
    """标签摘要。"""

    id: UUID
    name: str
    relevance: float
    is_primary: bool


class VoiceBrief(BaseModel):
    """Voice 来源摘要。"""

    id: UUID
    source: str
    created_at: datetime


class SearchResultItem(BaseModel):
    """单条搜索结果。"""

    unit_id: UUID
    text: str
    summary: str | None = None
    intent: str | None = None
    sentiment: str | None = None
    confidence: float | None = None
    confidence_tier: str = Field(description="high/medium/low")
    similarity_score: float
    rerank_score: float | None = None
    tags: list[TagBrief] = Field(default_factory=list)
    voice: VoiceBrief


class SearchResponse(BaseModel):
    """语义搜索响应。"""

    query: str
    total: int
    results: list[SearchResultItem]
