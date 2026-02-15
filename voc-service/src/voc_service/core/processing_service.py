"""管线编排：Stage 1 + Stage 2 处理 pending Voice。"""

from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from voc_service.core.config import VocServiceSettings
from voc_service.core.llm_client import LLMClient
from voc_service.models.voice import Voice
from voc_service.pipeline.stage1_splitting import SemanticSplitter
from voc_service.pipeline.stage2_tagging import TagEmergenceProcessor
from voc_service.pipeline.stage3_embedding import EmbeddingProcessor

logger = structlog.get_logger(__name__)


async def process_pending_voices(
    db: AsyncSession,
    *,
    llm_client: LLMClient,
    settings: VocServiceSettings,
    batch_id: UUID | None = None,
    limit: int | None = None,
) -> dict:
    """编排 Stage 1 + Stage 2 管线。

    流程：
    1. SELECT Voice WHERE processed_status='pending' FOR UPDATE SKIP LOCKED
    2. 逐条处理（AsyncSession 不可在多个协程间共享）
    3. Stage 1：语义拆解 → db.add_all(units) → flush
    4. Stage 2：标签涌现 + 标准化 → upsert tags → flush
    5. 更新 Voice.processed_status = completed/failed
    6. 返回 {processed, failed, skipped}

    Returns:
        {"processed": int, "failed": int, "skipped": int}
    """
    effective_limit = limit or settings.pipeline_batch_size

    # 构建查询
    query = (
        select(Voice)
        .where(Voice.processed_status == "pending")
        .with_for_update(skip_locked=True)
        .limit(effective_limit)
    )
    if batch_id is not None:
        query = query.where(Voice.batch_id == batch_id)

    result = await db.execute(query)
    voices = list(result.scalars().all())

    if not voices:
        logger.info("无待处理的 Voice")
        return {"processed": 0, "failed": 0, "skipped": 0}

    logger.info("开始管线处理", count=len(voices), batch_id=str(batch_id) if batch_id else None)

    splitter = SemanticSplitter(llm_client, settings)
    processed = 0
    failed = 0

    for voice in voices:
        try:
            # 标记为处理中
            voice.processed_status = "processing"
            await db.flush()

            # Stage 1: 语义拆解
            units = await splitter.split(voice)
            db.add_all(units)
            await db.flush()

            # Stage 2: 标签涌现 + 标准化
            tagger = TagEmergenceProcessor(llm_client, db, settings)
            await tagger.tag(units)
            await db.flush()

            # Stage 3: 向量化
            embedder = EmbeddingProcessor(llm_client, settings)
            embedded = await embedder.embed(units)
            await db.flush()

            logger.info(
                "Stage 3 向量化完成",
                voice_id=str(voice.id),
                embedded=embedded,
                total=len(units),
            )

            # 标记为完成
            voice.processed_status = "completed"
            voice.processing_error = None
            processed += 1

            logger.info(
                "Voice 处理完成",
                voice_id=str(voice.id),
                units_count=len(units),
            )

        except Exception as e:
            logger.error(
                "Voice 处理失败",
                voice_id=str(voice.id),
                error=str(e),
                exc_info=True,
            )
            voice.processed_status = "failed"
            voice.processing_error = str(e)[:500]
            voice.retry_count += 1
            failed += 1

    # 最终提交由 get_db 依赖的上下文管理器处理
    logger.info("管线处理完成", processed=processed, failed=failed)

    return {
        "processed": processed,
        "failed": failed,
        "skipped": 0,
    }
