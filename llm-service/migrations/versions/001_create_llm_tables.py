"""创建 llm schema 的 providers 和 model_slots 表

Revision ID: 001
Revises:
Create Date: 2026-02-13

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS llm")

    # --- providers 表 ---
    op.create_table(
        "providers",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("name", sa.String(100), unique=True, nullable=False),
        sa.Column("slug", sa.String(50), unique=True, nullable=False),
        sa.Column("provider_type", sa.String(50), nullable=False),
        sa.Column("base_url", sa.String(500), nullable=False),
        sa.Column("api_key_encrypted", sa.Text(), nullable=False),
        sa.Column("is_enabled", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("config", JSONB(), server_default="{}", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        schema="llm",
    )
    op.create_index(
        "idx_providers_is_enabled",
        "providers",
        ["is_enabled"],
        schema="llm",
        postgresql_where=sa.text("is_enabled = true"),
    )
    op.create_index("idx_providers_slug", "providers", ["slug"], schema="llm")

    # --- slot_type 枚举 ---
    slot_type_enum = sa.Enum("fast", "reasoning", "embedding", "rerank", name="slot_type", schema="llm")
    slot_type_enum.create(op.get_bind(), checkfirst=True)

    # --- model_slots 表 ---
    op.create_table(
        "model_slots",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("slot_type", slot_type_enum, unique=True, nullable=False),
        sa.Column(
            "primary_provider_id",
            UUID(as_uuid=True),
            sa.ForeignKey("llm.providers.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("primary_model_id", sa.String(200), nullable=False),
        sa.Column("fallback_chain", JSONB(), server_default="[]", nullable=False),
        sa.Column("is_enabled", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("config", JSONB(), server_default="{}", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        schema="llm",
    )
    op.create_index("idx_model_slots_slot_type", "model_slots", ["slot_type"], schema="llm")
    op.create_index("idx_model_slots_primary_provider", "model_slots", ["primary_provider_id"], schema="llm")


def downgrade() -> None:
    op.drop_table("model_slots", schema="llm")
    op.execute("DROP TYPE IF EXISTS llm.slot_type")
    op.drop_table("providers", schema="llm")
