"""推理网关与槽位调用业务逻辑。"""

import importlib
import json
import os
import time
import uuid
from collections.abc import AsyncGenerator
from typing import Any

import httpx
import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from llm_service.core.crypto import decrypt_api_key
from llm_service.core.errors import LLMErrorCode
from llm_service.core.routing import build_routing_info, build_trace_entry
from llm_service.core.slot_service import get_slot
from llm_service.models.provider import Provider
from llm_service.models.slot import SlotType
from prism_shared.exceptions import AppException, NotFoundException

logger = structlog.get_logger(__name__)

RUNTIME_MODE_ENV = "PRISM_LLM_RUNTIME_MODE"
RUNTIME_HTTP_FALLBACK_ENV = "PRISM_LLM_RUNTIME_HTTP_FALLBACK"


def _use_litellm() -> bool:
    return os.getenv(RUNTIME_MODE_ENV, "litellm").lower() == "litellm"


def _allow_http_fallback() -> bool:
    return os.getenv(RUNTIME_HTTP_FALLBACK_ENV, "true").lower() not in {"0", "false", "no"}


def _extract_usage(raw_usage: Any) -> dict[str, int]:
    if raw_usage is None:
        return {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
    if isinstance(raw_usage, dict):
        return {
            "prompt_tokens": int(raw_usage.get("prompt_tokens", 0) or 0),
            "completion_tokens": int(raw_usage.get("completion_tokens", 0) or 0),
            "total_tokens": int(raw_usage.get("total_tokens", 0) or 0),
        }
    return {
        "prompt_tokens": int(getattr(raw_usage, "prompt_tokens", 0) or 0),
        "completion_tokens": int(getattr(raw_usage, "completion_tokens", 0) or 0),
        "total_tokens": int(getattr(raw_usage, "total_tokens", 0) or 0),
    }


def _to_plain_dict(response: Any) -> dict[str, Any]:
    if isinstance(response, dict):
        return response
    model_dump = getattr(response, "model_dump", None)
    if callable(model_dump):
        return model_dump()
    to_dict = getattr(response, "dict", None)
    if callable(to_dict):
        return to_dict()
    data = getattr(response, "__dict__", None)
    if isinstance(data, dict):
        return data
    return {}


def _build_litellm_provider_kwargs(provider: Provider, model_id: str, api_key: str) -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        "model": model_id,
        "api_key": api_key,
    }
    if provider.base_url:
        kwargs["api_base"] = provider.base_url
    if provider.provider_type:
        kwargs["custom_llm_provider"] = provider.provider_type
    return kwargs


async def _get_provider_with_key(
    db: AsyncSession,
    provider_id: str,
    encryption_key: str,
) -> tuple[Provider, str]:
    """获取 Provider 并解密 API Key。"""
    try:
        pid = uuid.UUID(provider_id)
    except ValueError as exc:
        raise NotFoundException("Provider", provider_id) from exc
    provider = await db.get(Provider, pid)
    if provider is None:
        raise NotFoundException("Provider", provider_id)
    api_key = decrypt_api_key(provider.api_key_encrypted, encryption_key)
    return provider, api_key


async def _call_completion_http(
    *,
    provider: Provider,
    api_key: str,
    model_id: str,
    messages: list[dict],
    max_tokens: int | None = None,
    temperature: float | None = None,
    top_p: float | None = None,
) -> dict:
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
    usage = _extract_usage(body.get("usage"))
    return {
        "content": msg.get("content", ""),
        "usage": usage,
        "latency_ms": latency_ms,
        "model": body.get("model", model_id),
    }


