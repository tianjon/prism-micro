"""Provider 管理 API 路由。"""

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from llm_service.api.deps import get_db, get_encryption_key, require_admin
from llm_service.api.schemas.provider import (
    ProviderCreate,
    ProviderModelItem,
    ProviderPresetResponse,
    ProviderResponse,
    ProviderTestRequest,
    ProviderTestResponse,
    ProviderUpdate,
)
from llm_service.core import service
from llm_service.core.presets import BUILTIN_PRESETS
from prism_shared.schemas import ApiResponse, PaginatedResponse, PaginationMeta, PaginationParams

router = APIRouter(prefix="/api/llm/providers", tags=["providers"])


@router.get("/presets", response_model=ApiResponse[list[ProviderPresetResponse]])
async def list_presets():
    """获取内置 Provider 预设列表（无需认证）。"""
    presets = [
        ProviderPresetResponse(
            preset_id=p.preset_id,
            name=p.name,
            provider_type=p.provider_type,
            description=p.description,
        )
        for p in BUILTIN_PRESETS.values()
    ]
    return ApiResponse(data=presets)


@router.post("", status_code=status.HTTP_201_CREATED, response_model=ApiResponse[ProviderResponse])
async def create_provider(
    body: ProviderCreate,
    _admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    encryption_key: str = Depends(get_encryption_key),
):
    """创建 Provider（需要管理员权限）。支持通过 preset_id 使用内置预设。"""
    provider = await service.create_provider(
        db,
        name=body.name,
        slug=body.slug,
        provider_type=body.provider_type,
        base_url=body.base_url,
        api_key=body.api_key,
        preset_id=body.preset_id,
        config=body.config,
        encryption_key=encryption_key,
    )
    return ApiResponse(data=ProviderResponse.model_validate(provider))


@router.get("", response_model=PaginatedResponse[ProviderResponse])
async def list_providers(
    pagination: PaginationParams = Depends(),
    _admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """列出 Provider（需要管理员权限）。"""
    providers, total = await service.list_providers(db, page=pagination.page, page_size=pagination.page_size)
    return PaginatedResponse(
        data=[ProviderResponse.model_validate(p) for p in providers],
        pagination=PaginationMeta(page=pagination.page, page_size=pagination.page_size, total=total),
    )


@router.get("/{provider_id}", response_model=ApiResponse[ProviderResponse])
async def get_provider(
    provider_id: UUID,
    _admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """获取 Provider 详情（需要管理员权限）。"""
    provider = await service.get_provider(db, provider_id)
    return ApiResponse(data=ProviderResponse.model_validate(provider))


@router.put("/{provider_id}", response_model=ApiResponse[ProviderResponse])
async def update_provider(
    provider_id: UUID,
    body: ProviderUpdate,
    _admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    encryption_key: str = Depends(get_encryption_key),
):
    """更新 Provider（需要管理员权限，部分更新）。"""
    updates = body.model_dump(exclude_unset=True)
    provider = await service.update_provider(db, provider_id, encryption_key=encryption_key, **updates)
    return ApiResponse(data=ProviderResponse.model_validate(provider))


@router.delete("/{provider_id}", response_model=ApiResponse[dict])
async def delete_provider(
    provider_id: UUID,
    _admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """删除 Provider（需要管理员权限）。"""
    await service.delete_provider(db, provider_id)
    return ApiResponse(data={"message": "Provider 已删除"})


@router.get("/{provider_id}/models", response_model=ApiResponse[list[ProviderModelItem]])
async def list_provider_models(
    provider_id: UUID,
    _admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    encryption_key: str = Depends(get_encryption_key),
):
    """获取 Provider 可用模型列表（需要管理员权限）。"""
    models = await service.list_provider_models(db, provider_id, encryption_key=encryption_key)
    return ApiResponse(data=[ProviderModelItem(**m) for m in models])


@router.post("/{provider_id}/test", response_model=ApiResponse[ProviderTestResponse])
async def test_provider(
    provider_id: UUID,
    body: ProviderTestRequest | None = None,
    _admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    encryption_key: str = Depends(get_encryption_key),
):
    """测试 Provider 连通性（需要管理员权限）。"""
    body = body or ProviderTestRequest()
    result = await service.test_provider_connectivity(
        db,
        provider_id,
        encryption_key=encryption_key,
        test_type=body.test_type,
        test_model_id=body.test_model_id,
    )
    return ApiResponse(data=ProviderTestResponse(**result))
