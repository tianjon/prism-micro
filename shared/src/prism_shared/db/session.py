"""SQLAlchemy 异步 session 工厂。"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from prism_shared.db.pool_config import PoolConfig


def create_engine(database_url: str, pool_config: PoolConfig | None = None) -> AsyncEngine:
    """创建异步数据库引擎。"""
    pc = pool_config or PoolConfig()
    return create_async_engine(
        database_url,
        pool_size=pc.pool_size,
        max_overflow=pc.max_overflow,
        pool_timeout=pc.pool_timeout,
        pool_recycle=pc.pool_recycle,
        pool_pre_ping=True,  # L0 弹性：连接有效性预检
        echo=False,
    )


def create_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    """创建异步 session 工厂。"""
    return async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )


async def get_db_session(
    session_factory: async_sessionmaker[AsyncSession],
) -> AsyncGenerator[AsyncSession, None]:
    """FastAPI 依赖：获取数据库 session，自动管理事务。"""
    async with session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
