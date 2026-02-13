"""推理代理网关 API 路由。"""

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from llm_service.api.deps import get_db, get_encryption_key, require_admin
from llm_service.api.schemas.gateway import (
    CompletionRequest,
    CompletionResponse,
    EmbeddingItem,
    EmbeddingRequest,
    EmbeddingResponse,
    RerankRequest,
    RerankResponse,
    RerankResultItem,
    UsageInfo,
)
from llm_service.core import service
from prism_shared.schemas import ApiResponse

router = APIRouter(prefix="/api/llm", tags=["gateway"])


@router.post("/completions")
async def completions(
    body: CompletionRequest,
    _admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    encryption_key: str = Depends(get_encryption_key),
):
    """Chat 补全代理。支持 stream 参数切换流式/非流式。"""
    messages = [{"role": m.role, "content": m.content} for m in body.messages]

    if body.stream:
        generator = service.call_completion_stream(
            db,
            provider_id=body.provider_id,
            model_id=body.model_id,
            messages=messages,
            max_tokens=body.max_tokens,
            temperature=body.temperature,
            top_p=body.top_p,
            encryption_key=encryption_key,
        )
        return StreamingResponse(
            generator,
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    result = await service.call_completion(
        db,
        provider_id=body.provider_id,
        model_id=body.model_id,
        messages=messages,
        max_tokens=body.max_tokens,
        temperature=body.temperature,
        top_p=body.top_p,
        encryption_key=encryption_key,
    )
    return ApiResponse(
        data=CompletionResponse(
            content=result["content"],
            usage=UsageInfo(**result["usage"]),
            latency_ms=result["latency_ms"],
            model=result["model"],
        )
    )


@router.post("/embeddings", response_model=ApiResponse[EmbeddingResponse])
async def embeddings(
    body: EmbeddingRequest,
    _admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    encryption_key: str = Depends(get_encryption_key),
):
    """Embedding 代理。"""
    result = await service.call_embedding(
        db,
        provider_id=body.provider_id,
        model_id=body.model_id,
        input_texts=body.input,
        encryption_key=encryption_key,
    )
    return ApiResponse(
        data=EmbeddingResponse(
            embeddings=[EmbeddingItem(**e) for e in result["embeddings"]],
            usage=UsageInfo(**result["usage"]),
            latency_ms=result["latency_ms"],
            model=result["model"],
        )
    )


@router.post("/rerank", response_model=ApiResponse[RerankResponse])
async def rerank(
    body: RerankRequest,
    _admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    encryption_key: str = Depends(get_encryption_key),
):
    """Rerank 代理。"""
    result = await service.call_rerank(
        db,
        provider_id=body.provider_id,
        model_id=body.model_id,
        query=body.query,
        documents=body.documents,
        encryption_key=encryption_key,
    )
    return ApiResponse(
        data=RerankResponse(
            results=[RerankResultItem(**r) for r in result["results"]],
            latency_ms=result["latency_ms"],
            model=result["model"],
        )
    )
