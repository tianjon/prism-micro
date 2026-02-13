"""FastAPI 依赖注入。"""

import uuid
from collections.abc import AsyncGenerator
from functools import lru_cache

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from prism_shared.auth.deps import create_get_current_active_user, create_get_current_user
from prism_shared.db.session import create_engine, create_session_factory
from user_service.core.config import UserServiceSettings
from user_service.core.service import get_user_by_id


@lru_cache
def get_settings() -> UserServiceSettings:
    """获取服务配置（单例）。"""
    return UserServiceSettings()


def _build_session_factory() -> async_sessionmaker[AsyncSession]:
    """构建 session 工厂。"""
    settings = get_settings()
    engine = create_engine(settings.database_url)
    return create_session_factory(engine)


# 全局 session 工厂（延迟初始化）
_session_factory: async_sessionmaker[AsyncSession] | None = None


def _get_session_factory() -> async_sessionmaker[AsyncSession]:
    global _session_factory
    if _session_factory is None:
        _session_factory = _build_session_factory()
    return _session_factory


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI 依赖：获取数据库 session。"""
    factory = _get_session_factory()
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def _user_lookup(user_id: str):
    """用户查找回调，供认证依赖使用。"""
    factory = _get_session_factory()
    async with factory() as session:
        return await get_user_by_id(session, uuid.UUID(user_id))


# 认证依赖
_settings = get_settings()
get_current_user = create_get_current_user(
    jwt_secret=_settings.jwt_secret,
    user_lookup=_user_lookup,
)
get_current_active_user = create_get_current_active_user(get_current_user)
