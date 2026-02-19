"""标签管理 API 路由。"""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from prism_shared.schemas.pagination import PaginatedResponse, PaginationMeta
from prism_shared.schemas.response import ApiResponse
from voc_service.api.deps import UserRecord, get_current_user, get_db, get_settings
from voc_service.api.schemas.tag_schemas import (
    CompareResponse,
    CompareSummary,
    ComparisonItem,
    FeedbackRequest,
    FeedbackResponse,
    FeedbackSummary,
    TagDetail,
    TagListItem,
    TagUnitItem,
)
from voc_service.core.config import VocServiceSettings
from voc_service.core.tag_service import (
    compare_tags,
    get_tag_detail,
    list_tag_units,
    list_tags,
    submit_feedback,
)

router = APIRouter(prefix="/api/voc/tags", tags=["tags"])


@router.post("/{tag_id}/feedback", response_model=ApiResponse[FeedbackResponse])
async def feedback(
    tag_id: UUID,
    body: FeedbackRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
):
    """提交标签质量反馈（UPSERT 语义）。

    同一用户对同一标签仅保留最新反馈，重复提交会覆盖之前的反馈类型。
    """
    result = await submit_feedback(
        db,
        tag_id=tag_id,
        user_id=current_user.id,
        feedback_type=body.feedback_type.value,
    )
    return ApiResponse(data=FeedbackResponse(**result))


@router.get("", response_model=PaginatedResponse[TagListItem])
async def tags_list(
    page: int = Query(default=1, ge=1, description="页码"),
    page_size: int = Query(default=20, ge=1, le=100, description="每页条数"),
    sort_by: str = Query(
        default="usage_count",
        description="排序字段：usage_count/confidence/created_at",
    ),
    sort_order: str = Query(
        default="desc",
        pattern="^(asc|desc)$",
        description="排序方向",
    ),
    status: str | None = Query(
        default=None,
        pattern="^(active|merged|deprecated|all)$",
        description="状态过滤：active/merged/deprecated/all",
    ),
    min_usage: int = Query(default=0, ge=0, description="最低使用次数"),
    confidence_tier: str | None = Query(
        default=None,
        pattern="^(high|medium|low)$",
        description="置信度档位过滤",
    ),
    db: AsyncSession = Depends(get_db),
    settings: VocServiceSettings = Depends(get_settings),
    _current_user: UserRecord = Depends(get_current_user),
):
    """标签列表（含反馈统计摘要）。"""
    result = await list_tags(
        db,
        settings,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
        status=status,
        min_usage=min_usage,
        confidence_tier_filter=confidence_tier,
    )
    return PaginatedResponse(
        data=[
            TagListItem(**{**item, "feedback_summary": FeedbackSummary(**item["feedback_summary"])})
            for item in result["items"]
        ],
        pagination=PaginationMeta(page=page, page_size=page_size, total=result["total"]),
    )


@router.get("/compare", response_model=ApiResponse[CompareResponse])
async def tags_compare(
    preset_taxonomy: str = Query(description='预设分类关键词 JSON 数组，如 ["充电","续航"]'),
    page: int = Query(default=1, ge=1, description="页码"),
    page_size: int = Query(default=20, ge=1, le=100, description="每页条数"),
    db: AsyncSession = Depends(get_db),
    _current_user: UserRecord = Depends(get_current_user),
):
    """涌现标签 vs 预设分类对比。"""
    import json

    try:
        keywords = json.loads(preset_taxonomy)
        if not isinstance(keywords, list) or not all(isinstance(k, str) for k in keywords):
            raise ValueError
    except (json.JSONDecodeError, ValueError):
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "VOC_INVALID_TAXONOMY", "message": "preset_taxonomy 须为 JSON 字符串数组"},
        ) from None

    result = await compare_tags(db, preset_taxonomy=keywords, page=page, page_size=page_size)
    return ApiResponse(
        data=CompareResponse(
            summary=CompareSummary(**result["summary"]),
            items=[ComparisonItem(**item) for item in result["items"]],
            page=page,
            page_size=page_size,
            total=result["total"],
        )
    )


@router.get("/{tag_id}", response_model=ApiResponse[TagDetail])
async def tag_detail(
    tag_id: UUID,
    db: AsyncSession = Depends(get_db),
    settings: VocServiceSettings = Depends(get_settings),
    _current_user: UserRecord = Depends(get_current_user),
):
    """标签详情（含反馈统计 + 关联单元数）。"""
    result = await get_tag_detail(db, settings, tag_id=tag_id)
    result["feedback_summary"] = FeedbackSummary(**result["feedback_summary"])
    return ApiResponse(data=TagDetail(**result))


@router.get("/{tag_id}/units", response_model=PaginatedResponse[TagUnitItem])
async def tag_units(
    tag_id: UUID,
    page: int = Query(default=1, ge=1, description="页码"),
    page_size: int = Query(default=20, ge=1, le=100, description="每页条数"),
    min_relevance: float = Query(default=0.5, ge=0, le=1, description="最低关联度过滤"),
    db: AsyncSession = Depends(get_db),
    _current_user: UserRecord = Depends(get_current_user),
):
    """标签关联的语义单元列表。"""
    result = await list_tag_units(
        db,
        tag_id=tag_id,
        page=page,
        page_size=page_size,
        min_relevance=min_relevance,
    )
    return PaginatedResponse(
        data=[TagUnitItem(**item) for item in result["items"]],
        pagination=PaginationMeta(page=page, page_size=page_size, total=result["total"]),
    )
