"""数据管理服务（Batch / Mapping / Voice 的列表、详情、删除）。"""

from uuid import UUID

import structlog
from sqlalchemy import String, cast, delete, func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from voc_service.api.schemas.data_schemas import (
    BATCH_FILTER_FIELDS,
    BATCH_SORT_FIELDS,
    MAPPING_FILTER_FIELDS,
    MAPPING_SORT_FIELDS,
    VOICE_FILTER_FIELDS,
    VOICE_SORT_FIELDS,
)
from voc_service.core.exceptions import (
    BatchInProgressError,
    BatchNotFoundError,
    MappingInUseError,
    MappingNotFoundError,
    VoiceNotFoundError,
)
from voc_service.core.filter_builder import build_filters
from voc_service.models.enums import BatchStatus
from voc_service.models.ingestion_batch import IngestionBatch
from voc_service.models.schema_mapping import SchemaMapping
from voc_service.models.voice import Voice

logger = structlog.get_logger(__name__)

# 进行中状态集合（禁止删除）
_IN_PROGRESS_STATUSES = {
    BatchStatus.IMPORTING,
    BatchStatus.PROCESSING,
    BatchStatus.GENERATING_MAPPING,
}


# ============================================================
# Batch
# ============================================================


def _build_batch_filters(
    *,
    status: str | None,
    source: str | None,
    filter_conditions: list[dict] | None = None,
    filter_logic: str = "and",
) -> list:
    """构建 Batch 查询的 WHERE 条件。"""
    conditions = []
    if status:
        conditions.append(IngestionBatch.status == status)
    if source:
        conditions.append(IngestionBatch.source == source)

    # 通用筛选条件（OR 仅作用于用户定义的 FilterPanel 条件）
    if filter_conditions:
        conditions.extend(
            build_filters(
                IngestionBatch,
                filter_conditions,
                BATCH_FILTER_FIELDS,
                field_overrides={"mapping_name": SchemaMapping.name},
                logic=filter_logic,
            )
        )

    return conditions


