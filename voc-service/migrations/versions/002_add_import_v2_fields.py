"""新增导入 v2 字段：file_hash, file_statistics, dedup_columns, prompt_text

Revision ID: 002
Revises: 001
Create Date: 2026-02-16

"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision: str = "002"
down_revision: str | None = "001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "ingestion_batches",
        sa.Column("file_hash", sa.String(64), nullable=True),
        schema="voc",
    )
    op.add_column(
        "ingestion_batches",
        sa.Column("file_statistics", JSONB, nullable=True),
        schema="voc",
    )
    op.add_column(
        "ingestion_batches",
        sa.Column("dedup_columns", JSONB, nullable=True),
        schema="voc",
    )
    op.add_column(
        "ingestion_batches",
        sa.Column("prompt_text", sa.Text, nullable=True),
        schema="voc",
    )
    op.create_index(
        "ix_ingestion_batches_file_hash",
        "ingestion_batches",
        ["file_hash"],
        schema="voc",
    )


def downgrade() -> None:
    op.drop_index(
        "ix_ingestion_batches_file_hash",
        table_name="ingestion_batches",
        schema="voc",
    )
    op.drop_column("ingestion_batches", "prompt_text", schema="voc")
    op.drop_column("ingestion_batches", "dedup_columns", schema="voc")
    op.drop_column("ingestion_batches", "file_statistics", schema="voc")
    op.drop_column("ingestion_batches", "file_hash", schema="voc")
