"""llm-service 核心业务逻辑：Provider / Model / Slot 管理。"""

import time
import uuid
from typing import Any

import httpx
import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from llm_service.core.crypto import decrypt_api_key, encrypt_api_key
from llm_service.core.errors import LLMErrorCode
from llm_service.models.provider import Provider
from llm_service.models.slot import ModelSlot, SlotType
from prism_shared.exceptions import AppException, NotFoundException

logger = structlog.get_logger()


# ===========================
# Provider 管理
# ===========================


async def create_provider(
    db: AsyncSession,
    *,
    name: str,
    slug: str,
    provider_type: str,
    base_url: str,
    api_key: str,
    config: dict,
    encryption_key: str,
) -> Provider:
    """创建 Provider，API Key 加密存储。"""
    # 检查 slug 唯一性
    existing = await db.execute(select(Provider).where(Provider.slug == slug))
    if existing.scalar_one_or_none():
        raise AppException(
            code=LLMErrorCode.PROVIDER_SLUG_CONFLICT,
            message=f"slug '{slug}' 已被使用",
            status_code=409,
        )

    provider = Provider(
        name=name,
        slug=slug,
        provider_type=provider_type,
        base_url=base_url,
        api_key_encrypted=encrypt_api_key(api_key, encryption_key),
        config=config,
    )
    db.add(provider)
    await db.flush()
    await db.refresh(provider)
    return provider


async def get_provider(db: AsyncSession, provider_id: uuid.UUID) -> Provider:
    """获取 Provider，不存在时抛出 404。"""
    provider = await db.get(Provider, provider_id)
    if provider is None:
        raise NotFoundException("Provider", str(provider_id))
    return provider


async def list_providers(db: AsyncSession, *, page: int = 1, page_size: int = 20) -> tuple[list[Provider], int]:
    """分页列出 Provider，返回 (列表, 总数)。"""
    offset = (page - 1) * page_size

    total_result = await db.execute(select(func.count(Provider.id)))
    total = total_result.scalar_one()

    result = await db.execute(select(Provider).order_by(Provider.created_at.desc()).offset(offset).limit(page_size))
    providers = list(result.scalars().all())
    return providers, total


async def update_provider(
    db: AsyncSession,
    provider_id: uuid.UUID,
    *,
    encryption_key: str,
    **updates: Any,
) -> Provider:
    """更新 Provider（部分更新）。"""
    provider = await get_provider(db, provider_id)

    # 如果更新了 slug，检查唯一性
    new_slug = updates.get("slug")
    if new_slug and new_slug != provider.slug:
        existing = await db.execute(select(Provider).where(Provider.slug == new_slug))
        if existing.scalar_one_or_none():
            raise AppException(
                code=LLMErrorCode.PROVIDER_SLUG_CONFLICT,
                message=f"slug '{new_slug}' 已被使用",
                status_code=409,
            )

    # 如果更新了 api_key，加密后存储
    new_api_key = updates.pop("api_key", None)
    if new_api_key:
        provider.api_key_encrypted = encrypt_api_key(new_api_key, encryption_key)

    # 应用其他更新字段
    for field, value in updates.items():
        if value is not None and hasattr(provider, field):
            setattr(provider, field, value)

    await db.flush()
    await db.refresh(provider)
    return provider


async def delete_provider(db: AsyncSession, provider_id: uuid.UUID) -> None:
    """删除 Provider。如果有 Slot 引用则拒绝删除。"""
    provider = await get_provider(db, provider_id)

    # 检查是否被 Slot 引用（主 Provider 或降级链中）
    referenced_slots = await _find_referencing_slots(db, provider_id)
    if referenced_slots:
        slot_names = [s.slot_type.value for s in referenced_slots]
        raise AppException(
            code=LLMErrorCode.PROVIDER_IN_USE,
            message=f"该 Provider 被以下槽位引用：{', '.join(slot_names)}。请先解除引用。",
            status_code=409,
            details={"referenced_slots": slot_names},
        )

    await db.delete(provider)
    await db.flush()


