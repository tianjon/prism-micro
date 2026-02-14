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
from voc_service.models.schema_mapping import SchemaMapping
from voc_service.prompts.schema_mapping import build_schema_mapping_messages

logger = structlog.get_logger()


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
) -> MappingResult:
    """
    查找或创建 Schema 映射。

    1. 计算 column_hash
    2. 查询已有映射模板
    3. 匹配成功 → usage_count++
    4. 匹配失败 → 调用 LLM 生成映射
    5. 根据 confidence 决定是否需要确认
    """
    column_hash = compute_column_hash(columns)

    # 查询已有模板
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

    # 调用 LLM 生成映射
    logger.info("未找到匹配模板，调用 LLM 生成映射", column_hash=column_hash)
    messages = build_schema_mapping_messages(columns, sample_rows)

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

    # 检查是否有 raw_text 映射
    has_raw_text = any(m.get("target_field") == "raw_text" for m in mapping_data["mappings"])
    if not has_raw_text:
        raise AppException(
            code="VOC_NO_TEXT_COLUMN",
            message="映射结果中缺少 raw_text 目标字段，无法确定文本内容列",
            status_code=422,
        )

    return mapping_data


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

    Args:
        batch_id: 批次 ID
        confirmed_mappings: 用户确认/修正后的映射
        save_as_template: 是否保存为可复用模板
        template_name: 模板名称
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

    # 先验证 raw_text，再修改映射
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

    # 验证通过后再更新映射内容
    mapping.column_mappings = confirmed_mappings
    mapping.created_by = "llm_user_confirmed"
    if save_as_template and template_name:
        mapping.name = template_name

    await db.flush()
    return mapping
