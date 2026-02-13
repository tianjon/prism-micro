"""认证与授权工具。"""

from prism_shared.auth.api_key import generate_api_key, get_key_prefix, hash_api_key
from prism_shared.auth.api_key import verify_api_key as verify_api_key_hash
from prism_shared.auth.deps import create_get_current_active_user, create_get_current_user
from prism_shared.auth.jwt import create_access_token, create_refresh_token, decode_token
from prism_shared.auth.password import hash_password, verify_password
from prism_shared.auth.principal import Principal, PrincipalMiddleware, PrincipalType, get_principal, require_human

__all__ = [
    "Principal",
    "PrincipalMiddleware",
    "PrincipalType",
    "create_access_token",
    "create_get_current_active_user",
    "create_get_current_user",
    "create_refresh_token",
    "decode_token",
    "generate_api_key",
    "get_key_prefix",
    "get_principal",
    "hash_api_key",
    "hash_password",
    "require_human",
    "verify_api_key_hash",
    "verify_password",
]
