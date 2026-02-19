"""标签管理请求/响应模型。"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from voc_service.models.enums import FeedbackType

# 排序白名单（防 SQL 注入）
TAG_SORT_FIELDS = {"usage_count", "confidence", "created_at"}


class FeedbackRequest(BaseModel):
    """标签反馈请求。"""

    feedback_type: FeedbackType = Field(description="反馈类型：useful/useless/error")


class FeedbackResponse(BaseModel):
    """标签反馈响应。"""

    tag_id: UUID
    feedback_type: FeedbackType
    previous_feedback_type: FeedbackType | None = None
    is_update: bool = Field(description="是否为更新已有反馈")


class FeedbackSummary(BaseModel):
    """反馈统计摘要。"""

    useful: int = 0
    useless: int = 0
    error: int = 0


class TagListItem(BaseModel):
    """标签列表项。"""

    id: UUID
    name: str
    usage_count: int
    confidence: float | None = None
    confidence_tier: str = Field(description="high/medium/low")
    status: str
    feedback_summary: FeedbackSummary
    created_at: datetime


class TagDetail(BaseModel):
    """标签详情。"""

    id: UUID
    name: str
    raw_name: str
    usage_count: int
    confidence: float | None = None
    confidence_tier: str = Field(description="high/medium/low")
    status: str
    parent_tag_id: UUID | None = None
    feedback_summary: FeedbackSummary
    unit_count: int
    created_at: datetime
    updated_at: datetime


class TagUnitItem(BaseModel):
    """标签关联的语义单元。"""

    unit_id: UUID
    text: str
    summary: str | None = None
    intent: str | None = None
    sentiment: str | None = None
    relevance: float
    is_primary: bool
    created_at: datetime


class CompareSummary(BaseModel):
    """标签对比统计摘要。"""

    total_units: int
    emergent_coverage: float = Field(description="涌现标签覆盖率")
    preset_coverage: float = Field(description="预设标签覆盖率")
    emergent_only_count: int
    preset_only_count: int
    both_count: int


class ComparisonItem(BaseModel):
    """单个语义单元的标签对比结果。"""

    unit_id: UUID
    text: str
    emergent_tags: list[str] = Field(default_factory=list, description="涌现标签名列表")
    preset_matches: list[str] = Field(default_factory=list, description="匹配到的预设标签")
    verdict: str = Field(description="emergent_better/preset_better/both/neither")


class CompareResponse(BaseModel):
    """标签对比完整响应。"""

    summary: CompareSummary
    items: list[ComparisonItem]
    page: int
    page_size: int
    total: int
