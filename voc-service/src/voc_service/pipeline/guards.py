"""管线校验层：L1 格式校验 + L2 语义一致性校验。"""

import jsonschema
import structlog

from voc_service.core.llm_client import LLMClient
from voc_service.core.llm_response import extract_json_from_llm_response
from voc_service.prompts.guard_l2 import build_guard_l2_messages

logger = structlog.get_logger(__name__)

# --- L1 JSON Schema 定义 ---

STAGE1_SCHEMA: dict = {
    "type": "object",
    "required": ["units"],
    "properties": {
        "units": {
            "type": "array",
            "minItems": 1,
            "maxItems": 10,
            "items": {
                "type": "object",
                "required": ["text", "summary", "intent", "sentiment", "confidence"],
                "properties": {
                    "text": {"type": "string", "minLength": 1},
                    "summary": {"type": "string", "maxLength": 200},
                    "intent": {"type": "string"},
                    "sentiment": {
                        "enum": ["positive", "negative", "neutral", "mixed"],
                    },
                    "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                },
            },
        }
    },
}

STAGE2_SCHEMA: dict = {
    "type": "object",
    "required": ["tagged_units"],
    "properties": {
        "tagged_units": {
            "type": "array",
            "minItems": 1,
            "items": {
                "type": "object",
                "required": ["unit_index", "tags"],
                "properties": {
                    "unit_index": {"type": "integer", "minimum": 0},
                    "tags": {
                        "type": "array",
                        "minItems": 1,
                        "maxItems": 5,
                        "items": {
                            "type": "object",
                            "required": ["raw_name"],
                            "properties": {
                                "raw_name": {"type": "string", "minLength": 1},
                                "relevance": {"type": "number"},
                                "is_primary": {"type": "boolean"},
                                "confidence": {"type": "number"},
                            },
                        },
                    },
                },
            },
        }
    },
}


class L1ValidationError(Exception):
    """L1 格式校验失败。"""

    def __init__(self, message: str, errors: list[str] | None = None):
        super().__init__(message)
        self.errors = errors or []


def validate_l1(data: dict, schema: dict) -> None:
    """L1 格式校验，失败抛出 L1ValidationError。"""
    try:
        jsonschema.validate(instance=data, schema=schema)
    except jsonschema.ValidationError as e:
        raise L1ValidationError(
            message=f"L1 校验失败：{e.message}",
            errors=[e.message],
        ) from e


async def validate_l2(
    llm_client: LLMClient,
    raw_text: str,
    units: list[dict],
    *,
    temperature: float = 0.2,
) -> dict:
    """L2 语义一致性校验（调用 fast 槽位）。

    返回 {"consistent": bool, "confidence": float, "issues": [...]}
    非阻塞：失败只记日志不中断管线。
    """
    messages = build_guard_l2_messages(raw_text, units)
    try:
        response = await llm_client.invoke_slot(
            slot="fast",
            messages=messages,
            temperature=temperature,
            max_tokens=1024,
        )
        result = extract_json_from_llm_response(response)
        logger.info(
            "L2 校验完成",
            consistent=result.get("consistent"),
            confidence=result.get("confidence"),
            issues_count=len(result.get("issues", [])),
        )
        return result
    except Exception:
        logger.warning("L2 校验失败，跳过", exc_info=True)
        return {"consistent": True, "confidence": 0.0, "issues": []}
