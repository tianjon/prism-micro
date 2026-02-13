"""JWT token 签发与验证工具。"""

from datetime import UTC, datetime, timedelta
from typing import Any

from jose import JWTError, jwt


def create_access_token(
    data: dict[str, Any],
    secret: str,
    expires_delta: timedelta = timedelta(hours=1),
    algorithm: str = "HS256",
) -> str:
    """生成 access token。"""
    to_encode = data.copy()
    expire = datetime.now(UTC) + expires_delta
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, secret, algorithm=algorithm)


def create_refresh_token(
    data: dict[str, Any],
    secret: str,
    expires_delta: timedelta = timedelta(days=7),
    algorithm: str = "HS256",
) -> str:
    """生成 refresh token。"""
    to_encode = data.copy()
    expire = datetime.now(UTC) + expires_delta
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, secret, algorithm=algorithm)


def decode_token(
    token: str,
    secret: str,
    algorithm: str = "HS256",
) -> dict[str, Any] | None:
    """解码并验证 token。返回 None 表示验证失败。"""
    try:
        payload = jwt.decode(token, secret, algorithms=[algorithm])
        if payload.get("exp") and datetime.fromtimestamp(payload["exp"], tz=UTC) < datetime.now(UTC):
            return None
        return payload
    except JWTError:
        return None
