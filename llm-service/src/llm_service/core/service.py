"""llm-service 核心业务逻辑：Provider / Model / Slot 管理 + 推理代理网关。"""

import json
import time
import uuid
from collections.abc import AsyncGenerator
from typing import Any

import httpx
import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from llm_service.core.crypto import decrypt_api_key, encrypt_api_key
from llm_service.core.errors import LLMErrorCode
from llm_service.core.presets import get_preset
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
    provider_type: str | None = None,
    base_url: str | None = None,
    api_key: str,
    preset_id: str | None = None,
    config: dict,
    encryption_key: str,
) -> Provider:
    """创建 Provider，API Key 加密存储。支持通过 preset_id 自动补全配置。"""
    # 预设补全逻辑
    if preset_id:
        preset = get_preset(preset_id)
        if preset is None:
            raise AppException(
                code=LLMErrorCode.INVALID_PRESET,
                message=f"内置预设 '{preset_id}' 不存在",
                status_code=400,
            )
        # 用户未提供的字段从预设填充
        if not base_url:
            base_url = preset.base_url
        if not provider_type:
            provider_type = preset.provider_type
        # 标记预设来源
        config = {**config, "preset_id": preset_id}
    else:
        # 非预设模式：base_url 和 provider_type 必填
        if not base_url:
            raise AppException(
                code=LLMErrorCode.PROVIDER_UNREACHABLE,
                message="非预设模式下 base_url 为必填项",
                status_code=400,
            )
        if not provider_type:
            raise AppException(
                code=LLMErrorCode.PROVIDER_UNREACHABLE,
                message="非预设模式下 provider_type 为必填项",
                status_code=400,
            )

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

    三级探测策略（无 test_model_id 时）：
    1. GET /models — 最轻量，验证连通性 + API Key
    2. /models 返回 404 → 用预设的 test_model 发 chat ping-pong
    3. 无预设 test_model → 仅凭 404 判定网络可达

    指定 test_model_id 时：直接按 test_type 发送推理请求。
    """
    provider = await get_provider(db, provider_id)
    api_key = decrypt_api_key(provider.api_key_encrypted, encryption_key)
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    # 用户明确指定了模型：直接测试
    if test_model_id:
        return await _run_test(
            provider,
            headers,
            test_type,
            test_model_id,
            is_default_probe=False,
        )

    # 默认探测：先尝试 GET /models
    result = await _run_test(provider, headers, "models", None, is_default_probe=True)

    # /models 返回 404 → 尝试 chat ping-pong fallback
    if result.get("status") == "ok" and "不支持模型列表" in result.get("message", ""):
        fallback_model = _get_preset_test_model(provider)
        if fallback_model:
            return await _run_test(
                provider,
                headers,
                "chat",
                fallback_model,
                is_default_probe=False,
            )

    return result


async def _run_test(
    provider: Provider,
    headers: dict,
    test_type: str,
    test_model_id: str | None,
    *,
    is_default_probe: bool,
) -> dict:
    """执行单次连通性测试请求。"""
    start_time = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            if test_type == "models":
                response = await client.get(f"{provider.base_url}/models", headers=headers)
            else:
                model = test_model_id or "ping"
                response = await _send_model_test(client, provider.base_url, headers, test_type, model)

        latency_ms = int((time.monotonic() - start_time) * 1000)
        return _evaluate_response(
            provider.id,
            response.status_code,
            response.text,
            latency_ms,
            test_type,
            test_model_id,
            is_default_probe,
        )
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


def _get_preset_test_model(provider: Provider) -> str | None:
    """从 Provider 的预设配置中获取 test_model。"""
    preset_id = (provider.config or {}).get("preset_id")
    if not preset_id:
        return None
    preset = get_preset(preset_id)
    return preset.test_model if preset and preset.test_model else None


def _evaluate_response(
    provider_id: uuid.UUID,
    status_code: int,
    response_text: str,
    latency_ms: int,
    test_type: str,
    test_model_id: str | None,
    is_default_probe: bool,
) -> dict:
    """根据 HTTP 状态码评估连通性测试结果。"""
    base = {
        "provider_id": provider_id,
        "latency_ms": latency_ms,
        "test_type": test_type,
        "test_model_id": test_model_id,
    }

    if status_code < 400:
        return {**base, "status": "ok", "message": "连接成功"}

    if is_default_probe and status_code == 404:
        return {**base, "status": "ok", "message": "连接成功（不支持模型列表接口，将尝试 chat 验证）"}

    if status_code in (401, 403):
        return {
            **base,
            "status": "error",
            "message": f"API Key 无效或权限不足 (HTTP {status_code})",
            "error_detail": response_text[:500],
        }

    return {
        **base,
        "status": "error",
        "message": f"Provider 返回 HTTP {status_code}",
        "error_detail": response_text[:500],
    }


async def list_provider_models(
    db: AsyncSession,
    provider_id: uuid.UUID,
    *,
    encryption_key: str,
) -> list[dict]:
    """
    获取 Provider 可用模型列表。
    代理调用 Provider 的 GET /models 端点，返回标准化的模型列表。
    """
    provider = await get_provider(db, provider_id)
    api_key = decrypt_api_key(provider.api_key_encrypted, encryption_key)

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{provider.base_url}/models",
                headers={"Authorization": f"Bearer {api_key}"},
            )

        if response.status_code >= 400:
            logger.warning(
                "获取模型列表失败",
                provider_id=str(provider_id),
                status_code=response.status_code,
            )
            return []

        body = response.json()
        raw_models = body.get("data", [])

        # 标准化：只保留 id 和 owned_by
        models = []
        for m in raw_models:
            model_id = m.get("id")
            if model_id:
                models.append(
                    {
                        "id": model_id,
                        "owned_by": m.get("owned_by", ""),
                    }
                )

        # 按 id 排序
        models.sort(key=lambda x: x["id"])
        return models

    except (httpx.TimeoutException, httpx.ConnectError) as e:
        logger.warning("获取模型列表网络异常", provider_id=str(provider_id), error=str(e))
        return []


async def _send_model_test(
    client: httpx.AsyncClient,
    base_url: str,
    headers: dict,
    test_type: str,
    model_id: str,
) -> httpx.Response:
    """按 test_type 发送实际推理请求。"""
    if test_type == "embedding":
        return await client.post(
            f"{base_url}/embeddings",
            headers=headers,
            json={"model": model_id, "input": ["ping"]},
        )
    elif test_type == "rerank":
        return await client.post(
            f"{base_url}/rerank",
            headers=headers,
            json={"model": model_id, "query": "test", "documents": ["test"]},
        )
    else:
        return await client.post(
            f"{base_url}/chat/completions",
            headers=headers,
            json={"model": model_id, "messages": [{"role": "user", "content": "ping"}], "max_tokens": 1},
        )


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

    # 验证降级链中的 Provider（存在性 + 启用状态）
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


# ===========================
# 推理代理网关
# ===========================


async def _get_provider_with_key(
    db: AsyncSession,
    provider_id: str,
    encryption_key: str,
) -> tuple[Provider, str]:
    """获取 Provider 并解密 API Key。"""
    provider = await db.get(Provider, uuid.UUID(provider_id))
    if provider is None:
        raise NotFoundException("Provider", provider_id)
    api_key = decrypt_api_key(provider.api_key_encrypted, encryption_key)
    return provider, api_key


async def call_completion(
    db: AsyncSession,
    *,
    provider_id: str,
    model_id: str,
    messages: list[dict],
    max_tokens: int | None = None,
    temperature: float | None = None,
    top_p: float | None = None,
    encryption_key: str,
) -> dict:
    """
    非流式 Chat 补全代理。
    代理调用 Provider 的 /chat/completions，返回标准化结果。
    """
    provider, api_key = await _get_provider_with_key(db, provider_id, encryption_key)

    payload: dict[str, Any] = {
        "model": model_id,
        "messages": messages,
    }
    if max_tokens is not None:
        payload["max_tokens"] = max_tokens
    if temperature is not None:
        payload["temperature"] = temperature
    if top_p is not None:
        payload["top_p"] = top_p

    start = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{provider.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
    except (httpx.TimeoutException, httpx.ConnectError) as e:
        raise AppException(
            code=LLMErrorCode.UPSTREAM_ERROR,
            message=f"Provider 连接失败：{e}",
            status_code=502,
        ) from e

    latency_ms = int((time.monotonic() - start) * 1000)

    if response.status_code >= 400:
        raise AppException(
            code=LLMErrorCode.UPSTREAM_ERROR,
            message=f"Provider 返回 HTTP {response.status_code}",
            status_code=502,
            details={"upstream_status": response.status_code, "upstream_body": response.text[:1000]},
        )

    body = response.json()
    choice = body.get("choices", [{}])[0]
    msg = choice.get("message", {})
    usage = body.get("usage", {})

    return {
        "content": msg.get("content", ""),
        "usage": {
            "prompt_tokens": usage.get("prompt_tokens", 0),
            "completion_tokens": usage.get("completion_tokens", 0),
            "total_tokens": usage.get("total_tokens", 0),
        },
        "latency_ms": latency_ms,
        "model": body.get("model", model_id),
    }


async def call_completion_stream(
    db: AsyncSession,
    *,
    provider_id: str,
    model_id: str,
    messages: list[dict],
    max_tokens: int | None = None,
    temperature: float | None = None,
    top_p: float | None = None,
    encryption_key: str,
) -> AsyncGenerator[str, None]:
    """
    流式 Chat 补全代理。
    代理调用 Provider 的 /chat/completions（stream=true），逐块 yield SSE 数据。
    """
    provider, api_key = await _get_provider_with_key(db, provider_id, encryption_key)

    payload: dict[str, Any] = {
        "model": model_id,
        "messages": messages,
        "stream": True,
    }
    if max_tokens is not None:
        payload["max_tokens"] = max_tokens
    if temperature is not None:
        payload["temperature"] = temperature
    if top_p is not None:
        payload["top_p"] = top_p

    start = time.monotonic()
    try:
        async with (
            httpx.AsyncClient(timeout=120.0) as client,
            client.stream(
                "POST",
                f"{provider.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            ) as response,
        ):
            if response.status_code >= 400:
                body = await response.aread()
                raise AppException(
                    code=LLMErrorCode.UPSTREAM_ERROR,
                    message=f"Provider 返回 HTTP {response.status_code}",
                    status_code=502,
                    details={"upstream_status": response.status_code, "upstream_body": body.decode()[:1000]},
                )

            accumulated_content = ""
            usage_info: dict[str, int] = {}
            final_model = model_id

            async for line in response.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data_str = line[6:]
                if data_str.strip() == "[DONE]":
                    break

                try:
                    chunk = json.loads(data_str)
                except json.JSONDecodeError:
                    continue

                final_model = chunk.get("model", final_model)
                choice = chunk.get("choices", [{}])[0]
                delta = choice.get("delta", {})
                finish_reason = choice.get("finish_reason")
                delta_content = delta.get("content", "")

                if delta_content:
                    accumulated_content += delta_content

                # 检查 usage（部分 Provider 在最后一个 chunk 发送 usage）
                if chunk.get("usage"):
                    usage_info = chunk["usage"]

                event_data = {"delta": delta_content, "finish_reason": finish_reason}
                yield f"data: {json.dumps(event_data, ensure_ascii=False)}\n\n"

            # 发送最终汇总事件
            latency_ms = int((time.monotonic() - start) * 1000)
            final_event = {
                "usage": {
                    "prompt_tokens": usage_info.get("prompt_tokens", 0),
                    "completion_tokens": usage_info.get("completion_tokens", 0),
                    "total_tokens": usage_info.get("total_tokens", 0),
                },
                "latency_ms": latency_ms,
                "model": final_model,
            }
            yield f"data: {json.dumps(final_event, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"

    except AppException:
        raise
    except (httpx.TimeoutException, httpx.ConnectError) as e:
        raise AppException(
            code=LLMErrorCode.UPSTREAM_ERROR,
            message=f"Provider 连接失败：{e}",
            status_code=502,
        ) from e


async def call_embedding(
    db: AsyncSession,
    *,
    provider_id: str,
    model_id: str,
    input_texts: str | list[str],
    encryption_key: str,
    dimensions: int | None = None,
) -> dict:
    """
    Embedding 代理。
    代理调用 Provider 的 /embeddings，返回标准化的向量结果。
    """
    provider, api_key = await _get_provider_with_key(db, provider_id, encryption_key)

    # 统一为列表
    if isinstance(input_texts, str):
        input_texts = [input_texts]

    payload: dict = {"model": model_id, "input": input_texts}
    if dimensions is not None:
        payload["dimensions"] = dimensions

    start = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{provider.base_url}/embeddings",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
    except (httpx.TimeoutException, httpx.ConnectError) as e:
        raise AppException(
            code=LLMErrorCode.UPSTREAM_ERROR,
            message=f"Provider 连接失败：{e}",
            status_code=502,
        ) from e

    latency_ms = int((time.monotonic() - start) * 1000)

    if response.status_code >= 400:
        raise AppException(
            code=LLMErrorCode.UPSTREAM_ERROR,
            message=f"Provider 返回 HTTP {response.status_code}",
            status_code=502,
            details={"upstream_status": response.status_code, "upstream_body": response.text[:1000]},
        )

    body = response.json()
    raw_data = body.get("data", [])
    usage = body.get("usage", {})

    embeddings = []
    for item in raw_data:
        values = item.get("embedding", [])
        embeddings.append(
            {
                "index": item.get("index", 0),
                "values": values,
                "dimensions": len(values),
            }
        )

    return {
        "embeddings": embeddings,
        "usage": {
            "prompt_tokens": usage.get("prompt_tokens", 0),
            "completion_tokens": usage.get("completion_tokens", 0),
            "total_tokens": usage.get("total_tokens", 0),
        },
        "latency_ms": latency_ms,
        "model": body.get("model", model_id),
    }


async def call_rerank(
    db: AsyncSession,
    *,
    provider_id: str,
    model_id: str,
    query: str,
    documents: list[str],
    encryption_key: str,
) -> dict:
    """
    Rerank 代理。
    代理调用 Provider 的 /rerank，返回标准化的排序结果。
    """
    provider, api_key = await _get_provider_with_key(db, provider_id, encryption_key)

    start = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{provider.base_url}/rerank",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={"model": model_id, "query": query, "documents": documents},
            )
    except (httpx.TimeoutException, httpx.ConnectError) as e:
        raise AppException(
            code=LLMErrorCode.UPSTREAM_ERROR,
            message=f"Provider 连接失败：{e}",
            status_code=502,
        ) from e

    latency_ms = int((time.monotonic() - start) * 1000)

    if response.status_code >= 400:
        raise AppException(
            code=LLMErrorCode.UPSTREAM_ERROR,
            message=f"Provider 返回 HTTP {response.status_code}",
            status_code=502,
            details={"upstream_status": response.status_code, "upstream_body": response.text[:1000]},
        )

    body = response.json()
    raw_results = body.get("results", [])

    results = []
    for item in raw_results:
        idx = item.get("index", 0)
        results.append(
            {
                "index": idx,
                "document": documents[idx] if idx < len(documents) else "",
                "relevance_score": item.get("relevance_score", 0.0),
            }
        )

    # 按 relevance_score 降序排列
    results.sort(key=lambda x: x["relevance_score"], reverse=True)

    return {
        "results": results,
        "latency_ms": latency_ms,
        "model": body.get("model", model_id),
    }


async def invoke_slot(
    db: AsyncSession,
    slot_type: SlotType,
    *,
    messages: list[dict],
    max_tokens: int | None = None,
    temperature: float | None = None,
    encryption_key: str,
) -> dict:
    """
    槽位调用（含资源池故障转移）。
    解析槽位配置 → 调用主模型 → 失败时按资源池顺序故障转移 → 返回结果 + routing 信息。
    """
    slot = await get_slot(db, slot_type)
    if slot is None or not slot.is_enabled:
        raise AppException(
            code=LLMErrorCode.SLOT_NOT_CONFIGURED,
            message=f"槽位 '{slot_type.value}' 未配置或已禁用",
            status_code=503,
        )

    primary_provider = await db.get(Provider, slot.primary_provider_id)
    if primary_provider is None:
        raise AppException(
            code=LLMErrorCode.SLOT_NOT_CONFIGURED,
            message=f"槽位 '{slot_type.value}' 的主 Provider 不存在",
            status_code=503,
        )

    failover_trace: list[dict] = []

    # 尝试主模型
    try:
        result = await call_completion(
            db,
            provider_id=str(slot.primary_provider_id),
            model_id=slot.primary_model_id,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
            encryption_key=encryption_key,
        )
        failover_trace.append(
            {
                "provider_name": primary_provider.name,
                "model_id": slot.primary_model_id,
                "success": True,
                "error": None,
                "latency_ms": result["latency_ms"],
            }
        )
        return {
            "result": result,
            "routing": {
                "provider_name": primary_provider.name,
                "model_id": slot.primary_model_id,
                "slot_type": slot_type.value,
                "used_resource_pool": False,
                "failover_trace": failover_trace,
            },
        }
    except AppException as e:
        failover_trace.append(
            {
                "provider_name": primary_provider.name,
                "model_id": slot.primary_model_id,
                "success": False,
                "error": e.message,
                "latency_ms": None,
            }
        )
        logger.warning(
            "主模型调用失败，尝试资源池故障转移",
            slot_type=slot_type.value,
            error=e.message,
        )

    # 资源池故障转移
    for item in slot.fallback_chain or []:
        fb_provider_id = item.get("provider_id")
        fb_model_id = item.get("model_id")
        fb_provider = await db.get(Provider, fb_provider_id)
        fb_provider_name = fb_provider.name if fb_provider else "未知"

        try:
            result = await call_completion(
                db,
                provider_id=str(fb_provider_id),
                model_id=fb_model_id,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
                encryption_key=encryption_key,
            )
            failover_trace.append(
                {
                    "provider_name": fb_provider_name,
                    "model_id": fb_model_id,
                    "success": True,
                    "error": None,
                    "latency_ms": result["latency_ms"],
                }
            )
            return {
                "result": result,
                "routing": {
                    "provider_name": fb_provider_name,
                    "model_id": fb_model_id,
                    "slot_type": slot_type.value,
                    "used_resource_pool": True,
                    "failover_trace": failover_trace,
                },
            }
        except AppException as e:
            failover_trace.append(
                {
                    "provider_name": fb_provider_name,
                    "model_id": fb_model_id,
                    "success": False,
                    "error": e.message,
                    "latency_ms": None,
                }
            )
            logger.warning(
                "资源池备选模型调用失败",
                provider=fb_provider_name,
                model=fb_model_id,
                error=e.message,
            )

    # 全部失败
    raise AppException(
        code=LLMErrorCode.ALL_MODELS_FAILED,
        message="所有模型（主模型 + 资源池）均调用失败",
        status_code=503,
        details={"failover_trace": failover_trace},
    )