async def test_provider_connectivity(
    db: AsyncSession,
    provider_id: uuid.UUID,
    *,
    encryption_key: str,
    test_type: str = "chat",
    test_model_id: str | None = None,
) -> dict:
    """
    测试 Provider 连通性。
    向 base_url 发送轻量级请求验证可达性和 API Key 有效性。
    """
    provider = await get_provider(db, provider_id)
    api_key = decrypt_api_key(provider.api_key_encrypted, encryption_key)

    start_time = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # 根据测试类型发送不同的探测请求
            if test_type == "embedding":
                response = await client.post(
                    f"{provider.base_url}/embeddings",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": test_model_id or "test",
                        "input": ["ping"],
                    },
                )
            elif test_type == "rerank":
                response = await client.post(
                    f"{provider.base_url}/rerank",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": test_model_id or "test",
                        "query": "test",
                        "documents": ["test"],
                    },
                )
            else:
                # chat 测试：发送最简请求
                response = await client.post(
                    f"{provider.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": test_model_id or "test",
                        "messages": [{"role": "user", "content": "ping"}],
                        "max_tokens": 1,
                    },
                )

        latency_ms = int((time.monotonic() - start_time) * 1000)

        if response.status_code < 400:
            return {
                "provider_id": provider.id,
                "status": "ok",
                "latency_ms": latency_ms,
                "test_type": test_type,
                "test_model_id": test_model_id,
                "message": "连接成功",
            }
        else:
            return {
                "provider_id": provider.id,
                "status": "error",
                "latency_ms": latency_ms,
                "test_type": test_type,
                "test_model_id": test_model_id,
                "message": f"Provider 返回 HTTP {response.status_code}",
                "error_detail": response.text[:500],
            }
    except httpx.TimeoutException:
        latency_ms = int((time.monotonic() - start_time) * 1000)
        return {
            "provider_id": provider.id,
            "status": "error",
            "latency_ms": latency_ms,
            "test_type": test_type,
            "test_model_id": test_model_id,
            "message": "连接超时",
            "error_detail": "请求在 10 秒内未响应",
        }
    except httpx.ConnectError as e:
        return {
            "provider_id": provider.id,
            "status": "error",
            "test_type": test_type,
            "test_model_id": test_model_id,
            "message": "无法连接到 Provider",
            "error_detail": str(e),
        }


# ===========================
# Slot 管理
# ===========================


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
    # 验证主 Provider
    primary_provider = await db.get(Provider, primary_provider_id)
    if primary_provider is None:
        raise NotFoundException("Provider", str(primary_provider_id))
    if not primary_provider.is_enabled:
        raise AppException(
            code=LLMErrorCode.PROVIDER_UNREACHABLE,
            message=f"Provider '{primary_provider.name}' 已被禁用",
            status_code=400,
        )

    # 验证降级链中的 Provider
    for item in fallback_chain:
        fb_provider = await db.get(Provider, item["provider_id"])
        if fb_provider is None:
            raise NotFoundException("Provider", str(item["provider_id"]))

    # 查找现有 Slot 或创建新的
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
    """
    解析 Slot 配置，返回当前生效的模型信息（Phase 1 基础版，仅读配置）。
    """
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


# ===========================
# 内部辅助
# ===========================


async def _find_referencing_slots(db: AsyncSession, provider_id: uuid.UUID) -> list[ModelSlot]:
    """查找引用指定 Provider 的所有 Slot（主 Provider 或降级链中）。"""
    # 检查主 Provider 引用
    result = await db.execute(select(ModelSlot).where(ModelSlot.primary_provider_id == provider_id))
    slots = list(result.scalars().all())

    # 检查降级链引用（JSONB 包含查询）
    all_slots_result = await db.execute(select(ModelSlot))
    for slot in all_slots_result.scalars().all():
        if slot in slots:
            continue
        for item in slot.fallback_chain or []:
            if str(item.get("provider_id")) == str(provider_id):
                slots.append(slot)
                break

    return slots
