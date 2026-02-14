"""Stage 1: 语义拆解 — Voice → N × SemanticUnit。"""

import structlog

from voc_service.core.config import VocServiceSettings
from voc_service.core.llm_client import LLMClient
from voc_service.core.llm_response import extract_json_from_llm_response
from voc_service.models.semantic_unit import SemanticUnit
from voc_service.models.voice import Voice
from voc_service.pipeline.guards import (
    STAGE1_SCHEMA,
    L1ValidationError,
    validate_l1,
    validate_l2,
)
from voc_service.prompts.stage1 import (
    build_stage1_messages,
    build_stage1_simplified_messages,
)

logger = structlog.get_logger(__name__)


class SemanticSplitter:
    """Stage 1: Voice → N × SemanticUnit。

    三级降级策略：
    1. 正常 Prompt(reasoning, temperature=0.5) + L1 校验
    2. 简化 Prompt(reasoning, temperature=0.3) + L1 校验
    3. 兜底：整条 raw_text → 单个 SemanticUnit(confidence=0, intent=unclassified)
    """

    def __init__(self, llm_client: LLMClient, settings: VocServiceSettings) -> None:
        self._llm = llm_client
        self._settings = settings

    async def split(self, voice: Voice) -> list[SemanticUnit]:
        """对一条 Voice 执行语义拆解，返回 SemanticUnit 列表。"""
        raw_text = voice.raw_text

        # --- Level 1：正常 Prompt ---
        units_data = await self._try_split(
            raw_text,
            build_stage1_messages(raw_text),
            temperature=self._settings.stage1_temperature,
            level="L1-normal",
        )

        # --- Level 2：简化 Prompt 降级 ---
        if units_data is None:
            units_data = await self._try_split(
                raw_text,
                build_stage1_simplified_messages(raw_text),
                temperature=0.3,
                level="L2-simplified",
            )

        # --- Level 3：兜底 ---
        if units_data is None:
            logger.warning("Stage 1 三级降级均失败，使用兜底", voice_id=str(voice.id))
            return [
                SemanticUnit(
                    voice_id=voice.id,
                    text=raw_text,
                    summary=raw_text[:200],
                    intent="unclassified",
                    sentiment="neutral",
                    confidence=0.0,
                    sequence_index=0,
                )
            ]

        # L2 语义一致性校验（非阻塞）
        await validate_l2(
            self._llm,
            raw_text,
            units_data["units"],
            temperature=self._settings.guard_l2_temperature,
        )

        # 构建 SemanticUnit ORM 对象
        return [
            SemanticUnit(
                voice_id=voice.id,
                text=u["text"],
                summary=u.get("summary", ""),
                intent=u.get("intent"),
                sentiment=u.get("sentiment"),
                confidence=u.get("confidence"),
                sequence_index=idx,
            )
            for idx, u in enumerate(units_data["units"])
        ]

    async def _try_split(
        self,
        raw_text: str,
        messages: list[dict],
        *,
        temperature: float,
        level: str,
    ) -> dict | None:
        """尝试一次 LLM 调用 + L1 校验，失败返回 None。"""
        try:
            response = await self._llm.invoke_slot(
                slot="reasoning",
                messages=messages,
                temperature=temperature,
                max_tokens=4096,
            )
            data = extract_json_from_llm_response(response)
            validate_l1(data, STAGE1_SCHEMA)
            logger.info(
                "Stage 1 拆解成功",
                level=level,
                units_count=len(data["units"]),
            )
            return data
        except (L1ValidationError, Exception) as e:
            logger.warning(
                "Stage 1 拆解失败",
                level=level,
                error=str(e),
                raw_text_preview=raw_text[:100],
            )
            return None