async def list_batches(
    db: AsyncSession,
    *,
    page: int = 1,
    page_size: int = 20,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    status: str | None = None,
    source: str | None = None,
    filter_conditions: list[dict] | None = None,
    filter_logic: str = "and",
) -> dict:
    """导入批次列表。"""
    if sort_by not in BATCH_SORT_FIELDS:
        sort_by = "created_at"

    filters = _build_batch_filters(
        status=status, source=source,
        filter_conditions=filter_conditions, filter_logic=filter_logic,
    )

    # COUNT
    count_query = select(func.count()).select_from(
        select(IngestionBatch.id)
        .outerjoin(SchemaMapping, IngestionBatch.mapping_id == SchemaMapping.id)
        .where(*filters)
        .subquery()
    )
    total = (await db.execute(count_query)).scalar_one()

    # DATA
    query = (
        select(
            IngestionBatch.id,
            IngestionBatch.source,
            IngestionBatch.file_name,
            IngestionBatch.file_size_bytes,
            IngestionBatch.status,
            IngestionBatch.total_count,
            IngestionBatch.new_count,
            IngestionBatch.duplicate_count,
            IngestionBatch.failed_count,
            IngestionBatch.mapping_id,
            IngestionBatch.error_message,
            IngestionBatch.created_at,
            IngestionBatch.completed_at,
            IngestionBatch.file_hash,
            IngestionBatch.file_statistics,
            IngestionBatch.dedup_columns,
            IngestionBatch.prompt_text,
            IngestionBatch.updated_at,
            SchemaMapping.name.label("mapping_name"),
        )
        .outerjoin(SchemaMapping, IngestionBatch.mapping_id == SchemaMapping.id)
        .where(*filters)
    )

    sort_col = getattr(IngestionBatch, sort_by)
    query = query.order_by(sort_col.asc() if sort_order == "asc" else sort_col.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    rows = (await db.execute(query)).all()

    items = [
        {
            "id": row.id,
            "source": row.source,
            "file_name": row.file_name,
            "file_size_bytes": row.file_size_bytes,
            "status": row.status,
            "total_count": row.total_count,
            "new_count": row.new_count,
            "duplicate_count": row.duplicate_count,
            "failed_count": row.failed_count,
            "mapping_id": row.mapping_id,
            "error_message": row.error_message,
            "created_at": row.created_at,
            "completed_at": row.completed_at,
            "file_hash": row.file_hash,
            "file_statistics": row.file_statistics,
            "dedup_columns": row.dedup_columns,
            "prompt_text": row.prompt_text,
            "mapping_name": row.mapping_name,
            "updated_at": row.updated_at,
        }
        for row in rows
    ]

    return {"items": items, "total": total}


async def get_batch_detail(
    db: AsyncSession,
    *,
    batch_id: UUID,
) -> dict:
    """导入批次详情（含关联映射模板名称）。"""
    query = (
        select(
            IngestionBatch.id,
            IngestionBatch.source,
            IngestionBatch.file_name,
            IngestionBatch.file_size_bytes,
            IngestionBatch.status,
            IngestionBatch.total_count,
            IngestionBatch.new_count,
            IngestionBatch.duplicate_count,
            IngestionBatch.failed_count,
            IngestionBatch.mapping_id,
            IngestionBatch.error_message,
            IngestionBatch.created_at,
            IngestionBatch.completed_at,
            IngestionBatch.file_hash,
            IngestionBatch.file_statistics,
            IngestionBatch.dedup_columns,
            IngestionBatch.prompt_text,
            IngestionBatch.updated_at,
            SchemaMapping.name.label("mapping_name"),
        )
        .outerjoin(SchemaMapping, IngestionBatch.mapping_id == SchemaMapping.id)
        .where(IngestionBatch.id == batch_id)
    )

    row = (await db.execute(query)).first()
    if row is None:
        raise BatchNotFoundError(str(batch_id))

    return {
        "id": row.id,
        "source": row.source,
        "file_name": row.file_name,
        "file_size_bytes": row.file_size_bytes,
        "status": row.status,
        "total_count": row.total_count,
        "new_count": row.new_count,
        "duplicate_count": row.duplicate_count,
        "failed_count": row.failed_count,
        "mapping_id": row.mapping_id,
        "error_message": row.error_message,
        "created_at": row.created_at,
        "completed_at": row.completed_at,
        "file_hash": row.file_hash,
        "file_statistics": row.file_statistics,
        "dedup_columns": row.dedup_columns,
        "prompt_text": row.prompt_text,
        "mapping_name": row.mapping_name,
        "updated_at": row.updated_at,
    }


async def delete_batch(
    db: AsyncSession,
    *,
    batch_id: UUID,
) -> None:
    """删除导入批次及其关联 Voice。

    - 进行中状态（importing/processing/generating_mapping）禁止删除
    - 级联删除：Voice → SemanticUnit → UnitTagAssociation（DB FK CASCADE）
    - mapping_id FK 设置为 SET NULL，不删映射模板
    """
    # 查询批次状态
    result = await db.execute(
        select(IngestionBatch.id, IngestionBatch.status).where(
            IngestionBatch.id == batch_id
        )
    )
    row = result.first()
    if row is None:
        raise BatchNotFoundError(str(batch_id))

    if row.status in _IN_PROGRESS_STATUSES:
        raise BatchInProgressError(str(batch_id), row.status)

    # 先删关联 Voice（DB CASCADE 会处理 SemanticUnit → UnitTagAssociation）
    await db.execute(delete(Voice).where(Voice.batch_id == batch_id))

    # 删除批次本身
    await db.execute(delete(IngestionBatch).where(IngestionBatch.id == batch_id))

    logger.info("导入批次已删除", batch_id=str(batch_id))


# ============================================================
# Mapping
# ============================================================


def _build_mapping_filters(
    *,
    source_format: str | None,
    created_by: str | None,
    filter_conditions: list[dict] | None = None,
    filter_logic: str = "and",
) -> list:
    """构建 Mapping 查询的 WHERE 条件。"""
    conditions = []
    if source_format:
        conditions.append(SchemaMapping.source_format == source_format)
    if created_by:
        conditions.append(SchemaMapping.created_by == created_by)

    if filter_conditions:
        conditions.extend(
            build_filters(
                SchemaMapping, filter_conditions, MAPPING_FILTER_FIELDS,
                logic=filter_logic,
            )
        )

    return conditions


async def list_mappings(
    db: AsyncSession,
    *,
    page: int = 1,
    page_size: int = 20,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    source_format: str | None = None,
    created_by: str | None = None,
    filter_conditions: list[dict] | None = None,
    filter_logic: str = "and",
) -> dict:
    """映射模板列表。"""
    if sort_by not in MAPPING_SORT_FIELDS:
        sort_by = "created_at"

    filters = _build_mapping_filters(
        source_format=source_format,
        created_by=created_by,
        filter_conditions=filter_conditions,
        filter_logic=filter_logic,
    )

    # COUNT
    count_query = select(func.count()).select_from(
        select(SchemaMapping.id).where(*filters).subquery()
    )
    total = (await db.execute(count_query)).scalar_one()

    # DATA
    query = select(
        SchemaMapping.id,
        SchemaMapping.name,
        SchemaMapping.source_format,
        SchemaMapping.created_by,
        SchemaMapping.confidence,
        SchemaMapping.column_hash,
        SchemaMapping.usage_count,
        SchemaMapping.created_at,
        SchemaMapping.column_mappings,
        SchemaMapping.sample_data,
        SchemaMapping.updated_at,
    ).where(*filters)

    sort_col = getattr(SchemaMapping, sort_by)
    query = query.order_by(sort_col.asc() if sort_order == "asc" else sort_col.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    rows = (await db.execute(query)).all()

    items = [
        {
            "id": row.id,
            "name": row.name,
            "source_format": row.source_format,
            "created_by": row.created_by,
            "confidence": row.confidence,
            "column_hash": row.column_hash,
            "usage_count": row.usage_count,
            "created_at": row.created_at,
            "column_mappings": row.column_mappings,
            "sample_data": row.sample_data,
            "updated_at": row.updated_at,
        }
        for row in rows
    ]

    return {"items": items, "total": total}


async def get_mapping_detail(
    db: AsyncSession,
    *,
    mapping_id: UUID,
) -> dict:
    """映射模板详情。"""
    query = select(
        SchemaMapping.id,
        SchemaMapping.name,
        SchemaMapping.source_format,
        SchemaMapping.created_by,
        SchemaMapping.confidence,
        SchemaMapping.column_hash,
        SchemaMapping.usage_count,
        SchemaMapping.created_at,
        SchemaMapping.column_mappings,
        SchemaMapping.sample_data,
        SchemaMapping.updated_at,
    ).where(SchemaMapping.id == mapping_id)

    row = (await db.execute(query)).first()
    if row is None:
        raise MappingNotFoundError(str(mapping_id))

    return {
        "id": row.id,
        "name": row.name,
        "source_format": row.source_format,
        "created_by": row.created_by,
        "confidence": row.confidence,
        "column_hash": row.column_hash,
        "usage_count": row.usage_count,
        "created_at": row.created_at,
        "column_mappings": row.column_mappings,
        "sample_data": row.sample_data,
        "updated_at": row.updated_at,
    }


async def delete_mapping(
    db: AsyncSession,
    *,
    mapping_id: UUID,
) -> None:
    """删除映射模板。

    - 检查无进行中 Batch 引用（importing/processing/generating_mapping）
    - 关联 Batch 的 mapping_id SET NULL
    """
    # 检查模板是否存在
    result = await db.execute(
        select(SchemaMapping.id).where(SchemaMapping.id == mapping_id)
    )
    if result.scalar_one_or_none() is None:
        raise MappingNotFoundError(str(mapping_id))

    # 检查是否有进行中的 Batch 引用
    in_progress_count = (
        await db.execute(
            select(func.count()).where(
                IngestionBatch.mapping_id == mapping_id,
                IngestionBatch.status.in_(_IN_PROGRESS_STATUSES),
            )
        )
    ).scalar_one()

    if in_progress_count > 0:
        raise MappingInUseError(str(mapping_id))

    # 将关联 Batch 的 mapping_id 置 NULL
    await db.execute(
        update(IngestionBatch)
        .where(IngestionBatch.mapping_id == mapping_id)
        .values(mapping_id=None)
    )

    # 删除映射模板
    await db.execute(delete(SchemaMapping).where(SchemaMapping.id == mapping_id))

    logger.info("映射模板已删除", mapping_id=str(mapping_id))


# ============================================================
# Voice
# ============================================================


def _build_voice_filters(
    *,
    batch_id: UUID | None,
    source: str | None,
    processed_status: str | None,
    filter_conditions: list[dict] | None = None,
    filter_logic: str = "and",
) -> list:
    """构建 Voice 查询的 WHERE 条件。"""
    conditions = []
    if batch_id:
        conditions.append(Voice.batch_id == batch_id)
    if source:
        conditions.append(Voice.source == source)
    if processed_status:
        conditions.append(Voice.processed_status == processed_status)

    if filter_conditions:
        conditions.extend(
            build_filters(
                Voice, filter_conditions, VOICE_FILTER_FIELDS,
                logic=filter_logic,
            )
        )

    return conditions


async def list_voices(
    db: AsyncSession,
    *,
    page: int = 1,
    page_size: int = 20,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    batch_id: UUID | None = None,
    source: str | None = None,
    processed_status: str | None = None,
    filter_conditions: list[dict] | None = None,
    filter_logic: str = "and",
) -> dict:
    """Voice 列表。"""
    if sort_by not in VOICE_SORT_FIELDS:
        sort_by = "created_at"

    filters = _build_voice_filters(
        batch_id=batch_id,
        source=source,
        processed_status=processed_status,
        filter_conditions=filter_conditions,
        filter_logic=filter_logic,
    )

    # COUNT
    count_query = select(func.count()).select_from(
        select(Voice.id).where(*filters).subquery()
    )
    total = (await db.execute(count_query)).scalar_one()

    # DATA
    query = select(
        Voice.id,
        Voice.source,
        Voice.raw_text,
        Voice.content_hash,
        Voice.source_key,
        Voice.batch_id,
        Voice.processed_status,
        Voice.processing_error,
        Voice.metadata_,
        Voice.created_at,
        Voice.updated_at,
    ).where(*filters)

    sort_col = getattr(Voice, sort_by)
    query = query.order_by(sort_col.asc() if sort_order == "asc" else sort_col.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    rows = (await db.execute(query)).all()

    items = [
        {
            "id": row.id,
            "source": row.source,
            "raw_text": row.raw_text,
            "content_hash": row.content_hash,
            "source_key": row.source_key,
            "batch_id": row.batch_id,
            "processed_status": row.processed_status,
            "processing_error": row.processing_error,
            "metadata": row.metadata_,
            "created_at": row.created_at,
            "updated_at": row.updated_at,
        }
        for row in rows
    ]

    return {"items": items, "total": total}


async def delete_voice(
    db: AsyncSession,
    *,
    voice_id: UUID,
) -> None:
    """删除单条 Voice（cascade 删 SemanticUnit 已在 FK 层声明）。"""
    result = await db.execute(select(Voice.id).where(Voice.id == voice_id))
    if result.scalar_one_or_none() is None:
        raise VoiceNotFoundError(str(voice_id))

    await db.execute(delete(Voice).where(Voice.id == voice_id))

    logger.info("Voice 记录已删除", voice_id=str(voice_id))


# ============================================================
# Metadata Keys
# ============================================================


async def get_voice_metadata_keys(db: AsyncSession) -> list[str]:
    """查询所有 Voice 元数据中的不重复顶层键名。

    使用 PG 的 jsonb_object_keys() 函数从 JSONB 列提取键名。
    """
    query = text(
        "SELECT DISTINCT k FROM voc.voices, jsonb_object_keys(metadata) AS k ORDER BY k"
    )
    result = await db.execute(query)
    return [row[0] for row in result.all()]


# ============================================================
# 字段值发现（辅助完成）
# ============================================================


async def get_distinct_field_values(
    db: AsyncSession,
    model_class: type,
    field: str,
    *,
    prefix: str | None = None,
    limit: int = 21,
    field_overrides: dict | None = None,
) -> dict:
    """查询某字段的不重复取值，用于前端筛选值辅助完成。

    Args:
        model_class: SQLAlchemy 模型类
        field: 字段名（支持 metadata.xxx 格式）
        prefix: 前缀匹配（ILIKE prefix%）
        limit: 返回数量上限（默认 21，多取 1 条用于判断 has_more）
        field_overrides: 字段名到列对象的映射覆盖

    Returns:
        {"values": [...], "has_more": bool}
    """
    # 解析列对象
    if field_overrides and field in field_overrides:
        col = field_overrides[field]
    elif field.startswith("metadata."):
        meta_key = field[len("metadata."):]
        meta_col = getattr(model_class, "metadata_", None)
        if meta_col is None:
            return {"values": [], "has_more": False}
        col = meta_col[meta_key].astext
    else:
        col = getattr(model_class, field, None)
        if col is None:
            return {"values": [], "has_more": False}

    query = select(col).distinct().where(col.isnot(None))

    if prefix:
        query = query.where(cast(col, String).ilike(f"{prefix}%"))

    query = query.order_by(col).limit(limit)

    result = await db.execute(query)
    values = [str(row[0]) for row in result.all()]

    has_more = len(values) >= limit
    if has_more:
        values = values[: limit - 1]

    return {"values": values, "has_more": has_more}
