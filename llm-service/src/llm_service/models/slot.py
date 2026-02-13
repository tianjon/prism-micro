"""模型槽位 ORM 模型。"""

import enum

from sqlalchemy import Boolean, Enum, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from prism_shared.db import Base, TimestampMixin, UUIDMixin


class SlotType(enum.StrEnum):
    """4 槽位类型枚举。"""

    FAST = "fast"
    REASONING = "reasoning"
    EMBEDDING = "embedding"
    RERANK = "rerank"


class ModelSlot(Base, UUIDMixin, TimestampMixin):
    """
    模型槽位配置。
    每种槽位类型有且仅有一行，定义主模型 + 降级链。
    """

    __tablename__ = "model_slots"
    __table_args__ = (
        Index("idx_model_slots_slot_type", "slot_type"),
        Index("idx_model_slots_primary_provider", "primary_provider_id"),
        {"schema": "llm"},
    )

    slot_type: Mapped[SlotType] = mapped_column(
        Enum(SlotType, schema="llm", name="slot_type", values_callable=lambda e: [x.value for x in e]),
        unique=True,
        nullable=False,
        comment="槽位类型",
    )
    primary_provider_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("llm.providers.id", ondelete="RESTRICT"),
        nullable=False,
        comment="主 Provider ID",
    )
    primary_model_id: Mapped[str] = mapped_column(String(200), nullable=False, comment="Provider 侧模型 ID")
    fallback_chain: Mapped[list] = mapped_column(JSONB, default=list, server_default="[]", comment="有序降级链")
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true", comment="是否启用")
    config: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}", comment="调用参数覆盖")

    # 关联
    primary_provider = relationship("Provider", back_populates="slots", lazy="selectin")
