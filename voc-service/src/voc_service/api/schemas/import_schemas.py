"""导入功能请求/响应 Pydantic 模型。"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

# --- 请求 ---


class ImportUploadParams(BaseModel):
    """文件上传附加参数（作为 Form 字段传递）。"""

    source: str | None = Field(default=None, description="数据来源标识")
    mapping_id: UUID | None = Field(default=None, description="指定已有映射模板 ID")
    auto_process: bool = Field(default=True, description="导入完成后是否自动触发 AI 管线（预留）")


class ConfirmMappingRequest(BaseModel):
    """确认映射请求。"""

    confirmed_mappings: dict[str, dict] = Field(
        description="用户确认/修正后的映射，格式：{source_col: {target: field, ...}}",
    )
    save_as_template: bool = Field(default=False, description="是否保存为可复用模板")
    template_name: str | None = Field(default=None, description="模板名称")


# --- 响应 ---


class FileInfo(BaseModel):
    """文件信息。"""

    file_name: str
    file_size_bytes: int
    total_rows: int
    detected_encoding: str
    detected_format: str


class ImportResponse(BaseModel):
    """文件上传响应。"""

    batch_id: UUID
    status: str
    message: str
    file_info: FileInfo
    mapping_preview_url: str | None = None
    matched_mapping: dict | None = None


class ColumnMapping(BaseModel):
    """单列映射详情。"""

    source_column: str
    target_field: str
    confidence: float
    sample_values: list[str] = Field(default_factory=list)
    needs_confirmation: bool


class MappingPreviewResponse(BaseModel):
    """映射预览响应。"""

    batch_id: UUID
    source_format: str
    overall_confidence: float
    column_mappings: list[ColumnMapping]
    unmapped_columns: list[str] = Field(default_factory=list)
    sample_rows: list[dict] = Field(default_factory=list)


class BatchProgress(BaseModel):
    """批次进度。"""

    total_count: int
    new_count: int
    duplicate_count: int
    failed_count: int


class BatchStatusResponse(BaseModel):
    """批次状态响应。"""

    batch_id: UUID
    status: str
    source: str
    file_name: str | None
    progress: BatchProgress
    created_at: datetime
    completed_at: datetime | None


class ConfirmMappingResponse(BaseModel):
    """确认映射响应。"""

    batch_id: UUID
    status: str
    message: str
    mapping_id: UUID
    template_saved: bool
