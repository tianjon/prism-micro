"""管线校验层单元测试（L1 格式校验 + L2 语义一致性校验）。"""

from unittest.mock import AsyncMock, MagicMock

import pytest

from voc_service.core.llm_response import extract_json_from_llm_response, parse_json_from_text
from voc_service.pipeline.guards import (
    STAGE1_SCHEMA,
    STAGE2_SCHEMA,
    L1ValidationError,
    validate_l1,
    validate_l2,
)
from voc_service.prompts.guard_l2 import build_guard_l2_messages


# --- L1 格式校验 ---


class TestL1Validation:
    """validate_l1 + JSON Schema 校验。"""

    def test_valid_stage1_data(self):
        """合规 Stage 1 数据 → 通过。"""
        data = {
            "units": [
                {
                    "text": "充电速度太慢了",
                    "summary": "用户反馈充电慢",
                    "intent": "complaint",
                    "sentiment": "negative",
                    "confidence": 0.85,
                }
            ]
        }
        # 不应抛出异常
        validate_l1(data, STAGE1_SCHEMA)

    def test_stage1_missing_required_field(self):
        """缺少必填字段 → L1ValidationError。"""
        data = {
            "units": [
                {
                    "text": "充电速度太慢了",
                    # 缺少 summary / intent / sentiment / confidence
                }
            ]
        }
        with pytest.raises(L1ValidationError):
            validate_l1(data, STAGE1_SCHEMA)

    def test_stage1_empty_units(self):
        """空 units 数组 → L1ValidationError（minItems=1）。"""
        data = {"units": []}
        with pytest.raises(L1ValidationError):
            validate_l1(data, STAGE1_SCHEMA)

    def test_stage1_invalid_sentiment(self):
        """无效 sentiment 枚举值 → L1ValidationError。"""
        data = {
            "units": [
                {
                    "text": "很好",
                    "summary": "好评",
                    "intent": "praise",
                    "sentiment": "happy",  # 不在 enum 中
                    "confidence": 0.9,
                }
            ]
        }
        with pytest.raises(L1ValidationError):
            validate_l1(data, STAGE1_SCHEMA)

    def test_valid_stage2_data(self):
        """合规 Stage 2 数据 → 通过。"""
        data = {
            "tagged_units": [
                {
                    "unit_index": 0,
                    "tags": [{"raw_name": "充电速度", "relevance": 0.9, "is_primary": True, "confidence": 0.85}],
                }
            ]
        }
        validate_l1(data, STAGE2_SCHEMA)

    def test_stage2_missing_tags(self):
        """缺少 tags → L1ValidationError。"""
        data = {"tagged_units": [{"unit_index": 0}]}
        with pytest.raises(L1ValidationError):
            validate_l1(data, STAGE2_SCHEMA)


# --- L2 语义一致性校验 ---


class TestL2Validation:
    """validate_l2 语义一致性校验。"""

    async def test_l2_consistent(self):
        """L2 判定一致 → consistent=True。"""
        mock_client = MagicMock()
        mock_client.invoke_slot = AsyncMock(
            return_value={"data": {"result": {"content": '{"consistent": true, "confidence": 0.95, "issues": []}'}}}
        )

        result = await validate_l2(
            mock_client,
            raw_text="充电速度太慢了，要两个小时",
            units=[{"text": "充电速度太慢了", "intent": "complaint", "sentiment": "negative"}],
        )

        assert result["consistent"] is True
        assert result["confidence"] == 0.95
        assert result["issues"] == []

    async def test_l2_inconsistent(self):
        """L2 判定不一致 → consistent=False + issues。"""
        mock_client = MagicMock()
        mock_client.invoke_slot = AsyncMock(
            return_value={
                "data": {
                    "result": {
                        "content": (
                            '{"consistent": false, "confidence": 0.7,'
                            ' "issues": [{"type": "distortion",'
                            ' "description": "意思被歪曲", "severity": "high"}]}'
                        )
                    }
                }
            }
        )

        result = await validate_l2(
            mock_client,
            raw_text="充电速度太慢了",
            units=[{"text": "充电速度很快", "intent": "praise", "sentiment": "positive"}],
        )

        assert result["consistent"] is False
        assert len(result["issues"]) == 1

    async def test_l2_failure_returns_safe_default(self):
        """L2 调用失败 → 返回安全默认值（consistent=True）。"""
        mock_client = MagicMock()
        mock_client.invoke_slot = AsyncMock(side_effect=Exception("网络错误"))

        result = await validate_l2(
            mock_client,
            raw_text="测试文本",
            units=[{"text": "测试", "intent": "test", "sentiment": "neutral"}],
        )

        # 失败时不阻塞管线
        assert result["consistent"] is True
        assert result["confidence"] == 0.0


# --- LLM 响应解析 ---


class TestLLMResponseParsing:
    """extract_json_from_llm_response + parse_json_from_text。"""

    def test_extract_from_standard_response(self):
        """标准 llm-service 响应 → 正确解析。"""
        response = {"data": {"result": {"content": '{"units": [{"text": "测试"}]}'}}}
        result = extract_json_from_llm_response(response)
        assert result["units"][0]["text"] == "测试"

    def test_extract_from_markdown_fence(self):
        """Markdown 代码块包裹 → 正确解析。"""
        text = '```json\n{"key": "value"}\n```'
        result = parse_json_from_text(text)
        assert result["key"] == "value"

    def test_extract_empty_content(self):
        """空内容 → AppException。"""
        from prism_shared.exceptions import AppException

        response = {"data": {"result": {"content": ""}}}
        with pytest.raises(AppException, match="LLM 未返回内容"):
            extract_json_from_llm_response(response)

    def test_extract_invalid_json(self):
        """非法 JSON → AppException。"""
        from prism_shared.exceptions import AppException

        with pytest.raises(AppException, match="JSON 解析失败"):
            parse_json_from_text("not a json {{{")


# --- Prompt 构建 ---


class TestGuardPrompt:
    """build_guard_l2_messages Prompt 构建。"""

    def test_prompt_structure(self):
        """Prompt 消息列表结构正确。"""
        messages = build_guard_l2_messages(
            raw_text="充电慢",
            units=[{"text": "充电慢", "intent": "complaint", "sentiment": "negative"}],
        )
        assert len(messages) == 2
        assert messages[0]["role"] == "system"
        assert messages[1]["role"] == "user"
        assert "充电慢" in messages[1]["content"]
        assert "complaint" in messages[1]["content"]
