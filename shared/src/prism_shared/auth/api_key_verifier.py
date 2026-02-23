"""API Key 验证器工厂。"""

from datetime import UTC, datetime

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from prism_shared.auth.api_key import hash_api_key


def create_db_api_key_verifier(session_factory: async_sessionmaker[AsyncSession]):
    """
    基于 auth.api_keys 表创建 API Key 校验器。

    返回回调签名与 PrincipalMiddleware 的 ApiKeyVerifier 对齐：
      async verifier(plain_key: str) -> dict | None
    """

    async def verify_api_key(plain_key: str) -> dict | None:
        key_hash = hash_api_key(plain_key)

        async with session_factory() as session:
            result = await session.execute(
                text(
                    """
                    SELECT
                        ak.id AS key_id,
                        ak.user_id AS user_id,
                        ak.name AS name,
                        ak.is_active AS key_active,
                        ak.expires_at AS expires_at,
                        u.is_active AS user_active
                    FROM auth.api_keys ak
                    JOIN auth.users u ON u.id = ak.user_id
                    WHERE ak.key_hash = :key_hash
                    LIMIT 1
                    """
                ),
                {"key_hash": key_hash},
            )
            row = result.first()
            if row is None:
                return None

            if not row.key_active or not row.user_active:
                return None

            if row.expires_at is not None and row.expires_at <= datetime.now(UTC):
                return None

            return {
                "key_id": str(row.key_id),
                "user_id": str(row.user_id),
                "name": row.name,
            }

    return verify_api_key
