"""API Key 加解密工具（Fernet 对称加密）。"""

from cryptography.fernet import Fernet, InvalidToken

from llm_service.core.errors import LLMErrorCode
from prism_shared.exceptions import AppException


def encrypt_api_key(plain_key: str, encryption_key: str) -> str:
    """
    使用 Fernet 加密 API Key。
    encryption_key 必须是 URL-safe base64 编码的 32 字节密钥。
    """
    f = Fernet(encryption_key.encode())
    return f.encrypt(plain_key.encode()).decode()


def decrypt_api_key(encrypted_key: str, encryption_key: str) -> str:
    """
    使用 Fernet 解密 API Key。
    如果密钥不匹配或数据被篡改，抛出 AppException。
    """
    try:
        f = Fernet(encryption_key.encode())
        return f.decrypt(encrypted_key.encode()).decode()
    except InvalidToken as e:
        raise AppException(
            code=LLMErrorCode.ENCRYPTION_ERROR,
            message="API Key 解密失败，密钥可能不匹配",
            status_code=500,
        ) from e
