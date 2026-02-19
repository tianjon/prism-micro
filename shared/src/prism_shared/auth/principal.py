"""Principal 统一身份中间件。"""

from collections.abc import Callable, Coroutine
from dataclasses import dataclass
from enum import StrEnum
from typing import Any

from fastapi import Depends, HTTPException, Request, status
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse, Response

from prism_shared.auth.jwt import decode_token


class PrincipalType(StrEnum):
    """身份类型。"""

    HUMAN = "human"
    AGENT = "agent"


@dataclass(frozen=True)
class Principal:
    """统一身份对象。"""

    type: PrincipalType
    id: str  # human: user_id; agent: api_key_id
    display_name: str  # human: username; agent: key_name
    owner_id: str | None = None  # agent 关联的 human user_id
    metadata: dict[str, Any] | None = None


# API Key 验证回调类型
ApiKeyVerifier = Callable[[str], Coroutine[Any, Any, dict[str, Any] | None]]


class PrincipalMiddleware(BaseHTTPMiddleware):
    """
    认证中间件：从 JWT 或 API Key 解析出 Principal，注入 request.state。
    跳过 health check 和 docs 端点。
    """

    SKIP_PATHS = {"/health", "/docs", "/openapi.json", "/redoc"}

    def __init__(self, app, api_key_verifier: ApiKeyVerifier | None = None, jwt_secret: str = ""):
        super().__init__(app)
        self._api_key_verifier = api_key_verifier
        self._jwt_secret = jwt_secret

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if request.url.path in self.SKIP_PATHS:
            return await call_next(request)

        # 尝试 Bearer Token
        auth_header = request.headers.get("Authorization", "")
        api_key_header = request.headers.get("X-API-Key", "")

        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            payload = decode_token(token, self._jwt_secret)
            if payload is None:
                return _unauthorized_response("无效或过期的 JWT token")
            if payload.get("type") != "access":
                return _unauthorized_response("token 类型无效，需要 access token")
            sub = payload.get("sub")
            if sub is None:
                return _unauthorized_response("token 中缺少用户标识")
            request.state.principal = Principal(
                type=PrincipalType.HUMAN,
                id=str(sub),
                display_name=payload.get("username", "unknown"),
            )
        elif api_key_header and self._api_key_verifier:
            key_info = await self._api_key_verifier(api_key_header)
            if key_info is None:
                return _unauthorized_response("无效的 API Key")
            request.state.principal = Principal(
                type=PrincipalType.AGENT,
                id=str(key_info["key_id"]),
                display_name=key_info.get("name", "agent"),
                owner_id=str(key_info["user_id"]),
            )
        else:
            return _unauthorized_response("缺少认证信息")

        return await call_next(request)


def get_principal(request: Request) -> Principal:
    """FastAPI 依赖：获取当前请求的 Principal。"""
    principal = getattr(request.state, "principal", None)
    if principal is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未认证",
        )
    return principal


def require_human(principal: Principal = Depends(get_principal)) -> Principal:
    """FastAPI 依赖：要求 Human 类型的 Principal。"""
    if principal.type != PrincipalType.HUMAN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="此操作仅限人类用户",
        )
    return principal


def _unauthorized_response(message: str) -> JSONResponse:
    """构造 401 JSON 响应。"""
    return JSONResponse(
        status_code=401,
        content={
            "error": {"code": "SHARED_UNAUTHORIZED", "message": message},
            "meta": {},
        },
    )
