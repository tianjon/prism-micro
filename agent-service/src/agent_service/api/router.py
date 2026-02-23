"""agent-service API 路由。"""

from fastapi import APIRouter, Depends, HTTPException, Request

from agent_service.api.schemas import AgentExecuteRequest, AgentExecuteResponse, AgentExecution, SkillDefinition
from agent_service.core.config import AgentServiceSettings
from agent_service.core.execution_service import execute_task, get_execution, list_skills
from prism_shared.auth import Principal, get_principal
from prism_shared.schemas import ApiResponse

router = APIRouter(prefix="/api/agent", tags=["agent"])


def get_settings(request: Request) -> AgentServiceSettings:
    settings = getattr(request.app.state, "agent_settings", None)
    if settings is None:
        raise HTTPException(status_code=500, detail="agent_settings 未配置")
    return settings


@router.get("/skills", response_model=ApiResponse[list[SkillDefinition]])
async def get_skills(_principal: Principal = Depends(get_principal)):
    """获取可用 skills。"""
    return ApiResponse(data=list_skills())


@router.post("/execute", response_model=ApiResponse[AgentExecuteResponse])
async def run_agent(
    body: AgentExecuteRequest,
    request: Request,
    principal: Principal = Depends(get_principal),
    settings: AgentServiceSettings = Depends(get_settings),
):
    """执行最小 Agent loop。"""
    forwarded_headers: dict[str, str] = {}
    auth_header = request.headers.get("Authorization")
    api_key_header = request.headers.get("X-API-Key")
    if auth_header:
        forwarded_headers["Authorization"] = auth_header
    if api_key_header:
        forwarded_headers["X-API-Key"] = api_key_header

    result = await execute_task(
        settings=settings,
        principal=principal,
        body=body,
        forwarded_headers=forwarded_headers,
    )
    return ApiResponse(data=result)


@router.get("/executions/{execution_id}", response_model=ApiResponse[AgentExecution])
async def get_execution_log(
    execution_id: str,
    _principal: Principal = Depends(get_principal),
):
    """获取执行日志。"""
    execution = get_execution(execution_id)
    if execution is None:
        raise HTTPException(status_code=404, detail="执行记录不存在")
    return ApiResponse(data=execution)
