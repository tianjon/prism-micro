"""创建 voc schema 全部表

Revision ID: 001
Revises:
Create Date: 2026-02-14

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # 前置：Schema 与扩展
    # ------------------------------------------------------------------
    op.execute("CREATE SCHEMA IF NOT EXISTS voc")
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # ------------------------------------------------------------------
    # 1. schema_mappings（无依赖）
    # ------------------------------------------------------------------
    op.execute("""
        CREATE TABLE voc.schema_mappings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(200) NOT NULL,
            source_format VARCHAR(20) NOT NULL
                CHECK (source_format IN ('csv', 'excel', 'json')),
            column_mappings JSONB NOT NULL,
            created_by VARCHAR(50) NOT NULL
                CHECK (created_by IN ('llm', 'user', 'llm_user_confirmed')),
            confidence FLOAT,
            column_hash VARCHAR(64) NOT NULL,
            sample_data JSONB,
            usage_count INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX idx_mapping_column_hash ON voc.schema_mappings(column_hash)")
    op.execute("CREATE INDEX idx_mapping_format ON voc.schema_mappings(source_format)")

    # ------------------------------------------------------------------
    # 2. ingestion_batches（依赖 schema_mappings）
    # ------------------------------------------------------------------
    op.execute("""
        CREATE TABLE voc.ingestion_batches (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            source VARCHAR(50) NOT NULL,
            file_name VARCHAR(500),
            file_size_bytes BIGINT,
            mapping_id UUID REFERENCES voc.schema_mappings(id) ON DELETE SET NULL,
            total_count INTEGER DEFAULT 0,
            new_count INTEGER DEFAULT 0,
            duplicate_count INTEGER DEFAULT 0,
            failed_count INTEGER DEFAULT 0,
            status VARCHAR(30) NOT NULL DEFAULT 'pending'
                CHECK (status IN (
                    'pending', 'parsing', 'mapping', 'importing',
                    'processing', 'completed', 'partially_completed', 'failed'
                )),
            error_message TEXT,
            completed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX idx_batches_status ON voc.ingestion_batches(status)")
    op.execute("CREATE INDEX idx_batches_created ON voc.ingestion_batches(created_at DESC)")

    # ------------------------------------------------------------------
    # 3. voices（依赖 ingestion_batches）
    # ------------------------------------------------------------------
    op.execute("""
        CREATE TABLE voc.voices (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            source VARCHAR(50) NOT NULL,
            raw_text TEXT NOT NULL,
            content_hash VARCHAR(64) NOT NULL,
            source_key VARCHAR(200),
            batch_id UUID REFERENCES voc.ingestion_batches(id),
            processed_status VARCHAR(20) NOT NULL DEFAULT 'pending'
                CHECK (processed_status IN ('pending', 'processing', 'completed', 'failed')),
            processing_error TEXT,
            retry_count INTEGER DEFAULT 0,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    # 条件唯一索引：有业务键时按 (source, source_key) 去重
    op.execute("""
        CREATE UNIQUE INDEX idx_voices_source_dedup
        ON voc.voices(source, source_key)
        WHERE source_key IS NOT NULL
    """)
    # 条件唯一索引：无业务键时按 content_hash 去重
    op.execute("""
        CREATE UNIQUE INDEX idx_voices_content_dedup
        ON voc.voices(content_hash)
        WHERE source_key IS NULL
    """)
    # 复合索引：覆盖按批次查状态的高频查询
    op.execute("CREATE INDEX idx_voices_batch_status ON voc.voices(batch_id, processed_status)")
    op.execute("CREATE INDEX idx_voices_status ON voc.voices(processed_status)")
    op.execute("CREATE INDEX idx_voices_created ON voc.voices(created_at DESC)")

    # ------------------------------------------------------------------
    # 4. semantic_units（依赖 voices）
    # ------------------------------------------------------------------
    op.execute("""
        CREATE TABLE voc.semantic_units (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            voice_id UUID NOT NULL REFERENCES voc.voices(id) ON DELETE CASCADE,
            text TEXT NOT NULL,
            summary VARCHAR(500),
            intent VARCHAR(100),
            sentiment VARCHAR(20)
                CHECK (sentiment IN ('positive', 'negative', 'neutral', 'mixed')),
            confidence FLOAT,
            embedding vector(1024),
            sequence_index INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX idx_units_voice ON voc.semantic_units(voice_id)")
    op.execute("CREATE INDEX idx_units_sentiment ON voc.semantic_units(sentiment)")
    op.execute("CREATE INDEX idx_units_intent ON voc.semantic_units(intent)")
    # HNSW 向量索引：cosine 相似度，m=16 / ef_construction=64
    op.execute("""
        CREATE INDEX idx_units_embedding ON voc.semantic_units
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
    """)

    # ------------------------------------------------------------------
    # 5. emergent_tags（自引用）
    # ------------------------------------------------------------------
    op.execute("""
        CREATE TABLE voc.emergent_tags (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(200) NOT NULL UNIQUE,
            raw_name VARCHAR(200) NOT NULL,
            usage_count INTEGER DEFAULT 0,
            status VARCHAR(20) DEFAULT 'active'
                CHECK (status IN ('active', 'merged', 'deprecated')),
            confidence FLOAT,
            parent_tag_id UUID REFERENCES voc.emergent_tags(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX idx_tags_usage ON voc.emergent_tags(usage_count DESC)")
    op.execute("CREATE INDEX idx_tags_status ON voc.emergent_tags(status)")

    # ------------------------------------------------------------------
    # 6. unit_tag_associations（依赖 semantic_units + emergent_tags）
    # ------------------------------------------------------------------
    op.execute("""
        CREATE TABLE voc.unit_tag_associations (
            unit_id UUID NOT NULL REFERENCES voc.semantic_units(id) ON DELETE CASCADE,
            tag_id UUID NOT NULL REFERENCES voc.emergent_tags(id) ON DELETE CASCADE,
            relevance FLOAT DEFAULT 1.0,
            is_primary BOOLEAN DEFAULT false,
            source VARCHAR(30) NOT NULL DEFAULT 'llm_emergent',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (unit_id, tag_id)
        )
    """)
    op.execute("CREATE INDEX idx_uta_tag ON voc.unit_tag_associations(tag_id)")

    # ------------------------------------------------------------------
    # 7. tag_feedback（依赖 emergent_tags）
    # ------------------------------------------------------------------
    op.execute("""
        CREATE TABLE voc.tag_feedback (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tag_id UUID NOT NULL REFERENCES voc.emergent_tags(id),
            user_id UUID NOT NULL,
            feedback_type VARCHAR(20) NOT NULL
                CHECK (feedback_type IN ('useful', 'useless', 'error')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE(tag_id, user_id)
        )
    """)
    op.execute("CREATE INDEX idx_feedback_tag ON voc.tag_feedback(tag_id)")


def downgrade() -> None:
    # 按逆依赖顺序删除
    op.execute("DROP TABLE IF EXISTS voc.tag_feedback CASCADE")
    op.execute("DROP TABLE IF EXISTS voc.unit_tag_associations CASCADE")
    op.execute("DROP TABLE IF EXISTS voc.emergent_tags CASCADE")
    op.execute("DROP TABLE IF EXISTS voc.semantic_units CASCADE")
    op.execute("DROP TABLE IF EXISTS voc.voices CASCADE")
    op.execute("DROP TABLE IF EXISTS voc.ingestion_batches CASCADE")
    op.execute("DROP TABLE IF EXISTS voc.schema_mappings CASCADE")
    op.execute("DROP SCHEMA IF EXISTS voc CASCADE")
