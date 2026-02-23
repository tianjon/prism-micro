"""PRD 目标契约兼容路由（不替换现有路由）。"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from llm_service.api.deps import get_current_user, get_db, get_encryption_key, require_admin
from llm_service.api.schemas.gateway import (
    CompletionResponse,
    EmbeddingItem,
    EmbeddingResponse,
    FailoverTraceItem,
    MessageItem,
    RerankResponse,
    RerankResultItem,
    RoutingInfo,
    SlotEmbeddingResponse,
    SlotInvokeResponse,
    SlotRerankResponse,
    UsageInfo,
)
from llm_service.api.schemas.provider import ProviderTestResponse
from llm_service.api.schemas.slot import SlotConfigureRequest, SlotResponse
from llm_service.api.slots import _slot_to_response
from llm_service.core import service
from llm_service.models.slot import SlotType
from prism_shared.schemas import ApiResponse

router = APIRouter(prefix="/api/llm", tags=["llm-compat"])


class ChatRequest(BaseModel):
    """PRD 风格 chat 请求。"""

    messages: list[MessageItem] = Field(min_length=1)
    slot: SlotType = SlotType.REASONING
    stream: bool = False
    max_tokens: int | None = None
    temperature: float | None = None
    top_p: float | None = None


class SlotTestResponse(BaseModel):
    """槽位测试响应。"""

    slot_type: SlotType
    provider_test: ProviderTestResponse


class EmbeddingSlotRequest(BaseModel):
    """PRD 风格 embedding 请求（固定 embedding 槽位）。"""

    input: str | list[str]
    dimensions: int | None = None


class RerankSlotRequest(BaseModel):
    """PRD 风格 rerank 请求（固定 rerank 槽位）。"""

    query: str
    documents: list[str] = Field(min_length=1)
    top_n: int | None = Field(default=None, ge=1)


@router.get("/admin/slots", response_model=ApiResponse[list[SlotResponse]])
async def admin_list_slots(
    _admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """兼容路由：获取所有槽位配置。"""
    slots = await service.list_slots(db)
    configured = {s.slot_type for s in slots}
    result: list[SlotResponse] = [await _slot_to_response(db, slot) for slot in slots]
    for st in SlotType:
        if st not in configured:
            result.append(SlotResponse(slot_type=st, is_enabled=False))
    order = {SlotType.FAST: 0, SlotType.REASONING: 1, SlotType.EMBEDDING: 2, SlotType.RERANK: 3}
    result.sort(key=lambda x: order.get(x.slot_type, 99))
    return ApiResponse(data=result)


@router.put("/admin/slots/{slot_type}", response_model=ApiResponse[SlotResponse])
async def admin_configure_slot(
    slot_type: SlotType,
    body: SlotConfigureRequest,
    _admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """兼容路由：更新指定槽位配置。"""
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


@router.post("/admin/slots/{slot_type}/test", response_model=ApiResponse[SlotTestResponse])
async def admin_test_slot(
    slot_type: SlotType,
    _admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    encryption_key: str = Depends(get_encryption_key),
):
    """兼容路由：测试槽位连通性。"""
    slot = await service.get_slot(db, slot_type)
    if slot is None or not slot.is_enabled:
        raise HTTPException(status_code=404, detail=f"槽位 '{slot_type.value}' 未配置或已禁用")

    test_type_map = {
        SlotType.FAST: "chat",
        SlotType.REASONING: "chat",
        SlotType.EMBEDDING: "embedding",
        SlotType.RERANK: "rerank",
    }
    provider_test = await service.test_provider_connectivity(
        db,
        slot.primary_provider_id,
        encryption_key=encryption_key,
        test_type=test_type_map[slot_type],
        test_model_id=slot.primary_model_id,
    )
    return ApiResponse(
        data=SlotTestResponse(
            slot_type=slot_type,
            provider_test=ProviderTestResponse(**provider_test),
        )
    )


@router.post("/chat", response_model=ApiResponse[SlotInvokeResponse])
async def chat_by_slot(
    body: ChatRequest,
    _user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    encryption_key: str = Depends(get_encryption_key),
):
    """兼容路由：按槽位调用 chat。"""
    if body.stream:
        raise HTTPException(status_code=400, detail="兼容 /api/llm/chat 当前仅支持非流式调用")

    messages = [{"role": m.role, "content": m.content} for m in body.messages]
    result = await service.invoke_slot(
        db,
        body.slot,
        messages=messages,
        max_tokens=body.max_tokens,
        temperature=body.temperature,
        encryption_key=encryption_key,
    )
    completion = result["result"]
    routing = result["routing"]
    return ApiResponse(
        data=SlotInvokeResponse(
            result=CompletionResponse(
                content=completion["content"],
                usage=UsageInfo(**completion["usage"]),
                latency_ms=completion["latency_ms"],
                model=completion["model"],
            ),
            routing=RoutingInfo(
                provider_name=routing["provider_name"],
                model_id=routing["model_id"],
                slot_type=routing["slot_type"],
                used_resource_pool=routing["used_resource_pool"],
                failover_trace=[FailoverTraceItem(**t) for t in routing["failover_trace"]],
            ),
        )
    )


@router.post("/embedding", response_model=ApiResponse[SlotEmbeddingResponse])
async def embedding_by_slot(
    body: EmbeddingSlotRequest,
    _user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    encryption_key: str = Depends(get_encryption_key),
):
    """兼容路由：固定 embedding 槽位调用。"""
    result = await service.invoke_embedding_slot(
        db,
        input_texts=body.input,
        dimensions=body.dimensions,
        encryption_key=encryption_key,
    )
    routing = result["routing"]
    embedding_result = result["result"]
    return ApiResponse(
        data=SlotEmbeddingResponse(
            result=EmbeddingResponse(
                embeddings=[EmbeddingItem(**e) for e in embedding_result["embeddings"]],
                usage=UsageInfo(**embedding_result["usage"]),
                latency_ms=embedding_result["latency_ms"],
                model=embedding_result["model"],
            ),
            routing=RoutingInfo(
                provider_name=routing["provider_name"],
                model_id=routing["model_id"],
                slot_type=routing["slot_type"],
                used_resource_pool=routing["used_resource_pool"],
                failover_trace=[FailoverTraceItem(**t) for t in routing["failover_trace"]],
            ),
        )
    )


@router.post("/rerank/slot", response_model=ApiResponse[SlotRerankResponse])
async def rerank_by_slot(
    body: RerankSlotRequest,
    _user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    encryption_key: str = Depends(get_encryption_key),
):
    """兼容路由：固定 rerank 槽位调用。"""
    result = await service.invoke_rerank_slot(
        db,
        query=body.query,
        documents=body.documents,
        top_n=body.top_n,
        encryption_key=encryption_key,
    )
    routing = result["routing"]
    rerank_result = result["result"]
    return ApiResponse(
        data=SlotRerankResponse(
            result=RerankResponse(
                results=[RerankResultItem(**r) for r in rerank_result["results"]],
                latency_ms=rerank_result["latency_ms"],
                model=rerank_result["model"],
            ),
            routing=RoutingInfo(
                provider_name=routing["provider_name"],
                model_id=routing["model_id"],
                slot_type=routing["slot_type"],
                used_resource_pool=routing["used_resource_pool"],
                failover_trace=[FailoverTraceItem(**t) for t in routing["failover_trace"]],
            ),
        )
    )
