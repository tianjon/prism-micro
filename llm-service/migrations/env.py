"""Alembic 迁移环境配置（llm schema）。"""

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

# 确保模型注册到 Base.metadata
from llm_service.models import ModelSlot, Provider  # noqa: F401
from prism_shared.db.base import Base

SCHEMA_NAME = "llm"

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """离线模式：生成 SQL 脚本。"""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        version_table_schema=SCHEMA_NAME,
        include_schemas=[SCHEMA_NAME],
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    """在连接上运行迁移。"""
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        version_table_schema=SCHEMA_NAME,
        include_schemas=[SCHEMA_NAME],
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """异步模式：连接数据库并运行迁移。"""
    connectable = create_async_engine(
        config.get_main_option("sqlalchemy.url"),
    )

    async with connectable.connect() as connection:
        # 确保 schema 存在
        await connection.execute(text(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA_NAME}"))
        await connection.commit()

        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """在线模式：连接数据库执行迁移。"""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
