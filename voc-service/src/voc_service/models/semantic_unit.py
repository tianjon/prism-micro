"""SemanticUnit ORM 模型。"""

import uuid

from pgvector.sqlalchemy import Vector
from sqlalchemy import Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from prism_shared.db.base import Base, TimestampMixin, UUIDMixin


class SemanticUnit(Base, UUIDMixin, TimestampMixin):
    """语义单元。

    一条 Voice 经 Stage 1 拆解为多个 SemanticUnit，
    每个语义单元承载独立的意图和情感。
    embedding 由 Stage 3 向量化后写入。
    """

    __tablename__ = "semantic_units"
    __table_args__ = (
        Index("idx_units_voice", "voice_id"),
        Index("idx_units_sentiment", "sentiment"),
        Index("idx_units_intent", "intent"),
        # HNSW 向量索引在独立迁移中创建（需有数据后建立）
        {"schema": "voc"},
    )

    voice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("voc.voices.id", ondelete="CASCADE"),
        nullable=False,
    )
    text: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str | None] = mapped_column(String(500), nullable=True)
    intent: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="表达意图（开放值）：complaint/suggestion/praise/inquiry 等",
    )
    sentiment: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        comment="positive/negative/neutral/mixed",
    )
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    embedding = mapped_column(Vector(1024), nullable=True)
    sequence_index: Mapped[int] = mapped_column(
        Integer,
        default=0,
        server_default="0",
        comment="在原始 Voice 中的顺序",
    )

    # 关联
    voice = relationship("Voice", back_populates="semantic_units", lazy="selectin")
    tags = relationship(
        "EmergentTag",
        secondary="voc.unit_tag_associations",
        back_populates="units",
        lazy="noload",
    )
