"""SchemaMapping ORM 模型。"""

from sqlalchemy import Float, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from prism_shared.db.base import Base, TimestampMixin, UUIDMixin


class SchemaMapping(Base, UUIDMixin, TimestampMixin):
    """LLM Schema 映射模板。

    存储 CSV/Excel 列名到 Voice 字段的映射规则，支持模板复用。
    通过 column_hash 实现相同列结构的快速匹配。
    """

    __tablename__ = "schema_mappings"
    __table_args__ = (
        Index("idx_mapping_column_hash", "column_hash"),
        Index("idx_mapping_format", "source_format"),
        {"schema": "voc"},
    )

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    source_format: Mapped[str] = mapped_column(String(20), nullable=False, comment="csv/excel/json")
    column_mappings: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_by: Mapped[str] = mapped_column(String(50), nullable=False, comment="llm/user/llm_user_confirmed")
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    column_hash: Mapped[str] = mapped_column(String(64), nullable=False, comment="列名集合 SHA-256，用于模板匹配")
    sample_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    usage_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
