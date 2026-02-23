"""标签管理 API 测试（T15 反馈 + T16 列表/详情）。"""

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import pytest
from httpx import AsyncClient

from .conftest import NOW, TEST_TAG_ID, TEST_UNIT_ID, MockRow

pytestmark = pytest.mark.asyncio


# --- 辅助函数 ---


def _make_tag_row(
    *,
    tag_id: UUID = TEST_TAG_ID,
    name: str = "充电速度",
    usage_count: int = 15,
    confidence: float = 0.85,
    status: str = "active",
    fb_useful: int = 5,
    fb_useless: int = 1,
    fb_error: int = 0,
    created_at: datetime = NOW,
    **kwargs,
) -> MockRow:
    """构建模拟标签行。"""
    return MockRow(
        id=tag_id,
        name=name,
        usage_count=usage_count,
        confidence=confidence,
        status=status,
        fb_useful=fb_useful,
        fb_useless=fb_useless,
        fb_error=fb_error,
        created_at=created_at,
        **kwargs,
    )


def _make_detail_row(*, unit_count: int = 8, **kwargs) -> MockRow:
    """构建标签详情行。"""
    defaults = {
        "raw_name": "充电速度慢",
        "parent_tag_id": None,
        "updated_at": NOW,
    }
    defaults.update(kwargs)
    return _make_tag_row(unit_count=unit_count, **defaults)


def _make_unit_row(
    *,
    unit_id: UUID = TEST_UNIT_ID,
    text: str = "充电速度太慢了，要两个小时才能充满",
    summary: str = "用户反馈充电速度慢",
    intent: str = "complaint",
    sentiment: str = "negative",
    relevance: float = 0.92,
    is_primary: bool = True,
    created_at: datetime = NOW,
) -> MockRow:
    """构建关联单元行。"""
    return MockRow(
        unit_id=unit_id,
        text=text,
        summary=summary,
        intent=intent,
        sentiment=sentiment,
        relevance=relevance,
        is_primary=is_primary,
        created_at=created_at,
    )


# --- T15：标签反馈 ---


class TestTagFeedback:
    """POST /api/voc/tags/{tag_id}/feedback"""

    async def test_submit_new_feedback(self, client: AsyncClient, mock_db: AsyncMock):
        """首次提交反馈 → is_update=false。"""
        # 标签存在
        tag_exists_result = MagicMock()
        tag_exists_result.scalar_one_or_none.return_value = TEST_TAG_ID

        # 无已有反馈
        no_existing = MagicMock()
        no_existing.scalar_one_or_none.return_value = None

        # UPSERT 执行
        upsert_result = MagicMock()

        mock_db.execute = AsyncMock(side_effect=[tag_exists_result, no_existing, upsert_result])

        resp = await client.post(
            f"/api/voc/tags/{TEST_TAG_ID}/feedback",
            json={"feedback_type": "useful"},
        )

        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["feedback_type"] == "useful"
        assert data["is_update"] is False
        assert data["previous_feedback_type"] is None

    async def test_update_existing_feedback(self, client: AsyncClient, mock_db: AsyncMock):
        """更新已有反馈 → is_update=true, previous_feedback_type 有值。"""
        tag_exists_result = MagicMock()
        tag_exists_result.scalar_one_or_none.return_value = TEST_TAG_ID

        existing = MagicMock()
        existing.scalar_one_or_none.return_value = "useful"

        upsert_result = MagicMock()

        mock_db.execute = AsyncMock(side_effect=[tag_exists_result, existing, upsert_result])

        resp = await client.post(
            f"/api/voc/tags/{TEST_TAG_ID}/feedback",
            json={"feedback_type": "error"},
        )

        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["feedback_type"] == "error"
        assert data["is_update"] is True
        assert data["previous_feedback_type"] == "useful"

    async def test_feedback_tag_not_found(self, client: AsyncClient, mock_db: AsyncMock):
        """标签不存在 → 404。"""
        not_found = MagicMock()
        not_found.scalar_one_or_none.return_value = None
        mock_db.execute = AsyncMock(return_value=not_found)

        resp = await client.post(
            f"/api/voc/tags/{TEST_TAG_ID}/feedback",
            json={"feedback_type": "useful"},
        )

        assert resp.status_code == 404
        assert "VOC_TAG_NOT_FOUND" in resp.json()["error"]["code"]

    async def test_feedback_invalid_type(self, client: AsyncClient):
        """无效反馈类型 → 422（Pydantic 校验）。"""
        resp = await client.post(
            f"/api/voc/tags/{TEST_TAG_ID}/feedback",
            json={"feedback_type": "invalid"},
        )

        assert resp.status_code == 422


# --- T16：标签列表 ---