async def _call_completion_litellm(
    *,
    provider: Provider,
    api_key: str,
    model_id: str,
    messages: list[dict],
    max_tokens: int | None = None,
    temperature: float | None = None,
    top_p: float | None = None,
) -> dict:
    litellm = importlib.import_module("litellm")
    acompletion = litellm.acompletion

    kwargs = _build_litellm_provider_kwargs(provider, model_id, api_key)
    kwargs["messages"] = messages
    if max_tokens is not None:
        kwargs["max_tokens"] = max_tokens
    if temperature is not None:
        kwargs["temperature"] = temperature
    if top_p is not None:
        kwargs["top_p"] = top_p

    start = time.monotonic()
    response = await acompletion(**kwargs)
    latency_ms = int((time.monotonic() - start) * 1000)
    body = _to_plain_dict(response)

    choices = body.get("choices", [])
    content = ""
    if choices:
        c0 = choices[0]
        if isinstance(c0, dict):
            msg = c0.get("message", {})
            content = msg.get("content", "") if isinstance(msg, dict) else getattr(msg, "content", "")
        else:
            msg = getattr(c0, "message", None)
            content = getattr(msg, "content", "")

    usage = _extract_usage(body.get("usage", getattr(response, "usage", None)))
    model = body.get("model", getattr(response, "model", model_id))
    return {
        "content": content,
        "usage": usage,
        "latency_ms": latency_ms,
        "model": model,
    }


async def _call_embedding_http(
    *,
    provider: Provider,
    api_key: str,
    model_id: str,
    input_texts: str | list[str],
    dimensions: int | None = None,
) -> dict:
    if isinstance(input_texts, str):
        input_texts = [input_texts]

    payload: dict[str, Any] = {"model": model_id, "input": input_texts}
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
    usage = _extract_usage(body.get("usage"))
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
        "usage": usage,
        "latency_ms": latency_ms,
        "model": body.get("model", model_id),
    }


async def _call_embedding_litellm(
    *,
    provider: Provider,
    api_key: str,
    model_id: str,
    input_texts: str | list[str],
    dimensions: int | None = None,
) -> dict:
    if isinstance(input_texts, str):
        input_texts = [input_texts]

    litellm = importlib.import_module("litellm")
    aembedding = litellm.aembedding

    kwargs = _build_litellm_provider_kwargs(provider, model_id, api_key)
    kwargs["input"] = input_texts
    if dimensions is not None:
        kwargs["dimensions"] = dimensions

    start = time.monotonic()
    response = await aembedding(**kwargs)
    latency_ms = int((time.monotonic() - start) * 1000)
    body = _to_plain_dict(response)

    raw_data = body.get("data", [])
    embeddings = []
    for item in raw_data:
        if isinstance(item, dict):
            values = item.get("embedding", [])
            index = int(item.get("index", 0))
        else:
            values = getattr(item, "embedding", [])
            index = int(getattr(item, "index", 0) or 0)
        embeddings.append(
            {
                "index": index,
                "values": values,
                "dimensions": len(values),
            }
        )

    usage = _extract_usage(body.get("usage", getattr(response, "usage", None)))
    model = body.get("model", getattr(response, "model", model_id))
    return {
        "embeddings": embeddings,
        "usage": usage,
        "latency_ms": latency_ms,
        "model": model,
    }


async def _call_rerank_http(
    *,
    provider: Provider,
    api_key: str,
    model_id: str,
    query: str,
    documents: list[str],
) -> dict:
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

    results.sort(key=lambda x: x["relevance_score"], reverse=True)
    return {
        "results": results,
        "latency_ms": latency_ms,
        "model": body.get("model", model_id),
    }


