"""基础配置类，所有服务 Settings 的基类。"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class BaseAppSettings(BaseSettings):
    """
    所有服务 Settings 的基类。
    各服务继承并添加自己的配置项。
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- 通用配置 ---
    app_name: str = "prism"
    debug: bool = False
    log_level: str = "INFO"

    # --- 数据库 ---
    database_url: str = "postgresql+asyncpg://prism:prism@localhost:5432/prism"

    # --- Redis ---
    redis_url: str = "redis://localhost:6379/0"

    # --- JWT ---
    jwt_secret: str = "change-me-in-production"
    jwt_access_token_expire_minutes: int = 60
    jwt_refresh_token_expire_days: int = 7

    # --- Neo4j ---
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_username: str = "neo4j"
    neo4j_password: str = "prism"
