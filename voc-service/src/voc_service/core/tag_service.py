"""标签管理服务。"""

from uuid import UUID

import structlog
from sqlalchemy import case, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from voc_service.api.schemas.tag_schemas import TAG_SORT_FIELDS
from voc_service.core.config import VocServiceSettings
from voc_service.core.exceptions import TagNotFoundError
from voc_service.core.search_service import confidence_tier
from voc_service.models.emergent_tag import EmergentTag
from voc_service.models.semantic_unit import SemanticUnit
from voc_service.models.tag_feedback import TagFeedback
from voc_service.models.unit_tag_association import UnitTagAssociation

logger = structlog.get_logger(__name__)


async def _check_tag_exists(db: AsyncSession, tag_id: UUID) -> None:
    """检查标签是否存在，不存在则抛出 TagNotFoundError。"""
    result = await db.execute(select(EmergentTag.id).where(EmergentTag.id == tag_id))
    if result.scalar_one_or_none() is None:
        raise TagNotFoundError(str(tag_id))


def _build_tag_filters(
    *,
    status: str | None,
    min_usage: int,
    confidence_tier_filter: str | None,
    settings: VocServiceSettings,
) -> list:
    """构建标签查询的 WHERE 条件列表（COUNT 和 DATA 查询共享）。"""
    conditions = []
    if status and status != "all":
        conditions.append(EmergentTag.status == status)
    if min_usage > 0:
        conditions.append(EmergentTag.usage_count >= min_usage)
    if confidence_tier_filter:
        high = settings.confidence_high_threshold
        medium = settings.confidence_medium_threshold
        if confidence_tier_filter == "high":
            conditions.append(EmergentTag.confidence >= high)
        elif confidence_tier_filter == "medium":
            conditions.extend(
                [
                    EmergentTag.confidence >= medium,
                    EmergentTag.confidence < high,
                ]
            )
        elif confidence_tier_filter == "low":
            conditions.append((EmergentTag.confidence < medium) | (EmergentTag.confidence.is_(None)))
    return conditions


def _feedback_aggregates():
    """构建反馈统计聚合列。"""
    return (
        func.coalesce(func.sum(case((TagFeedback.feedback_type == "useful", 1), else_=0)), 0).label("fb_useful"),
        func.coalesce(func.sum(case((TagFeedback.feedback_type == "useless", 1), else_=0)), 0).label("fb_useless"),
        func.coalesce(func.sum(case((TagFeedback.feedback_type == "error", 1), else_=0)), 0).label("fb_error"),
    )


async def submit_feedback(
    db: AsyncSession,
    *,
    tag_id: UUID,
    user_id: UUID,
    feedback_type: str,
) -> dict:
    """提交标签反馈（UPSERT 语义）。"""
    await _check_tag_exists(db, tag_id)

    # 查询已有反馈
    existing = await db.execute(
        select(TagFeedback.feedback_type).where(
            TagFeedback.tag_id == tag_id,
            TagFeedback.user_id == user_id,
        )
    )
    previous = existing.scalar_one_or_none()

    # UPSERT
    stmt = (
        pg_insert(TagFeedback)
        .values(tag_id=tag_id, user_id=user_id, feedback_type=feedback_type)
        .on_conflict_do_update(
            constraint="uq_feedback_tag_user",
            set_={"feedback_type": feedback_type},
        )
    )
    await db.execute(stmt)

    return {
        "tag_id": tag_id,
        "feedback_type": feedback_type,
        "previous_feedback_type": previous,
        "is_update": previous is not None,
    }


async def list_tags(
    db: AsyncSession,
    settings: VocServiceSettings,
    *,
    page: int = 1,
    page_size: int = 20,
    sort_by: str = "usage_count",
    sort_order: str = "desc",
    status: str | None = None,
    min_usage: int = 0,
    confidence_tier_filter: str | None = None,
) -> dict:
    """标签列表（含反馈统计）。"""
    if sort_by not in TAG_SORT_FIELDS:
        sort_by = "usage_count"

    # 共享过滤条件
    filters = _build_tag_filters(
        status=status,
        min_usage=min_usage,
        confidence_tier_filter=confidence_tier_filter,
        settings=settings,
    )

    # COUNT 查询
    count_query = select(func.count()).select_from(select(EmergentTag.id).where(*filters).subquery())
    total = (await db.execute(count_query)).scalar_one()

    # 数据查询（含反馈聚合）
    fb_useful, fb_useless, fb_error = _feedback_aggregates()
    query = (
        select(
            EmergentTag.id,
            EmergentTag.name,
            EmergentTag.usage_count,
            EmergentTag.confidence,
            EmergentTag.status,
            EmergentTag.created_at,
            fb_useful,
            fb_useless,
            fb_error,
        )
        .outerjoin(TagFeedback, TagFeedback.tag_id == EmergentTag.id)
        .where(*filters)
        .group_by(EmergentTag.id)
    )

    # 排序
    sort_col = getattr(EmergentTag, sort_by)
    query = query.order_by(sort_col.asc() if sort_order == "asc" else sort_col.desc())

    # 分页
    query = query.offset((page - 1) * page_size).limit(page_size)

    rows = (await db.execute(query)).all()

    items = [
        {
            "id": row.id,
            "name": row.name,
            "usage_count": row.usage_count,
            "confidence": row.confidence,
            "confidence_tier": confidence_tier(row.confidence, settings),
            "status": row.status,
            "feedback_summary": {
                "useful": row.fb_useful,
                "useless": row.fb_useless,
                "error": row.fb_error,
            },
            "created_at": row.created_at,
        }
        for row in rows
    ]

    return {"items": items, "total": total}


