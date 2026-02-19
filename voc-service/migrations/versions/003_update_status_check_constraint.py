"""更新 ingestion_batches status CHECK 约束，新增 generating_mapping 状态

Revision ID: 003
Revises: 002
Create Date: 2026-02-16

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "003"
down_revision: str | None = "002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# 旧约束：pending, parsing, mapping, importing, processing, completed, partially_completed, failed
# 新约束：新增 generating_mapping（保留 parsing 以兼容历史数据）
_NEW_STATUSES = [
    "pending",
    "parsing",
    "generating_mapping",
    "mapping",
    "importing",
    "processing",
    "completed",
    "partially_completed",
    "failed",
]

_OLD_STATUSES = [
    "pending",
    "parsing",
    "mapping",
    "importing",
    "processing",
    "completed",
    "partially_completed",
    "failed",
]


def _rebuild_check(statuses: list[str]) -> None:
    """删除旧约束并创建新约束。"""
    op.drop_constraint(
        "ingestion_batches_status_check",
        "ingestion_batches",
        schema="voc",
        type_="check",
    )
    values = ", ".join(f"'{s}'" for s in statuses)
    op.execute(
        f"ALTER TABLE voc.ingestion_batches "
        f"ADD CONSTRAINT ingestion_batches_status_check "
        f"CHECK (status IN ({values}))"
    )


def upgrade() -> None:
    _rebuild_check(_NEW_STATUSES)


def downgrade() -> None:
    _rebuild_check(_OLD_STATUSES)
