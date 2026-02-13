# voc-service 数据模型实施文档

> 实施日期：2026-02-14
> 提交：`4fb82b4`
> 状态：已完成

## 概述

本文档记录 voc-service 数据模型的完整实施过程，包括两轮评审决议、最终技术选型和数据库 Schema 定义。

## 文件清单

| 文件 | 说明 |
|------|------|
| `voc-service/pyproject.toml` | 新增 pgvector、alembic 依赖 |
| `models/enums.py` | 8 个 StrEnum 枚举 |
| `models/schema_mapping.py` | LLM Schema 映射模板 |
| `models/ingestion_batch.py` | 数据导入批次 |
| `models/voice.py` | 原始客户反馈 |
| `models/semantic_unit.py` | 语义单元 + 向量 |
| `models/emergent_tag.py` | 涌现标签（自引用层级） |
| `models/unit_tag_association.py` | 语义单元-标签多对多关联 |
| `models/tag_feedback.py` | 标签质量反馈 |
| `models/__init__.py` | 统一导出 |
| `alembic.ini` | Alembic 迁移配置 |
| `migrations/env.py` | 异步迁移环境 |
| `migrations/script.py.mako` | 迁移脚本模板 |
| `migrations/versions/001_create_voc_tables.py` | 初始迁移（7 表 + 索引） |

---

## 技术决策

### 1. 枚举策略：VARCHAR + CHECK（非原生 PG ENUM）

**决策人**：赵一凡（架构）

原生 PostgreSQL ENUM 的弊端：
- 添加新值需要 `ALTER TYPE ... ADD VALUE`，不可在事务中执行
- 删除值极其困难，需重建类型
- 跨 Schema 共享 ENUM 增加耦合

采用方案：DDL 层用 `VARCHAR + CHECK` 约束，应用层用 Python `StrEnum` 保证类型安全。

```sql
-- DDL 层
status VARCHAR(30) NOT NULL CHECK (status IN ('pending', 'parsing', ...))

-- Python 层
class BatchStatus(StrEnum):
    PENDING = "pending"
    PARSING = "parsing"
    ...
```

### 2. 去重策略：条件唯一索引

**决策人**：李维（数据工程）

基于真实数据分析（35,150 条工单，305 条内容重复但工单号不同），采用双路去重：

```sql
-- 有业务键时：按 (source, source_key) 去重
CREATE UNIQUE INDEX idx_voices_source_dedup
ON voc.voices(source, source_key)
WHERE source_key IS NOT NULL;

-- 无业务键时：按 content_hash fallback 去重
CREATE UNIQUE INDEX idx_voices_content_dedup
ON voc.voices(content_hash)
WHERE source_key IS NULL;
```

Voice 模型新增 `source_key VARCHAR(200)` 字段，存储业务主键（如工单编号）。

### 3. 向量配置：1024 维 + HNSW 索引

**约束**：pgvector 0.8.1 的 HNSW / IVFFlat 索引均限制最大 2000 维。

| 配置 | 值 |
|------|-----|
| 模型 | Qwen-Embedding-8B |
| 维度 | 1024（通过 dimensions 参数指定） |
| 索引 | HNSW |
| 距离 | cosine（vector_cosine_ops） |
| m | 16 |
| ef_construction | 64 |

llm-service 的 `EmbeddingRequest` 增加了 `dimensions: int | None` 可选参数，
调用方可按需指定输出维度，透传给上游 Embedding API。

### 4. intent 字段：开放值，不设 CHECK

**决策人**：陈思琪（AI 管线）

intent 是 LLM 自由抽取的语义意图，如果用 CHECK 约束会限制模型发现新意图类别。
保留为 `VARCHAR(100)` 开放字段，应用层通过 StrEnum 提供推荐值但不强制。

### 5. 涌现标签：不添加 tag_type

**决策人**：陈思琪（AI 管线）

EmergentTag 的核心理念是"涌现"——标签完全由 AI 管线从数据中发现，
不应预设分类体系。如果未来需要预设标签，应作为独立的 PresetTag 表实现。

### 6. UnitTagAssociation.source：标签来源溯源

**决策人**：陈思琪（AI 管线）

新增 `source VARCHAR(30) DEFAULT 'llm_emergent'` 字段，区分标签来源：
- `llm_emergent`：AI 管线自动生成
- `human_annotation`：人工标注
- `human_correction`：人工修正 AI 结果

支持 Prompt A/B 测试和 AI 管线质量评估。

### 7. metadata 字段命名

**决策人**：王磊（后端）

SQLAlchemy 的 `Base` 类已占用 `metadata` 属性（指向 `MetaData` 对象）。
ORM 属性名用 `metadata_`，通过 `mapped_column("metadata", JSONB)` 映射到数据库列名 `metadata`。