async def _call_rerank_litellm(
    *,
    provider: Provider,
    api_key: str,
    model_id: str,
    query: str,
    documents: list[str],
) -> dict:
    litellm = importlib.import_module("litellm")
    rerank_fn = getattr(litellm, "arerank", None)
    if rerank_fn is None:
        raise RuntimeError("当前 litellm 版本不支持 arerank")

    kwargs = _build_litellm_provider_kwargs(provider, model_id, api_key)
    kwargs["query"] = query
    kwargs["documents"] = documents

    start = time.monotonic()
    response = await rerank_fn(**kwargs)
    latency_ms = int((time.monotonic() - start) * 1000)
    body = _to_plain_dict(response)
    raw_results = body.get("results", [])

    results = []
    for item in raw_results:
        if isinstance(item, dict):
            idx = int(item.get("index", 0))
            score = float(item.get("relevance_score", item.get("score", 0.0)) or 0.0)
        else:
            idx = int(getattr(item, "index", 0) or 0)
            score = float(getattr(item, "relevance_score", getattr(item, "score", 0.0)) or 0.0)
        results.append(
            {
                "index": idx,
                "document": documents[idx] if idx < len(documents) else "",
                "relevance_score": score,
            }
        )

    results.sort(key=lambda x: x["relevance_score"], reverse=True)
    model = body.get("model", getattr(response, "model", model_id))
    return {
        "results": results,
        "latency_ms": latency_ms,
        "model": model,
    }


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
    """非流式 Chat 补全代理。"""
    provider, api_key = await _get_provider_with_key(db, provider_id, encryption_key)

    if _use_litellm():
        try:
            return await _call_completion_litellm(
                provider=provider,
                api_key=api_key,
                model_id=model_id,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
                top_p=top_p,
            )
        except Exception as e:  # pragma: no cover - fallback path
            logger.warning("litellm chat 调用失败，回退 HTTP", provider_id=provider_id, model=model_id, error=str(e))
            if not _allow_http_fallback():
                raise AppException(
                    code=LLMErrorCode.UPSTREAM_ERROR,
                    message=f"litellm 调用失败且已禁用 HTTP fallback: {e}",
                    status_code=502,
                ) from e

    return await _call_completion_http(
        provider=provider,
        api_key=api_key,
        model_id=model_id,
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
        top_p=top_p,
    )


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
    当前保留 HTTP 直连实现，确保 SSE 兼容性稳定。
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

                if chunk.get("usage"):
                    usage_info = chunk["usage"]

                event_data = {"delta": delta_content, "finish_reason": finish_reason}
                yield f"data: {json.dumps(event_data, ensure_ascii=False)}\n\n"

            latency_ms = int((time.monotonic() - start) * 1000)
            final_event = {
                "usage": _extract_usage(usage_info),
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
    """Embedding 代理。"""
    provider, api_key = await _get_provider_with_key(db, provider_id, encryption_key)

    if _use_litellm():
        try:
            return await _call_embedding_litellm(
                provider=provider,
                api_key=api_key,
                model_id=model_id,
                input_texts=input_texts,
                dimensions=dimensions,
            )
        except Exception as e:  # pragma: no cover - fallback path
            logger.warning(
                "litellm embedding 调用失败，回退 HTTP", provider_id=provider_id, model=model_id, error=str(e)
            )
            if not _allow_http_fallback():
                raise AppException(
                    code=LLMErrorCode.UPSTREAM_ERROR,
                    message=f"litellm embedding 失败且已禁用 HTTP fallback: {e}",
                    status_code=502,
                ) from e

    return await _call_embedding_http(
        provider=provider,
        api_key=api_key,
        model_id=model_id,
        input_texts=input_texts,
        dimensions=dimensions,
    )


async def call_rerank(
    db: AsyncSession,
    *,
    provider_id: str,
    model_id: str,
    query: str,
    documents: list[str],
    encryption_key: str,
) -> dict:
    """Rerank 代理。"""
    provider, api_key = await _get_provider_with_key(db, provider_id, encryption_key)

    if _use_litellm():
        try:
            return await _call_rerank_litellm(
                provider=provider,
                api_key=api_key,
                model_id=model_id,
                query=query,
                documents=documents,
            )
        except Exception as e:  # pragma: no cover - fallback path
            logger.warning("litellm rerank 调用失败，回退 HTTP", provider_id=provider_id, model=model_id, error=str(e))
            if not _allow_http_fallback():
                raise AppException(
                    code=LLMErrorCode.UPSTREAM_ERROR,
                    message=f"litellm rerank 失败且已禁用 HTTP fallback: {e}",
                    status_code=502,
                ) from e

    return await _call_rerank_http(
        provider=provider,
        api_key=api_key,
        model_id=model_id,
        query=query,
        documents=documents,
    )


async def invoke_slot(
    db: AsyncSession,
    slot_type: SlotType,
    *,
    messages: list[dict],
    max_tokens: int | None = None,
    temperature: float | None = None,
    encryption_key: str,
) -> dict:
    """槽位调用（含资源池故障转移）。"""
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

    failover_trace: list[dict[str, Any]] = []

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
            build_trace_entry(
                provider_name=primary_provider.name,
                model_id=slot.primary_model_id,
                success=True,
                latency_ms=result["latency_ms"],
            )
        )
        return {
            "result": result,
            "routing": build_routing_info(
                provider_name=primary_provider.name,
                model_id=slot.primary_model_id,
                slot_type=slot_type.value,
                used_resource_pool=False,
                failover_trace=failover_trace,
            ),
        }
    except AppException as e:
        failover_trace.append(
            build_trace_entry(
                provider_name=primary_provider.name,
                model_id=slot.primary_model_id,
                success=False,
                error=e.message,
            )
        )
        logger.warning("主模型调用失败，尝试资源池故障转移", slot_type=slot_type.value, error=e.message)

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
                build_trace_entry(
                    provider_name=fb_provider_name,
                    model_id=fb_model_id,
                    success=True,
                    latency_ms=result["latency_ms"],
                )
            )
            return {
                "result": result,
                "routing": build_routing_info(
                    provider_name=fb_provider_name,
                    model_id=fb_model_id,
                    slot_type=slot_type.value,
                    used_resource_pool=True,
                    failover_trace=failover_trace,
                ),
            }
        except AppException as e:
            failover_trace.append(
                build_trace_entry(
                    provider_name=fb_provider_name,
                    model_id=fb_model_id,
                    success=False,
                    error=e.message,
                )
            )
            logger.warning("资源池备选模型调用失败", provider=fb_provider_name, model=fb_model_id, error=e.message)

    raise AppException(
        code=LLMErrorCode.ALL_MODELS_FAILED,
        message="所有模型（主模型 + 资源池）均调用失败",
        status_code=503,
        details={"failover_trace": failover_trace},
    )


