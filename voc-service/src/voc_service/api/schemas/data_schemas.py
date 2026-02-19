"""数据管理请求/响应模型。"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

# 排序白名单（防 SQL 注入）
BATCH_SORT_FIELDS = {
    "created_at", "status", "source", "total_count", "updated_at",
    "file_name", "new_count", "duplicate_count", "failed_count",
    "file_size_bytes", "completed_at",
}
MAPPING_SORT_FIELDS = {
    "created_at", "source_format", "usage_count", "confidence", "updated_at",
    "name", "created_by", "column_hash",
}
VOICE_SORT_FIELDS = {
    "created_at", "source", "processed_status",
    "raw_text", "content_hash", "source_key", "updated_at",
}

# 筛选字段白名单
BATCH_FILTER_FIELDS = {
    "source", "file_name", "status", "total_count", "new_count",
    "duplicate_count", "failed_count", "file_size_bytes", "mapping_name",
    "error_message", "created_at", "completed_at", "updated_at",
}
MAPPING_FILTER_FIELDS = {
    "name", "source_format", "created_by", "confidence",
    "usage_count", "column_hash", "created_at", "updated_at",
}
VOICE_FILTER_FIELDS = {
    "source", "raw_text", "processed_status", "content_hash",
    "source_key", "batch_id", "processing_error",
    "created_at", "updated_at",
    "metadata.*",  # JSONB 动态键：metadata.xxx → metadata_->>'xxx'
}


# --- Batch ---


class BatchItem(BaseModel):
    """导入批次（列表 + 详情共用）。"""

    id: UUID
    source: str
    file_name: str | None = None
    file_size_bytes: int | None = None
    status: str
    total_count: int
    new_count: int
    duplicate_count: int
    failed_count: int
    mapping_id: UUID | None = None
    error_message: str | None = None
    created_at: datetime
    completed_at: datetime | None = None
    file_hash: str | None = None
    file_statistics: dict | None = None
    dedup_columns: list | None = None
    prompt_text: str | None = None
    mapping_name: str | None = Field(default=None, description="关联映射模板名称")
    updated_at: datetime


# 向后兼容别名
BatchListItem = BatchItem
BatchDetail = BatchItem


class BatchVoiceItem(BaseModel):
    """批次关联的 Voice 列表项。"""

    id: UUID
    source: str
    raw_text: str = Field(description="原始文本（截断前 200 字符）")
    content_hash: str
    processed_status: str
    created_at: datetime

    @field_validator("raw_text", mode="before")
    @classmethod
    def truncate_raw_text(cls, v: str) -> str:
        """截断原始文本至 200 字符。"""
        if v and len(v) > 200:
            return v[:200] + "..."
        return v


# --- Mapping ---


class MappingItem(BaseModel):
    """映射模板（列表 + 详情共用）。"""

    id: UUID
    name: str
    source_format: str
    created_by: str
    confidence: float | None = None
    column_hash: str
    usage_count: int
    created_at: datetime
    column_mappings: dict | None = None
    sample_data: dict | None = None
    updated_at: datetime | None = None


# 向后兼容别名
MappingListItem = MappingItem
MappingDetail = MappingItem


# --- Voice ---


class VoiceListItem(BaseModel):
    """Voice 列表项。"""

    id: UUID
    source: str
    raw_text: str = Field(description="原始文本（截断前 200 字符）")
    content_hash: str
    source_key: str | None = None
    batch_id: UUID | None = None
    processed_status: str
    processing_error: str | None = None
    metadata: dict
    created_at: datetime
    updated_at: datetime

    @field_validator("raw_text", mode="before")
    @classmethod
    def truncate_raw_text(cls, v: str) -> str:
        """截断原始文本至 200 字符。"""
        if v and len(v) > 200:
            return v[:200] + "..."
        return v


# --- 通用 ---


class MetadataKeysResponse(BaseModel):
    """Voice 元数据键列表响应。"""

    keys: list[str]


class FieldValuesResponse(BaseModel):
    """字段不重复取值响应（辅助完成）。"""

    values: list[str]
    has_more: bool


class DeleteResponse(BaseModel):
    """删除操作响应。"""

    id: str
    deleted: bool
    message: str
