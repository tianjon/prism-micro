"""UnitTagAssociation ORM 模型。"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from prism_shared.db.base import Base


class UnitTagAssociation(Base):
    """语义单元-标签关联表。

    多对多关联，组合主键 (unit_id, tag_id)，不使用 UUIDMixin。
    source 字段区分标签来源，支持 AI 管线质量评估和 Prompt A/B 测试。
    """

    __tablename__ = "unit_tag_associations"
    __table_args__ = (
        Index("idx_uta_tag", "tag_id"),
        {"schema": "voc"},
    )

    unit_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("voc.semantic_units.id", ondelete="CASCADE"),
        primary_key=True,
    )
    tag_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("voc.emergent_tags.id", ondelete="CASCADE"),
        primary_key=True,
    )
    relevance: Mapped[float] = mapped_column(Float, default=1.0, server_default="1.0")
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    source: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        server_default="llm_emergent",
        comment="标签来源：llm_emergent/human_annotation/human_correction",
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
