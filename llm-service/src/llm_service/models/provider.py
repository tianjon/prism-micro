"""LLM Provider ORM 模型。"""

from sqlalchemy import Boolean, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from prism_shared.db import Base, TimestampMixin, UUIDMixin


class Provider(Base, UUIDMixin, TimestampMixin):
    """
    LLM Provider 配置。
    每条记录对应一个 LLM 服务商（如硅基流动、OpenRouter）。
    """

    __tablename__ = "providers"
    __table_args__ = (
        Index("idx_providers_is_enabled", "is_enabled", postgresql_where="is_enabled = true"),
        Index("idx_providers_slug", "slug"),
        {"schema": "llm"},
    )

    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, comment="显示名称")
    slug: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, comment="标识符")
    provider_type: Mapped[str] = mapped_column(String(50), nullable=False, comment="LiteLLM provider 类型，如 openai")
    base_url: Mapped[str] = mapped_column(String(500), nullable=False, comment="API Base URL")
    api_key_encrypted: Mapped[str] = mapped_column(Text, nullable=False, comment="加密存储的 API Key")
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true", comment="是否启用")
    config: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}", comment="额外配置")

    # 反向关联
    slots = relationship("ModelSlot", back_populates="primary_provider", lazy="selectin")
