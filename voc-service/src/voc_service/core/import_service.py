"""导入编排服务：批次管理 + 去重写入。"""

import hashlib
import json
from datetime import UTC, datetime
from uuid import UUID

import structlog
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from prism_shared.exceptions import AppException
from voc_service.models.enums import BatchStatus
from voc_service.models.ingestion_batch import IngestionBatch
from voc_service.models.schema_mapping import SchemaMapping

logger = structlog.get_logger(__name__)


async def create_batch(
    db: AsyncSession,
    *,
    source: str,
    file_name: str,
    file_size_bytes: int,
    total_rows: int,
) -> IngestionBatch:
    """创建导入批次，status=pending。"""
    batch = IngestionBatch(
        source=source,
        file_name=file_name,
        file_size_bytes=file_size_bytes,
        total_count=total_rows,
        status=BatchStatus.PENDING,
    )
    db.add(batch)
    await db.flush()
    logger.info("创建导入批次", batch_id=str(batch.id), source=source, file_name=file_name)
    return batch


async def execute_import(
    db: AsyncSession,
    *,
    batch: IngestionBatch,
    rows: list[dict[str, str]],
    mapping: SchemaMapping,
    chunk_size: int = 500,
    dedup_columns: list[str] | None = None,
) -> IngestionBatch:
    """
    按 chunk_size 分块写入 Voice 表。

    1. 应用映射：source_column → target_field
    2. 计算 content_hash（SHA-256）
    3. 提取 source_key（或从 dedup_columns 生成）
    4. INSERT ... ON CONFLICT DO NOTHING 去重
    5. 更新 batch 计数器
    """
    batch.status = BatchStatus.IMPORTING
    await db.flush()

    column_mappings = mapping.column_mappings
    new_count = 0
    duplicate_count = 0
    failed_count = 0

    # 预处理映射：找出 raw_text、source_key 和 metadata 字段
    raw_text_col = None
    source_key_col = None
    metadata_cols: dict[str, str] = {}  # source_col → metadata_key

    for source_col, mapping_info in column_mappings.items():
        target = mapping_info.get("target", "")
        if target == "raw_text":
            raw_text_col = source_col
        elif target == "source_key":
            source_key_col = source_col
        elif target.startswith("metadata."):
            metadata_key = target[len("metadata."):]
            metadata_cols[source_col] = metadata_key

    if raw_text_col is None:
        batch.status = BatchStatus.FAILED
        batch.error_message = "映射中缺少 raw_text 字段"
        await db.flush()
        return batch

    # 根据是否有 source_key 使用不同的 INSERT SQL，显式指定 conflict target
    insert_sql_with_source_key = text(
        "INSERT INTO voc.voices"
        " (id, source, raw_text, content_hash, source_key,"
        " batch_id, processed_status, metadata, created_at, updated_at)"
        " VALUES (gen_random_uuid(), :source, :raw_text, :content_hash,"
        " :source_key, :batch_id, 'pending', CAST(:metadata AS jsonb), now(), now())"
        " ON CONFLICT (source, source_key) WHERE source_key IS NOT NULL DO NOTHING"
    )
    insert_sql_without_source_key = text(
        "INSERT INTO voc.voices"
        " (id, source, raw_text, content_hash, source_key,"
        " batch_id, processed_status, metadata, created_at, updated_at)"
        " VALUES (gen_random_uuid(), :source, :raw_text, :content_hash,"
        " NULL, :batch_id, 'pending', CAST(:metadata AS jsonb), now(), now())"
        " ON CONFLICT (content_hash) WHERE source_key IS NULL DO NOTHING"
    )

    try:
        # 分块处理
        for chunk_start in range(0, len(rows), chunk_size):
            chunk = rows[chunk_start : chunk_start + chunk_size]

            for row in chunk:
                raw_text = row.get(raw_text_col, "").strip()
                if not raw_text:
                    failed_count += 1
                    continue

                content_hash = hashlib.sha256(raw_text.encode("utf-8")).hexdigest()

                # source_key 逻辑：优先映射列，其次 dedup_columns 生成
                source_key = None
                if source_key_col:
                    source_key = row.get(source_key_col, "").strip() or None

                if source_key is None and dedup_columns:
                    dedup_values = [row.get(col, "").strip() for col in dedup_columns]
                    if any(dedup_values):
                        source_key = hashlib.sha256(
                            "|".join(str(v) for v in dedup_values).encode()
                        ).hexdigest()[:32]

                # 构建 metadata
                metadata = {}
                for source_col, meta_key in metadata_cols.items():
                    val = row.get(source_col, "").strip()
                    if val:
                        metadata[meta_key] = val

                # 自动填充 platform：若 LLM 映射未覆盖或该行该列为空，从 batch.source 回填
                if "platform" not in metadata and batch.source:
                    metadata["platform"] = batch.source

                # 根据 source_key 是否存在选择对应的去重策略
                metadata_json = json.dumps(metadata if metadata else {}, ensure_ascii=False)
                params = {
                    "source": batch.source,
                    "raw_text": raw_text,
                    "content_hash": content_hash,
                    "batch_id": batch.id,
                    "metadata": metadata_json,
                }

                if source_key is not None:
                    params["source_key"] = source_key
                    result = await db.execute(insert_sql_with_source_key, params)
                else:
                    result = await db.execute(insert_sql_without_source_key, params)

                if result.rowcount > 0:
                    new_count += 1
                else:
                    duplicate_count += 1

            await db.flush()

    except Exception as e:
        logger.error(
            "导入过程中发生异常",
            batch_id=str(batch.id),
            error=str(e),
            exc_info=True,
        )
        raise

    # 更新批次计数器
    batch.new_count = new_count
    batch.duplicate_count = duplicate_count
    batch.failed_count = failed_count

    if failed_count > 0 and new_count == 0 and duplicate_count == 0:
        batch.status = BatchStatus.FAILED
        batch.error_message = f"全部 {failed_count} 条记录写入失败（空文本）"
    elif failed_count > 0:
        batch.status = BatchStatus.PARTIALLY_COMPLETED
    else:
        batch.status = BatchStatus.COMPLETED

    batch.completed_at = datetime.now(UTC)
    await db.flush()

    logger.info(
        "导入完成",
        batch_id=str(batch.id),
        new_count=new_count,
        duplicate_count=duplicate_count,
        failed_count=failed_count,
    )
    return batch


async def get_batch_with_progress(
    db: AsyncSession,
    *,
    batch_id: UUID,
) -> IngestionBatch:
    """查询批次状态 + 进度。"""
    stmt = select(IngestionBatch).where(IngestionBatch.id == batch_id)
    result = await db.execute(stmt)
    batch = result.scalar_one_or_none()
    if batch is None:
        raise AppException(
            code="VOC_BATCH_NOT_FOUND",
            message=f"导入批次 {batch_id} 不存在",
            status_code=404,
        )
    return batch
