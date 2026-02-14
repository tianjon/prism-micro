"""数据导入 API 路由。"""

from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from prism_shared.exceptions import AppException
from prism_shared.schemas import ApiResponse
from voc_service.api.deps import _UserRecord, get_current_user, get_db, get_llm_client, get_settings
from voc_service.api.schemas.import_schemas import (
    BatchProgress,
    BatchStatusResponse,
    ColumnMapping,
    ConfirmMappingRequest,
    ConfirmMappingResponse,
    FileInfo,
    ImportResponse,
    MappingPreviewResponse,
)
from voc_service.core import import_service, schema_mapping_service
from voc_service.core.config import VocServiceSettings
from voc_service.core.file_parser import parse_file
from voc_service.core.llm_client import LLMClient

logger = structlog.get_logger()

router = APIRouter(prefix="/api/voc/import", tags=["import"])


@router.post("", status_code=202, response_model=ApiResponse[ImportResponse])
async def upload_file(
    file: UploadFile = File(...),
    source: str = Form(default=""),
    mapping_id: str = Form(default=""),
    auto_process: bool = Form(default=True),
    db: AsyncSession = Depends(get_db),
    settings: VocServiceSettings = Depends(get_settings),
    llm_client: LLMClient = Depends(get_llm_client),
    current_user: _UserRecord = Depends(get_current_user),
):
    """
    上传文件，触发解析 + LLM Schema 映射。

    流程：
    1. 验证文件格式和大小
    2. 解析采样数据
    3. 创建 IngestionBatch
    4. 查找或创建 Schema 映射
    5. 根据置信度决定后续流程
    """
    # 采样解析
    sample_result = await parse_file(
        file,
        max_file_size_bytes=settings.max_file_size_bytes,
        sample_only=True,
        sample_rows=settings.mapping_sample_rows,
    )

    # 推断来源
    if not source:
        source = sample_result.detected_format

    # 创建批次
    batch = await import_service.create_batch(
        db,
        source=source,
        file_name=file.filename or "unknown",
        file_size_bytes=file.size or 0,
        total_rows=sample_result.total_rows,
    )

    # 简化：llm-service 部署在同一内网，暂不传递 token
    api_key = None

    # 查找或创建映射
    mapping_result = await schema_mapping_service.find_or_create_mapping(
        db,
        columns=sample_result.columns,
        sample_rows=sample_result.rows,
        source_format=sample_result.detected_format,
        llm_client=llm_client,
        confidence_auto=settings.mapping_confidence_auto,
        api_key=api_key,
    )

    batch.mapping_id = mapping_result.mapping.id

    file_info = FileInfo(
        file_name=file.filename or "unknown",
        file_size_bytes=file.size or 0,
        total_rows=sample_result.total_rows,
        detected_encoding=sample_result.detected_encoding,
        detected_format=sample_result.detected_format,
    )

    if mapping_result.needs_confirmation:
        # 需要用户确认映射
        batch.status = "mapping"
        await db.flush()

        return ApiResponse(
            data=ImportResponse(
                batch_id=batch.id,
                status="mapping",
                message="Schema 映射需要确认，请查看映射预览并确认",
                file_info=file_info,
                mapping_preview_url=f"/api/voc/import/{batch.id}/mapping-preview",
            )
        )

    # 置信度足够，需要重新完整解析文件
    # 重置文件指针再次读取
    await file.seek(0)
    full_result = await parse_file(
        file,
        max_file_size_bytes=settings.max_file_size_bytes,
        sample_only=False,
    )

    # 在后台任务中执行导入
    chunk_size = settings.upload_chunk_size

    # Phase 1 简化实现：在请求中直接导入
    await import_service.execute_import(
        db,
        batch=batch,
        rows=full_result.rows,
        mapping=mapping_result.mapping,
        chunk_size=chunk_size,
    )

    return ApiResponse(
        data=ImportResponse(
            batch_id=batch.id,
            status=batch.status,
            message=f"导入完成：新增 {batch.new_count} 条，重复 {batch.duplicate_count} 条",
            file_info=file_info,
            matched_mapping={
                "mapping_id": str(mapping_result.mapping.id),
                "name": mapping_result.mapping.name,
                "is_new": mapping_result.is_new,
            },
        )
    )


@router.get("/{batch_id}/status", response_model=ApiResponse[BatchStatusResponse])
async def get_batch_status(
    batch_id: UUID,
    db: AsyncSession = Depends(get_db),
    _current_user: _UserRecord = Depends(get_current_user),
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
            created_at=batch.created_at,
            completed_at=batch.completed_at,
        )
    )


@router.get("/{batch_id}/mapping-preview", response_model=ApiResponse[MappingPreviewResponse])
async def get_mapping_preview(
    batch_id: UUID,
    db: AsyncSession = Depends(get_db),
    _current_user: _UserRecord = Depends(get_current_user),
):
    """获取映射预览。"""
    batch = await import_service.get_batch_with_progress(db, batch_id=batch_id)

    if batch.mapping_id is None:
        raise AppException(
            code="VOC_BATCH_NOT_FOUND",
            message="批次没有关联的映射",
            status_code=404,
        )

    from sqlalchemy import select

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
        # 提取采样值
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
    body: ConfirmMappingRequest,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    settings: VocServiceSettings = Depends(get_settings),
    _current_user: _UserRecord = Depends(get_current_user),
):
    """
    确认映射并开始导入。

    需要重新上传文件（因为采样阶段未保存完整数据）。
    """
    # 确认映射
    mapping = await schema_mapping_service.confirm_mapping(
        db,
        batch_id=batch_id,
        confirmed_mappings=body.confirmed_mappings,
        save_as_template=body.save_as_template,
        template_name=body.template_name,
    )

    # 完整解析文件
    full_result = await parse_file(
        file,
        max_file_size_bytes=settings.max_file_size_bytes,
        sample_only=False,
    )

    # 更新批次状态
    batch = await import_service.get_batch_with_progress(db, batch_id=batch_id)
    batch.total_count = full_result.total_rows

    # 执行导入
    await import_service.execute_import(
        db,
        batch=batch,
        rows=full_result.rows,
        mapping=mapping,
        chunk_size=settings.upload_chunk_size,
    )

    return ApiResponse(
        data=ConfirmMappingResponse(
            batch_id=batch.id,
            status=batch.status,
            message=f"导入完成：新增 {batch.new_count} 条，重复 {batch.duplicate_count} 条",
            mapping_id=mapping.id,
            template_saved=body.save_as_template,
        )
    )
