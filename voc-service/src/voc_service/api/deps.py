"""FastAPI 依赖注入。"""

from collections.abc import AsyncGenerator
from typing import Any

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from voc_service.core.config import VocServiceSettings
from voc_service.core.llm_client import LLMClient


def get_settings(request: Request) -> VocServiceSettings:
    """获取 VocServiceSettings 实例。

    统一开发服务器中存储在 app.state.voc_settings，
    独立部署时存储在 app.state.settings。
    """
    return getattr(request.app.state, "voc_settings", None) or request.app.state.settings


async def get_db(request: Request) -> AsyncGenerator[AsyncSession, None]:
    """获取数据库 session。"""
    session_factory = request.app.state.session_factory
    async with session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


def get_llm_client(
    settings: VocServiceSettings = Depends(get_settings),
) -> LLMClient:
    """获取 LLM 客户端实例。"""
    return LLMClient(
        base_url=settings.llm_service_base_url,
        timeout=settings.llm_service_timeout,
    )


# --- 鉴权依赖 ---
# voc-service 不 import user-service 的模型，直接用 raw SQL 查 auth.users 表。


class UserRecord:
    """轻量用户记录，避免跨服务 import ORM 模型。"""

    def __init__(self, row: Any) -> None:
        self.id = row.id
        self.email = row.email
        self.role = row.role
        self.is_active = row.is_active


# 保留旧名以兼容已有 import
_UserRecord = UserRecord


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> UserRecord:
    """鉴权依赖：获取当前登录用户（复用 get_db session，避免双连接）。"""
    from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

    _bearer = HTTPBearer(auto_error=False)
    credentials: HTTPAuthorizationCredentials | None = await _bearer(request)

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="缺少认证信息",
            headers={"WWW-Authenticate": "Bearer"},
        )

    from prism_shared.auth.jwt import decode_token

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

    result = await db.execute(
        text("SELECT id, email, role, is_active FROM auth.users WHERE id = :uid"),
        {"uid": user_id},
    )
    row = result.first()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在",
        )

    user = UserRecord(row)
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="用户已被禁用",
        )

    request.state.token_payload = payload
    return user
