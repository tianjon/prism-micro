"""FastAPI 认证依赖注入。"""

from typing import Any, Protocol

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from prism_shared.auth.jwt import decode_token

_bearer_scheme = HTTPBearer(auto_error=False)


class UserLookup(Protocol):
    """用户查找协议。各服务提供具体实现。"""

    async def __call__(self, user_id: str) -> Any | None: ...


def create_get_current_user(jwt_secret: str, user_lookup: UserLookup):
    """
    工厂函数：创建 get_current_user 依赖。

    各服务在初始化时调用此函数，传入自己的 jwt_secret 和 user_lookup 实现。
    这样 shared 不需要直接依赖任何服务的 DB 模型。
    """

    async def get_current_user(
        request: Request,
        credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    ) -> Any:
        if credentials is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="缺少认证信息",
                headers={"WWW-Authenticate": "Bearer"},
            )

        payload = decode_token(credentials.credentials, jwt_secret)
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无效或过期的 token",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # 校验 token 类型：仅接受 access token
        if payload.get("type") != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="token 类型无效，需要 access token",
                headers={"WWW-Authenticate": "Bearer"},
            )

        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="token 中缺少用户标识",
            )

        user = await user_lookup(user_id)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户不存在",
            )

        # 将 token payload 存入 request.state 供后续使用
        request.state.token_payload = payload
        return user

    return get_current_user


def create_get_current_active_user(get_current_user):
    """
    工厂函数：创建 get_current_active_user 依赖。
    在 get_current_user 基础上额外检查用户是否激活。
    要求用户对象具有 is_active 属性。
    """

    async def get_current_active_user(user=Depends(get_current_user)) -> Any:
        if not getattr(user, "is_active", True):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="用户已被禁用",
            )
        return user

    return get_current_active_user