class TestTagList:
    """GET /api/voc/tags"""

    async def test_list_tags_basic(self, client: AsyncClient, mock_db: AsyncMock):
        """基本列表 → 分页结构 + feedback_summary。"""
        # COUNT 查询
        count_result = MagicMock()
        count_result.scalar_one.return_value = 2

        # DATA 查询
        row1 = _make_tag_row(name="充电速度", confidence=0.85)
        row2 = _make_tag_row(
            tag_id=UUID("00000000-0000-0000-0000-000000000011"),
            name="续航里程",
            confidence=0.65,
            usage_count=10,
        )
        data_result = MagicMock()
        data_result.all.return_value = [row1, row2]

        mock_db.execute = AsyncMock(side_effect=[count_result, data_result])

        resp = await client.get("/api/voc/tags")

        assert resp.status_code == 200
        body = resp.json()
        assert body["pagination"]["total"] == 2
        assert len(body["data"]) == 2

        item = body["data"][0]
        assert item["name"] == "充电速度"
        assert item["confidence_tier"] == "high"
        assert "feedback_summary" in item
        assert item["feedback_summary"]["useful"] == 5

    async def test_list_tags_with_filters(self, client: AsyncClient, mock_db: AsyncMock):
        """带过滤条件 → 正常返回。"""
        count_result = MagicMock()
        count_result.scalar_one.return_value = 1

        row = _make_tag_row(confidence=0.9)
        data_result = MagicMock()
        data_result.all.return_value = [row]

        mock_db.execute = AsyncMock(side_effect=[count_result, data_result])

        resp = await client.get(
            "/api/voc/tags",
            params={"status": "active", "confidence_tier": "high", "min_usage": 5, "sort_by": "confidence"},
        )

        assert resp.status_code == 200
        assert resp.json()["pagination"]["total"] == 1

    async def test_list_tags_empty(self, client: AsyncClient, mock_db: AsyncMock):
        """空列表 → total=0, data=[]。"""
        count_result = MagicMock()
        count_result.scalar_one.return_value = 0

        data_result = MagicMock()
        data_result.all.return_value = []

        mock_db.execute = AsyncMock(side_effect=[count_result, data_result])

        resp = await client.get("/api/voc/tags")

        assert resp.status_code == 200
        assert resp.json()["data"] == []
        assert resp.json()["pagination"]["total"] == 0


# --- T16：标签详情 ---


class TestTagDetail:
    """GET /api/voc/tags/{tag_id}"""

    async def test_get_detail(self, client: AsyncClient, mock_db: AsyncMock):
        """详情 → 含 unit_count + feedback_summary + raw_name。"""
        row = _make_detail_row(unit_count=8, confidence=0.85)
        result = MagicMock()
        result.first.return_value = row

        mock_db.execute = AsyncMock(return_value=result)

        resp = await client.get(f"/api/voc/tags/{TEST_TAG_ID}")

        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["unit_count"] == 8
        assert data["raw_name"] == "充电速度慢"
        assert data["confidence_tier"] == "high"
        assert data["feedback_summary"]["useful"] == 5

    async def test_detail_not_found(self, client: AsyncClient, mock_db: AsyncMock):
        """标签不存在 → 404。"""
        result = MagicMock()
        result.first.return_value = None

        mock_db.execute = AsyncMock(return_value=result)

        resp = await client.get(f"/api/voc/tags/{TEST_TAG_ID}")

        assert resp.status_code == 404


# --- T16：标签关联单元 ---


class TestTagUnits:
    """GET /api/voc/tags/{tag_id}/units"""

    async def test_list_units(self, client: AsyncClient, mock_db: AsyncMock):
        """关联单元列表 → 分页结构 + relevance 字段。"""
        # 标签存在检查
        tag_exists = MagicMock()
        tag_exists.scalar_one_or_none.return_value = TEST_TAG_ID

        # COUNT
        count_result = MagicMock()
        count_result.scalar_one.return_value = 1

        # DATA
        unit_row = _make_unit_row()
        data_result = MagicMock()
        data_result.all.return_value = [unit_row]

        mock_db.execute = AsyncMock(side_effect=[tag_exists, count_result, data_result])

        resp = await client.get(f"/api/voc/tags/{TEST_TAG_ID}/units")

        assert resp.status_code == 200
        body = resp.json()
        assert body["pagination"]["total"] == 1
        item = body["data"][0]
        assert item["relevance"] == 0.92
        assert item["is_primary"] is True

    async def test_units_tag_not_found(self, client: AsyncClient, mock_db: AsyncMock):
        """标签不存在 → 404。"""
        not_found = MagicMock()
        not_found.scalar_one_or_none.return_value = None
        mock_db.execute = AsyncMock(return_value=not_found)

        resp = await client.get(f"/api/voc/tags/{TEST_TAG_ID}/units")

        assert resp.status_code == 404

    async def test_units_with_min_relevance(self, client: AsyncClient, mock_db: AsyncMock):
        """min_relevance 参数 → 过滤低关联度单元。"""
        tag_exists = MagicMock()
        tag_exists.scalar_one_or_none.return_value = TEST_TAG_ID

        count_result = MagicMock()
        count_result.scalar_one.return_value = 0

        data_result = MagicMock()
        data_result.all.return_value = []

        mock_db.execute = AsyncMock(side_effect=[tag_exists, count_result, data_result])

        resp = await client.get(
            f"/api/voc/tags/{TEST_TAG_ID}/units",
            params={"min_relevance": 0.9},
        )

        assert resp.status_code == 200
        assert resp.json()["pagination"]["total"] == 0
