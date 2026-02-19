"""数据导入 API 路由（v2：6 步流程）。"""

import asyncio
import hashlib
import time
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from prism_shared.exceptions import AppException
from prism_shared.schemas import ApiResponse
from voc_service.api.deps import UserRecord, get_current_user, get_db, get_settings
from voc_service.api.schemas.import_schemas import (
    BatchProgress,
    BatchStatusResponse,
    BuildPromptRequest,
    ColumnMapping,
    ColumnStats,
    ConfirmMappingBody,
    ConfirmMappingResponse,
    DataPreviewResponse,
    FileInfo,
    GenerateMappingRequest,
    ImportResponse,
    MappingPreviewResponse,
    PromptPreviewResponse,
    ResultPreviewResponse,
    UpdatePromptBody,
)
from voc_service.core import import_service, schema_mapping_service
from voc_service.core.config import VocServiceSettings
from voc_service.core.file_parser import (
    compute_full_column_statistics,
    generate_split_statistics,
    parse_bytes,
    random_sample_rows,
)
from voc_service.core.import_background import (
    _temp_file_path,
    run_confirm_import_background,
    run_generate_mapping_background,
)
from voc_service.core.prompt_builder import PromptBuilder
from voc_service.models.enums import BatchStatus

logger = structlog.get_logger(__name__)


def _ms(start: float) -> int:
    """计算自 start 以来经过的毫秒数。"""
    return int((time.monotonic() - start) * 1000)

router = APIRouter(prefix="/api/voc/import", tags=["import"])


@router.post("", response_model=ApiResponse[ImportResponse])
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    source: str = Form(default=""),
    db: AsyncSession = Depends(get_db),
    settings: VocServiceSettings = Depends(get_settings),
    current_user: UserRecord = Depends(get_current_user),
):
    """
    上传文件（同步返回）。

    v2 变更：不再启动后台任务，仅计算 file_hash + 暂存文件 + 创建 batch。
    列统计延迟到 data-preview 端点首次调用时计算。
    """
    t0 = time.monotonic()

    # 1. 读取文件字节
    file_bytes = await file.read()
    filename = file.filename or "unknown"
    logger.info("上传步骤耗时", step="read_file", elapsed_ms=_ms(t0), file_size=len(file_bytes))

    # 2. 采样解析（快速验证文件格式和内容）
    t1 = time.monotonic()
    sample_result = parse_bytes(
        file_bytes,
        filename=filename,
        sample_only=True,
        sample_rows=settings.mapping_sample_rows,
        max_file_size_bytes=settings.max_file_size_bytes,
    )
    logger.info("上传步骤耗时", step="parse_sample", elapsed_ms=_ms(t1))

    # 推断来源
    if not source:
        source = sample_result.detected_format

    # 3. 计算 file_hash
    t2 = time.monotonic()
    file_hash = hashlib.sha256(file_bytes).hexdigest()
    logger.info("上传步骤耗时", step="compute_hash", elapsed_ms=_ms(t2))

    # 4. 查询是否已有同 file_hash 的 batch
    t3 = time.monotonic()
    from voc_service.models.ingestion_batch import IngestionBatch

    dup_stmt = (
        select(IngestionBatch)
        .where(IngestionBatch.file_hash == file_hash)
        .order_by(IngestionBatch.created_at.desc())
        .limit(1)
    )
    dup_result = await db.execute(dup_stmt)
    dup_batch = dup_result.scalar_one_or_none()
    duplicate_batch_id = dup_batch.id if dup_batch else None
    logger.info("上传步骤耗时", step="dedup_query", elapsed_ms=_ms(t3))

    # 5. 创建批次（不含 file_statistics，延迟到 data-preview 计算）
    t4 = time.monotonic()
    batch = await import_service.create_batch(
        db,
        source=source,
        file_name=filename,
        file_size_bytes=sample_result.file_size_bytes,
        total_rows=sample_result.total_rows,
    )
    batch.file_hash = file_hash
    await db.commit()
    logger.info("上传步骤耗时", step="create_batch", elapsed_ms=_ms(t4))

    # 6. 暂存文件
    t5 = time.monotonic()
    _temp_file_path(batch.id).write_bytes(file_bytes)
    logger.info("上传步骤耗时", step="write_temp_file", elapsed_ms=_ms(t5))

    logger.info(
        "上传完成",
        batch_id=str(batch.id),
        file_name=filename,
        file_size=len(file_bytes),
        total_elapsed_ms=_ms(t0),
    )

    file_info = FileInfo(
        file_name=filename,
        file_size_bytes=sample_result.file_size_bytes,
        total_rows=sample_result.total_rows,
        detected_encoding=sample_result.detected_encoding,
        detected_format=sample_result.detected_format,
    )

    return ApiResponse(
        data=ImportResponse(
            batch_id=batch.id,
            status="pending",
            message="文件已上传，请预览数据后生成映射",
            file_info=file_info,
            file_hash=file_hash,
            duplicate_batch_id=duplicate_batch_id,
        )
    )