async def get_tag_detail(
    db: AsyncSession,
    settings: VocServiceSettings,
    *,
    tag_id: UUID,
) -> dict:
    """标签详情（含反馈统计 + 关联单元数）。"""
    fb_useful, fb_useless, fb_error = _feedback_aggregates()

    unit_count_subq = (
        select(func.count())
        .where(UnitTagAssociation.tag_id == tag_id)
        .correlate_except(UnitTagAssociation)
        .scalar_subquery()
    )

    query = (
        select(
            EmergentTag.id,
            EmergentTag.name,
            EmergentTag.raw_name,
            EmergentTag.usage_count,
            EmergentTag.confidence,
            EmergentTag.status,
            EmergentTag.parent_tag_id,
            EmergentTag.created_at,
            EmergentTag.updated_at,
            fb_useful,
            fb_useless,
            fb_error,
            unit_count_subq.label("unit_count"),
        )
        .outerjoin(TagFeedback, TagFeedback.tag_id == EmergentTag.id)
        .where(EmergentTag.id == tag_id)
        .group_by(EmergentTag.id)
    )

    row = (await db.execute(query)).first()
    if row is None:
        raise TagNotFoundError(str(tag_id))

    return {
        "id": row.id,
        "name": row.name,
        "raw_name": row.raw_name,
        "usage_count": row.usage_count,
        "confidence": row.confidence,
        "confidence_tier": confidence_tier(row.confidence, settings),
        "status": row.status,
        "parent_tag_id": row.parent_tag_id,
        "feedback_summary": {
            "useful": row.fb_useful,
            "useless": row.fb_useless,
            "error": row.fb_error,
        },
        "unit_count": row.unit_count,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


async def list_tag_units(
    db: AsyncSession,
    *,
    tag_id: UUID,
    page: int = 1,
    page_size: int = 20,
    min_relevance: float = 0.5,
) -> dict:
    """标签关联的语义单元列表。"""
    await _check_tag_exists(db, tag_id)

    # 基础条件
    base_conditions = [
        UnitTagAssociation.tag_id == tag_id,
        UnitTagAssociation.relevance >= min_relevance,
    ]

    # 总数
    count_result = await db.execute(select(func.count()).where(*base_conditions))
    total = count_result.scalar_one()

    # 查询关联单元
    query = (
        select(
            SemanticUnit.id.label("unit_id"),
            SemanticUnit.text,
            SemanticUnit.summary,
            SemanticUnit.intent,
            SemanticUnit.sentiment,
            UnitTagAssociation.relevance,
            UnitTagAssociation.is_primary,
            UnitTagAssociation.created_at,
        )
        .join(UnitTagAssociation, UnitTagAssociation.unit_id == SemanticUnit.id)
        .where(*base_conditions)
        .order_by(UnitTagAssociation.is_primary.desc(), UnitTagAssociation.relevance.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    rows = (await db.execute(query)).all()

    items = [
        {
            "unit_id": row.unit_id,
            "text": row.text,
            "summary": row.summary,
            "intent": row.intent,
            "sentiment": row.sentiment,
            "relevance": row.relevance,
            "is_primary": row.is_primary,
            "created_at": row.created_at,
        }
        for row in rows
    ]

    return {"items": items, "total": total}


async def compare_tags(
    db: AsyncSession,
    *,
    preset_taxonomy: list[str],
    page: int = 1,
    page_size: int = 20,
) -> dict:
    """对比涌现标签与预设分类的覆盖情况。

    对每个有标签的语义单元，检查其涌现标签是否与预设关键词匹配（子串包含）。
    """
    # 查所有有标签的语义单元（去重）
    unit_ids_stmt = select(UnitTagAssociation.unit_id).distinct()
    unit_ids_result = await db.execute(unit_ids_stmt)
    all_unit_ids = [row[0] for row in unit_ids_result.all()]
    total = len(all_unit_ids)

    if total == 0:
        return {
            "summary": {
                "total_units": 0,
                "emergent_coverage": 0.0,
                "preset_coverage": 0.0,
                "emergent_only_count": 0,
                "preset_only_count": 0,
                "both_count": 0,
            },
            "items": [],
            "total": 0,
        }

    # 分页的 unit_ids
    paged_ids = all_unit_ids[(page - 1) * page_size : page * page_size]

    # 批量查询这些 unit 的文本和标签
    units_stmt = select(SemanticUnit.id, SemanticUnit.text).where(SemanticUnit.id.in_(paged_ids))
    units_result = await db.execute(units_stmt)
    units_map = {row.id: row.text for row in units_result.all()}

    # 查询标签
    tags_stmt = (
        select(UnitTagAssociation.unit_id, EmergentTag.name)
        .join(EmergentTag, UnitTagAssociation.tag_id == EmergentTag.id)
        .where(UnitTagAssociation.unit_id.in_(paged_ids))
    )
    tags_result = await db.execute(tags_stmt)
    unit_tags: dict[UUID, list[str]] = {}
    for row in tags_result.all():
        unit_tags.setdefault(row.unit_id, []).append(row.name)

    # 对比并生成结果
    items = []
    # 全量统计用变量（需要遍历所有 unit，不只是分页的）
    emergent_only_total = 0
    preset_only_total = 0
    both_total = 0
    neither_total = 0

    # 先对全量做统计
    all_tags_stmt = select(UnitTagAssociation.unit_id, EmergentTag.name).join(
        EmergentTag, UnitTagAssociation.tag_id == EmergentTag.id
    )
    all_tags_result = await db.execute(all_tags_stmt)
    all_unit_tags: dict[UUID, list[str]] = {}
    for row in all_tags_result.all():
        all_unit_tags.setdefault(row.unit_id, []).append(row.name)

    # 获取所有 unit 的文本用于预设匹配
    all_units_stmt = select(SemanticUnit.id, SemanticUnit.text).where(SemanticUnit.id.in_(all_unit_ids))
    all_units_result = await db.execute(all_units_stmt)
    all_units_map = {row.id: row.text for row in all_units_result.all()}

    for uid in all_unit_ids:
        emergent = all_unit_tags.get(uid, [])
        unit_text = all_units_map.get(uid, "").lower()
        has_emergent = len(emergent) > 0

        # 预设匹配：检查 unit 文本或涌现标签名是否包含预设关键词
        matched_presets = []
        emergent_lower = [t.lower() for t in emergent]
        for kw in preset_taxonomy:
            kw_l = kw.lower()
            if kw_l in unit_text or any(kw_l in tag for tag in emergent_lower):
                matched_presets.append(kw)
        has_preset = len(matched_presets) > 0

        if has_emergent and has_preset:
            both_total += 1
        elif has_emergent:
            emergent_only_total += 1
        elif has_preset:
            preset_only_total += 1
        else:
            neither_total += 1

    # 构建分页项
    for uid in paged_ids:
        emergent = unit_tags.get(uid, [])
        unit_text = units_map.get(uid, "").lower()
        emergent_lower = [t.lower() for t in emergent]

        matched_presets = []
        for kw in preset_taxonomy:
            kw_l = kw.lower()
            if kw_l in unit_text or any(kw_l in tag for tag in emergent_lower):
                matched_presets.append(kw)

        has_emergent = len(emergent) > 0
        has_preset = len(matched_presets) > 0

        if has_emergent and has_preset:
            verdict = "both"
        elif has_emergent:
            verdict = "emergent_better"
        elif has_preset:
            verdict = "preset_better"
        else:
            verdict = "neither"

        items.append(
            {
                "unit_id": uid,
                "text": units_map.get(uid, ""),
                "emergent_tags": emergent,
                "preset_matches": matched_presets,
                "verdict": verdict,
            }
        )

    emergent_covered = emergent_only_total + both_total
    preset_covered = preset_only_total + both_total

    return {
        "summary": {
            "total_units": total,
            "emergent_coverage": emergent_covered / total if total > 0 else 0.0,
            "preset_coverage": preset_covered / total if total > 0 else 0.0,
            "emergent_only_count": emergent_only_total,
            "preset_only_count": preset_only_total,
            "both_count": both_total,
        },
        "items": items,
        "total": total,
    }
