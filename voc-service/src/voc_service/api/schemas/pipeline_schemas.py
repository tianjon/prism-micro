"""管线 API 请求/响应模型。"""

from uuid import UUID

from pydantic import BaseModel, Field


class ProcessRequest(BaseModel):
    """管线处理请求。"""

    batch_id: UUID | None = None
    limit: int = Field(default=100, le=500, description="最大处理条数")


class ProcessResult(BaseModel):
    """管线处理结果。"""

    processed: int
    failed: int
    skipped: int
