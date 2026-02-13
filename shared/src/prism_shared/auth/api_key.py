"""API Key 生成、加密存储与验证工具。"""

import hashlib
import secrets

API_KEY_PREFIX = "prism_"
API_KEY_LENGTH = 32  # 不含前缀


def generate_api_key() -> tuple[str, str]:
    """
    生成 API Key。返回 (明文 key, hash)。
    明文 key 仅在创建时返回给用户，之后仅存储 hash。
    """
    raw = secrets.token_urlsafe(API_KEY_LENGTH)
    full_key = f"{API_KEY_PREFIX}{raw}"
    key_hash = _hash_key(full_key)
    return full_key, key_hash


def hash_api_key(plain_key: str) -> str:
    """对明文 API Key 计算 SHA-256 hash。"""
    return _hash_key(plain_key)


def verify_api_key(plain_key: str, stored_hash: str) -> bool:
    """验证 API Key 是否匹配。"""
    return _hash_key(plain_key) == stored_hash


def get_key_prefix(plain_key: str) -> str:
    """提取 key 前缀用于列表展示（如 prism_xxxx****）。"""
    if len(plain_key) <= 10:
        return plain_key[:4] + "****"
    return plain_key[:10] + "****"


def _hash_key(key: str) -> str:
    """SHA-256 哈希。"""
    return hashlib.sha256(key.encode("utf-8")).hexdigest()
