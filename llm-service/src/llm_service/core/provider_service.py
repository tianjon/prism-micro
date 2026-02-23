"""Provider 管理业务逻辑。"""

import time
import uuid
from typing import Any

import httpx
import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from llm_service.core.crypto import decrypt_api_key, encrypt_api_key
from llm_service.core.errors import LLMErrorCode
from llm_service.core.presets import get_preset
from llm_service.models.provider import Provider
from prism_shared.exceptions import AppException, NotFoundException

logger = structlog.get_logger(__name__)


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
    if preset_id:
        preset = get_preset(preset_id)
        if preset is None:
            raise AppException(
                code=LLMErrorCode.INVALID_PRESET,
                message=f"内置预设 '{preset_id}' 不存在",
                status_code=400,
            )
        if not base_url:
            base_url = preset.base_url
        if not provider_type:
            provider_type = preset.provider_type
        config = {**config, "preset_id": preset_id}
    else:
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

    new_slug = updates.get("slug")
    if new_slug and new_slug != provider.slug:
        existing = await db.execute(select(Provider).where(Provider.slug == new_slug))
        if existing.scalar_one_or_none():
            raise AppException(
                code=LLMErrorCode.PROVIDER_SLUG_CONFLICT,
                message=f"slug '{new_slug}' 已被使用",
                status_code=409,
            )

    new_api_key = updates.pop("api_key", None)
    if new_api_key:
        provider.api_key_encrypted = encrypt_api_key(new_api_key, encryption_key)

    for field, value in updates.items():
        if value is not None and hasattr(provider, field):
            setattr(provider, field, value)

    await db.flush()
    await db.refresh(provider)
    return provider


async def delete_provider(db: AsyncSession, provider_id: uuid.UUID) -> None:
    """删除 Provider。如果有 Slot 引用则拒绝删除。"""
    provider = await get_provider(db, provider_id)

    from llm_service.core.slot_service import find_referencing_slots

    referenced_slots = await find_referencing_slots(db, provider_id)
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
      1. GET /models
      2. /models 返回 404 -> 用预设 test_model 做 chat ping
      3. 无预设 test_model -> 仅判定网络可达
    """
    provider = await get_provider(db, provider_id)
    api_key = decrypt_api_key(provider.api_key_encrypted, encryption_key)
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    if test_model_id:
        return await _run_test(
            provider,
            headers,
            test_type,
            test_model_id,
            is_default_probe=False,
        )

    result = await _run_test(provider, headers, "models", None, is_default_probe=True)
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


async def list_provider_models(
    db: AsyncSession,
    provider_id: uuid.UUID,
    *,
    encryption_key: str,
) -> list[dict]:
    """
    获取 Provider 可用模型列表。
    代理调用 Provider 的 GET /models 端点，返回标准化结果。
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

        models.sort(key=lambda x: x["id"])
        return models

    except (httpx.TimeoutException, httpx.ConnectError) as e:
        logger.warning("获取模型列表网络异常", provider_id=str(provider_id), error=str(e))
        return []


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
    if test_type == "rerank":
        return await client.post(
            f"{base_url}/rerank",
            headers=headers,
            json={"model": model_id, "query": "test", "documents": ["test"]},
        )
    return await client.post(
        f"{base_url}/chat/completions",
        headers=headers,
        json={"model": model_id, "messages": [{"role": "user", "content": "ping"}], "max_tokens": 1},
    )
