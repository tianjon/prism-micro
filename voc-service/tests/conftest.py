"""voc-service 测试基础设施。

提供共享 fixture：Mock DB session、Settings、UserRecord、LLMClient、httpx 测试客户端。
"""

from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from typing import Any
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from voc_service.api.deps import UserRecord, get_current_user, get_db, get_llm_client, get_settings
from voc_service.app import create_app
from voc_service.core.config import VocServiceSettings
from voc_service.core.llm_client import LLMClient

# --- 常量 ---
TEST_USER_ID = UUID("00000000-0000-0000-0000-000000000001")
TEST_TAG_ID = UUID("00000000-0000-0000-0000-000000000010")
TEST_UNIT_ID = UUID("00000000-0000-0000-0000-000000000020")

NOW = datetime(2026, 1, 15, 12, 0, 0, tzinfo=UTC)


# --- Settings ---


@pytest.fixture()
def settings() -> VocServiceSettings:
    """测试用配置。"""
    return VocServiceSettings(
        database_url="postgresql+asyncpg://test:test@prism.test:5432/test",
        redis_url="redis://prism.test:6379",
        jwt_secret="test-secret-key",
        debug=True,
        llm_service_base_url="http://prism.test:8601",
        llm_service_timeout=10,
        confidence_high_threshold=0.8,
        confidence_medium_threshold=0.6,
    )


# --- Mock DB Session ---


@pytest.fixture()
def mock_db() -> AsyncMock:
    """Mock AsyncSession，测试用例需自行配置 execute 返回值。"""
    session = AsyncMock(spec=AsyncSession)
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    return session


# --- Mock User ---


class MockRow:
    """模拟 SQLAlchemy Row 对象。"""

    def __init__(self, **kwargs: Any) -> None:
        for k, v in kwargs.items():
            setattr(self, k, v)


@pytest.fixture()
def test_user() -> UserRecord:
    """测试用户。"""
    row = MockRow(id=TEST_USER_ID, email="test@example.com", role="user", is_active=True)
    return UserRecord(row)


# --- Mock LLM Client ---


@pytest.fixture()
def mock_llm_client() -> MagicMock:
    """Mock LLMClient，预置 embedding / rerank / invoke_slot 返回。"""
    client = MagicMock(spec=LLMClient)

    # embedding：返回 1024 维全 0.1 向量
    async def mock_embedding(*, texts: list[str], **kwargs: Any) -> list[list[float]]:
        return [[0.1] * 1024 for _ in texts]

    client.embedding = AsyncMock(side_effect=mock_embedding)

    # rerank：按原序返回，score 递减
    async def mock_rerank(*, query: str, documents: list[str], top_n: int | None = None, **kwargs: Any) -> list[dict]:
        n = top_n or len(documents)
        return [
            {"index": i, "document": documents[i], "relevance_score": round(1.0 - i * 0.1, 2)}
            for i in range(min(n, len(documents)))
        ]

    client.rerank = AsyncMock(side_effect=mock_rerank)

    # invoke_slot：返回合规 L2 结果
    async def mock_invoke_slot(**kwargs: Any) -> dict:
        return {"data": {"result": {"content": '{"consistent": true, "confidence": 0.95, "issues": []}'}}}

    client.invoke_slot = AsyncMock(side_effect=mock_invoke_slot)

    return client


# --- FastAPI 测试客户端 ---


@pytest_asyncio.fixture()
async def client(
    settings: VocServiceSettings,
    mock_db: AsyncMock,
    test_user: UserRecord,
    mock_llm_client: MagicMock,
) -> AsyncGenerator[AsyncClient, None]:
    """httpx.AsyncClient 测试客户端，依赖注入全部用 Mock 替代。"""
    app = create_app(settings)

    # 覆盖依赖
    async def override_get_db():
        yield mock_db

    def override_get_settings():
        return settings

    async def override_get_current_user():
        return test_user

    def override_get_llm_client():
        return mock_llm_client

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_settings] = override_get_settings
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_llm_client] = override_get_llm_client

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
