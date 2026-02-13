"""FastAPI 依赖注入。"""

from collections.abc import AsyncGenerator

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from llm_service.core.config import LLMServiceSettings


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