@router.get("/{batch_id}/data-preview", response_model=ApiResponse[DataPreviewResponse])
async def get_data_preview(
    batch_id: UUID,
    db: AsyncSession = Depends(get_db),
    settings: VocServiceSettings = Depends(get_settings),
    _current_user: UserRecord = Depends(get_current_user),
):
    """返回解析后的数据预览 + 列统计。"""
    batch = await import_service.get_batch_with_progress(db, batch_id=batch_id)

    # 从暂存文件读取数据
    temp_path = _temp_file_path(batch_id)
    if not temp_path.exists():
        raise AppException(
            code="VOC_FILE_NOT_FOUND",
            message="暂存文件不存在，可能已过期",
            status_code=404,
        )

    file_bytes = temp_path.read_bytes()
    filename = batch.file_name or "unknown"

    # 采样 50 行用于表格预览
    preview_result = parse_bytes(
        file_bytes,
        filename=filename,
        sample_only=True,
        sample_rows=50,
        max_file_size_bytes=settings.max_file_size_bytes,
    )

    # 全量列统计（pandas），首次计算后缓存到 batch
    # 旧格式缓存缺少 dtype/total_count 等字段，检测到则重新计算
    cached = batch.file_statistics
    if cached and cached.get("columns") and "dtype" in (cached["columns"][0] if cached["columns"] else {}):
        col_stats = cached["columns"]
    else:
        col_stats = compute_full_column_statistics(file_bytes, filename)
        batch.file_statistics = {"columns": col_stats}
        await db.commit()

    return ApiResponse(
        data=DataPreviewResponse(
            batch_id=batch.id,
            rows=preview_result.rows,
            columns=[ColumnStats(**s) for s in col_stats],
            total_rows=preview_result.total_rows,
        )
    )


