"""用户认证 API 路由。"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from prism_shared.schemas.response import ApiResponse
from user_service.api.deps import get_current_active_user, get_session, get_settings
from user_service.core.config import UserServiceSettings
from user_service.core.schemas import (
    APIKeyCreatedOut,
    APIKeyOut,
    CreateAPIKeyRequest,
    LoginOut,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokensOut,
    UserOut,
)
from user_service.core.service import (
    authenticate_user,
    create_api_key,
    list_api_keys,
    refresh_tokens,
    register_user,
    revoke_api_key,
)
from user_service.models.user import User

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", status_code=201)
async def register(
    body: RegisterRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    settings: Annotated[UserServiceSettings, Depends(get_settings)],
) -> ApiResponse[UserOut]:
    """用户注册。"""
    user = await register_user(
        session=session,
        email=body.email,
        username=body.username,
        password=body.password,
        settings=settings,
    )
    return ApiResponse(data=UserOut.model_validate(user))


@router.post("/login")
async def login(
    body: LoginRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    settings: Annotated[UserServiceSettings, Depends(get_settings)],
) -> ApiResponse[LoginOut]:
    """用户登录，返回用户信息和 Token。"""
    user, tokens = await authenticate_user(
        session=session,
        email=body.email,
        password=body.password,
        settings=settings,
    )
    return ApiResponse(
        data=LoginOut(
            user=UserOut.model_validate(user),
            tokens=TokensOut(**tokens),
        )
    )


@router.post("/refresh")
async def refresh(
    body: RefreshRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    settings: Annotated[UserServiceSettings, Depends(get_settings)],
) -> ApiResponse[TokensOut]:
    """刷新 Token。"""
    _user, tokens = await refresh_tokens(
        session=session,
        refresh_token=body.refresh_token,
        settings=settings,
    )
    return ApiResponse(data=TokensOut(**tokens))


@router.get("/me")
async def get_me(
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> ApiResponse[UserOut]:
    """获取当前登录用户信息。"""
    return ApiResponse(data=UserOut.model_validate(current_user))


@router.post("/api-keys", status_code=201)
async def create_key(
    body: CreateAPIKeyRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ApiResponse[APIKeyCreatedOut]:
    """创建 API Key。明文 key 仅在此响应中返回一次。"""
    api_key, plain_key = await create_api_key(
        session=session,
        user_id=current_user.id,
        name=body.name,
        expires_at=body.expires_at,
    )
    return ApiResponse(
        data=APIKeyCreatedOut(
            id=api_key.id,
            name=api_key.name,
            key=plain_key,
            key_prefix=api_key.key_prefix,
            expires_at=api_key.expires_at,
            created_at=api_key.created_at,
        )
    )


@router.get("/api-keys")
async def list_keys(
    current_user: Annotated[User, Depends(get_current_active_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ApiResponse[list[APIKeyOut]]:
    """列出当前用户的 API Keys。"""
    keys = await list_api_keys(session=session, user_id=current_user.id)
    return ApiResponse(data=[APIKeyOut.model_validate(k) for k in keys])


@router.delete("/api-keys/{key_id}", status_code=200)
async def revoke_key(
    key_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ApiResponse[dict]:
    """撤销 API Key。"""
    await revoke_api_key(session=session, user_id=current_user.id, key_id=key_id)
    return ApiResponse(data={"message": "API Key 已撤销"})
