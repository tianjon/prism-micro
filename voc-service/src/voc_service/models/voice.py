"""Voice ORM 模型。"""

import uuid

from sqlalchemy import ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from prism_shared.db.base import Base, TimestampMixin, UUIDMixin


class Voice(Base, UUIDMixin, TimestampMixin):
    """原始客户反馈。

    一条 Voice 对应一条原始反馈文本，通过 AI 管线拆解为多个 SemanticUnit。
    去重策略：有 source_key 时按 (source, source_key) 去重，
    无 source_key 时 fallback 到 content_hash。
    """

    __tablename__ = "voices"
    __table_args__ = (
        # 复合索引：覆盖按批次查状态的高频查询，替代单列 batch_id 索引
        Index("idx_voices_batch_status", "batch_id", "processed_status"),
        Index("idx_voices_status", "processed_status"),
        Index("idx_voices_created", "created_at", postgresql_using="btree"),
        {"schema": "voc"},
    )

    source: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="数据来源，与所属 batch 一致",
    )
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False, comment="SHA-256(raw_text)")
    source_key: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
        comment="业务主键（如工单编号），用于有业务键场景的去重",
    )
    batch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("voc.ingestion_batches.id"),
        nullable=True,
    )
    processed_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        server_default="pending",
        comment="pending/processing/completed/failed",
    )
    processing_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    # Python 属性名用 metadata_ 避免与 SQLAlchemy Base.metadata 冲突
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, server_default="{}")

    # 关联
    batch = relationship("IngestionBatch", back_populates="voices", lazy="selectin")
    semantic_units = relationship(
        "SemanticUnit",
        back_populates="voice",
        lazy="noload",
        cascade="all, delete-orphan",
    )
