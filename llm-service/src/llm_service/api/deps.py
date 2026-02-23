"""FastAPI 依赖注入。"""

from collections.abc import AsyncGenerator
from typing import Any

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from llm_service.core.config import LLMServiceSettings
from prism_shared.auth import Principal, PrincipalType, get_principal


def get_settings(request: Request) -> LLMServiceSettings:
    """获取全局 Settings 实例。"""
    return request.app.state.settings


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


def get_encryption_key(settings: LLMServiceSettings = Depends(get_settings)) -> str:
    """获取加密密钥。"""
    return settings.llm_encryption_key


# --- 鉴权依赖 ---
# llm-service 不 import user-service 的模型，直接用 raw SQL 查 auth.users 表。
# 返回一个轻量 dict 而非 ORM 对象，满足 is_active / role 检查需求。


class _UserRecord:
    """轻量用户记录，避免跨服务 import ORM 模型。"""

    def __init__(self, row: Any) -> None:
        self.id = row.id
        self.email = row.email
        self.role = row.role
        self.is_active = row.is_active


async def get_current_user(
    principal: Principal = Depends(get_principal),
    db: AsyncSession = Depends(get_db),
) -> _UserRecord:
    """鉴权依赖：获取当前用户（Human 本人或 Agent 对应 owner）。"""
    if principal.type == PrincipalType.HUMAN:
        user_id = principal.id
    elif principal.type == PrincipalType.AGENT and principal.owner_id:
        user_id = principal.owner_id
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Agent 缺少 owner 绑定信息",
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

    user = _UserRecord(row)
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="用户已被禁用",
        )
    return user


async def require_admin(
    current_user: _UserRecord = Depends(get_current_user),
) -> _UserRecord:
    """鉴权依赖：要求管理员角色。"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理员权限",
        )
    return current_user
