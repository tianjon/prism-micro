"""IngestionBatch ORM 模型。"""

import uuid
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from prism_shared.db.base import Base, TimestampMixin, UUIDMixin


class IngestionBatch(Base, UUIDMixin, TimestampMixin):
    """导入批次。

    记录每次文件导入的元信息和处理进度。
    状态流转：pending → parsing → mapping → importing → processing
    → completed / partially_completed / failed
    """

    __tablename__ = "ingestion_batches"
    __table_args__ = (
        Index("idx_batches_status", "status"),
        Index("idx_batches_created", "created_at", postgresql_using="btree"),
        {"schema": "voc"},
    )

    source: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="导入来源：csv/excel/synthetic/crawler_dongchedi/crawler_weibo",
    )
    file_name: Mapped[str | None] = mapped_column(String(500), nullable=True)
    file_size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    mapping_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("voc.schema_mappings.id", ondelete="SET NULL"),
        nullable=True,
    )
    total_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    new_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    duplicate_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    failed_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        server_default="pending",
        comment="pending/parsing/mapping/importing/processing/completed/partially_completed/failed",
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # 关联
    mapping = relationship("SchemaMapping", lazy="selectin")
    voices = relationship("Voice", back_populates="batch", lazy="noload")
