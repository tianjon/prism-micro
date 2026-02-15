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

    # --- 管线 ---
    pipeline_batch_size: int = Field(default=20, description="每轮取多少条 Voice 处理")
    pipeline_max_retries: int = Field(default=2, description="失败重试次数")
    stage1_temperature: float = Field(default=0.5, description="Stage 1 reasoning 温度")
    stage2_temperature: float = Field(default=0.5, description="Stage 2 reasoning 温度")
    normalize_temperature: float = Field(default=0.2, description="标准化 fast 温度")
    guard_l2_temperature: float = Field(default=0.2, description="L2 检查 fast 温度")

    # --- 搜索 ---
    embedding_batch_size: int = Field(default=20, description="embedding 批次大小")
    search_candidate_multiplier: int = Field(default=2, description="搜索候选倍数（rerank 时取 top_k * multiplier）")
    confidence_high_threshold: float = Field(default=0.8, description="高置信度阈值")
    confidence_medium_threshold: float = Field(default=0.6, description="中置信度阈值")
