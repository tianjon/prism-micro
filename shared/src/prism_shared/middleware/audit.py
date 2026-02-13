"""审计日志中间件。"""

import time

import structlog
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

logger = structlog.get_logger("audit")


class AuditMiddleware(BaseHTTPMiddleware):
    """
    审计日志中间件。记录所有 API 请求的 Principal、方法、路径、状态码、耗时。
    Phase 1 输出到结构化日志；Phase 2+ 可扩展到持久化存储。
    """

    SKIP_PATHS = {"/health", "/docs", "/openapi.json", "/redoc"}

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if request.url.path in self.SKIP_PATHS:
            return await call_next(request)

        start_time = time.monotonic()
        response = await call_next(request)
        duration_ms = int((time.monotonic() - start_time) * 1000)

        principal = getattr(request.state, "principal", None)
        request_id = getattr(request.state, "request_id", "unknown")

        logger.info(
            "api_audit",
            request_id=str(request_id),
            principal_type=principal.type if principal else "anonymous",
            principal_id=principal.id if principal else None,
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=duration_ms,
            query_params=str(request.query_params) if request.query_params else None,
        )

        return response
