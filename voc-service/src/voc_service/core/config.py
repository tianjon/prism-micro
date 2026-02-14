"""voc-service 配置，从环境变量加载。"""

from pydantic import Field

from prism_shared.config import BaseAppSettings


class VocServiceSettings(BaseAppSettings):
    """
    VOC 服务配置。
    继承 BaseAppSettings 的通用配置（database_url、redis_url、jwt_secret 等），
    并添加 voc-service 特有的参数。
    """

    # --- 服务 ---
    service_host: str = "0.0.0.0"
    service_port: int = 8602

    # --- 连接池 ---
    db_pool_size: int = Field(default=10, description="数据库常驻连接数")
    db_max_overflow: int = Field(default=20, description="数据库峰值额外连接数")

    # --- 文件上传 ---
    max_file_size_bytes: int = Field(default=52_428_800, description="最大文件大小（50MB）")
    upload_chunk_size: int = Field(default=500, description="每次批量写入行数")

    # --- LLM 映射 ---
    llm_service_base_url: str = Field(
        default="http://localhost:8601",
        description="llm-service 基础 URL",
    )
    llm_service_timeout: int = Field(default=60, description="llm-service 调用超时（秒）")
    mapping_sample_rows: int = Field(default=10, description="Schema 映射采样行数")
    mapping_confidence_auto: float = Field(
        default=0.8,
        description="自动通过映射的置信度阈值",
    )
    mapping_confidence_reject: float = Field(
        default=0.5,
        description="拒绝映射的置信度阈值",
    )
