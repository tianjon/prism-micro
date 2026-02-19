"""数据管理 API 路由（Batch / Mapping / Voice）。"""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from prism_shared.schemas.pagination import PaginatedResponse, PaginationMeta
from prism_shared.schemas.response import ApiResponse
from voc_service.api.deps import UserRecord, get_current_user, get_db
from voc_service.api.schemas.data_schemas import (
    BATCH_FILTER_FIELDS,
    BatchItem,
    DeleteResponse,
    FieldValuesResponse,
    MAPPING_FILTER_FIELDS,
    MappingItem,
    MetadataKeysResponse,
    VOICE_FILTER_FIELDS,
    VoiceListItem,
)
from voc_service.core.data_service import (
    delete_batch,
    delete_mapping,
    delete_voice,
    get_batch_detail,
    get_distinct_field_values,
    get_mapping_detail,
    get_voice_metadata_keys,
    list_batches,
    list_mappings,
    list_voices,
)
from voc_service.models.ingestion_batch import IngestionBatch
from voc_service.models.schema_mapping import SchemaMapping
from voc_service.models.voice import Voice
from voc_service.core.filter_builder import parse_filter_conditions

router = APIRouter(prefix="/api/voc/data", tags=["data"])


# ============================================================
# Batch 端点
# ============================================================


@router.get("/batches", response_model=PaginatedResponse[BatchItem])
async def batches_list(
    page: int = Query(default=1, ge=1, description="页码"),
    page_size: int = Query(default=20, ge=1, le=100, description="每页条数"),
    sort_by: str = Query(
        default="created_at",
        description="排序字段",
    ),
    sort_order: str = Query(
        default="desc",
        pattern="^(asc|desc)$",
        description="排序方向",
    ),
    status: str | None = Query(default=None, description="状态过滤"),
    source: str | None = Query(default=None, description="来源过滤"),
    filters: str | None = Query(default=None, description="JSON 筛选条件数组"),
    db: AsyncSession = Depends(get_db),
    _current_user: UserRecord = Depends(get_current_user),
):
    """导入批次列表。"""
    filter_conditions, filter_logic = parse_filter_conditions(filters)
    result = await list_batches(
        db,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
        status=status,
        source=source,
        filter_conditions=filter_conditions,
        filter_logic=filter_logic,
    )
    return PaginatedResponse(
        data=[BatchItem(**item) for item in result["items"]],
        pagination=PaginationMeta(page=page, page_size=page_size, total=result["total"]),
    )


@router.get("/batches/{batch_id}", response_model=ApiResponse[BatchItem])
async def batch_detail(
    batch_id: UUID,
    db: AsyncSession = Depends(get_db),
    _current_user: UserRecord = Depends(get_current_user),
):
    """导入批次详情。"""
    result = await get_batch_detail(db, batch_id=batch_id)
    return ApiResponse(data=BatchItem(**result))


@router.get("/batches/field-values", response_model=ApiResponse[FieldValuesResponse])
async def batch_field_values(
    field: str = Query(..., description="字段名"),
    prefix: str | None = Query(default=None, description="前缀匹配"),
    db: AsyncSession = Depends(get_db),
    _current_user: UserRecord = Depends(get_current_user),
):
    """获取批次某字段的不重复取值（辅助完成）。"""
    if field not in BATCH_FILTER_FIELDS:
        return ApiResponse(data=FieldValuesResponse(values=[], has_more=False))

    overrides = {"mapping_name": SchemaMapping.name}
    result = await get_distinct_field_values(
        db, IngestionBatch, field, prefix=prefix, field_overrides=overrides,
    )
    return ApiResponse(data=FieldValuesResponse(**result))


@router.delete("/batches/{batch_id}", response_model=ApiResponse[DeleteResponse])
async def batch_delete(
    batch_id: UUID,
    db: AsyncSession = Depends(get_db),
    _current_user: UserRecord = Depends(get_current_user),
):
    """删除导入批次（级联删除关联 Voice）。"""
    await delete_batch(db, batch_id=batch_id)
    return ApiResponse(
        data=DeleteResponse(
            id=str(batch_id),
            deleted=True,
            message="导入批次及关联数据已删除",
        )
    )


# ============================================================
# Mapping 端点
# ============================================================


@router.get("/mappings", response_model=PaginatedResponse[MappingItem])
async def mappings_list(
    page: int = Query(default=1, ge=1, description="页码"),
    page_size: int = Query(default=20, ge=1, le=100, description="每页条数"),
    sort_by: str = Query(
        default="created_at",
        description="排序字段",
    ),
    sort_order: str = Query(
        default="desc",
        pattern="^(asc|desc)$",
        description="排序方向",
    ),
    source_format: str | None = Query(default=None, description="文件格式过滤：csv/excel/json"),
    created_by: str | None = Query(default=None, description="创建方式过滤：llm/user/llm_user_confirmed"),
    filters: str | None = Query(default=None, description="JSON 筛选条件数组"),
    db: AsyncSession = Depends(get_db),
    _current_user: UserRecord = Depends(get_current_user),
):
    """映射模板列表。"""
    filter_conditions, filter_logic = parse_filter_conditions(filters)
    result = await list_mappings(
        db,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
        source_format=source_format,
        created_by=created_by,
        filter_conditions=filter_conditions,
        filter_logic=filter_logic,
    )
    return PaginatedResponse(
        data=[MappingItem(**item) for item in result["items"]],
        pagination=PaginationMeta(page=page, page_size=page_size, total=result["total"]),
    )