@router.post("/{batch_id}/build-prompt", response_model=ApiResponse[PromptPreviewResponse])
async def build_prompt(
    batch_id: UUID,
    body: BuildPromptRequest,
    db: AsyncSession = Depends(get_db),
    settings: VocServiceSettings = Depends(get_settings),
    current_user: UserRecord = Depends(get_current_user),
):
    """构建映射提示词（同步返回，不触发 LLM）。"""
    batch = await import_service.get_batch_with_progress(db, batch_id=batch_id)

    allowed = (BatchStatus.PENDING, BatchStatus.PROMPT_READY, BatchStatus.MAPPING, BatchStatus.FAILED)
    if batch.status not in allowed:
        raise AppException(
            code="VOC_INVALID_BATCH_STATUS",
            message=f"批次状态为 {batch.status}，无法构建提示词",
            status_code=409,
        )

    # 存储去重键
    batch.dedup_columns = body.dedup_columns or []

    # 读取暂存文件
    temp_path = _temp_file_path(batch_id)
    if not temp_path.exists():
        raise AppException(
            code="VOC_FILE_NOT_FOUND",
            message="暂存文件不存在，可能已过期",
            status_code=404,
        )

    file_bytes = temp_path.read_bytes()
    filename = batch.file_name or "unknown"

    # 生成 pandas 统计信息（分别获取 describe 和 info）
    df_describe, df_info = generate_split_statistics(file_bytes, filename)

    # 随机采样
    sample_data = random_sample_rows(file_bytes, filename, n=5)

    # 采样解析（用于获取列名和总行数）
    sample_result = parse_bytes(
        file_bytes,
        filename=filename,
        sample_only=True,
        sample_rows=1,
        max_file_size_bytes=settings.max_file_size_bytes,
    )

    # --- 精确缓存检查：column_hash 匹配 → 跳过 LLM ---
    cached_mapping = await schema_mapping_service.find_exact_mapping(
        db, columns=sample_result.columns,
    )
    if cached_mapping:
        cached_mapping.usage_count += 1
        batch.mapping_id = cached_mapping.id
        batch.status = BatchStatus.MAPPING
        batch.prompt_text = None
        await db.commit()
        return ApiResponse(
            data=PromptPreviewResponse(
                batch_id=batch.id,
                prompt_text=None,
                source="cache_hit",
                template_name=cached_mapping.name,
                cache_hit=True,
                cached_mapping_id=str(cached_mapping.id),
            )
        )

    # --- 未命中：查找相似历史映射注入 prompt ---
    similar = await schema_mapping_service.find_similar_mappings(
        db, columns=sample_result.columns,
    )
    historical_ref = schema_mapping_service.format_historical_reference(similar)

    # 构建 V3 提示词
    prompt_builder = PromptBuilder()
    prompt_text = prompt_builder.build_mapping_prompt(
        sample_result.columns,
        sample_result.total_rows,
        dedup_columns=body.dedup_columns if body.dedup_columns else None,
        df_describe=df_describe,
        df_info=df_info,
        sample_data=sample_data,
        historical_reference=historical_ref,
    )

    batch.prompt_text = prompt_text
    batch.status = BatchStatus.PROMPT_READY
    await db.commit()

    return ApiResponse(
        data=PromptPreviewResponse(
            batch_id=batch.id,
            prompt_text=prompt_text,
            source="llm_generated",
            template_name=None,
        )
    )


@router.put("/{batch_id}/prompt-text", response_model=ApiResponse[PromptPreviewResponse])
async def update_prompt_text(
    batch_id: UUID,
    body: UpdatePromptBody,
    db: AsyncSession = Depends(get_db),
    _current_user: UserRecord = Depends(get_current_user),
):
    """用户编辑提示词后保存。"""
    batch = await import_service.get_batch_with_progress(db, batch_id=batch_id)

    if batch.status != BatchStatus.PROMPT_READY:
        raise AppException(
            code="VOC_INVALID_BATCH_STATUS",
            message=f"批次状态为 {batch.status}，仅 prompt_ready 状态可编辑提示词",
            status_code=409,
        )

    batch.prompt_text = body.prompt_text
    await db.commit()

    return ApiResponse(
        data=PromptPreviewResponse(
            batch_id=batch.id,
            prompt_text=batch.prompt_text,
            source="llm_generated",
            template_name=None,
        )
    )


