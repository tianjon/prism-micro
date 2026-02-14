"""Stage 2: 标签涌现 + 标准化 — SemanticUnit → EmergentTag + UnitTagAssociation。"""

import structlog
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from voc_service.core.config import VocServiceSettings
from voc_service.core.llm_client import LLMClient
from voc_service.core.llm_response import extract_json_from_llm_response
from voc_service.models.emergent_tag import EmergentTag
from voc_service.models.semantic_unit import SemanticUnit
from voc_service.models.unit_tag_association import UnitTagAssociation
from voc_service.pipeline.guards import (
    STAGE2_SCHEMA,
    L1ValidationError,
    validate_l1,
)
from voc_service.prompts.normalize import build_normalize_messages
from voc_service.prompts.stage2 import build_stage2_tagging_messages

logger = structlog.get_logger(__name__)


class TagEmergenceProcessor:
    """Stage 2: SemanticUnit → EmergentTag + UnitTagAssociation。

    两步流程：
    1. reasoning 槽位生成原始标签 + L1 校验
    2. fast 槽位标准化（合并同义、去冗余修饰）
    3. UPSERT EmergentTag
    4. 创建 UnitTagAssociation
    """

    def __init__(
        self,
        llm_client: LLMClient,
        db: AsyncSession,
        settings: VocServiceSettings,
    ) -> None:
        self._llm = llm_client
        self._db = db
        self._settings = settings

    async def tag(self, units: list[SemanticUnit]) -> list[EmergentTag]:
        """对一组 SemanticUnit 执行标签涌现，返回关联的 EmergentTag 列表。"""
        if not units:
            return []

        # 构建用于 Prompt 的 unit dict 列表
        units_for_prompt = [
            {
                "text": u.text,
                "summary": u.summary or "",
                "intent": u.intent or "unknown",
                "sentiment": u.sentiment or "neutral",
            }
            for u in units
        ]

        # Step 1: reasoning 槽位生成原始标签
        tagging_data = await self._generate_raw_tags(units_for_prompt)
        if tagging_data is None:
            logger.warning("Stage 2 标签生成失败，跳过")
            return []

        # 收集所有原始标签名用于标准化
        all_raw_names: list[str] = []
        for tu in tagging_data["tagged_units"]:
            for tag in tu["tags"]:
                if tag["raw_name"] not in all_raw_names:
                    all_raw_names.append(tag["raw_name"])

        # Step 2: fast 槽位标准化
        normalize_map = await self._normalize_tags(all_raw_names)

        # Step 3 + 4: UPSERT EmergentTag + 创建关联
        all_tags: list[EmergentTag] = []
        for tu in tagging_data["tagged_units"]:
            unit_index = tu["unit_index"]
            if unit_index < 0 or unit_index >= len(units):
                logger.warning("unit_index 越界", unit_index=unit_index, total=len(units))
                continue

            unit = units[unit_index]
            for tag_info in tu["tags"]:
                raw_name = tag_info["raw_name"]
                normalized_name = normalize_map.get(raw_name, raw_name)
                confidence = tag_info.get("confidence", 0.8)

                tag = await self._upsert_tag(normalized_name, raw_name, confidence)
                all_tags.append(tag)

                # 创建关联
                assoc = UnitTagAssociation(
                    unit_id=unit.id,
                    tag_id=tag.id,
                    relevance=tag_info.get("relevance", 1.0),
                    is_primary=tag_info.get("is_primary", False),
                    source="llm_emergent",
                )
                self._db.add(assoc)

        return all_tags

    async def _generate_raw_tags(self, units: list[dict]) -> dict | None:
        """调用 reasoning 槽位生成原始标签。"""
        messages = build_stage2_tagging_messages(units)
        try:
            response = await self._llm.invoke_slot(
                slot="reasoning",
                messages=messages,
                temperature=self._settings.stage2_temperature,
                max_tokens=4096,
            )
            data = extract_json_from_llm_response(response)
            validate_l1(data, STAGE2_SCHEMA)
            logger.info(
                "Stage 2 标签生成成功",
                tagged_units_count=len(data["tagged_units"]),
            )
            return data
        except (L1ValidationError, Exception) as e:
            logger.warning("Stage 2 标签生成失败", error=str(e))
            return None

    async def _normalize_tags(
        self,
        raw_names: list[str],
    ) -> dict[str, str]:
        """标签标准化：raw_name → normalized_name 映射。"""
        if not raw_names:
            return {}

        # 查询已有标签用于合并参考
        result = await self._db.execute(select(EmergentTag.name).where(EmergentTag.status == "active").limit(100))
        existing_tags = [row[0] for row in result.all()]

        messages = build_normalize_messages(raw_names, existing_tags or None)
        try:
            response = await self._llm.invoke_slot(
                slot="fast",
                messages=messages,
                temperature=self._settings.normalize_temperature,
                max_tokens=2048,
            )
            data = extract_json_from_llm_response(response)

            mapping: dict[str, str] = {}
            for item in data.get("normalized", []):
                raw = item.get("raw_name", "")
                # 如果有 merged_into 且不为 null，使用合并目标
                merged = item.get("merged_into")
                normalized = merged if merged else item.get("normalized_name", raw)
                mapping[raw] = normalized

            logger.info("标签标准化完成", count=len(mapping))
            return mapping
        except Exception as e:
            logger.warning("标签标准化失败，使用原始名称", error=str(e))
            return {name: name for name in raw_names}

    async def _upsert_tag(
        self,
        name: str,
        raw_name: str,
        confidence: float,
    ) -> EmergentTag:
        """UPSERT EmergentTag：已存在则 usage_count +1，否则新建。"""
        # 查找已有标签
        result = await self._db.execute(select(EmergentTag).where(EmergentTag.name == name))
        existing = result.scalar_one_or_none()

        if existing is not None:
            existing.usage_count += 1
            return existing

        # 新建标签
        tag = EmergentTag(
            name=name,
            raw_name=raw_name,
            usage_count=1,
            confidence=confidence,
            status="active",
        )
        self._db.add(tag)
        try:
            await self._db.flush()
        except IntegrityError:
            # 并发竞争：另一个 worker 先创建了同名标签
            await self._db.rollback()
            result = await self._db.execute(select(EmergentTag).where(EmergentTag.name == name))
            tag = result.scalar_one()
            tag.usage_count += 1

        return tag
