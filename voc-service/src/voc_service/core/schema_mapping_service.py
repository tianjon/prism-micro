"""Schema 映射服务：模板匹配 + LLM 映射生成。"""

import hashlib
from dataclasses import dataclass
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from prism_shared.exceptions import AppException
from voc_service.core.llm_client import LLMClient
from voc_service.core.llm_response import extract_json_from_llm_response
from voc_service.core.prompt_builder import PromptBuilder
from voc_service.models.schema_mapping import SchemaMapping

logger = structlog.get_logger(__name__)


def compute_column_hash(columns: list[str]) -> str:
    """计算列名集合的 SHA-256 哈希。"""
    normalized = ",".join(sorted(col.strip().lower() for col in columns))
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


@dataclass
class MappingResult:
    """映射查找/创建结果。"""

    mapping: SchemaMapping
    is_new: bool
    needs_confirmation: bool


async def find_or_create_mapping(
    db: AsyncSession,
    *,
    columns: list[str],
    sample_rows: list[dict[str, str]],
    source_format: str,
    llm_client: LLMClient,
    confidence_auto: float = 0.8,
    api_key: str | None = None,
    dedup_columns: list[str] | None = None,
) -> MappingResult:
    """
    查找或创建 Schema 映射。

    1. 按 column_hash 查找已有模板（结构匹配）
    2. 未找到则调用 LLM 生成（使用 v2 提示词 + PromptBuilder）
    """
    column_hash = compute_column_hash(columns)

    # 1. 按 column_hash 查找
    stmt = (
        select(SchemaMapping)
        .where(SchemaMapping.column_hash == column_hash)
        .order_by(SchemaMapping.usage_count.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing is not None:
        existing.usage_count += 1
        logger.info("匹配到已有 Schema 映射模板", mapping_id=str(existing.id), name=existing.name)
        return MappingResult(
            mapping=existing,
            is_new=False,
            needs_confirmation=False,
        )

    # 3. 调用 LLM 生成映射（使用 v2 PromptBuilder）
    logger.info("未找到匹配模板，调用 LLM 生成映射", column_hash=column_hash)

    prompt_builder = PromptBuilder()
    messages = prompt_builder.build_messages(columns, sample_rows, dedup_columns)

    llm_response = await llm_client.invoke_slot(
        slot="reasoning",
        messages=messages,
        temperature=0.3,
        max_tokens=4096,
        api_key=api_key,
    )

    # 解析 LLM 响应
    mapping_data = _parse_llm_mapping_response(llm_response)

    overall_confidence = mapping_data.get("overall_confidence", 0.0)
    needs_confirmation = overall_confidence < confidence_auto

    # 创建新映射
    column_mappings = {
        m["source_column"]: {
            "target": m["target_field"],
            "confidence": m["confidence"],
            "reason": m.get("reason", ""),
        }
        for m in mapping_data.get("mappings", [])
    }

    new_mapping = SchemaMapping(
        name=f"LLM 自动映射 ({len(columns)} 列)",
        source_format=source_format,
        column_mappings=column_mappings,
        created_by="llm",
        confidence=overall_confidence,
        column_hash=column_hash,
        sample_data={
            "columns": columns,
            "sample_rows": sample_rows[:3],
            "unmapped_columns": mapping_data.get("unmapped_columns", []),
        },
        usage_count=1,
    )
    db.add(new_mapping)
    await db.flush()

    logger.info(
        "LLM 映射生成完成",
        mapping_id=str(new_mapping.id),
        confidence=overall_confidence,
        needs_confirmation=needs_confirmation,
    )

    return MappingResult(
        mapping=new_mapping,
        is_new=True,
        needs_confirmation=needs_confirmation,
    )


def _parse_llm_mapping_response(llm_response: dict) -> dict:
    """从 llm-service 响应中解析映射结果 JSON。"""
    mapping_data = extract_json_from_llm_response(llm_response)

    # 验证必要字段
    if "mappings" not in mapping_data:
        raise AppException(
            code="VOC_MAPPING_FAILED",
            message="LLM 映射结果缺少 mappings 字段",
            status_code=422,
        )

    # 检查是否有 raw_text 映射；缺失时不抛异常，而是降低置信度
    has_raw_text = any(m.get("target_field") == "raw_text" for m in mapping_data["mappings"])
    if not has_raw_text:
        logger.warning(
            "LLM 映射结果缺少 raw_text 目标字段，置信度强制归零以触发用户确认",
            columns=[m.get("source_column") for m in mapping_data["mappings"]],
        )
        mapping_data["overall_confidence"] = 0.0

    return mapping_data


async def create_mapping_from_llm_response(
    db: AsyncSession,
    *,
    llm_response: dict,
    columns: list[str],
    sample_rows: list[dict[str, str]],
    source_format: str,
    confidence_auto: float = 0.8,
) -> MappingResult:
    """从 LLM 响应创建映射记录（跳过模板缓存查找，用于提示词可能被用户编辑的场景）。"""
    mapping_data = _parse_llm_mapping_response(llm_response)

    overall_confidence = mapping_data.get("overall_confidence", 0.0)
    needs_confirmation = overall_confidence < confidence_auto

    column_mappings = {
        m["source_column"]: {
            "target": m["target_field"],
            "confidence": m["confidence"],
            "reason": m.get("reason", ""),
        }
        for m in mapping_data.get("mappings", [])
    }

    column_hash = compute_column_hash(columns)

    new_mapping = SchemaMapping(
        name=f"LLM 自动映射 ({len(columns)} 列)",
        source_format=source_format,
        column_mappings=column_mappings,
        created_by="llm",
        confidence=overall_confidence,
        column_hash=column_hash,
        sample_data={
            "columns": columns,
            "sample_rows": sample_rows[:3],
            "unmapped_columns": mapping_data.get("unmapped_columns", []),
        },
        usage_count=1,
    )
    db.add(new_mapping)
    await db.flush()

    logger.info(
        "LLM 映射生成完成（from prompt_text）",
        mapping_id=str(new_mapping.id),
        confidence=overall_confidence,
        needs_confirmation=needs_confirmation,
    )

    return MappingResult(
        mapping=new_mapping,
        is_new=True,
        needs_confirmation=needs_confirmation,
    )


async def confirm_mapping(
    db: AsyncSession,
    *,
    batch_id: UUID,
    confirmed_mappings: dict[str, dict],
    save_as_template: bool = False,
    template_name: str | None = None,
) -> SchemaMapping:
    """
    用户确认映射后更新 SchemaMapping。

    v2 变更：所有列必须有映射（无跳过选项）。
    """
    from voc_service.models.ingestion_batch import IngestionBatch

    stmt = select(IngestionBatch).where(IngestionBatch.id == batch_id)
    result = await db.execute(stmt)
    batch = result.scalar_one_or_none()
    if batch is None:
        raise AppException(
            code="VOC_BATCH_NOT_FOUND",
            message=f"导入批次 {batch_id} 不存在",
            status_code=404,
        )

    from voc_service.models.enums import BatchStatus

    if batch.status != BatchStatus.MAPPING:
        raise AppException(
            code="VOC_INVALID_BATCH_STATUS",
            message=f"批次状态为 {batch.status}，无法确认映射（需要 mapping 状态）",
            status_code=409,
        )

    if batch.mapping_id is None:
        raise AppException(
            code="VOC_BATCH_NOT_FOUND",
            message="批次没有关联的映射",
            status_code=404,
        )

    # 验证 raw_text 映射存在
    has_raw_text = any(v.get("target") == "raw_text" for v in confirmed_mappings.values())
    if not has_raw_text:
        raise AppException(
            code="VOC_NO_TEXT_COLUMN",
            message="确认的映射中缺少 raw_text 目标字段",
            status_code=422,
        )

    stmt = select(SchemaMapping).where(SchemaMapping.id == batch.mapping_id)
    result = await db.execute(stmt)
    mapping = result.scalar_one_or_none()
    if mapping is None:
        raise AppException(
            code="VOC_BATCH_NOT_FOUND",
            message="关联的映射不存在",
            status_code=404,
        )

    # 更新映射内容
    mapping.column_mappings = confirmed_mappings
    mapping.created_by = "llm_user_confirmed"
    if save_as_template and template_name:
        mapping.name = template_name

    await db.flush()
    return mapping


async def find_exact_mapping(
    db: AsyncSession,
    *,
    columns: list[str],
) -> SchemaMapping | None:
    """按 column_hash 精确查找已有映射（usage_count 最高优先）。"""
    column_hash = compute_column_hash(columns)
    stmt = (
        select(SchemaMapping)
        .where(SchemaMapping.column_hash == column_hash)
        .order_by(SchemaMapping.usage_count.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def find_similar_mappings(
    db: AsyncSession,
    *,
    columns: list[str],
    top_k: int = 3,
    min_similarity: float = 0.3,
) -> list[tuple[SchemaMapping, float]]:
    """Jaccard 相似度查找列名相近的历史映射。"""
    input_set = {col.strip().lower() for col in columns}
    current_hash = compute_column_hash(columns)

    stmt = select(SchemaMapping).where(
        SchemaMapping.sample_data.isnot(None),
        SchemaMapping.column_hash != current_hash,
    )
    result = await db.execute(stmt)
    candidates = result.scalars().all()

    scored: list[tuple[SchemaMapping, float]] = []
    for mapping in candidates:
        stored_cols = mapping.sample_data.get("columns", [])
        if not stored_cols:
            continue
        stored_set = {c.strip().lower() for c in stored_cols}
        intersection = input_set & stored_set
        union = input_set | stored_set
        similarity = len(intersection) / len(union) if union else 0.0
        if similarity >= min_similarity:
            scored.append((mapping, similarity))

    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[:top_k]


def format_historical_reference(
    similar_mappings: list[tuple[SchemaMapping, float]],
) -> str:
    """格式化历史映射为 LLM 参考文本。"""
    if not similar_mappings:
        return ""

    lines = ["## 历史映射参考\n"]
    lines.append(
        "以下是结构相似的历史数据集的映射方案，仅供参考。"
        "你应基于当前数据独立判断，不可直接照搬。\n"
    )

    for i, (mapping, similarity) in enumerate(similar_mappings, 1):
        stored_cols = mapping.sample_data.get("columns", [])
        lines.append(f"### 参考 {i}（相似度 {similarity:.0%}）")
        lines.append(f"- 原始列名：{', '.join(stored_cols)}")
        lines.append("- 映射方案：")
        for src_col, info in mapping.column_mappings.items():
            lines.append(f"  - {src_col} → {info.get('target', '?')}")
        lines.append("")

    return "\n".join(lines)
