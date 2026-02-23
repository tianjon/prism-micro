"""Slot 管理业务逻辑。"""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from llm_service.core.errors import LLMErrorCode
from llm_service.models.provider import Provider
from llm_service.models.slot import ModelSlot, SlotType
from prism_shared.exceptions import AppException, NotFoundException


async def configure_slot(
    db: AsyncSession,
    slot_type: SlotType,
    *,
    primary_provider_id: uuid.UUID,
    primary_model_id: str,
    fallback_chain: list[dict],
    is_enabled: bool = True,
    config: dict | None = None,
) -> ModelSlot:
    """
    配置或更新 Slot。
    验证主 Provider 和降级链中所有 Provider 均存在且启用。
    """
    primary_provider = await db.get(Provider, primary_provider_id)
    if primary_provider is None:
        raise NotFoundException("Provider", str(primary_provider_id))
    if not primary_provider.is_enabled:
        raise AppException(
            code=LLMErrorCode.PROVIDER_UNREACHABLE,
            message=f"Provider '{primary_provider.name}' 已被禁用",
            status_code=400,
        )

    for item in fallback_chain:
        fb_provider = await db.get(Provider, item["provider_id"])
        if fb_provider is None:
            raise NotFoundException("Provider", str(item["provider_id"]))
        if not fb_provider.is_enabled:
            raise AppException(
                code=LLMErrorCode.PROVIDER_UNREACHABLE,
                message=f"降级链中的 Provider '{fb_provider.name}' 已被禁用",
                status_code=400,
            )

    result = await db.execute(select(ModelSlot).where(ModelSlot.slot_type == slot_type))
    slot = result.scalar_one_or_none()

    if slot is None:
        slot = ModelSlot(
            slot_type=slot_type,
            primary_provider_id=primary_provider_id,
            primary_model_id=primary_model_id,
            fallback_chain=fallback_chain,
            is_enabled=is_enabled,
            config=config or {},
        )
        db.add(slot)
    else:
        slot.primary_provider_id = primary_provider_id
        slot.primary_model_id = primary_model_id
        slot.fallback_chain = fallback_chain
        slot.is_enabled = is_enabled
        slot.config = config or {}

    await db.flush()
    await db.refresh(slot)
    return slot


async def get_slot(db: AsyncSession, slot_type: SlotType) -> ModelSlot | None:
    """获取指定类型的 Slot 配置。"""
    result = await db.execute(select(ModelSlot).where(ModelSlot.slot_type == slot_type))
    return result.scalar_one_or_none()


async def list_slots(db: AsyncSession) -> list[ModelSlot]:
    """列出所有 Slot 配置。"""
    result = await db.execute(select(ModelSlot).order_by(ModelSlot.slot_type))
    return list(result.scalars().all())


async def resolve_slot(db: AsyncSession, slot_type: SlotType) -> dict:
    """解析 Slot 配置，返回当前生效模型信息。"""
    slot = await get_slot(db, slot_type)
    if slot is None or not slot.is_enabled:
        raise AppException(
            code=LLMErrorCode.SLOT_NOT_CONFIGURED,
            message=f"槽位 '{slot_type.value}' 未配置或已禁用",
            status_code=503,
        )

    provider = await db.get(Provider, slot.primary_provider_id)
    return {
        "slot_type": slot.slot_type.value,
        "provider_name": provider.name if provider else None,
        "provider_slug": provider.slug if provider else None,
        "model_id": slot.primary_model_id,
        "fallback_count": len(slot.fallback_chain),
    }


async def find_referencing_slots(db: AsyncSession, provider_id: uuid.UUID) -> list[ModelSlot]:
    """查找引用指定 Provider 的所有 Slot（主 Provider 或降级链中）。"""
    result = await db.execute(select(ModelSlot).where(ModelSlot.primary_provider_id == provider_id))
    slots = list(result.scalars().all())

    all_slots_result = await db.execute(select(ModelSlot))
    for slot in all_slots_result.scalars().all():
        if slot in slots:
            continue
        for item in slot.fallback_chain or []:
            if str(item.get("provider_id")) == str(provider_id):
                slots.append(slot)
                break

    return slots