@router.post("/{batch_id}/generate-mapping", status_code=202, response_model=ApiResponse[ImportResponse])
async def generate_mapping(
    batch_id: UUID,
    body: GenerateMappingRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    settings: VocServiceSettings = Depends(get_settings),
    _current_user: UserRecord = Depends(get_current_user),
):
    """触发 LLM 映射生成（异步后台任务）。"""
    batch = await import_service.get_batch_with_progress(db, batch_id=batch_id)

    allowed = (BatchStatus.PROMPT_READY, BatchStatus.MAPPING, BatchStatus.FAILED)
    if batch.status not in allowed:
        raise AppException(
            code="VOC_INVALID_BATCH_STATUS",
            message=f"批次状态为 {batch.status}，无法生成映射（需要 prompt_ready/mapping/failed 状态）",
            status_code=409,
        )

    if not batch.prompt_text:
        raise AppException(
            code="VOC_PROMPT_NOT_READY",
            message="提示词为空，请先调用 build-prompt 构建提示词",
            status_code=400,
        )

    # 存储 dedup_columns（可能从 mapping 回退后重新触发）
    if body.dedup_columns:
        batch.dedup_columns = body.dedup_columns

    batch.status = BatchStatus.GENERATING_MAPPING
    await db.commit()

    # 从请求头提取 JWT token
    auth_header = request.headers.get("Authorization", "")
    api_key = auth_header.removeprefix("Bearer ").strip() or None

    # 启动后台任务
    asyncio.create_task(
        run_generate_mapping_background(
            request.app.state.session_factory,
            batch_id=batch.id,
            llm_base_url=settings.llm_service_base_url,
            llm_timeout=settings.llm_service_timeout,
            api_key=api_key,
            confidence_auto=settings.mapping_confidence_auto,
            max_file_size_bytes=settings.max_file_size_bytes,
            mapping_sample_rows=settings.mapping_sample_rows,
        )
    )

    file_info = FileInfo(
        file_name=batch.file_name or "",
        file_size_bytes=batch.file_size_bytes or 0,
        total_rows=batch.total_count,
        detected_encoding="",
        detected_format=batch.source,
    )

    return ApiResponse(
        data=ImportResponse(
            batch_id=batch.id,
            status="generating_mapping",
            message="映射生成已启动",
            file_info=file_info,
        )
    )


@router.get("/{batch_id}/prompt-text", response_model=ApiResponse[PromptPreviewResponse])
async def get_prompt_text(
    batch_id: UUID,
    db: AsyncSession = Depends(get_db),
    _current_user: UserRecord = Depends(get_current_user),
):
    """返回 LLM 提示词全文。"""
    batch = await import_service.get_batch_with_progress(db, batch_id=batch_id)

    # 判断映射来源
    source_type = "llm_generated"
    template_name = None
    if batch.mapping_id and batch.mapping:
        mapping = batch.mapping
        if mapping.created_by in ("user", "llm_user_confirmed"):
            source_type = "template_reused"
            template_name = mapping.name

    return ApiResponse(
        data=PromptPreviewResponse(
            batch_id=batch.id,
            prompt_text=batch.prompt_text,
            source=source_type,
            template_name=template_name,
        )
    )


@router.get("/{batch_id}/status", response_model=ApiResponse[BatchStatusResponse])
async def get_batch_status(
    batch_id: UUID,
    db: AsyncSession = Depends(get_db),
    _current_user: UserRecord = Depends(get_current_user),
):
    """查询导入批次状态。"""
    batch = await import_service.get_batch_with_progress(db, batch_id=batch_id)

    return ApiResponse(
        data=BatchStatusResponse(
            batch_id=batch.id,
            status=batch.status,
            source=batch.source,
            file_name=batch.file_name,
            progress=BatchProgress(
                total_count=batch.total_count,
                new_count=batch.new_count,
                duplicate_count=batch.duplicate_count,
                failed_count=batch.failed_count,
            ),
            error_message=batch.error_message,
            created_at=batch.created_at,
            completed_at=batch.completed_at,
        )
    )


@router.get("/{batch_id}/mapping-preview", response_model=ApiResponse[MappingPreviewResponse])
async def get_mapping_preview(
    batch_id: UUID,
    db: AsyncSession = Depends(get_db),
    _current_user: UserRecord = Depends(get_current_user),
):
    """获取映射预览。"""
    batch = await import_service.get_batch_with_progress(db, batch_id=batch_id)

    if batch.mapping_id is None:
        raise AppException(
            code="VOC_BATCH_NOT_FOUND",
            message="批次没有关联的映射",
            status_code=404,
        )

    from voc_service.models.schema_mapping import SchemaMapping

    stmt = select(SchemaMapping).where(SchemaMapping.id == batch.mapping_id)
    result = await db.execute(stmt)
    mapping = result.scalar_one_or_none()
    if mapping is None:
        raise AppException(
            code="VOC_BATCH_NOT_FOUND",
            message="关联的映射不存在",
            status_code=404,
        )

    # 构建列映射详情
    column_mappings = []
    sample_data = mapping.sample_data or {}
    sample_rows_data = sample_data.get("sample_rows", [])

    for source_col, mapping_info in mapping.column_mappings.items():
        sample_values = []
        for row in sample_rows_data:
            val = row.get(source_col, "")
            if val:
                sample_values.append(str(val))

        column_mappings.append(
            ColumnMapping(
                source_column=source_col,
                target_field=mapping_info.get("target", ""),
                confidence=mapping_info.get("confidence", 0.0),
                sample_values=sample_values[:5],
                needs_confirmation=mapping_info.get("confidence", 0.0) < 0.8,
            )
        )

    unmapped = sample_data.get("unmapped_columns", [])

    return ApiResponse(
        data=MappingPreviewResponse(
            batch_id=batch.id,
            source_format=mapping.source_format,
            overall_confidence=mapping.confidence or 0.0,
            column_mappings=column_mappings,
            unmapped_columns=unmapped,
            sample_rows=sample_rows_data,
        )
    )


