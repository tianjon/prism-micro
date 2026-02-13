"""EmergentTag ORM 模型。"""

import uuid

from sqlalchemy import Float, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from prism_shared.db.base import Base, TimestampMixin, UUIDMixin


class EmergentTag(Base, UUIDMixin, TimestampMixin):
    """涌现标签。

    由 AI 管线 Stage 2 从语义单元中自动发现和标准化，
    通过 usage_count 反映涌现强度。
    支持 parent_tag_id 自引用实现标签合并。
    """

    __tablename__ = "emergent_tags"
    __table_args__ = (
        Index("idx_tags_name", "name", unique=True),
        Index("idx_tags_usage", "usage_count", postgresql_using="btree"),
        Index("idx_tags_status", "status"),
        {"schema": "voc"},
    )

    name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        unique=True,
        comment="标准化后的名称",
    )
    raw_name: Mapped[str] = mapped_column(String(200), nullable=False, comment="LLM 原始输出")
    usage_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    status: Mapped[str] = mapped_column(
        String(20),
        server_default="active",
        comment="active/merged/deprecated",
    )
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    parent_tag_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("voc.emergent_tags.id", ondelete="SET NULL"),
        nullable=True,
        comment="合并到的父标签",
    )

    # 关联
    parent_tag = relationship("EmergentTag", remote_side="EmergentTag.id", lazy="selectin")
    children = relationship("EmergentTag", lazy="noload")
    units = relationship(
        "SemanticUnit",
        secondary="voc.unit_tag_associations",
        back_populates="tags",
        lazy="noload",
    )
    feedbacks = relationship("TagFeedback", back_populates="tag", lazy="noload")