@router.get("/mappings/{mapping_id}", response_model=ApiResponse[MappingItem])
async def mapping_detail(
    mapping_id: UUID,
    db: AsyncSession = Depends(get_db),
    _current_user: UserRecord = Depends(get_current_user),
):
    """映射模板详情。"""
    result = await get_mapping_detail(db, mapping_id=mapping_id)
    return ApiResponse(data=MappingItem(**result))


@router.get("/mappings/field-values", response_model=ApiResponse[FieldValuesResponse])
async def mapping_field_values(
    field: str = Query(..., description="字段名"),
    prefix: str | None = Query(default=None, description="前缀匹配"),
    db: AsyncSession = Depends(get_db),
    _current_user: UserRecord = Depends(get_current_user),
):
    """获取映射模板某字段的不重复取值（辅助完成）。"""
    if field not in MAPPING_FILTER_FIELDS:
        return ApiResponse(data=FieldValuesResponse(values=[], has_more=False))

    result = await get_distinct_field_values(db, SchemaMapping, field, prefix=prefix)
    return ApiResponse(data=FieldValuesResponse(**result))


@router.delete("/mappings/{mapping_id}", response_model=ApiResponse[DeleteResponse])
async def mapping_delete(
    mapping_id: UUID,
    db: AsyncSession = Depends(get_db),
    _current_user: UserRecord = Depends(get_current_user),
):
    """删除映射模板。"""
    await delete_mapping(db, mapping_id=mapping_id)
    return ApiResponse(
        data=DeleteResponse(
            id=str(mapping_id),
            deleted=True,
            message="映射模板已删除",
        )
    )


# ============================================================
# Voice 端点
# ============================================================


@router.get("/voices", response_model=PaginatedResponse[VoiceListItem])
async def voices_list(
    page: int = Query(default=1, ge=1, description="页码"),
    page_size: int = Query(default=20, ge=1, le=100, description="每页条数"),
    sort_by: str = Query(
        default="created_at",
        description="排序字段",
    ),
    sort_order: str = Query(
        default="desc",
        pattern="^(asc|desc)$",
        description="排序方向",
    ),
    batch_id: UUID | None = Query(default=None, description="按批次 ID 过滤"),
    source: str | None = Query(default=None, description="来源过滤"),
    processed_status: str | None = Query(default=None, description="处理状态过滤"),
    filters: str | None = Query(default=None, description="JSON 筛选条件数组"),
    db: AsyncSession = Depends(get_db),
    _current_user: UserRecord = Depends(get_current_user),
):
    """Voice 列表。"""
    filter_conditions, filter_logic = parse_filter_conditions(filters)
    result = await list_voices(
        db,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
        batch_id=batch_id,
        source=source,
        processed_status=processed_status,
        filter_conditions=filter_conditions,
        filter_logic=filter_logic,
    )
    return PaginatedResponse(
        data=[VoiceListItem(**item) for item in result["items"]],
        pagination=PaginationMeta(page=page, page_size=page_size, total=result["total"]),
    )


@router.get("/voices/field-values", response_model=ApiResponse[FieldValuesResponse])
async def voice_field_values(
    field: str = Query(..., description="字段名（支持 metadata.xxx）"),
    prefix: str | None = Query(default=None, description="前缀匹配"),
    db: AsyncSession = Depends(get_db),
    _current_user: UserRecord = Depends(get_current_user),
):
    """获取 Voice 某字段的不重复取值（辅助完成）。"""
    if field not in VOICE_FILTER_FIELDS and not (
        "metadata.*" in VOICE_FILTER_FIELDS and field.startswith("metadata.")
    ):
        return ApiResponse(data=FieldValuesResponse(values=[], has_more=False))

    result = await get_distinct_field_values(db, Voice, field, prefix=prefix)
    return ApiResponse(data=FieldValuesResponse(**result))


@router.get("/voices/metadata-keys", response_model=ApiResponse[MetadataKeysResponse])
async def voice_metadata_keys(
    db: AsyncSession = Depends(get_db),
    _current_user: UserRecord = Depends(get_current_user),
):
    """获取 Voice 元数据中所有不重复的顶层键名。"""
    keys = await get_voice_metadata_keys(db)
    return ApiResponse(data=MetadataKeysResponse(keys=keys))


@router.delete("/voices/{voice_id}", response_model=ApiResponse[DeleteResponse])
async def voice_delete(
    voice_id: UUID,
    db: AsyncSession = Depends(get_db),
    _current_user: UserRecord = Depends(get_current_user),
):
    """删除单条 Voice。"""
    await delete_voice(db, voice_id=voice_id)
    return ApiResponse(
        data=DeleteResponse(
            id=str(voice_id),
            deleted=True,
            message="Voice 记录已删除",
        )
    )