@router.post("/{batch_id}/confirm-mapping", response_model=ApiResponse[ConfirmMappingResponse])
async def confirm_mapping(
    batch_id: UUID,
    body: ConfirmMappingBody,
    request: Request,
    db: AsyncSession = Depends(get_db),
    settings: VocServiceSettings = Depends(get_settings),
    _current_user: UserRecord = Depends(get_current_user),
):
    """
    确认映射并启动后台导入。

    v2 变更：所有列必须有映射（无跳过），导入时支持 dedup_columns。
    """
    mapping = await schema_mapping_service.confirm_mapping(
        db,
        batch_id=batch_id,
        confirmed_mappings=body.confirmed_mappings,
        save_as_template=body.save_as_template,
        template_name=body.template_name,
    )

    batch = await import_service.get_batch_with_progress(db, batch_id=batch_id)
    batch.status = BatchStatus.IMPORTING
    await db.commit()

    asyncio.create_task(
        run_confirm_import_background(
            request.app.state.session_factory,
            batch_id=batch_id,
            mapping_id=mapping.id,
            max_file_size_bytes=settings.max_file_size_bytes,
            chunk_size=settings.upload_chunk_size,
        )
    )

    return ApiResponse(
        data=ConfirmMappingResponse(
            batch_id=batch.id,
            status="importing",
            message="映射已确认，正在后台导入数据",
            mapping_id=mapping.id,
            template_saved=body.save_as_template,
        )
    )


@router.get("/{batch_id}/result-preview", response_model=ApiResponse[ResultPreviewResponse])
async def get_result_preview(
    batch_id: UUID,
    db: AsyncSession = Depends(get_db),
    _current_user: UserRecord = Depends(get_current_user),
):
    """返回导入后的抽样数据 + 统计。"""
    batch = await import_service.get_batch_with_progress(db, batch_id=batch_id)

    terminal = (
        BatchStatus.COMPLETED,
        BatchStatus.PARTIALLY_COMPLETED,
        BatchStatus.FAILED,
    )
    if batch.status not in terminal:
        raise AppException(
            code="VOC_INVALID_BATCH_STATUS",
            message=f"批次状态为 {batch.status}，导入尚未完成",
            status_code=409,
        )

    # 抽样 100 行
    sample_sql = text(
        "SELECT id, source, source_key, raw_text, metadata "
        "FROM voc.voices WHERE batch_id = CAST(:batch_id AS uuid) "
        "ORDER BY RANDOM() LIMIT 100"
    )
    result = await db.execute(sample_sql, {"batch_id": str(batch_id)})
    rows = result.mappings().all()

    sample_rows = []
    for row in rows:
        sample_rows.append({
            "id": str(row["id"]),
            "source": row["source"],
            "source_key": row["source_key"],
            "raw_text": row["raw_text"][:200] if row["raw_text"] else "",
            "metadata": row["metadata"] or {},
        })

    return ApiResponse(
        data=ResultPreviewResponse(
            batch_id=batch.id,
            sample_rows=sample_rows,
            statistics=BatchProgress(
                total_count=batch.total_count,
                new_count=batch.new_count,
                duplicate_count=batch.duplicate_count,
                failed_count=batch.failed_count,
            ),
        )
    )
