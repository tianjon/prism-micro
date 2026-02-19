"""基础配置类，所有服务 Settings 的基类。"""

from pathlib import Path

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

    # --- 日志 ---
    log_dir: Path = Path.home() / ".prism" / "log" / "app"
    log_max_size_mb: int = 200
    log_rotation_days: int = 7
    log_file_max_mb: int = 50

    # --- 数据库 ---
    database_url: str = "postgresql+asyncpg://prism:prism@prism.test:5432/prism"

    # --- Redis ---
    redis_url: str = "redis://prism.test:6379/0"

    # --- JWT ---
    jwt_secret: str = "change-me-in-production"
    jwt_access_token_expire_minutes: int = 60
    jwt_refresh_token_expire_days: int = 7

    # --- Neo4j ---
    neo4j_uri: str = "bolt://prism.test:7687"
    neo4j_username: str = "neo4j"
    neo4j_password: str = "prism"
