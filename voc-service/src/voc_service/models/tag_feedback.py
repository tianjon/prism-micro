"""TagFeedback ORM 模型。"""

import uuid

from sqlalchemy import ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from prism_shared.db.base import Base, TimestampMixin, UUIDMixin


class TagFeedback(Base, UUIDMixin, TimestampMixin):
    """标签质量反馈。

    每个用户对每个标签只能有一条反馈（UPSERT 语义）。
    user_id 为应用层引用 auth.users.id，无 DB 级外键约束（跨 Schema 规范）。
    """

    __tablename__ = "tag_feedback"
    __table_args__ = (
        UniqueConstraint("tag_id", "user_id", name="uq_feedback_tag_user"),
        Index("idx_feedback_tag", "tag_id"),
        {"schema": "voc"},
    )

    tag_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("voc.emergent_tags.id"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        comment="应用层引用 auth.users.id，无 DB 外键约束",
    )
    feedback_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="useful/useless/error",
    )

    # 关联
    tag = relationship("EmergentTag", back_populates="feedbacks", lazy="selectin")
