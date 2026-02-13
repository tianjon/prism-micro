"""X-Request-ID 注入中间件。"""

from uuid import uuid4

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response


class RequestIdMiddleware(BaseHTTPMiddleware):
    """
    为每个请求注入唯一 request_id：
    - 优先使用客户端传入的 X-Request-ID header
    - 如果没有，则自动生成 UUID
    - 将 request_id 存入 request.state 并回写到响应 header
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = request.headers.get("X-Request-ID") or str(uuid4())
        request.state.request_id = request_id

        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response