### 8. TimestampMixin 统一应用

**决策人**：赵一凡（架构）

6 个实体表（SchemaMapping、IngestionBatch、Voice、SemanticUnit、EmergentTag、TagFeedback）
统一使用 `TimestampMixin`（提供 `created_at` + `updated_at`），保持一致性。

UnitTagAssociation 作为关联表，仅保留 `created_at`（手动定义），不使用 UUIDMixin。

### 9. 跨 Schema 引用

TagFeedback.user_id 引用 `auth.users.id`，但不建立 DB 级外键约束（跨 Schema 规范）。
通过应用层保证引用完整性，字段注释说明用途。

---

## 数据库 Schema

### 表结构

```
voc.schema_mappings      (11 列)  — LLM 列映射模板
voc.ingestion_batches    (14 列)  — 数据导入批次
voc.voices               (12 列)  — 原始客户反馈
voc.semantic_units       (11 列)  — 语义单元 + 向量
voc.emergent_tags         (9 列)  — 涌现标签
voc.unit_tag_associations (6 列)  — 语义单元-标签关联
voc.tag_feedback          (6 列)  — 标签质量反馈
```

### ER 关系

```
schema_mappings ←(mapping_id)— ingestion_batches ←(batch_id)— voices ←(voice_id)— semantic_units
                                                                                       ↕ (unit_tag_associations)
                                                               emergent_tags ←(parent_tag_id)— emergent_tags (自引用)
                                                                     ↑
                                                               tag_feedback
```

### 索引清单（20 个应用索引 + 7 个 PK/UK）

| 索引名 | 表 | 类型 | 列 |
|--------|------|------|-----|
| idx_mapping_column_hash | schema_mappings | btree | column_hash |
| idx_mapping_format | schema_mappings | btree | source_format |
| idx_batches_status | ingestion_batches | btree | status |
| idx_batches_created | ingestion_batches | btree | created_at DESC |
| idx_voices_source_dedup | voices | btree unique | (source, source_key) WHERE source_key IS NOT NULL |
| idx_voices_content_dedup | voices | btree unique | content_hash WHERE source_key IS NULL |
| idx_voices_batch_status | voices | btree | (batch_id, processed_status) |
| idx_voices_status | voices | btree | processed_status |
| idx_voices_created | voices | btree | created_at DESC |
| idx_units_voice | semantic_units | btree | voice_id |
| idx_units_sentiment | semantic_units | btree | sentiment |
| idx_units_intent | semantic_units | btree | intent |
| idx_units_embedding | semantic_units | hnsw | embedding (cosine, m=16, ef=64) |
| idx_tags_usage | emergent_tags | btree | usage_count DESC |
| idx_tags_status | emergent_tags | btree | status |
| idx_uta_tag | unit_tag_associations | btree | tag_id |
| idx_feedback_tag | tag_feedback | btree | tag_id |
| emergent_tags_name_key | emergent_tags | btree unique | name |
| tag_feedback_tag_id_user_id_key | tag_feedback | btree unique | (tag_id, user_id) |

---

## 评审记录

### 第一轮评审（通用团队）

参与者：data-reviewer、semantic-reviewer、mapping-reviewer

关键发现：
- content_hash 去重会丢失 305 条合法记录（0.87%）→ 引入 source_key 条件去重
- IVFFlat 不应在空表上创建 → 延迟向量索引
- UnitTagAssociation 需要 source 字段

### 第二轮评审（项目专家团队）

| 专家 | 角色 | 主要贡献 |
|------|------|----------|
| 赵一凡 | 架构 | TimestampMixin 统一、VARCHAR+CHECK 替代 ENUM、迁移风格统一 |
| 陈思琪 | AI 管线 | intent 开放值、不加 tag_type、source 溯源、向量维度风险预警 |
| 王磊 | 后端 | 复合索引优化、metadata 命名冲突、CASCADE 策略确认 |
| 李维 | 数据工程 | source_key 去重策略、partially_completed 状态、column_mappings 扩展 |

---

## 迁移说明

### 执行迁移

```bash
cd voc-service
UV_PROJECT_ENVIRONMENT=~/.base-venv uv run alembic upgrade head
```

### 回退迁移

```bash
cd voc-service
UV_PROJECT_ENVIRONMENT=~/.base-venv uv run alembic downgrade base
```

downgrade 会 `DROP SCHEMA voc CASCADE`，清除所有表和数据。

### 迁移风格

使用 `op.execute()` 原生 SQL（与 llm-service 统一），而非 `op.create_table()` DSL。
原因：涉及 pgvector 扩展、条件唯一索引、HNSW 参数等 Alembic DSL 难以表达的特性。
