"""agent-service API schemas。"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class SkillDefinition(BaseModel):
    """可用 skill 定义。"""

    id: str
    name: str
    description: str
    input_schema: dict[str, Any]


class AgentExecuteRequest(BaseModel):
    """执行请求。"""

    task: str = Field(min_length=1, description="用户任务")
    slot: str = Field(default="reasoning", description="调用槽位")
    max_tokens: int | None = Field(default=None, ge=1)


class ExecutionStep(BaseModel):
    """执行步骤记录。"""

    phase: str
    detail: str
    status: str


class AgentExecution(BaseModel):
    """执行日志。"""

    id: str
    principal_type: str
    principal_id: str
    task: str
    status: str
    steps: list[ExecutionStep]
    result: str | None = None
    error: str | None = None
    started_at: datetime
    finished_at: datetime | None = None


class AgentExecuteResponse(BaseModel):
    """执行响应。"""

    execution_id: str
    status: str
    output: str | None
    steps: list[ExecutionStep]
