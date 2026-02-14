"""管线触发端点。"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from prism_shared.schemas.response import ApiResponse
from voc_service.api.deps import UserRecord, get_current_user, get_db, get_llm_client, get_settings
from voc_service.api.schemas.pipeline_schemas import ProcessRequest, ProcessResult
from voc_service.core.config import VocServiceSettings
from voc_service.core.llm_client import LLMClient
from voc_service.core.processing_service import process_pending_voices

router = APIRouter(prefix="/api/voc/pipeline", tags=["pipeline"])


@router.post("/process", response_model=ApiResponse[ProcessResult])
async def trigger_processing(
    body: ProcessRequest,
    db: AsyncSession = Depends(get_db),
    settings: VocServiceSettings = Depends(get_settings),
    llm_client: LLMClient = Depends(get_llm_client),
    _current_user: UserRecord = Depends(get_current_user),
):
    """触发 AI 管线处理 pending 状态的 Voice。

    Phase 1 同步执行，适合小批量测试验证。
    """
    result = await process_pending_voices(
        db,
        llm_client=llm_client,
        settings=settings,
        batch_id=body.batch_id,
        limit=body.limit,
    )
    return ApiResponse(data=ProcessResult(**result))
