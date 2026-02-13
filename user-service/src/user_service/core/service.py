"""用户认证核心业务逻辑。"""

import uuid
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from prism_shared.auth.api_key import generate_api_key, get_key_prefix
from prism_shared.auth.jwt import create_access_token, create_refresh_token, decode_token
from prism_shared.auth.password import hash_password, verify_password
from prism_shared.exceptions import AppException
from user_service.core.config import UserServiceSettings
from user_service.core.errors import AuthErrorCode
from user_service.models.user import APIKey, User


async def register_user(
    session: AsyncSession,
    email: str,
    username: str,
    password: str,
    settings: UserServiceSettings,
) -> User:
    """用户注册。校验邮箱唯一性后创建用户。"""
    if not settings.allow_registration:
        raise AppException(
            code=AuthErrorCode.REGISTRATION_DISABLED,
            message="当前不允许注册新用户",
            status_code=403,
        )

    # 检查邮箱是否已被注册
    stmt = select(User).where(User.email == email)
    result = await session.execute(stmt)
    if result.scalar_one_or_none() is not None:
        raise AppException(
            code=AuthErrorCode.EMAIL_EXISTS,
            message="该邮箱已被注册",
            status_code=409,
        )

    user = User(
        email=email,
        username=username,
        hashed_password=hash_password(password),
        role=settings.default_user_role,
    )
    session.add(user)
    await session.flush()
    return user


async def authenticate_user(
    session: AsyncSession,
    email: str,
    password: str,
    settings: UserServiceSettings,
) -> tuple[User, dict[str, str]]:
    """
    用户登录验证。
    返回 (user, tokens_dict)，其中 tokens_dict 包含 access_token 和 refresh_token。
    """
    stmt = select(User).where(User.email == email)
    result = await session.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        raise AppException(
            code=AuthErrorCode.INVALID_CREDENTIALS,
            message="邮箱或密码错误",
            status_code=401,
        )

    if not verify_password(password, user.hashed_password):
        raise AppException(
            code=AuthErrorCode.INVALID_CREDENTIALS,
            message="邮箱或密码错误",
            status_code=401,
        )

    if not user.is_active:
        raise AppException(
            code=AuthErrorCode.USER_INACTIVE,
            message="用户已被禁用",
            status_code=403,
        )

    tokens = _create_tokens(user, settings)
    return user, tokens


async def refresh_tokens(
    session: AsyncSession,
    refresh_token: str,
    settings: UserServiceSettings,
) -> tuple[User, dict[str, str]]:
    """刷新 Token。验证 refresh_token 有效性后签发新的 token 对。"""
    payload = decode_token(refresh_token, settings.jwt_secret)
    if payload is None:
        raise AppException(
            code=AuthErrorCode.INVALID_TOKEN,
            message="无效或过期的 refresh token",
            status_code=401,
        )

    if payload.get("type") != "refresh":
        raise AppException(
            code=AuthErrorCode.TOKEN_TYPE_MISMATCH,
            message="需要 refresh token",
            status_code=401,
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise AppException(
            code=AuthErrorCode.INVALID_TOKEN,
            message="token 中缺少用户标识",
            status_code=401,
        )

    stmt = select(User).where(User.id == uuid.UUID(user_id))
    result = await session.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        raise AppException(
            code=AuthErrorCode.USER_NOT_FOUND,
            message="用户不存在",
            status_code=404,
        )

    if not user.is_active:
        raise AppException(
            code=AuthErrorCode.USER_INACTIVE,
            message="用户已被禁用",
            status_code=403,
        )

    tokens = _create_tokens(user, settings)
    return user, tokens


async def get_user_by_id(session: AsyncSession, user_id: uuid.UUID) -> User:
    """根据 ID 获取用户。"""
    stmt = select(User).where(User.id == user_id)
    result = await session.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        raise AppException(
            code=AuthErrorCode.USER_NOT_FOUND,
            message="用户不存在",
            status_code=404,
        )
    return user


async def create_api_key(
    session: AsyncSession,
    user_id: uuid.UUID,
    name: str,
    expires_at: datetime | None = None,
) -> tuple[APIKey, str]:
    """
    创建 API Key。
    返回 (api_key_model, plain_key)。明文 key 仅此时可用。
    """
    plain_key, key_hash = generate_api_key()
    prefix = get_key_prefix(plain_key)

    api_key = APIKey(
        user_id=user_id,
        key_hash=key_hash,
        key_prefix=prefix,
        name=name,
        expires_at=expires_at,
    )
    session.add(api_key)
    await session.flush()
    return api_key, plain_key


async def list_api_keys(session: AsyncSession, user_id: uuid.UUID) -> list[APIKey]:
    """列出用户的所有活跃 API Keys。"""
    stmt = (
        select(APIKey).where(APIKey.user_id == user_id, APIKey.is_active.is_(True)).order_by(APIKey.created_at.desc())
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def revoke_api_key(
    session: AsyncSession,
    user_id: uuid.UUID,
    key_id: uuid.UUID,
) -> None:
    """撤销 API Key（软删除：设置 is_active=False）。"""
    stmt = select(APIKey).where(APIKey.id == key_id, APIKey.user_id == user_id)
    result = await session.execute(stmt)
    api_key = result.scalar_one_or_none()

    if api_key is None:
        raise AppException(
            code=AuthErrorCode.API_KEY_NOT_FOUND,
            message="API Key 不存在",
            status_code=404,
        )

    api_key.is_active = False
    await session.flush()


def _create_tokens(user: User, settings: UserServiceSettings) -> dict[str, str]:
    """为用户生成 access + refresh token 对。"""
    token_data = {
        "sub": str(user.id),
        "email": user.email,
        "username": user.username,
        "role": user.role,
    }
    access_token = create_access_token(
        data=token_data,
        secret=settings.jwt_secret,
        expires_delta=timedelta(minutes=settings.jwt_access_token_expire_minutes),
    )
    refresh_token_str = create_refresh_token(
        data=token_data,
        secret=settings.jwt_secret,
        expires_delta=timedelta(days=settings.jwt_refresh_token_expire_days),
    )
    return {
        "access_token": access_token,
        "refresh_token": refresh_token_str,
    }
