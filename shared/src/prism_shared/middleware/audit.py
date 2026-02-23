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

    DEFAULT_SKIP_PATHS = {"/health", "/openapi.json"}
    DEFAULT_SKIP_PREFIXES = ("/docs", "/redoc")

    def __init__(
        self,
        app,
        skip_paths: set[str] | None = None,
        skip_prefixes: tuple[str, ...] | None = None,
    ):
        super().__init__(app)
        self._skip_paths = self.DEFAULT_SKIP_PATHS | (skip_paths or set())
        self._skip_prefixes = self.DEFAULT_SKIP_PREFIXES + (skip_prefixes or ())

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if self._is_skip_path(request.url.path):
            return await call_next(request)

        start_time = time.monotonic()
        response = await call_next(request)
        duration_ms = int((time.monotonic() - start_time) * 1000)

        principal = getattr(request.state, "principal", None)
        request_id = getattr(request.state, "request_id", "unknown")

        logger.info(
            "api_audit",
            request_id=str(request_id),
            principal_type=(principal.type.value if principal else "anonymous"),
            principal_id=principal.id if principal else None,
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=duration_ms,
            query_params=str(request.query_params) if request.query_params else None,
        )

        return response

    def _is_skip_path(self, path: str) -> bool:
        if path in self._skip_paths:
            return True
        return any(path.startswith(prefix) for prefix in self._skip_prefixes)
