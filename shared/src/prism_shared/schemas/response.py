"""统一响应模型。"""

from datetime import UTC, datetime
from typing import Generic, TypeVar
from uuid import UUID, uuid4

from pydantic import BaseModel, Field

T = TypeVar("T")


class Meta(BaseModel):
    """响应元信息。"""

    request_id: UUID = Field(default_factory=uuid4)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))


class ApiResponse(BaseModel, Generic[T]):
    """统一成功响应。"""

    data: T
    meta: Meta = Field(default_factory=Meta)


class ErrorDetail(BaseModel):
    """错误详情。"""

    code: str
    message: str
    details: dict | None = None


class ErrorResponse(BaseModel):
    """统一错误响应。"""

    error: ErrorDetail
    meta: Meta = Field(default_factory=Meta)