async def invoke_embedding_slot(
    db: AsyncSession,
    *,
    input_texts: str | list[str],
    encryption_key: str,
    dimensions: int | None = None,
) -> dict:
    """基于 embedding 槽位调用向量化（含故障转移）。"""
    slot = await get_slot(db, SlotType.EMBEDDING)
    if slot is None or not slot.is_enabled:
        raise AppException(
            code=LLMErrorCode.SLOT_NOT_CONFIGURED,
            message="槽位 'embedding' 未配置或已禁用",
            status_code=503,
        )

    primary_provider = await db.get(Provider, slot.primary_provider_id)
    if primary_provider is None:
        raise AppException(
            code=LLMErrorCode.SLOT_NOT_CONFIGURED,
            message="槽位 'embedding' 的主 Provider 不存在",
            status_code=503,
        )

    failover_trace: list[dict[str, Any]] = []

    try:
        result = await call_embedding(
            db,
            provider_id=str(slot.primary_provider_id),
            model_id=slot.primary_model_id,
            input_texts=input_texts,
            dimensions=dimensions,
            encryption_key=encryption_key,
        )
        failover_trace.append(
            build_trace_entry(
                provider_name=primary_provider.name,
                model_id=slot.primary_model_id,
                success=True,
                latency_ms=result["latency_ms"],
            )
        )
        return {
            "result": result,
            "routing": build_routing_info(
                provider_name=primary_provider.name,
                model_id=slot.primary_model_id,
                slot_type=SlotType.EMBEDDING.value,
                used_resource_pool=False,
                failover_trace=failover_trace,
            ),
        }
    except AppException as e:
        failover_trace.append(
            build_trace_entry(
                provider_name=primary_provider.name,
                model_id=slot.primary_model_id,
                success=False,
                error=e.message,
            )
        )
        logger.warning("Embedding 主模型调用失败，尝试资源池故障转移", error=e.message)

    for item in slot.fallback_chain or []:
        fb_provider_id = item.get("provider_id")
        fb_model_id = item.get("model_id")
        fb_provider = await db.get(Provider, fb_provider_id)
        fb_provider_name = fb_provider.name if fb_provider else "未知"

        try:
            result = await call_embedding(
                db,
                provider_id=str(fb_provider_id),
                model_id=fb_model_id,
                input_texts=input_texts,
                dimensions=dimensions,
                encryption_key=encryption_key,
            )
            failover_trace.append(
                build_trace_entry(
                    provider_name=fb_provider_name,
                    model_id=fb_model_id,
                    success=True,
                    latency_ms=result["latency_ms"],
                )
            )
            return {
                "result": result,
                "routing": build_routing_info(
                    provider_name=fb_provider_name,
                    model_id=fb_model_id,
                    slot_type=SlotType.EMBEDDING.value,
                    used_resource_pool=True,
                    failover_trace=failover_trace,
                ),
            }
        except AppException as e:
            failover_trace.append(
                build_trace_entry(
                    provider_name=fb_provider_name,
                    model_id=fb_model_id,
                    success=False,
                    error=e.message,
                )
            )
            logger.warning(
                "Embedding 资源池备选模型调用失败", provider=fb_provider_name, model=fb_model_id, error=e.message
            )

    raise AppException(
        code=LLMErrorCode.ALL_MODELS_FAILED,
        message="所有 Embedding 模型（主模型 + 资源池）均调用失败",
        status_code=503,
        details={"failover_trace": failover_trace},
    )


