"""Slot 管理 API 路由。"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from llm_service.api.deps import get_db
from llm_service.api.schemas.slot import (
    FallbackItemResponse,
    ProviderBrief,
    SlotConfigureRequest,
    SlotResponse,
)
from llm_service.core import service
from llm_service.models.slot import SlotType
from prism_shared.schemas import ApiResponse

router = APIRouter(prefix="/api/llm/slots", tags=["slots"])


@router.get("", response_model=ApiResponse[list[SlotResponse]])
async def list_slots(db: AsyncSession = Depends(get_db)):
    """列出所有 Slot 配置。"""
    slots = await service.list_slots(db)

    # 构建已配置的 slot_type 集合
    configured = {s.slot_type for s in slots}
    result: list[SlotResponse] = []

    # 将已配置的 Slot 转换为响应格式
    for slot in slots:
        result.append(await _slot_to_response(db, slot))

    # 补充未配置的 Slot（返回空壳）
    for st in SlotType:
        if st not in configured:
            result.append(SlotResponse(slot_type=st, is_enabled=False))

    # 按枚举顺序排序
    slot_order = {SlotType.FAST: 0, SlotType.REASONING: 1, SlotType.EMBEDDING: 2, SlotType.RERANK: 3}
    result.sort(key=lambda s: slot_order.get(s.slot_type, 99))

    return ApiResponse(data=result)


@router.get("/{slot_type}", response_model=ApiResponse[SlotResponse])
async def get_slot(slot_type: SlotType, db: AsyncSession = Depends(get_db)):
    """获取指定 Slot 配置。"""
    slot = await service.get_slot(db, slot_type)
    if slot is None:
        # 返回未配置的空壳
        return ApiResponse(data=SlotResponse(slot_type=slot_type, is_enabled=False))
    return ApiResponse(data=await _slot_to_response(db, slot))


@router.put("/{slot_type}", response_model=ApiResponse[SlotResponse])
async def configure_slot(
    slot_type: SlotType,
    body: SlotConfigureRequest,
    db: AsyncSession = Depends(get_db),
):
    """配置 Slot。"""
    # 将 FallbackItem 列表转换为 dict 列表存储
    fallback_chain = [{"provider_id": str(item.provider_id), "model_id": item.model_id} for item in body.fallback_chain]

    slot = await service.configure_slot(
        db,
        slot_type,
        primary_provider_id=body.primary_provider_id,
        primary_model_id=body.primary_model_id,
        fallback_chain=fallback_chain,
        is_enabled=body.is_enabled,
        config=body.config,
    )
    return ApiResponse(data=await _slot_to_response(db, slot))


# --- 内部辅助 ---


async def _slot_to_response(db: AsyncSession, slot) -> SlotResponse:
    """将 ModelSlot ORM 对象转换为 SlotResponse。"""
    from llm_service.models.provider import Provider

    # 加载主 Provider 信息
    primary_provider = await db.get(Provider, slot.primary_provider_id)
    primary_brief = ProviderBrief.model_validate(primary_provider) if primary_provider else None

    # 构建降级链响应
    fallback_responses = []
    for item in slot.fallback_chain or []:
        fb_provider = await db.get(Provider, item["provider_id"])
        if fb_provider:
            fallback_responses.append(
                FallbackItemResponse(
                    provider=ProviderBrief.model_validate(fb_provider),
                    model_id=item["model_id"],
                )
            )

    return SlotResponse(
        slot_type=slot.slot_type,
        is_enabled=slot.is_enabled,
        primary_provider=primary_brief,
        primary_model_id=slot.primary_model_id,
        fallback_chain=fallback_responses,
        config=slot.config,
        updated_at=slot.updated_at,
    )
