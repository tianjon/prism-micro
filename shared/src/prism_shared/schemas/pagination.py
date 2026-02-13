"""分页参数与响应模型。"""

from typing import Generic, TypeVar

from pydantic import BaseModel, Field

from prism_shared.schemas.response import Meta

T = TypeVar("T")


class PaginationParams(BaseModel):
    """分页请求参数。"""

    page: int = Field(default=1, ge=1, description="页码，从 1 开始")
    page_size: int = Field(default=20, ge=1, le=100, description="每页条数")

    @property
    def offset(self) -> int:
        """计算 SQL OFFSET。"""
        return (self.page - 1) * self.page_size


class PaginationMeta(BaseModel):
    """分页信息。"""

    page: int
    page_size: int
    total: int


class PaginatedResponse(BaseModel, Generic[T]):
    """统一分页响应。"""

    data: list[T]
    pagination: PaginationMeta
    meta: Meta = Field(default_factory=Meta)
