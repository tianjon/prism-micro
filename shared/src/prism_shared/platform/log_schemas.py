"""日志查询 Pydantic 模型。"""

from datetime import datetime

from pydantic import BaseModel, Field


class LogEntry(BaseModel):
    """单条日志记录。"""

    timestamp: datetime
    level: str
    service: str
    module: str
    event: str
    extra: dict | None = None


class LogQueryParams(BaseModel):
    """日志查询参数。"""

    service: str | None = None
    module: str | None = None
    level: str | None = None
    since: datetime | None = None
    until: datetime | None = None
    page: int = Field(default=1, ge=1, description="页码，从 1 开始")
    page_size: int = Field(default=50, ge=1, le=200, description="每页条数")


class LogFiltersResponse(BaseModel):
    """可用的日志筛选项。"""

    services: list[str]
    modules: list[str]
    levels: list[str]
