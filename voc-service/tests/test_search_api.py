"""语义搜索 API 测试（T12 基本搜索 + T13 rerank）。"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import AsyncClient

from .conftest import TEST_TAG_ID, TEST_UNIT_ID

pytestmark = pytest.mark.asyncio

NOW = datetime(2026, 1, 15, 12, 0, 0, tzinfo=UTC)


def _make_search_mappings(*, count: int = 1, with_embedding: bool = True) -> list[dict]:
    """构建模拟搜索结果 mappings。"""
    rows = []
    for i in range(count):
        rows.append(
            {
                "unit_id": TEST_UNIT_ID,
                "text": f"测试语义单元 {i}",
                "summary": f"摘要 {i}",
                "intent": "complaint",
                "sentiment": "negative",
                "confidence": 0.85,
                "voice_id": TEST_TAG_ID,
                "voice_source": "dongchedi",
                "voice_created_at": NOW,
                "similarity_score": round(0.95 - i * 0.05, 6),
            }
        )
    return rows


def _make_tag_mappings() -> list[dict]:
    """构建标签关联 mappings（空）。"""
    return []


class TestSearch:
    """POST /api/voc/search"""

    async def test_basic_search(self, client: AsyncClient, mock_db: AsyncMock):
        """基本搜索 → 含 query / total / results。"""
        # 向量搜索结果
        search_result = MagicMock()
        search_result.mappings.return_value.all.return_value = _make_search_mappings(count=2)

        # 标签查询结果（空）
        tag_result = MagicMock()
        tag_result.mappings.return_value.all.return_value = _make_tag_mappings()

        mock_db.execute = AsyncMock(side_effect=[search_result, tag_result])

        resp = await client.post(
            "/api/voc/search",
            json={"query": "充电速度慢"},
        )

        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["query"] == "充电速度慢"
        assert data["total"] == 2
        assert len(data["results"]) == 2

        item = data["results"][0]
        assert "similarity_score" in item
        assert "confidence_tier" in item
        assert item["rerank_score"] is None

    async def test_search_with_rerank(self, client: AsyncClient, mock_db: AsyncMock):
        """启用 rerank → rerank_score 有值。"""
        search_result = MagicMock()
        search_result.mappings.return_value.all.return_value = _make_search_mappings(count=3)

        tag_result = MagicMock()
        tag_result.mappings.return_value.all.return_value = _make_tag_mappings()

        mock_db.execute = AsyncMock(side_effect=[search_result, tag_result])

        resp = await client.post(
            "/api/voc/search",
            json={"query": "充电问题", "rerank": True, "top_k": 3},
        )

        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["total"] > 0
        # rerank 启用后，结果应带 rerank_score
        for result in data["results"]:
            assert result["rerank_score"] is not None

    async def test_search_empty_results(self, client: AsyncClient, mock_db: AsyncMock):
        """无匹配结果 → total=0, results=[]。"""
        search_result = MagicMock()
        search_result.mappings.return_value.all.return_value = []

        mock_db.execute = AsyncMock(return_value=search_result)

        resp = await client.post(
            "/api/voc/search",
            json={"query": "不存在的内容xyz"},
        )

        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["total"] == 0
        assert data["results"] == []

    async def test_search_requires_auth(self, client: AsyncClient):
        """未认证 → 401。"""
        # 清除 auth 覆盖，恢复真实鉴权
        from voc_service.api.deps import get_current_user

        app = client._transport.app  # type: ignore[attr-defined]
        if get_current_user in app.dependency_overrides:
            del app.dependency_overrides[get_current_user]

        resp = await client.post(
            "/api/voc/search",
            json={"query": "测试"},
        )

        assert resp.status_code == 401

    async def test_search_invalid_query(self, client: AsyncClient):
        """空查询 → 422（Pydantic 校验）。"""
        resp = await client.post(
            "/api/voc/search",
            json={"query": ""},
        )

        assert resp.status_code == 422