async def invoke_rerank_slot(
    db: AsyncSession,
    *,
    query: str,
    documents: list[str],
    encryption_key: str,
    top_n: int | None = None,
) -> dict:
    """基于 rerank 槽位调用重排序（含故障转移）。"""
    slot = await get_slot(db, SlotType.RERANK)
    if slot is None or not slot.is_enabled:
        raise AppException(
            code=LLMErrorCode.SLOT_NOT_CONFIGURED,
            message="槽位 'rerank' 未配置或已禁用",
            status_code=503,
        )

    primary_provider = await db.get(Provider, slot.primary_provider_id)
    if primary_provider is None:
        raise AppException(
            code=LLMErrorCode.SLOT_NOT_CONFIGURED,
            message="槽位 'rerank' 的主 Provider 不存在",
            status_code=503,
        )

    failover_trace: list[dict[str, Any]] = []
    try:
        result = await call_rerank(
            db,
            provider_id=str(slot.primary_provider_id),
            model_id=slot.primary_model_id,
            query=query,
            documents=documents,
            encryption_key=encryption_key,
        )
        if top_n is not None:
            result["results"] = result["results"][:top_n]

        failover_trace.append(
            build_trace_entry(
                provider_name=primary_provider.name,
                model_id=slot.primary_model_id,
                success=True,
                latency_ms=result["latency_ms"],
            )
        )
        return {
            "result": result,
            "routing": build_routing_info(
                provider_name=primary_provider.name,
                model_id=slot.primary_model_id,
                slot_type=SlotType.RERANK.value,
                used_resource_pool=False,
                failover_trace=failover_trace,
            ),
        }
    except AppException as e:
        failover_trace.append(
            build_trace_entry(
                provider_name=primary_provider.name,
                model_id=slot.primary_model_id,
                success=False,
                error=e.message,
            )
        )
        logger.warning("Rerank 主模型调用失败，尝试资源池故障转移", error=e.message)

    for item in slot.fallback_chain or []:
        fb_provider_id = item.get("provider_id")
        fb_model_id = item.get("model_id")
        fb_provider = await db.get(Provider, fb_provider_id)
        fb_provider_name = fb_provider.name if fb_provider else "未知"

        try:
            result = await call_rerank(
                db,
                provider_id=str(fb_provider_id),
                model_id=fb_model_id,
                query=query,
                documents=documents,
                encryption_key=encryption_key,
            )
            if top_n is not None:
                result["results"] = result["results"][:top_n]

            failover_trace.append(
                build_trace_entry(
                    provider_name=fb_provider_name,
                    model_id=fb_model_id,
                    success=True,
                    latency_ms=result["latency_ms"],
                )
            )
            return {
                "result": result,
                "routing": build_routing_info(
                    provider_name=fb_provider_name,
                    model_id=fb_model_id,
                    slot_type=SlotType.RERANK.value,
                    used_resource_pool=True,
                    failover_trace=failover_trace,
                ),
            }
        except AppException as e:
            failover_trace.append(
                build_trace_entry(
                    provider_name=fb_provider_name,
                    model_id=fb_model_id,
                    success=False,
                    error=e.message,
                )
            )
            logger.warning(
                "Rerank 资源池备选模型调用失败", provider=fb_provider_name, model=fb_model_id, error=e.message
            )

    raise AppException(
        code=LLMErrorCode.ALL_MODELS_FAILED,
        message="所有 Rerank 模型（主模型 + 资源池）均调用失败",
        status_code=503,
        details={"failover_trace": failover_trace},
    )
