"""FastAPI 依赖注入。"""

import uuid
from collections.abc import AsyncGenerator

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from prism_shared.auth.deps import create_get_current_active_user
from prism_shared.auth.jwt import decode_token
from user_service.core.config import UserServiceSettings
from user_service.models.user import User

_bearer_scheme = HTTPBearer(auto_error=False)


def get_settings(request: Request) -> UserServiceSettings:
    """获取 UserServiceSettings。

    统一开发服务器中使用 app.state.user_settings；
    独立部署时使用 app.state.settings。
    """
    return getattr(request.app.state, "user_settings", None) or request.app.state.settings


async def get_session(request: Request) -> AsyncGenerator[AsyncSession, None]:
    """FastAPI 依赖：获取数据库 session。"""
    session_factory = request.app.state.session_factory
    async with session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_session),
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> User:
    """鉴权依赖：获取当前登录用户。"""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="缺少认证信息",
            headers={"WWW-Authenticate": "Bearer"},
        )

    settings = get_settings(request)
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

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="token 中缺少用户标识",
        )

    try:
        uid = uuid.UUID(user_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的用户标识",
        ) from exc

    result = await db.execute(select(User).where(User.id == uid))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在",
        )

    request.state.token_payload = payload
    return user


get_current_active_user = create_get_current_active_user(get_current_user)
