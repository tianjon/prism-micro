"""agent-service 最小执行循环。"""

import uuid
from datetime import UTC, datetime
from threading import Lock

from agent_service.api.schemas import (
    AgentExecuteRequest,
    AgentExecuteResponse,
    AgentExecution,
    ExecutionStep,
    SkillDefinition,
)
from agent_service.core.config import AgentServiceSettings
from agent_service.core.llm_client import LLMServiceClient
from prism_shared.auth import Principal

SKILLS: list[SkillDefinition] = [
    SkillDefinition(
        id="llm_chat",
        name="LLM Chat",
        description="通过 llm-service 槽位路由执行推理",
        input_schema={
            "type": "object",
            "properties": {
                "task": {"type": "string"},
                "slot": {"type": "string", "enum": ["fast", "reasoning"]},
            },
            "required": ["task"],
        },
    )
]

_EXECUTIONS: dict[str, AgentExecution] = {}
_LOCK = Lock()


def list_skills() -> list[SkillDefinition]:
    return SKILLS


def get_execution(execution_id: str) -> AgentExecution | None:
    return _EXECUTIONS.get(execution_id)


async def execute_task(
    *,
    settings: AgentServiceSettings,
    principal: Principal,
    body: AgentExecuteRequest,
    forwarded_headers: dict[str, str],
) -> AgentExecuteResponse:
    execution_id = str(uuid.uuid4())
    started_at = datetime.now(UTC)

    steps = [
        ExecutionStep(phase="reasoning", detail="选择工具 llm_chat", status="ok"),
        ExecutionStep(phase="tool_call", detail=f"调用 llm-service /api/llm/chat (slot={body.slot})", status="running"),
    ]

    execution = AgentExecution(
        id=execution_id,
        principal_type=principal.type.value,
        principal_id=principal.id,
        task=body.task,
        status="running",
        steps=steps,
        started_at=started_at,
    )
    with _LOCK:
        _EXECUTIONS[execution_id] = execution

    client = LLMServiceClient(base_url=settings.llm_service_base_url)

    try:
        llm_data = await client.chat(
            messages=[{"role": "user", "content": body.task}],
            slot=body.slot or settings.default_slot,
            max_tokens=body.max_tokens,
            headers=forwarded_headers,
        )
        content = llm_data.get("result", {}).get("content")
        if not isinstance(content, str):
            content = ""

        execution.steps[1].status = "ok"
        execution.steps.append(ExecutionStep(phase="finalize", detail="组装执行结果", status="ok"))
        execution.status = "succeeded"
        execution.result = content
        execution.error = None
    except Exception as exc:  # noqa: BLE001
        execution.steps[1].status = "error"
        execution.steps.append(ExecutionStep(phase="finalize", detail="执行失败并返回错误", status="error"))
        execution.status = "failed"
        execution.error = str(exc)
        execution.result = None

    execution.finished_at = datetime.now(UTC)
    with _LOCK:
        _EXECUTIONS[execution_id] = execution

    return AgentExecuteResponse(
        execution_id=execution_id,
        status=execution.status,
        output=execution.result,
        steps=execution.steps,
    )
