"""LLM 响应解析工具。"""

import json
import re

import structlog

from prism_shared.exceptions import AppException

logger = structlog.get_logger(__name__)


def extract_json_from_llm_response(llm_response: dict) -> dict:
    """从 llm-service 槽位调用响应中提取 JSON。

    处理 data.result.content 格式 + markdown 代码块。

    Args:
        llm_response: llm-service 返回的完整响应 dict

    Returns:
        解析后的 JSON dict

    Raises:
        AppException: 响应格式异常或 JSON 解析失败
    """
    try:
        data = llm_response.get("data", {})
        content = data.get("result", {}).get("content", "")
    except (AttributeError, TypeError) as e:
        raise AppException(
            code="VOC_LLM_RESPONSE_INVALID",
            message="LLM 响应格式异常",
            status_code=422,
        ) from e

    if not content:
        raise AppException(
            code="VOC_LLM_RESPONSE_INVALID",
            message="LLM 未返回内容",
            status_code=422,
        )

    return parse_json_from_text(content)


def parse_json_from_text(text: str) -> dict:
    """从文本中提取 JSON（支持 markdown 代码块）。

    Args:
        text: 可能包含 markdown 代码块的 JSON 文本

    Returns:
        解析后的 JSON dict

    Raises:
        AppException: JSON 解析失败
    """
    json_str = text.strip()
    # 优先匹配完整的 markdown 代码块
    fence_match = re.search(r"```(?:\w*)\s*\n(.*?)```", json_str, re.DOTALL)
    if fence_match:
        json_str = fence_match.group(1).strip()
    elif json_str.startswith("```"):
        # 处理截断的代码块（LLM 响应被 max_tokens 截断，缺少闭合标记）
        json_str = re.sub(r"^```\w*\s*\n?", "", json_str).strip()

    try:
        return json.loads(json_str)
    except json.JSONDecodeError as e:
        logger.error("JSON 解析失败", content=text[:500], error=str(e))
        raise AppException(
            code="VOC_LLM_RESPONSE_INVALID",
            message=f"LLM 输出 JSON 解析失败：{e}",
            status_code=422,
        ) from e
