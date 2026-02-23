"""llm-service 配置，从环境变量加载。"""

from pydantic import Field

from prism_shared.config import BaseAppSettings


class LLMServiceSettings(BaseAppSettings):
    """
    LLM 服务配置。
    继承 BaseAppSettings 的通用配置（database_url、redis_url、jwt_secret 等），
    并添加 llm-service 特有的加密密钥与连接池参数。
    """

    # --- API Key 加密密钥（AES-256，base64 编码的 32 字节密钥）---
    llm_encryption_key: str = Field(
        description="AES-256-GCM 加密密钥，base64 编码，用于加密 Provider API Key",
    )

    # --- 连接池（覆盖 shared 默认值，弹性 L0）---
    db_pool_size: int = Field(default=10, description="数据库常驻连接数")
    db_max_overflow: int = Field(default=20, description="数据库峰值额外连接数")

    # --- LLM 运行时（LiteLLM 主路径 + HTTP fallback）---
    llm_runtime_mode: str = Field(
        default="litellm",
        description="LLM 运行时模式：litellm 或 http",
    )
    llm_runtime_http_fallback: bool = Field(
        default=True,
        description="当 litellm 调用失败时是否允许回退到 HTTP 直连",
    )

    # --- 服务 ---
    service_host: str = "0.0.0.0"
    service_port: int = 8601
