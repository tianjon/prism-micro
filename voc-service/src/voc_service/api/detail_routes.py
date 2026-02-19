"""Voice/Unit 详情 API 路由。"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from prism_shared.schemas.response import ApiResponse
from voc_service.api.deps import UserRecord, get_current_user, get_db, get_settings
from voc_service.api.schemas.detail_schemas import (
    UnitDetail,
    UnitTagInfo,
    VoiceBrief,
    VoiceDetail,
    VoiceUnitItem,
)
from voc_service.core.config import VocServiceSettings
from voc_service.core.search_service import confidence_tier
from voc_service.models.semantic_unit import SemanticUnit
from voc_service.models.unit_tag_association import UnitTagAssociation
from voc_service.models.voice import Voice

router = APIRouter(prefix="/api/voc", tags=["details"])


async def _build_unit_tags(db: AsyncSession, unit_id: UUID) -> list[dict]:
    """查询语义单元关联的标签列表。"""
    from voc_service.models.emergent_tag import EmergentTag

    stmt = (
        select(
            UnitTagAssociation.tag_id,
            EmergentTag.name,
            UnitTagAssociation.relevance,
            UnitTagAssociation.is_primary,
        )
        .join(EmergentTag, UnitTagAssociation.tag_id == EmergentTag.id)
        .where(UnitTagAssociation.unit_id == unit_id)
        .order_by(UnitTagAssociation.relevance.desc())
    )
    result = await db.execute(stmt)
    return [
        {
            "tag_id": row.tag_id,
            "tag_name": row.name,
            "relevance": row.relevance,
            "is_primary": row.is_primary,
        }
        for row in result.all()
    ]


@router.get("/units/{unit_id}", response_model=ApiResponse[UnitDetail])
async def unit_detail(
    unit_id: UUID,
    db: AsyncSession = Depends(get_db),
    settings: VocServiceSettings = Depends(get_settings),
    _current_user: UserRecord = Depends(get_current_user),
):
    """语义单元详情。"""
    stmt = select(SemanticUnit).options(selectinload(SemanticUnit.voice)).where(SemanticUnit.id == unit_id)
    result = await db.execute(stmt)
    unit = result.scalar_one_or_none()

    if unit is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "VOC_UNIT_NOT_FOUND", "message": "语义单元不存在"},
        )

    tags = await _build_unit_tags(db, unit_id)
    voice = unit.voice

    return ApiResponse(
        data=UnitDetail(
            id=unit.id,
            voice_id=unit.voice_id,
            text=unit.text,
            summary=unit.summary,
            intent=unit.intent,
            sentiment=unit.sentiment,
            confidence=unit.confidence,
            confidence_tier=confidence_tier(unit.confidence, settings),
            sequence_index=unit.sequence_index,
            tags=[UnitTagInfo(**t) for t in tags],
            voice=VoiceBrief(
                id=voice.id,
                source=voice.source,
                raw_text=voice.raw_text,
                metadata=voice.metadata_,
                created_at=voice.created_at,
            ),
            created_at=unit.created_at,
        )
    )


@router.get("/voices/{voice_id}", response_model=ApiResponse[VoiceDetail])
async def voice_detail(
    voice_id: UUID,
    db: AsyncSession = Depends(get_db),
    settings: VocServiceSettings = Depends(get_settings),
    _current_user: UserRecord = Depends(get_current_user),
):
    """Voice 详情。"""
    stmt = select(Voice).where(Voice.id == voice_id)
    result = await db.execute(stmt)
    voice = result.scalar_one_or_none()

    if voice is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "VOC_VOICE_NOT_FOUND", "message": "Voice 不存在"},
        )

    # 查询关联的语义单元
    units_stmt = select(SemanticUnit).where(SemanticUnit.voice_id == voice_id).order_by(SemanticUnit.sequence_index)
    units_result = await db.execute(units_stmt)
    units = units_result.scalars().all()

    # 批量查询所有 unit 的标签
    unit_items = []
    for u in units:
        tags = await _build_unit_tags(db, u.id)
        unit_items.append(
            VoiceUnitItem(
                id=u.id,
                text=u.text,
                summary=u.summary,
                intent=u.intent,
                sentiment=u.sentiment,
                confidence=u.confidence,
                confidence_tier=confidence_tier(u.confidence, settings),
                sequence_index=u.sequence_index,
                tags=[UnitTagInfo(**t) for t in tags],
            )
        )

    return ApiResponse(
        data=VoiceDetail(
            id=voice.id,
            source=voice.source,
            raw_text=voice.raw_text,
            content_hash=voice.content_hash,
            batch_id=voice.batch_id,
            processed_status=voice.processed_status,
            metadata=voice.metadata_,
            units=unit_items,
            created_at=voice.created_at,
        )
    )
