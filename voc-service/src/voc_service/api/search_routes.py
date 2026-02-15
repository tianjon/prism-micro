"""语义搜索 API 路由。"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from prism_shared.schemas.response import ApiResponse
from voc_service.api.deps import UserRecord, get_current_user, get_db, get_llm_client, get_settings
from voc_service.api.schemas.search_schemas import SearchRequest, SearchResponse, SearchResultItem, TagBrief, VoiceBrief
from voc_service.core.config import VocServiceSettings
from voc_service.core.llm_client import LLMClient
from voc_service.core.search_service import vector_search

router = APIRouter(prefix="/api/voc", tags=["search"])


@router.post("/search", response_model=ApiResponse[SearchResponse])
async def search(
    body: SearchRequest,
    db: AsyncSession = Depends(get_db),
    settings: VocServiceSettings = Depends(get_settings),
    llm_client: LLMClient = Depends(get_llm_client),
    _current_user: UserRecord = Depends(get_current_user),
):
    """语义搜索 API。

    将查询文本向量化后，在已向量化的语义单元中进行 ANN 搜索。
    可选启用 rerank 对结果进行重排序以提高精度。
    """
    result = await vector_search(
        db,
        llm_client,
        settings,
        query=body.query,
        top_k=body.top_k,
        min_confidence=body.min_confidence,
        rerank=body.rerank,
    )

    return ApiResponse(
        data=SearchResponse(
            query=result["query"],
            total=result["total"],
            results=[
                SearchResultItem(
                    **{
                        **item,
                        "tags": [TagBrief(**t) for t in item["tags"]],
                        "voice": VoiceBrief(**item["voice"]),
                    }
                )
                for item in result["results"]
            ],
        )
    )
