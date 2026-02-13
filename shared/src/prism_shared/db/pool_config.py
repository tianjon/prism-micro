"""数据库连接池配置（L0 弹性策略）。"""

from pydantic import Field
from pydantic_settings import BaseSettings


class PoolConfig(BaseSettings):
    """
    数据库连接池配置。L0 弹性策略的核心参数。

    调优原则：
    - pool_size: 常驻连接数，按服务并发量设置
    - max_overflow: 峰值额外连接，超过后新请求等待
    - pool_timeout: 等待连接的超时时间
    - pool_recycle: 连接最大存活时间（防止 PG 端超时断开）
    """

    pool_size: int = Field(
        default=5,
        description="常驻连接数",
        ge=1,
        le=50,
    )
    max_overflow: int = Field(
        default=10,
        description="允许的额外临时连接数",
        ge=0,
        le=100,
    )
    pool_timeout: int = Field(
        default=30,
        description="等待可用连接的超时时间（秒）",
        ge=5,
        le=120,
    )
    pool_recycle: int = Field(
        default=3600,
        description="连接最大存活时间（秒），防止服务端超时断开",
        ge=300,
        le=7200,
    )

    model_config = {"env_prefix": "DB_POOL_"}
