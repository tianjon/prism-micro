"""新增 prompt_ready 状态到 ingestion_batches CHECK 约束

Revision ID: 004
Revises: 003
Create Date: 2026-02-16

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "004"
down_revision: str | None = "003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_NEW_STATUSES = [
    "pending",
    "parsing",
    "prompt_ready",
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
    "generating_mapping",
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
