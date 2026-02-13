"""Provider 管理 API 路由。"""

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from llm_service.api.deps import get_db, get_encryption_key
from llm_service.api.schemas.provider import (
    ProviderCreate,
    ProviderResponse,
    ProviderTestRequest,
    ProviderTestResponse,
    ProviderUpdate,
)
from llm_service.core import service
from prism_shared.schemas import ApiResponse, PaginatedResponse, PaginationMeta, PaginationParams

router = APIRouter(prefix="/api/llm/providers", tags=["providers"])


@router.post("", status_code=status.HTTP_201_CREATED, response_model=ApiResponse[ProviderResponse])
async def create_provider(
    body: ProviderCreate,
    db: AsyncSession = Depends(get_db),
    encryption_key: str = Depends(get_encryption_key),
):
    """创建 Provider。"""
    provider = await service.create_provider(
        db,
        name=body.name,
        slug=body.slug,
        provider_type=body.provider_type,
        base_url=body.base_url,
        api_key=body.api_key,
        config=body.config,
        encryption_key=encryption_key,
    )
    return ApiResponse(data=ProviderResponse.model_validate(provider))


@router.get("", response_model=PaginatedResponse[ProviderResponse])
async def list_providers(
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """列出 Provider。"""
    providers, total = await service.list_providers(db, page=pagination.page, page_size=pagination.page_size)
    return PaginatedResponse(
        data=[ProviderResponse.model_validate(p) for p in providers],
        pagination=PaginationMeta(page=pagination.page, page_size=pagination.page_size, total=total),
    )


@router.get("/{provider_id}", response_model=ApiResponse[ProviderResponse])
async def get_provider(
    provider_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """获取 Provider 详情。"""
    provider = await service.get_provider(db, provider_id)
    return ApiResponse(data=ProviderResponse.model_validate(provider))


@router.put("/{provider_id}", response_model=ApiResponse[ProviderResponse])
async def update_provider(
    provider_id: UUID,
    body: ProviderUpdate,
    db: AsyncSession = Depends(get_db),
    encryption_key: str = Depends(get_encryption_key),
):
    """更新 Provider（部分更新）。"""
    updates = body.model_dump(exclude_unset=True)
    provider = await service.update_provider(db, provider_id, encryption_key=encryption_key, **updates)
    return ApiResponse(data=ProviderResponse.model_validate(provider))


@router.delete("/{provider_id}", response_model=ApiResponse[dict])
async def delete_provider(
    provider_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """删除 Provider。"""
    await service.delete_provider(db, provider_id)
    return ApiResponse(data={"message": "Provider 已删除"})


@router.post("/{provider_id}/test", response_model=ApiResponse[ProviderTestResponse])
async def test_provider(
    provider_id: UUID,
    body: ProviderTestRequest | None = None,
    db: AsyncSession = Depends(get_db),
    encryption_key: str = Depends(get_encryption_key),
):
    """测试 Provider 连通性。"""
    body = body or ProviderTestRequest()
    result = await service.test_provider_connectivity(
        db,
        provider_id,
        encryption_key=encryption_key,
        test_type=body.test_type,
        test_model_id=body.test_model_id,
    )
    return ApiResponse(data=ProviderTestResponse(**result))
