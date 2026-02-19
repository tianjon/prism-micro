"""日志查询 API 路由。

提供 GET /logs 和 GET /logs/filters 两个端点，
用于查询结构化日志文件和获取可用筛选项。
"""

from datetime import datetime
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from prism_shared.auth.jwt import decode_token
from prism_shared.platform.log_reader import get_available_filters, query_logs
from prism_shared.platform.log_schemas import LogEntry, LogFiltersResponse, LogQueryParams
from prism_shared.schemas import ApiResponse, PaginatedResponse, PaginationMeta

logger = structlog.get_logger(__name__)

router = APIRouter(tags=["platform"])

_bearer_scheme = HTTPBearer(auto_error=False)


async def _require_admin(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> dict[str, Any]:
    """平台级认证：校验 JWT 有效性 + 管理员角色。

    日志查询属于平台运维功能，仅管理员可访问。
    通过 JWT payload 中的 role 字段判断，不查询数据库。
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="缺少认证信息",
            headers={"WWW-Authenticate": "Bearer"},
        )

    settings = request.app.state.settings
    payload = decode_token(credentials.credentials, settings.jwt_secret)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效或过期的 token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="token 类型无效，需要 access token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if payload.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="日志查询需要管理员权限",
        )

    return payload


@router.get("/logs")
async def query_log_entries(
    request: Request,
    service: str | None = Query(default=None, description="按服务名筛选"),
    module: str | None = Query(default=None, description="按模块名筛选"),
    level: str | None = Query(default=None, description="按日志级别筛选（INFO/WARNING/ERROR 等）"),
    since: datetime | None = Query(default=None, description="起始时间（ISO 8601）"),
    until: datetime | None = Query(default=None, description="截止时间（ISO 8601）"),
    page: int = Query(default=1, ge=1, description="页码"),
    page_size: int = Query(default=50, ge=1, le=200, description="每页条数"),
    _auth: dict = Depends(_require_admin),
) -> dict:
    """查询结构化日志。

    返回分页日志列表，按时间倒序排列（最新在前）。
    如果扫描行数达到上限，响应中 truncated 字段为 true。
    """
    params = LogQueryParams(
        service=service,
        module=module,
        level=level,
        since=since,
        until=until,
        page=page,
        page_size=page_size,
    )

    log_dir = request.app.state.settings.log_dir
    entries, total, truncated = query_logs(log_dir, params)

    response = PaginatedResponse[LogEntry](
        data=entries,
        pagination=PaginationMeta(
            page=page,
            page_size=page_size,
            total=total,
        ),
    )

    # 在标准分页响应基础上追加 truncated 字段
    result = response.model_dump(mode="json")
    result["truncated"] = truncated
    return result


@router.get("/logs/filters")
async def list_log_filters(
    request: Request,
    _auth: dict = Depends(_require_admin),
) -> ApiResponse[LogFiltersResponse]:
    """获取可用的日志筛选项。

    扫描日志文件，提取所有出现过的 service/module/level 值。
    """
    log_dir = request.app.state.settings.log_dir
    filters = get_available_filters(log_dir)
    return ApiResponse(data=filters)
