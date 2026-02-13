"""创建 llm schema 的 providers 和 model_slots 表

Revision ID: 001
Revises:
Create Date: 2026-02-13

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS llm")

    # --- slot_type 枚举 ---
    op.execute("CREATE TYPE llm.slot_type AS ENUM ('fast', 'reasoning', 'embedding', 'rerank')")

    # --- providers 表 ---
    op.execute("""
        CREATE TABLE llm.providers (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            name VARCHAR(100) NOT NULL UNIQUE,
            slug VARCHAR(50) NOT NULL UNIQUE,
            provider_type VARCHAR(50) NOT NULL,
            base_url VARCHAR(500) NOT NULL,
            api_key_encrypted TEXT NOT NULL,
            is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
            config JSONB NOT NULL DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX idx_providers_is_enabled ON llm.providers (is_enabled) WHERE is_enabled = true")
    op.execute("CREATE INDEX idx_providers_slug ON llm.providers (slug)")

    # --- model_slots 表 ---
    op.execute("""
        CREATE TABLE llm.model_slots (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            slot_type llm.slot_type NOT NULL UNIQUE,
            primary_provider_id UUID NOT NULL REFERENCES llm.providers(id) ON DELETE RESTRICT,
            primary_model_id VARCHAR(200) NOT NULL,
            fallback_chain JSONB NOT NULL DEFAULT '[]',
            is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
            config JSONB NOT NULL DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX idx_model_slots_slot_type ON llm.model_slots (slot_type)")
    op.execute("CREATE INDEX idx_model_slots_primary_provider ON llm.model_slots (primary_provider_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS llm.model_slots")
    op.execute("DROP TABLE IF EXISTS llm.providers")
    op.execute("DROP TYPE IF EXISTS llm.slot_type")
