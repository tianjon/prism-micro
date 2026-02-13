# voc-service 实现级设计文档

> **作者**：陈思琪（AI 工程负责人）、李维（数据工程负责人）
> **版本**：v1.0
> **状态**：初稿
> **适用范围**：Phase 3（M3-M5），覆盖 Wave 1 核心价值闭环

---

## 1. 服务概述

### 1.1 职责定义

voc-service 是 Prism 平台的 VOC（Voice of Customer）语义分析引擎，负责从原始客户反馈数据中提取结构化语义信息。它是 Prism 最复杂的后端服务，承载数据导入、AI 管线处理、语义搜索、涌现标签管理四大核心能力。

**核心职责**：
- 接收 CSV/Excel 格式的客户反馈文件，通过 LLM 自动映射 Schema 并导入
- 执行三阶段 AI 管线：语义拆解 -> 标签涌现 + 标准化 -> 向量化
- 提供基于 pgvector 的语义搜索 API
- 管理涌现标签的生命周期及用户反馈

### 1.2 PRD 功能映射

| PRD 功能 | 本服务实现 | 里程碑 |
|----------|-----------|--------|
| F1 CSV/Excel 导入 + LLM Schema 映射 | `POST /api/voc/import`、SchemaMapping 模板、文件解析器 | M3 |
| F18 Excel 上传支持 | openpyxl 集成，ExcelParser | M3 |
| F19 LLM Schema 自动映射服务 | SchemaMappingService、reasoning 槽位调用 | M3 |
| F20 前端映射确认 UI | 映射预览 API（由前端消费） | M5 |
| F24 增量去重引擎 | content hash SHA-256 + IngestionBatch | M3 |
| F2 Stage 2 标签涌现 + 标准化 | pipeline/stage2_tagging.py | M3 |
| F5 守卫层 L1/L2 | pipeline/guards.py | M4 |
| F3 Stage 3 向量化 | pipeline/stage3_embedding.py | M4 |
| F4 语义搜索 API | `POST /api/voc/search` + pgvector ANN | M4 |
| F6 置信度三档展示 | API 响应中的 confidence_tier 字段 | M3 |
| F14 标签反馈机制 | `POST /api/voc/tags/{id}/feedback` | M3 |
| F15 涌现 vs 预设对比 | `GET /api/voc/tags/compare` | M5 |
| F16 合成数据冷启动 | SyntheticDataGenerator | M3 |

### 1.3 里程碑划分

```
M3（W0+7 周）数据底座
├── CSV/Excel 文件解析（CsvParser, ExcelParser）
├── LLM Schema 自动映射（SchemaMappingService）
├── 映射模板缓存复用（SchemaMapping CRUD）
├── 增量去重（content hash + IngestionBatch）
├── Stage 1 语义拆解（SemanticSplitter）
├── Stage 2 标签涌现 + 标准化（TagEmergenceProcessor）
└── 合成数据冷启动（SyntheticDataGenerator）

M4（W0+9 周）语义搜索
├── Stage 3 向量化（EmbeddingProcessor）
├── vector_search API（SearchService）
├── 可选 rerank（RerankService）
└── 守卫层 L1/L2（FormatGuard, SemanticGuard）

M5（W0+12 周）前端集成联调
├── 映射预览 API 完善
├── 标签对比视图 API
├── 全端点联调 + 错误处理完善
└── 性能调优（pgvector 索引、批量处理）
```

---

## 2. 模块结构

### 2.1 目录树

```
voc-service/
├── pyproject.toml
├── .env.example
├── alembic.ini
├── alembic/
│   ├── env.py
│   └── versions/
├── src/
│   └── voc_service/
│       ├── __init__.py
│       ├── main.py                          # FastAPI app 入口
│       ├── config.py                        # Pydantic Settings 配置
│       │
│       ├── api/                             # API 层（安全边界）
│       │   ├── __init__.py
│       │   ├── deps.py                      # FastAPI 依赖注入（DB session, auth）
│       │   ├── exception_handlers.py        # 全局异常处理器
│       │   └── routers/
│       │       ├── __init__.py
│       │       ├── health.py                # GET /health
│       │       ├── import_.py               # POST /api/voc/import, GET .../status
│       │       ├── search.py                # POST /api/voc/search
│       │       ├── tags.py                  # GET /api/voc/tags, .../feedback, .../compare
│       │       ├── units.py                 # GET /api/voc/units/{id}
│       │       └── voices.py               # GET /api/voc/voices/{id}
│       │
│       ├── core/                            # 核心业务逻辑
│       │   ├── __init__.py
│       │   ├── import_service.py            # 导入编排（文件解析 + 映射 + 去重 + 入库）
│       │   ├── schema_mapping_service.py    # LLM Schema 映射 + 模板管理
│       │   ├── processing_service.py        # AI 管线调度（三阶段编排）
│       │   ├── search_service.py            # 语义搜索 + rerank
│       │   ├── tag_service.py               # 标签查询 + 反馈 + 对比
│       │   └── synthetic_data_service.py    # 合成数据生成
│       │
│       ├── pipeline/                        # AI 管线（独立目录）
│       │   ├── __init__.py
│       │   ├── stage1_splitting.py          # Stage 1: 语义拆解
│       │   ├── stage2_tagging.py            # Stage 2: 标签涌现 + 标准化
│       │   ├── stage3_embedding.py          # Stage 3: 向量化
│       │   ├── guards.py                    # 守卫层 L1（格式）+ L2（语义）
│       │   └── llm_client.py               # llm-service HTTP 客户端封装
│       │
│       ├── parsers/                         # 文件解析器
│       │   ├── __init__.py
│       │   ├── base.py                      # BaseParser ABC
│       │   ├── csv_parser.py                # CSV 流式解析
│       │   └── excel_parser.py              # Excel 解析（openpyxl）
│       │
│       ├── prompts/                         # Prompt 模板（版本化）
│       │   ├── schema_mapping_v1.py         # Schema 映射 Prompt
│       │   ├── stage1_splitting_v1.py       # 语义拆解 Prompt
│       │   ├── stage2_tagging_v1.py         # 标签涌现 Prompt
│       │   ├── stage2_normalize_v1.py       # 标签标准化 Prompt
│       │   ├── guard_l2_v1.py               # L2 语义一致性 Prompt
│       │   └── synthetic_data_v1.py         # 合成数据生成 Prompt
│       │
│       ├── models/                          # SQLAlchemy ORM 模型
│       │   ├── __init__.py
│       │   ├── voice.py                     # Voice
│       │   ├── semantic_unit.py             # SemanticUnit
│       │   ├── emergent_tag.py              # EmergentTag
│       │   ├── unit_tag_association.py       # UnitTagAssociation
│       │   ├── tag_feedback.py              # TagFeedback
│       │   ├── schema_mapping.py            # SchemaMapping
│       │   └── ingestion_batch.py           # IngestionBatch
│       │
│       └── schemas/                         # Pydantic 请求/响应模型
│           ├── __init__.py
│           ├── common.py                    # ApiResponse[T], PaginatedResponse[T]
│           ├── import_.py                   # 导入相关
│           ├── search.py                    # 搜索相关
│           ├── tag.py                       # 标签相关
│           ├── unit.py                      # 语义单元相关
│           └── voice.py                     # Voice 相关
│
├── tests/
│   ├── conftest.py                          # 公共 fixture（DB, mock LLM）
│   ├── unit/
│   │   ├── test_csv_parser.py
│   │   ├── test_excel_parser.py
│   │   ├── test_schema_mapping.py
│   │   ├── test_stage1_splitting.py
│   │   ├── test_stage2_tagging.py
│   │   ├── test_stage3_embedding.py
│   │   ├── test_guards.py
│   │   ├── test_search_service.py
│   │   └── test_deduplication.py
│   ├── integration/
│   │   ├── test_import_flow.py
│   │   ├── test_pipeline_flow.py
│   │   ├── test_search_flow.py
│   │   └── test_tag_feedback_flow.py
│   └── golden/                              # Golden Dataset 测试
│       ├── datasets/
│       │   ├── splitting_golden.json
│       │   ├── tagging_golden.json
│       │   └── mapping_golden.json
│       └── test_golden_datasets.py
│
└── configs/
    └── settings.yaml                        # 运行时配置
```

### 2.2 模块职责与依赖

```
api/routers/          # 入口：HTTP 请求验证、认证、响应序列化
    │
    ├──→ core/        # 业务编排：调度 parser、pipeline、DB 操作
    │       │
    │       ├──→ pipeline/     # AI 管线：LLM 调用、语义处理
    │       │       │
    │       │       └──→ prompts/    # Prompt 模板：纯数据，无逻辑
    │       │       └──→ llm_client  # HTTP → llm-service
    │       │
    │       ├──→ parsers/      # 文件解析：CSV/Excel → dict 列表
    │       │
    │       └──→ models/       # ORM 模型 + DB 操作
    │
    └──→ schemas/     # Pydantic 模型：请求/响应验证
```

**依赖方向约束**：
- `api/` → `core/` → `pipeline/` | `parsers/` | `models/`
- `pipeline/` → `prompts/`（只读）、`llm_client`（HTTP 出口）
- `parsers/` 无外部依赖，纯解析逻辑
- `models/` 无上层依赖
- **禁止**：`pipeline/` → `api/`、`models/` → `core/`

---

## 3. 数据模型

### 3.1 完整 DDL

```sql
-- ============================================================
-- voc Schema 创建
-- ============================================================
CREATE SCHEMA IF NOT EXISTS voc;

-- ============================================================
-- IngestionBatch（导入批次，需先创建，Voice 依赖它）
-- ============================================================
CREATE TABLE voc.ingestion_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source VARCHAR(50) NOT NULL,              -- csv/excel/synthetic/crawler_dongchedi/crawler_weibo
    file_name VARCHAR(500),                   -- 原始文件名
    file_size_bytes BIGINT,                   -- 文件大小
    mapping_id UUID,                          -- 使用的 SchemaMapping（可选）
    total_count INTEGER DEFAULT 0,            -- 文件中的总记录数
    new_count INTEGER DEFAULT 0,              -- 实际新增数
    duplicate_count INTEGER DEFAULT 0,        -- 重复跳过数
    failed_count INTEGER DEFAULT 0,           -- 解析/入库失败数
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'parsing', 'mapping', 'importing', 'processing', 'completed', 'failed')),
    error_message TEXT,                       -- 失败时的错误信息
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_batches_status ON voc.ingestion_batches(status);
CREATE INDEX idx_batches_created ON voc.ingestion_batches(created_at DESC);

-- ============================================================
-- Voice（原始反馈）
-- ============================================================
CREATE TABLE voc.voices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source VARCHAR(50) NOT NULL,
    raw_text TEXT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,        -- SHA-256
    batch_id UUID REFERENCES voc.ingestion_batches(id),
    processed_status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (processed_status IN ('pending', 'processing', 'completed', 'failed')),
    processing_error TEXT,                    -- 处理失败时的错误详情
    retry_count INTEGER DEFAULT 0,            -- 重试次数
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_voices_content_hash ON voc.voices(content_hash);
CREATE INDEX idx_voices_batch ON voc.voices(batch_id);
CREATE INDEX idx_voices_status ON voc.voices(processed_status);
CREATE INDEX idx_voices_created ON voc.voices(created_at DESC);

-- ============================================================
-- SemanticUnit（语义单元）
-- ============================================================
CREATE TABLE voc.semantic_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voice_id UUID NOT NULL REFERENCES voc.voices(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    summary VARCHAR(500),
    intent VARCHAR(100),
    sentiment VARCHAR(20) CHECK (sentiment IN ('positive', 'negative', 'neutral', 'mixed')),
    confidence FLOAT,
    embedding vector(4096),                   -- pgvector, Qwen-Embedding-8B
    sequence_index INTEGER DEFAULT 0,         -- 在原始 Voice 中的顺序
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_units_voice ON voc.semantic_units(voice_id);
CREATE INDEX idx_units_sentiment ON voc.semantic_units(sentiment);
CREATE INDEX idx_units_intent ON voc.semantic_units(intent);
CREATE INDEX idx_units_embedding ON voc.semantic_units
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================
-- EmergentTag（涌现标签）
-- ============================================================
CREATE TABLE voc.emergent_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,               -- 标准化后的名称
    raw_name VARCHAR(200) NOT NULL,           -- LLM 原始输出
    usage_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active'
        CHECK (status IN ('active', 'merged', 'deprecated')),
    confidence FLOAT,
    parent_tag_id UUID REFERENCES voc.emergent_tags(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tags_name ON voc.emergent_tags(name);
CREATE INDEX idx_tags_usage ON voc.emergent_tags(usage_count DESC);
CREATE INDEX idx_tags_status ON voc.emergent_tags(status);

-- ============================================================
-- UnitTagAssociation（语义单元-标签关联）
-- ============================================================
CREATE TABLE voc.unit_tag_associations (
    unit_id UUID NOT NULL REFERENCES voc.semantic_units(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES voc.emergent_tags(id) ON DELETE CASCADE,
    relevance FLOAT DEFAULT 1.0,
    is_primary BOOLEAN DEFAULT false,
    PRIMARY KEY (unit_id, tag_id)
);

CREATE INDEX idx_uta_tag ON voc.unit_tag_associations(tag_id);

-- ============================================================
-- TagFeedback（标签质量反馈）
-- ============================================================
CREATE TABLE voc.tag_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tag_id UUID NOT NULL REFERENCES voc.emergent_tags(id),
    user_id UUID NOT NULL,                    -- 引用 auth.users.id（跨 Schema 例外）
    feedback_type VARCHAR(20) NOT NULL
        CHECK (feedback_type IN ('useful', 'useless', 'error')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tag_id, user_id)
);

CREATE INDEX idx_feedback_tag ON voc.tag_feedback(tag_id);

-- ============================================================
-- SchemaMapping（LLM 映射模板）
-- ============================================================
CREATE TABLE voc.schema_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    source_format VARCHAR(20) NOT NULL
        CHECK (source_format IN ('csv', 'excel', 'json')),
    column_mappings JSONB NOT NULL,           -- {"原始列名": {"target": "voice字段", "confidence": 0.95}}
    created_by VARCHAR(50) NOT NULL
        CHECK (created_by IN ('llm', 'user', 'llm+user_confirmed')),
    confidence FLOAT,                         -- 整体映射置信度
    column_hash VARCHAR(64) NOT NULL,         -- 列名集合的 SHA-256，用于模板匹配
    sample_data JSONB,                        -- 前 5 行采样数据
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_mapping_column_hash ON voc.schema_mappings(column_hash);
CREATE INDEX idx_mapping_format ON voc.schema_mappings(source_format);
```

### 3.2 ER 关系描述

```
IngestionBatch 1 ──→ N Voice          （一次导入产生多条 Voice）
Voice          1 ──→ N SemanticUnit   （一条 Voice 拆解为多个语义单元）
SemanticUnit   N ←──→ N EmergentTag   （通过 UnitTagAssociation 多对多）
EmergentTag    1 ──→ N TagFeedback    （一个标签可收到多条反馈）
EmergentTag    1 ──→ N EmergentTag    （parent_tag_id 自引用，支持层级/合并）
SchemaMapping  1 ──→ N IngestionBatch （一个模板可被多次复用，通过 mapping_id）
```

### 3.3 column_mappings JSONB 结构示例

```json
{
  "评论内容": {"target": "raw_text", "confidence": 0.95},
  "发布时间": {"target": "metadata.published_at", "confidence": 0.88},
  "用户昵称": {"target": "metadata.author_name", "confidence": 0.92},
  "评分":     {"target": "metadata.rating", "confidence": 0.90},
  "来源平台": {"target": "metadata.platform", "confidence": 0.85}
}
```

**目标字段清单**（LLM 映射的候选目标）：
- `raw_text`（必选）：反馈文本内容
- `metadata.published_at`：发布时间
- `metadata.author_name`：作者名称
- `metadata.author_id`：作者 ID
- `metadata.rating`：评分
- `metadata.platform`：来源平台
- `metadata.url`：原始链接
- `metadata.*`：其余字段存入 metadata

---

## 4. API 设计

### 4.1 端点总览

| 方法 | 路径 | 说明 | 里程碑 |
|------|------|------|--------|
| POST | `/api/voc/import` | CSV/Excel 批量导入 | M3 |
| GET | `/api/voc/import/{batch_id}/status` | 导入任务状态 | M3 |
| GET | `/api/voc/import/{batch_id}/mapping-preview` | 映射预览（前端确认用） | M3 |
| POST | `/api/voc/import/{batch_id}/confirm-mapping` | 确认/修正映射后继续导入 | M3 |
| POST | `/api/voc/search` | 语义搜索 | M4 |
| GET | `/api/voc/tags` | 涌现标签列表 | M3 |
| GET | `/api/voc/tags/{id}/units` | 标签关联的 SemanticUnit | M3 |
| POST | `/api/voc/tags/{id}/feedback` | 提交标签反馈 | M3 |
| GET | `/api/voc/tags/compare` | 涌现 vs 预设分类对比 | M5 |
| GET | `/api/voc/units/{id}` | SemanticUnit 详情 | M3 |
| GET | `/api/voc/voices/{id}` | Voice 全文 | M3 |

### 4.2 POST /api/voc/import

**功能**：上传 CSV/Excel 文件，触发导入流程。

**请求**：`multipart/form-data`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | File | 是 | CSV 或 Excel 文件（最大 50MB） |
| source | string | 否 | 来源标识，默认根据文件扩展名推断 |
| mapping_id | UUID | 否 | 指定已有映射模板 ID，跳过 LLM 映射 |
| auto_process | bool | 否 | 导入后自动触发 AI 管线，默认 true |

**响应 202**（首次上传新格式，需确认映射）：

```json
{
  "data": {
    "batch_id": "550e8400-e29b-41d4-a716-446655440001",
    "status": "mapping",
    "message": "Schema 映射已生成，请确认后继续导入",
    "mapping_preview_url": "/api/voc/import/550e8400-.../mapping-preview",
    "file_info": {
      "file_name": "dongchedi_reviews.csv",
      "file_size_bytes": 1048576,
      "total_rows": 1523,
      "detected_encoding": "utf-8",
      "detected_format": "csv"
    }
  },
  "meta": {
    "request_id": "req-uuid-001",
    "timestamp": "2026-02-12T10:00:00Z"
  }
}
```

**响应 202**（复用已有模板，直接导入）：

```json
{
  "data": {
    "batch_id": "550e8400-e29b-41d4-a716-446655440002",
    "status": "importing",
    "message": "已匹配映射模板「懂车帝评论数据」，正在导入",
    "matched_mapping": {
      "id": "mapping-uuid-001",
      "name": "懂车帝评论数据",
      "usage_count": 12,
      "confidence": 0.93
    },
    "file_info": {
      "file_name": "dongchedi_reviews_feb.csv",
      "file_size_bytes": 2097152,
      "total_rows": 3021
    }
  },
  "meta": {
    "request_id": "req-uuid-002",
    "timestamp": "2026-02-12T10:05:00Z"
  }
}
```

**错误响应**：

| HTTP 状态码 | 错误码 | 场景 |
|------------|--------|------|
| 400 | `INVALID_FILE_FORMAT` | 文件格式不是 CSV/Excel |
| 400 | `FILE_TOO_LARGE` | 文件超过 50MB |
| 400 | `FILE_ENCODING_ERROR` | 文件编码无法识别 |
| 400 | `EMPTY_FILE` | 文件为空或无有效数据行 |
| 503 | `LLM_UNAVAILABLE` | LLM 服务不可用（Schema 映射失败） |

### 4.3 GET /api/voc/import/{batch_id}/status

**响应 200**：

```json
{
  "data": {
    "batch_id": "550e8400-e29b-41d4-a716-446655440001",
    "status": "processing",
    "source": "csv",
    "file_name": "dongchedi_reviews.csv",
    "progress": {
      "total_count": 1523,
      "new_count": 1200,
      "duplicate_count": 300,
      "failed_count": 23,
      "processed_count": 850,
      "processing_count": 50
    },
    "pipeline_status": {
      "stage1_completed": 800,
      "stage2_completed": 750,
      "stage3_completed": 600
    },
    "created_at": "2026-02-12T10:00:00Z",
    "completed_at": null,
    "estimated_remaining_seconds": 180
  },
  "meta": {
    "request_id": "req-uuid-003",
    "timestamp": "2026-02-12T10:15:00Z"
  }
}
```

### 4.4 GET /api/voc/import/{batch_id}/mapping-preview

**响应 200**：

```json
{
  "data": {
    "batch_id": "550e8400-e29b-41d4-a716-446655440001",
    "source_format": "csv",
    "overall_confidence": 0.87,
    "column_mappings": [
      {
        "source_column": "评论内容",
        "target_field": "raw_text",
        "confidence": 0.95,
        "sample_values": ["这车空间很大，后排坐三个人完全不挤", "油耗偏高，百公里12个油"]
      },
      {
        "source_column": "发布时间",
        "target_field": "metadata.published_at",
        "confidence": 0.88,
        "sample_values": ["2026-01-15", "2026-01-20"]
      },
      {
        "source_column": "用户昵称",
        "target_field": "metadata.author_name",
        "confidence": 0.92,
        "sample_values": ["车友老张", "新手上路"]
      },
      {
        "source_column": "综合评分",
        "target_field": "metadata.rating",
        "confidence": 0.72,
        "sample_values": ["4.5", "3.8"],
        "needs_confirmation": true
      }
    ],
    "unmapped_columns": ["序号", "IP属地"],
    "sample_rows": [
      {"评论内容": "这车空间很大...", "发布时间": "2026-01-15", "用户昵称": "车友老张", "综合评分": "4.5", "序号": "1", "IP属地": "北京"},
      {"评论内容": "油耗偏高...", "发布时间": "2026-01-20", "用户昵称": "新手上路", "综合评分": "3.8", "序号": "2", "IP属地": "上海"}
    ]
  },
  "meta": {
    "request_id": "req-uuid-004",
    "timestamp": "2026-02-12T10:01:00Z"
  }
}
```

### 4.5 POST /api/voc/import/{batch_id}/confirm-mapping

**请求**：

```json
{
  "confirmed_mappings": {
    "评论内容": {"target": "raw_text"},
    "发布时间": {"target": "metadata.published_at"},
    "用户昵称": {"target": "metadata.author_name"},
    "综合评分": {"target": "metadata.rating"}
  },
  "save_as_template": true,
  "template_name": "懂车帝评论数据"
}
```

**响应 200**：

```json
{
  "data": {
    "batch_id": "550e8400-e29b-41d4-a716-446655440001",
    "status": "importing",
    "message": "映射已确认，开始导入",
    "mapping_id": "mapping-uuid-001",
    "template_saved": true
  },
  "meta": {
    "request_id": "req-uuid-005",
    "timestamp": "2026-02-12T10:02:00Z"
  }
}
```

### 4.6 POST /api/voc/search

**请求**：

```json
{
  "query": "支付卡顿",
  "top_k": 20,
  "min_confidence": 0.5,
  "filters": {
    "sentiment": ["negative"],
    "tags": ["支付体验"],
    "date_range": {
      "start": "2026-01-01",
      "end": "2026-02-12"
    }
  },
  "rerank": true
}
```

**响应 200**：

```json
{
  "data": {
    "query": "支付卡顿",
    "total": 15,
    "results": [
      {
        "unit_id": "unit-uuid-001",
        "text": "结账的时候页面转了好久的菊花，等了快一分钟才成功",
        "summary": "结账页面长时间加载，等待近一分钟",
        "intent": "complaint",
        "sentiment": "negative",
        "confidence": 0.91,
        "confidence_tier": "high",
        "similarity_score": 0.89,
        "rerank_score": 0.93,
        "tags": [
          {"id": "tag-uuid-001", "name": "支付体验", "relevance": 0.95, "is_primary": true},
          {"id": "tag-uuid-002", "name": "页面卡顿", "relevance": 0.88, "is_primary": false}
        ],
        "voice": {
          "id": "voice-uuid-001",
          "source": "csv",
          "created_at": "2026-01-15T08:30:00Z"
        }
      },
      {
        "unit_id": "unit-uuid-002",
        "text": "付款的时候直接卡死了，只能杀掉重开",
        "summary": "付款时应用无响应，需要强制重启",
        "intent": "complaint",
        "sentiment": "negative",
        "confidence": 0.88,
        "confidence_tier": "high",
        "similarity_score": 0.85,
        "rerank_score": 0.87,
        "tags": [
          {"id": "tag-uuid-001", "name": "支付体验", "relevance": 0.92, "is_primary": true},
          {"id": "tag-uuid-003", "name": "应用崩溃", "relevance": 0.80, "is_primary": false}
        ],
        "voice": {
          "id": "voice-uuid-002",
          "source": "csv",
          "created_at": "2026-01-18T14:20:00Z"
        }
      }
    ]
  },
  "meta": {
    "request_id": "req-uuid-010",
    "timestamp": "2026-02-12T10:30:00Z",
    "search_time_ms": 320
  }
}
```

**错误响应**：

| HTTP 状态码 | 错误码 | 场景 |
|------------|--------|------|
| 400 | `EMPTY_QUERY` | 搜索词为空 |
| 400 | `QUERY_TOO_LONG` | 搜索词超过 500 字符 |
| 503 | `EMBEDDING_UNAVAILABLE` | embedding 槽位不可用 |
| 503 | `RERANK_UNAVAILABLE` | rerank 槽位不可用（仅 rerank=true 时） |

### 4.7 GET /api/voc/tags

**查询参数**：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| page | int | 1 | 页码 |
| page_size | int | 20 | 每页数量（最大 100） |
| sort_by | string | usage_count | 排序字段：usage_count / confidence / created_at |
| sort_order | string | desc | 排序方向：asc / desc |
| status | string | active | 标签状态过滤 |
| min_usage | int | 0 | 最小使用次数 |
| confidence_tier | string | - | 置信度档位过滤：high / medium / low |

**响应 200**：

```json
{
  "data": [
    {
      "id": "tag-uuid-001",
      "name": "支付体验",
      "raw_name": "支付体验问题",
      "usage_count": 156,
      "status": "active",
      "confidence": 0.91,
      "confidence_tier": "high",
      "parent_tag_id": null,
      "feedback_summary": {
        "useful": 12,
        "useless": 1,
        "error": 0
      },
      "created_at": "2026-01-10T08:00:00Z"
    },
    {
      "id": "tag-uuid-004",
      "name": "发动机异响",
      "raw_name": "发动机有异响嗡嗡声",
      "usage_count": 89,
      "status": "active",
      "confidence": 0.78,
      "confidence_tier": "medium",
      "parent_tag_id": null,
      "feedback_summary": {
        "useful": 8,
        "useless": 2,
        "error": 1
      },
      "created_at": "2026-01-12T09:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 87
  },
  "meta": {
    "request_id": "req-uuid-020",
    "timestamp": "2026-02-12T11:00:00Z"
  }
}
```

### 4.8 GET /api/voc/tags/{id}/units

**查询参数**：page, page_size, min_relevance（默认 0.5）

**响应 200**：

```json
{
  "data": {
    "tag": {
      "id": "tag-uuid-001",
      "name": "支付体验",
      "usage_count": 156
    },
    "units": [
      {
        "id": "unit-uuid-001",
        "text": "结账的时候页面转了好久的菊花",
        "summary": "结账页面长时间加载",
        "intent": "complaint",
        "sentiment": "negative",
        "confidence": 0.91,
        "confidence_tier": "high",
        "relevance": 0.95,
        "is_primary": true,
        "voice_id": "voice-uuid-001"
      }
    ]
  },
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 156
  },
  "meta": {
    "request_id": "req-uuid-021",
    "timestamp": "2026-02-12T11:05:00Z"
  }
}
```

### 4.9 POST /api/voc/tags/{id}/feedback

**请求**：

```json
{
  "feedback_type": "useful"
}
```

**响应 200**（新建反馈）：

```json
{
  "data": {
    "id": "feedback-uuid-001",
    "tag_id": "tag-uuid-001",
    "user_id": "user-uuid-001",
    "feedback_type": "useful",
    "created_at": "2026-02-12T11:10:00Z"
  },
  "meta": {
    "request_id": "req-uuid-022",
    "timestamp": "2026-02-12T11:10:00Z"
  }
}
```

**响应 200**（更新已有反馈）：

```json
{
  "data": {
    "id": "feedback-uuid-001",
    "tag_id": "tag-uuid-001",
    "user_id": "user-uuid-001",
    "feedback_type": "error",
    "created_at": "2026-02-12T11:10:00Z",
    "updated_at": "2026-02-12T11:15:00Z",
    "previous_feedback_type": "useful"
  },
  "meta": {
    "request_id": "req-uuid-023",
    "timestamp": "2026-02-12T11:15:00Z"
  }
}
```

**错误响应**：

| HTTP 状态码 | 错误码 | 场景 |
|------------|--------|------|
| 400 | `INVALID_FEEDBACK_TYPE` | feedback_type 不在 useful/useless/error 中 |
| 404 | `TAG_NOT_FOUND` | 标签不存在 |

### 4.10 GET /api/voc/tags/compare

**查询参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| preset_taxonomy | JSON string | 预设分类体系（关键词列表） |
| page | int | 页码 |
| page_size | int | 每页数量 |

**响应 200**：

```json
{
  "data": {
    "summary": {
      "total_units": 1500,
      "emergent_coverage": 0.92,
      "preset_coverage": 0.68,
      "emergent_only_count": 360,
      "preset_only_count": 120,
      "both_count": 1020
    },
    "comparisons": [
      {
        "unit_id": "unit-uuid-050",
        "text": "M3芯片发热严重，夏天车内温度很高",
        "emergent_tags": [
          {"name": "芯片散热", "confidence": 0.85}
        ],
        "preset_matches": [
          {"category": "产品质量/车身电子", "match_type": "keyword", "keyword": "芯片"}
        ],
        "verdict": "emergent_better"
      },
      {
        "unit_id": "unit-uuid-051",
        "text": "方向盘异响，过减速带咯吱咯吱的",
        "emergent_tags": [
          {"name": "底盘异响", "confidence": 0.90}
        ],
        "preset_matches": [
          {"category": "产品质量/底盘", "match_type": "keyword", "keyword": "异响"}
        ],
        "verdict": "both_good"
      }
    ]
  },
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 1500
  },
  "meta": {
    "request_id": "req-uuid-030",
    "timestamp": "2026-02-12T12:00:00Z"
  }
}
```

### 4.11 GET /api/voc/units/{id}

**响应 200**：

```json
{
  "data": {
    "id": "unit-uuid-001",
    "voice_id": "voice-uuid-001",
    "text": "结账的时候页面转了好久的菊花，等了快一分钟才成功",
    "summary": "结账页面长时间加载，等待近一分钟",
    "intent": "complaint",
    "sentiment": "negative",
    "confidence": 0.91,
    "confidence_tier": "high",
    "sequence_index": 0,
    "tags": [
      {"id": "tag-uuid-001", "name": "支付体验", "relevance": 0.95, "is_primary": true},
      {"id": "tag-uuid-002", "name": "页面卡顿", "relevance": 0.88, "is_primary": false}
    ],
    "voice": {
      "id": "voice-uuid-001",
      "source": "csv",
      "raw_text": "结账的时候页面转了好久的菊花，等了快一分钟才成功。而且地址选择也不好用，每次都要重新输入。",
      "metadata": {
        "author_name": "匿名用户",
        "rating": 2.5,
        "published_at": "2026-01-15"
      },
      "created_at": "2026-01-15T08:30:00Z"
    },
    "created_at": "2026-01-15T08:31:00Z"
  },
  "meta": {
    "request_id": "req-uuid-040",
    "timestamp": "2026-02-12T12:10:00Z"
  }
}
```

### 4.12 GET /api/voc/voices/{id}

**响应 200**：

```json
{
  "data": {
    "id": "voice-uuid-001",
    "source": "csv",
    "raw_text": "结账的时候页面转了好久的菊花，等了快一分钟才成功。而且地址选择也不好用，每次都要重新输入。",
    "content_hash": "a3f2b8c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1",
    "batch_id": "550e8400-e29b-41d4-a716-446655440001",
    "processed_status": "completed",
    "metadata": {
      "author_name": "匿名用户",
      "rating": 2.5,
      "published_at": "2026-01-15",
      "platform": "dongchedi"
    },
    "units": [
      {
        "id": "unit-uuid-001",
        "text": "结账的时候页面转了好久的菊花，等了快一分钟才成功",
        "summary": "结账页面长时间加载",
        "intent": "complaint",
        "sentiment": "negative",
        "confidence": 0.91,
        "confidence_tier": "high",
        "sequence_index": 0,
        "tags": [
          {"id": "tag-uuid-001", "name": "支付体验", "is_primary": true},
          {"id": "tag-uuid-002", "name": "页面卡顿", "is_primary": false}
        ]
      },
      {
        "id": "unit-uuid-003",
        "text": "地址选择也不好用，每次都要重新输入",
        "summary": "地址选择交互差，需重复输入",
        "intent": "complaint",
        "sentiment": "negative",
        "confidence": 0.87,
        "confidence_tier": "high",
        "sequence_index": 1,
        "tags": [
          {"id": "tag-uuid-005", "name": "地址管理", "is_primary": true}
        ]
      }
    ],
    "created_at": "2026-01-15T08:30:00Z"
  },
  "meta": {
    "request_id": "req-uuid-041",
    "timestamp": "2026-02-12T12:15:00Z"
  }
}
```

### 4.13 全局错误码表

| HTTP | 错误码 | 说明 |
|------|--------|------|
| 400 | `INVALID_FILE_FORMAT` | 文件格式不支持 |
| 400 | `FILE_TOO_LARGE` | 文件超过大小限制 |
| 400 | `FILE_ENCODING_ERROR` | 文件编码无法识别 |
| 400 | `EMPTY_FILE` | 文件为空 |
| 400 | `EMPTY_QUERY` | 搜索词为空 |
| 400 | `QUERY_TOO_LONG` | 搜索词超过 500 字符 |
| 400 | `INVALID_FEEDBACK_TYPE` | 反馈类型无效 |
| 400 | `MAPPING_CONFIRMATION_REQUIRED` | 需要确认映射 |
| 400 | `INVALID_MAPPING` | 映射配置无效（缺少 raw_text 目标） |
| 404 | `BATCH_NOT_FOUND` | 导入批次不存在 |
| 404 | `TAG_NOT_FOUND` | 标签不存在 |
| 404 | `UNIT_NOT_FOUND` | 语义单元不存在 |
| 404 | `VOICE_NOT_FOUND` | Voice 不存在 |
| 409 | `ALL_DUPLICATES` | 全部数据为重复 |
| 503 | `LLM_UNAVAILABLE` | LLM 服务不可用 |
| 503 | `EMBEDDING_UNAVAILABLE` | embedding 槽位不可用 |
| 503 | `RERANK_UNAVAILABLE` | rerank 槽位不可用 |

---

## 5. 核心流程

### 5.1 文件导入全流程

```mermaid
sequenceDiagram
    actor User
    participant Web as Web UI
    participant API as voc-service API
    participant Core as ImportService
    participant Parser as CsvParser/ExcelParser
    participant Mapping as SchemaMappingService
    participant LLM as llm-service
    participant DB as PostgreSQL

    User->>Web: 上传 CSV/Excel 文件
    Web->>API: POST /api/voc/import (multipart)
    API->>Core: handle_import(file)

    Core->>DB: 创建 IngestionBatch(status=pending)
    Core->>Parser: parse_header(file)
    Parser-->>Core: columns: ["评论内容", "发布时间", ...]

    Core->>Mapping: find_matching_template(columns)

    alt 匹配到已有模板
        Mapping-->>Core: SchemaMapping(confidence=0.93)
        Core->>DB: 更新 Batch(status=importing, mapping_id=...)
        Core-->>API: 202 {status: "importing", matched_mapping: {...}}
        Core->>Core: start_import_task(batch_id) [后台]
    else 未匹配到模板
        Core->>Mapping: generate_mapping_via_llm(columns, sample_rows)
        Mapping->>LLM: POST /api/llm/chat (reasoning 槽位)
        LLM-->>Mapping: 映射建议 JSON
        Mapping->>DB: 暂存映射草稿
        Core->>DB: 更新 Batch(status=mapping)
        Core-->>API: 202 {status: "mapping", mapping_preview_url: "..."}
        API-->>Web: 展示映射预览面板
        User->>Web: 确认/修正映射
        Web->>API: POST /api/voc/import/{id}/confirm-mapping
        API->>Core: confirm_mapping(batch_id, mappings)
        Core->>Mapping: save_as_template(mappings, name)
        Core->>DB: 更新 Batch(status=importing)
        Core->>Core: start_import_task(batch_id) [后台]
    end

    Note over Core,DB: === 后台导入任务 ===

    loop 分块读取文件（每 500 行）
        Core->>Parser: parse_chunk(file, offset, limit)
        Parser-->>Core: rows: [{col: val, ...}, ...]
        Core->>Core: apply_mapping(rows, column_mappings)
        Core->>Core: compute_content_hash(raw_text) per row
        Core->>DB: 批量 INSERT voices (ON CONFLICT DO NOTHING)
        DB-->>Core: new_count, duplicate_count
        Core->>DB: 更新 Batch 计数器
    end

    Core->>DB: 更新 Batch(status=processing)

    alt auto_process = true
        Core->>Core: trigger_pipeline(batch_id)
    end

    Core->>DB: 更新 Batch(status=completed, completed_at=now())
```

### 5.2 AI 管线三阶段处理流程

```mermaid
sequenceDiagram
    participant Sched as ProcessingService
    participant S1 as Stage1 SemanticSplitter
    participant S2 as Stage2 TagEmergence
    participant S3 as Stage3 Embedding
    participant Guard as Guards (L1/L2)
    participant LLM as llm-service
    participant DB as PostgreSQL

    Sched->>DB: 查询 pending Voices (batch_size=50)
    DB-->>Sched: voices[]

    loop 每条 Voice（并发 concurrency=10）
        Sched->>DB: 更新 Voice(status=processing)

        Note over Sched,Guard: === Stage 1: 语义拆解 ===
        Sched->>S1: split(voice)
        S1->>LLM: POST /api/llm/chat (slot=reasoning)
        LLM-->>S1: JSON {units: [...]}
        S1->>Guard: l1_validate(response, STAGE1_SCHEMA)
        alt L1 校验通过
            Guard-->>S1: valid
        else L1 校验失败
            Guard-->>S1: ValidationError
            S1->>S1: retry_with_simplified_prompt()
            S1->>LLM: POST /api/llm/chat (简化 Prompt)
            LLM-->>S1: JSON
            S1->>Guard: l1_validate(response, STAGE1_SCHEMA)
            alt 再次失败
                S1->>S1: fallback_single_unit(voice)
                Note over S1: 整条 Voice 作为单个 SemanticUnit
            end
        end
        S1->>Guard: l2_semantic_check(voice.raw_text, units)
        Guard->>LLM: POST /api/llm/chat (slot=fast)
        LLM-->>Guard: {consistent: true/false, issues: [...]}
        alt L2 检查不一致
            Guard-->>S1: SemanticInconsistencyWarning
            S1->>S1: 记录警告，不阻塞流程
        end
        S1->>DB: 批量 INSERT semantic_units
        S1-->>Sched: units[]

        Note over Sched,Guard: === Stage 2: 标签涌现 + 标准化 ===
        Sched->>S2: tag(units)
        S2->>LLM: POST /api/llm/chat (slot=reasoning)
        LLM-->>S2: JSON {tags: [{raw_name, ...}, ...]}
        S2->>Guard: l1_validate(response, STAGE2_SCHEMA)
        S2->>S2: normalize_tags(raw_tags)
        S2->>LLM: POST /api/llm/chat (slot=fast)
        Note over S2: 标签标准化：去重 + 同义合并
        LLM-->>S2: JSON {normalized: [...]}
        S2->>DB: UPSERT emergent_tags (ON CONFLICT name DO UPDATE usage_count)
        S2->>DB: INSERT unit_tag_associations
        S2-->>Sched: tags[]

        Note over Sched,Guard: === Stage 3: 向量化 ===
        Sched->>S3: embed(units)
        S3->>LLM: POST /api/llm/embedding (slot=embedding)
        LLM-->>S3: vectors[]
        S3->>DB: UPDATE semantic_units SET embedding = vector
        S3-->>Sched: done

        Sched->>DB: 更新 Voice(status=completed)
    end
```

### 5.3 语义搜索流程

```mermaid
sequenceDiagram
    actor User
    participant API as voc-service API
    participant Search as SearchService
    participant LLM as llm-service
    participant DB as PostgreSQL (pgvector)

    User->>API: POST /api/voc/search {query: "支付卡顿", top_k: 20}
    API->>Search: search(query, params)

    Search->>LLM: POST /api/llm/embedding (slot=embedding)
    Note over Search,LLM: 将查询文本向量化
    LLM-->>Search: query_vector (4096维)

    Search->>DB: SELECT ... FROM semantic_units<br/>ORDER BY embedding <=> query_vector<br/>LIMIT 40
    Note over Search,DB: pgvector ANN 搜索，取 2x top_k 候选
    DB-->>Search: candidate_units[]

    alt rerank = true
        Search->>LLM: POST /api/llm/rerank (slot=rerank)
        Note over Search,LLM: 用 rerank 模型精排
        LLM-->>Search: reranked_scores[]
        Search->>Search: 按 rerank_score 排序，取 top_k
    else rerank = false
        Search->>Search: 按 similarity_score 排序，取 top_k
    end

    Search->>DB: 批量查询关联 tags + voice 信息
    DB-->>Search: enriched_results[]

    Search->>Search: 添加 confidence_tier 计算
    Search-->>API: SearchResponse
    API-->>User: 200 {data: {results: [...]}}
```

### 5.4 Schema 映射匹配流程

```mermaid
sequenceDiagram
    participant Core as ImportService
    participant Mapping as SchemaMappingService
    participant LLM as llm-service
    participant DB as PostgreSQL

    Core->>Mapping: find_or_create_mapping(columns, sample_rows)

    Mapping->>Mapping: column_hash = SHA256(sorted(columns))
    Mapping->>DB: SELECT * FROM schema_mappings<br/>WHERE column_hash = ? AND source_format = ?
    DB-->>Mapping: existing_mappings[]

    alt 精确匹配（column_hash 完全一致）
        Mapping->>DB: UPDATE usage_count += 1
        Mapping-->>Core: {mapping, match_type: "exact"}
    else 无匹配
        Mapping->>Mapping: 构造映射 Prompt（含列名 + 采样数据）
        Mapping->>LLM: POST /api/llm/chat (slot=reasoning)
        LLM-->>Mapping: 映射建议 JSON

        alt overall_confidence >= 0.8
            Mapping-->>Core: {mapping, match_type: "llm_auto", needs_confirmation: false}
        else overall_confidence < 0.8
            Mapping-->>Core: {mapping, match_type: "llm_suggest", needs_confirmation: true}
        end
    end
```

---

## 6. 关键实现

### 6.1 配置项（config.py）

```python
from pydantic_settings import BaseSettings

class VocServiceSettings(BaseSettings):
    """voc-service 配置，通过环境变量或 .env 加载"""

    # === 服务基础 ===
    service_name: str = "voc-service"
    service_port: int = 8003
    debug: bool = False

    # === 数据库 ===
    database_url: str = "postgresql+asyncpg://prism:prism@localhost:5432/prism"
    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_schema: str = "voc"

    # === llm-service 连接 ===
    llm_service_base_url: str = "http://localhost:8001"
    llm_service_timeout_seconds: int = 60
    llm_service_retry_count: int = 3

    # === 文件上传 ===
    max_file_size_bytes: int = 50 * 1024 * 1024  # 50MB
    upload_chunk_size: int = 500                   # 每次解析的行数
    supported_encodings: list[str] = ["utf-8", "gbk", "gb2312", "utf-8-sig"]

    # === AI 管线 ===
    pipeline_concurrency: int = 10                 # 并发处理 Voice 数量
    pipeline_batch_size: int = 50                  # 每次从 DB 取待处理记录数
    pipeline_max_retries: int = 3                  # 单条 Voice 最大重试次数
    embedding_batch_size: int = 20                 # 向量化批次大小
    embedding_dimension: int = 4096                # Qwen-Embedding-8B

    # === Schema 映射 ===
    mapping_confidence_auto_threshold: float = 0.8   # >= 此值自动通过
    mapping_confidence_reject_threshold: float = 0.5  # < 此值拒绝映射
    mapping_sample_rows: int = 10                     # 采样行数

    # === 搜索 ===
    search_max_top_k: int = 100
    search_default_top_k: int = 20
    search_candidate_multiplier: int = 2              # 候选集 = top_k * multiplier
    search_max_query_length: int = 500

    # === 置信度三档 ===
    confidence_high_threshold: float = 0.8
    confidence_medium_threshold: float = 0.6
    # < medium_threshold 为 low

    class Config:
        env_prefix = "VOC_"
        env_file = ".env"
```

### 6.2 FastAPI 入口（main.py）

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from voc_service.config import VocServiceSettings
from voc_service.api.routers import health, import_, search, tags, units, voices
from voc_service.api.exception_handlers import register_exception_handlers


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    settings = VocServiceSettings()
    app.state.settings = settings
    from voc_service.models import init_db_engine
    app.state.db_engine = await init_db_engine(settings)
    yield
    await app.state.db_engine.dispose()


def create_app() -> FastAPI:
    app = FastAPI(
        title="voc-service",
        description="Prism VOC 语义分析引擎",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(import_.router, prefix="/api/voc", tags=["import"])
    app.include_router(search.router, prefix="/api/voc", tags=["search"])
    app.include_router(tags.router, prefix="/api/voc", tags=["tags"])
    app.include_router(units.router, prefix="/api/voc", tags=["units"])
    app.include_router(voices.router, prefix="/api/voc", tags=["voices"])

    register_exception_handlers(app)

    return app


app = create_app()
```

### 6.3 依赖注入（api/deps.py）

```python
from typing import AsyncGenerator
from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from prism_shared.auth.deps import get_current_user
from voc_service.config import VocServiceSettings


async def get_db(request: Request) -> AsyncGenerator[AsyncSession, None]:
    """获取数据库 session"""
    engine = request.app.state.db_engine
    async with AsyncSession(engine, expire_on_commit=False) as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_settings(request: Request) -> VocServiceSettings:
    """获取服务配置"""
    return request.app.state.settings


# 认证依赖（复用 shared 模块）
CurrentUser = Depends(get_current_user)
```

### 6.4 文件解析器（parsers/）

```python
# === parsers/base.py ===

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import BinaryIO


@dataclass
class ParsedHeader:
    """文件头信息"""
    columns: list[str]
    total_rows: int
    detected_encoding: str
    sample_rows: list[dict]


@dataclass
class ParsedChunk:
    """解析分块结果"""
    rows: list[dict[str, str]]
    offset: int
    has_more: bool


class BaseParser(ABC):
    """文件解析器抽象基类"""

    @abstractmethod
    async def parse_header(self, file: BinaryIO, sample_count: int = 10) -> ParsedHeader:
        """解析文件头，返回列信息和采样数据"""
        ...

    @abstractmethod
    async def parse_chunk(self, file: BinaryIO, offset: int, limit: int) -> ParsedChunk:
        """分块解析文件内容"""
        ...

    @abstractmethod
    def supported_extensions(self) -> list[str]:
        """支持的文件扩展名"""
        ...
```

```python
# === parsers/csv_parser.py ===

import csv
import io
import chardet
from typing import BinaryIO
from voc_service.parsers.base import BaseParser, ParsedHeader, ParsedChunk


class CsvParser(BaseParser):
    """CSV 文件流式解析器，支持自动编码检测和分隔符推断"""

    def supported_extensions(self) -> list[str]:
        return [".csv"]

    async def parse_header(self, file: BinaryIO, sample_count: int = 10) -> ParsedHeader:
        raw_bytes = file.read()
        detected = chardet.detect(raw_bytes)
        encoding = detected["encoding"] or "utf-8"

        text = raw_bytes.decode(encoding)
        sniffer = csv.Sniffer()
        dialect = sniffer.sniff(text[:8192])

        reader = csv.DictReader(io.StringIO(text), dialect=dialect)
        columns = reader.fieldnames or []

        sample_rows = []
        total_rows = 0
        for i, row in enumerate(reader):
            total_rows += 1
            if i < sample_count:
                sample_rows.append(dict(row))

        file.seek(0)
        return ParsedHeader(
            columns=list(columns),
            total_rows=total_rows,
            detected_encoding=encoding,
            sample_rows=sample_rows,
        )

    async def parse_chunk(self, file: BinaryIO, offset: int, limit: int) -> ParsedChunk:
        raw_bytes = file.read()
        detected = chardet.detect(raw_bytes)
        encoding = detected["encoding"] or "utf-8"
        text = raw_bytes.decode(encoding)

        reader = csv.DictReader(io.StringIO(text))
        rows = []
        for i, row in enumerate(reader):
            if i < offset:
                continue
            if len(rows) >= limit:
                file.seek(0)
                return ParsedChunk(rows=rows, offset=offset, has_more=True)
            rows.append(dict(row))

        file.seek(0)
        return ParsedChunk(rows=rows, offset=offset, has_more=False)
```

```python
# === parsers/excel_parser.py ===

from typing import BinaryIO
from openpyxl import load_workbook
from voc_service.parsers.base import BaseParser, ParsedHeader, ParsedChunk


class ExcelParser(BaseParser):
    """Excel 文件解析器（openpyxl），仅读取第一个 Sheet"""

    def supported_extensions(self) -> list[str]:
        return [".xlsx", ".xls"]

    async def parse_header(self, file: BinaryIO, sample_count: int = 10) -> ParsedHeader:
        wb = load_workbook(file, read_only=True, data_only=True)
        ws = wb.active
        rows_iter = ws.iter_rows(values_only=True)
        header_row = next(rows_iter, None)
        if header_row is None:
            raise ValueError("Excel 文件为空")

        columns = [str(c) if c is not None else f"column_{i}" for i, c in enumerate(header_row)]

        sample_rows = []
        total_rows = 0
        for row in rows_iter:
            total_rows += 1
            if len(sample_rows) < sample_count:
                row_dict = {columns[i]: str(v) if v is not None else "" for i, v in enumerate(row)}
                sample_rows.append(row_dict)

        wb.close()
        file.seek(0)
        return ParsedHeader(columns=columns, total_rows=total_rows, detected_encoding="utf-8", sample_rows=sample_rows)

    async def parse_chunk(self, file: BinaryIO, offset: int, limit: int) -> ParsedChunk:
        wb = load_workbook(file, read_only=True, data_only=True)
        ws = wb.active
        rows_iter = ws.iter_rows(values_only=True)
        header_row = next(rows_iter, None)
        columns = [str(c) if c is not None else f"column_{i}" for i, c in enumerate(header_row)]

        rows = []
        for i, row in enumerate(rows_iter):
            if i < offset:
                continue
            if len(rows) >= limit:
                wb.close()
                file.seek(0)
                return ParsedChunk(rows=rows, offset=offset, has_more=True)
            row_dict = {columns[j]: str(v) if v is not None else "" for j, v in enumerate(row)}
            rows.append(row_dict)

        wb.close()
        file.seek(0)
        return ParsedChunk(rows=rows, offset=offset, has_more=False)
```

### 6.5 LLM 客户端封装（pipeline/llm_client.py）

```python
import httpx
from typing import Any
from voc_service.config import VocServiceSettings


class LLMClient:
    """llm-service HTTP 客户端封装"""

    def __init__(self, settings: VocServiceSettings):
        self._base_url = settings.llm_service_base_url
        self._timeout = settings.llm_service_timeout_seconds
        self._retry_count = settings.llm_service_retry_count
        self._client = httpx.AsyncClient(
            base_url=self._base_url,
            timeout=httpx.Timeout(self._timeout),
        )

    async def chat(
        self,
        *,
        slot: str,
        messages: list[dict],
        temperature: float = 0.7,
        max_tokens: int = 4096,
        response_format: dict | None = None,
    ) -> dict[str, Any]:
        """
        调用 llm-service Chat API。

        Args:
            slot: 模型槽位（"reasoning" | "fast"）
            messages: OpenAI 格式消息列表
            temperature: 生成温度
            max_tokens: 最大 token 数
            response_format: JSON mode 配置

        Raises:
            LLMUnavailableError: llm-service 不可用
            LLMResponseError: LLM 返回非预期格式
        """
        payload: dict[str, Any] = {
            "slot": slot,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": False,
        }
        if response_format:
            payload["response_format"] = response_format

        last_error: Exception | None = None
        for attempt in range(self._retry_count):
            try:
                resp = await self._client.post("/api/llm/chat", json=payload)
                resp.raise_for_status()
                return resp.json()["data"]
            except httpx.HTTPStatusError as e:
                last_error = e
                if e.response.status_code < 500:
                    raise LLMResponseError(f"LLM 请求错误: {e.response.text}") from e
            except httpx.RequestError as e:
                last_error = e

        raise LLMUnavailableError(
            f"llm-service 不可用，已重试 {self._retry_count} 次"
        ) from last_error

    async def embedding(self, *, texts: list[str]) -> list[list[float]]:
        """调用 llm-service Embedding API，返回 4096 维向量列表"""
        resp = await self._client.post("/api/llm/embedding", json={"input": texts})
        resp.raise_for_status()
        return [item["embedding"] for item in resp.json()["data"]["data"]]

    async def rerank(
        self, *, query: str, documents: list[str], top_n: int | None = None,
    ) -> list[dict]:
        """调用 llm-service Rerank API"""
        payload: dict[str, Any] = {"query": query, "documents": documents}
        if top_n:
            payload["top_n"] = top_n
        resp = await self._client.post("/api/llm/rerank", json=payload)
        resp.raise_for_status()
        return resp.json()["data"]["results"]

    async def close(self):
        await self._client.aclose()


class LLMUnavailableError(Exception):
    """llm-service 不可用"""

class LLMResponseError(Exception):
    """LLM 返回非预期响应"""
```

### 6.6 Prompt 模板

#### 6.6.1 Schema 映射 Prompt（prompts/schema_mapping_v1.py）

```python
SCHEMA_MAPPING_SYSTEM_PROMPT = """你是一个数据 Schema 映射专家。你的任务是分析用户上传的数据文件的列名和采样数据，
将其映射到 VOC（客户声音）系统的标准字段。

## 标准目标字段

必选字段：
- raw_text: 客户反馈的原始文本内容（必须映射，一条数据只有一个主文本字段）

可选字段：
- metadata.published_at: 发布/评论时间
- metadata.author_name: 作者名称/昵称
- metadata.author_id: 作者 ID
- metadata.rating: 评分（数值型）
- metadata.platform: 来源平台名称
- metadata.url: 原始链接
- metadata.category: 分类信息
- metadata.[自定义]: 其他有意义的字段

## 输出格式
严格输出 JSON：
{
  "mappings": {
    "原始列名": {"target": "目标字段名", "confidence": 0.0-1.0, "reasoning": "映射理由"}
  },
  "unmapped_columns": ["无法映射的列名"],
  "overall_confidence": 0.0-1.0,
  "notes": "整体映射说明"
}

## 规则
1. raw_text 映射的 confidence 必须 >= 0.7，否则整体映射失败
2. 数值型评分字段映射到 metadata.rating
3. 时间类字段映射到 metadata.published_at
4. 无法判断含义的列放入 unmapped_columns
5. ID 类、序号类无业务意义的列放入 unmapped_columns"""


def build_schema_mapping_prompt(
    columns: list[str],
    sample_rows: list[dict],
    source_format: str,
) -> list[dict]:
    """构建 Schema 映射 Prompt"""
    sample_text = ""
    for i, row in enumerate(sample_rows[:5]):
        sample_text += f"\n第 {i+1} 行: {row}"

    user_prompt = f"""请分析以下 {source_format.upper()} 文件的结构，并映射到 VOC 标准字段。

## 列名
{columns}

## 采样数据（前 5 行）
{sample_text}

请输出映射 JSON。"""

    return [
        {"role": "system", "content": SCHEMA_MAPPING_SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]
```

#### 6.6.2 Stage 1 语义拆解 Prompt（prompts/stage1_splitting_v1.py）

```python
STAGE1_SYSTEM_PROMPT = """你是一个语义分析专家，擅长从客户反馈中提取结构化的语义单元。

## 任务
将一条客户反馈文本拆解为多个独立的「语义单元」。每个语义单元表达一个完整的独立观点或诉求。

## 语义单元结构
- text: 原文中对应的文本片段
- summary: 一句话摘要（不超过 50 字）
- intent: 用户意图（complaint/suggestion/praise/inquiry/comparison/experience 等）
- sentiment: 情感倾向（positive/negative/neutral/mixed）
- confidence: 置信度（0.0-1.0）

## 规则
1. 一条反馈拆解为 1-10 个语义单元
2. 每个语义单元必须独立可理解
3. 不要遗漏信息
4. 纯寒暄/语气词可忽略
5. 如果原文只表达一个观点，输出 1 个语义单元

## 输出格式
严格输出 JSON：
{
  "units": [
    {"text": "...", "summary": "...", "intent": "...", "sentiment": "...", "confidence": 0.0-1.0}
  ]
}"""

STAGE1_SIMPLIFIED_SYSTEM_PROMPT = """你是语义分析专家。将客户反馈拆解为语义单元。
输出 JSON：{"units": [{"text": "...", "summary": "...", "intent": "...", "sentiment": "positive|negative|neutral|mixed", "confidence": 0.0-1.0}]}"""


def build_stage1_prompt(raw_text: str) -> list[dict]:
    """构建 Stage 1 语义拆解 Prompt"""
    return [
        {"role": "system", "content": STAGE1_SYSTEM_PROMPT},
        {"role": "user", "content": f"请拆解以下客户反馈：\n\n{raw_text}"},
    ]


def build_stage1_simplified_prompt(raw_text: str) -> list[dict]:
    """降级用简化 Prompt"""
    return [
        {"role": "system", "content": STAGE1_SIMPLIFIED_SYSTEM_PROMPT},
        {"role": "user", "content": raw_text},
    ]
```

#### 6.6.3 Stage 2 标签涌现 Prompt（prompts/stage2_tagging_v1.py）

```python
STAGE2_TAGGING_SYSTEM_PROMPT = """你是一个 VOC 标签生成专家。为语义单元生成「涌现标签」。

## 什么是涌现标签？
不从预设分类中选择，而是从数据中自由发现语义主题。

## 规则
1. 每个语义单元 1-3 个标签
2. 标签具体、有信息量（"支付页面加载慢"而非"用户体验差"）
3. 第一个标签为 is_primary: true
4. 标签名 2-8 个字，不超过 20 字符
5. 标签应可跨反馈复用

## 输出格式
{
  "tagged_units": [
    {"unit_index": 0, "tags": [{"raw_name": "...", "relevance": 0.0-1.0, "is_primary": true, "confidence": 0.0-1.0}]}
  ]
}"""


def build_stage2_tagging_prompt(units: list[dict]) -> list[dict]:
    """构建 Stage 2 标签涌现 Prompt"""
    units_text = ""
    for i, unit in enumerate(units):
        units_text += f"\n[{i}] 文本: {unit['text']}\n    摘要: {unit['summary']}\n    意图: {unit['intent']}\n    情感: {unit['sentiment']}\n"

    return [
        {"role": "system", "content": STAGE2_TAGGING_SYSTEM_PROMPT},
        {"role": "user", "content": f"请为以下语义单元生成涌现标签：\n{units_text}"},
    ]
```

#### 6.6.4 标签标准化 Prompt（prompts/stage2_normalize_v1.py）

```python
NORMALIZE_SYSTEM_PROMPT = """你是标签标准化专家。将原始标签名称标准化为简洁一致的形式。

## 规则
1. 去除冗余修饰词（"的问题"、"比较"、"有点"等）
2. 同义标签合并（"加载慢""响应慢""打开速度慢" -> "页面加载慢"）
3. 名词短语优先（"电池续航"而非"电池续航不够"）
4. 保持具体性，不过度抽象

## 输出格式
{"normalized": [{"raw_name": "...", "normalized_name": "...", "merged_into": "合并目标或null"}]}"""


def build_normalize_prompt(
    raw_tag_names: list[str],
    existing_tags: list[str] | None = None,
) -> list[dict]:
    """构建标签标准化 Prompt"""
    user_content = f"请标准化以下标签：\n{raw_tag_names}"
    if existing_tags:
        user_content += f"\n\n系统中已有标签（优先合并到这些标签）：\n{existing_tags[:100]}"
    return [
        {"role": "system", "content": NORMALIZE_SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]
```

#### 6.6.5 L2 语义一致性 Prompt（prompts/guard_l2_v1.py）

```python
GUARD_L2_SYSTEM_PROMPT = """你是语义一致性审核员。判断 AI 生成的语义拆解结果是否与原文一致。

## 检查项
1. 信息完整性：原文中所有实质性内容是否都被覆盖？
2. 信息准确性：拆解结果是否歪曲了原文的意思？
3. 情感一致性：情感判断是否与原文语气一致？
4. 无中生有：是否添加了原文中不存在的信息？

## 输出格式
{
  "consistent": true/false,
  "confidence": 0.0-1.0,
  "issues": [{"type": "missing_info|distortion|sentiment_mismatch|hallucination", "description": "...", "severity": "low|medium|high"}]
}"""


def build_guard_l2_prompt(raw_text: str, units: list[dict]) -> list[dict]:
    """构建 L2 语义一致性检查 Prompt"""
    units_text = ""
    for i, unit in enumerate(units):
        units_text += f"\n[{i}] {unit['text']} (意图: {unit['intent']}, 情感: {unit['sentiment']})"
    return [
        {"role": "system", "content": GUARD_L2_SYSTEM_PROMPT},
        {"role": "user", "content": f"原文：\n{raw_text}\n\nAI 拆解结果：{units_text}\n\n请审核一致性。"},
    ]
```

#### 6.6.6 合成数据 Prompt（prompts/synthetic_data_v1.py）

```python
SYNTHETIC_DATA_SYSTEM_PROMPT = """你是合成数据生成专家。生成高质量的模拟客户反馈数据（VOC）。

## 要求
1. 覆盖多种表达风格（口语化、正式、简短、详细）
2. 情感分布自然（约 40% 负面、30% 正面、20% 中性、10% 混合）
3. 每条反馈 20-200 字
4. 约 30% 为包含多个独立观点的复合反馈
5. 覆盖指定的行业和主题范围

## 输出格式
{"voices": [{"raw_text": "...", "metadata": {"synthetic": true, "theme": "...", "expected_sentiment": "..."}}]}"""


def build_synthetic_data_prompt(
    industry: str, themes: list[str], count: int = 50,
) -> list[dict]:
    """构建合成数据生成 Prompt"""
    return [
        {"role": "system", "content": SYNTHETIC_DATA_SYSTEM_PROMPT},
        {"role": "user", "content": f"请为「{industry}」行业生成 {count} 条模拟客户反馈。\n覆盖主题：{themes}\n输出 JSON。"},
    ]
```

### 6.7 核心服务实现

#### 6.7.1 导入服务（core/import_service.py）

```python
import hashlib
import asyncio
from uuid import UUID
from typing import BinaryIO

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert

from voc_service.config import VocServiceSettings
from voc_service.models.voice import Voice
from voc_service.models.ingestion_batch import IngestionBatch
from voc_service.parsers.base import BaseParser
from voc_service.parsers.csv_parser import CsvParser
from voc_service.parsers.excel_parser import ExcelParser
from voc_service.core.schema_mapping_service import SchemaMappingService
from voc_service.core.processing_service import ProcessingService


class ImportService:
    """文件导入编排服务"""

    def __init__(
        self,
        db: AsyncSession,
        settings: VocServiceSettings,
        mapping_service: SchemaMappingService,
        processing_service: ProcessingService,
    ):
        self._db = db
        self._settings = settings
        self._mapping_service = mapping_service
        self._processing_service = processing_service
        self._parsers: dict[str, BaseParser] = {"csv": CsvParser(), "excel": ExcelParser()}

    async def handle_import(
        self,
        *,
        file: BinaryIO,
        file_name: str,
        file_size: int,
        source: str | None = None,
        mapping_id: UUID | None = None,
        auto_process: bool = True,
    ) -> dict:
        """
        处理文件导入请求。

        流程：
        1. 检测文件格式 -> 选择解析器
        2. 解析文件头（列名 + 采样）
        3. 查找或生成 Schema 映射
        4. 如需确认映射 -> 返回 202 (mapping)
        5. 如映射就绪 -> 创建后台导入任务
        """
        fmt = self._detect_format(file_name)
        parser = self._parsers.get(fmt)
        if parser is None:
            raise InvalidFileFormatError(f"不支持的文件格式: {file_name}")

        header = await parser.parse_header(file, sample_count=self._settings.mapping_sample_rows)
        if not header.columns or header.total_rows == 0:
            raise EmptyFileError("文件为空或无有效数据行")

        batch = IngestionBatch(
            source=source or fmt, file_name=file_name,
            file_size_bytes=file_size, total_count=header.total_rows, status="pending",
        )
        self._db.add(batch)
        await self._db.flush()

        if mapping_id:
            mapping_result = await self._mapping_service.get_mapping(mapping_id)
        else:
            mapping_result = await self._mapping_service.find_or_create_mapping(
                columns=header.columns, sample_rows=header.sample_rows, source_format=fmt,
            )

        if mapping_result.needs_confirmation:
            batch.status = "mapping"
            batch.mapping_id = mapping_result.mapping.id
            await self._db.flush()
            return {"batch_id": batch.id, "status": "mapping",
                    "mapping_preview_url": f"/api/voc/import/{batch.id}/mapping-preview"}

        batch.status = "importing"
        batch.mapping_id = mapping_result.mapping.id
        await self._db.flush()
        asyncio.create_task(
            self._import_task(batch.id, file, parser, mapping_result.mapping, auto_process)
        )
        return {"batch_id": batch.id, "status": "importing", "matched_mapping": mapping_result.to_dict()}

    async def _import_task(self, batch_id, file, parser, mapping, auto_process):
        """后台导入任务：分块读取 -> 映射 -> 去重(ON CONFLICT DO NOTHING) -> 入库"""
        offset = 0
        chunk_size = self._settings.upload_chunk_size
        new_total = dup_total = fail_total = 0

        try:
            while True:
                chunk = await parser.parse_chunk(file, offset, chunk_size)
                voices_to_insert = []
                for row in chunk.rows:
                    try:
                        raw_text, metadata = self._apply_mapping(row, mapping.column_mappings)
                        if not raw_text or not raw_text.strip():
                            fail_total += 1
                            continue
                        content_hash = hashlib.sha256(raw_text.encode("utf-8")).hexdigest()
                        voices_to_insert.append({
                            "source": mapping.source_format, "raw_text": raw_text,
                            "content_hash": content_hash, "batch_id": batch_id, "metadata": metadata,
                        })
                    except Exception:
                        fail_total += 1

                if voices_to_insert:
                    stmt = pg_insert(Voice).values(voices_to_insert)
                    stmt = stmt.on_conflict_do_nothing(index_elements=["content_hash"])
                    result = await self._db.execute(stmt)
                    new_total += result.rowcount
                    dup_total += len(voices_to_insert) - result.rowcount

                offset += chunk_size
                if not chunk.has_more:
                    break

            if auto_process and new_total > 0:
                await self._processing_service.process_batch(batch_id)
        except Exception as e:
            await self._update_batch_status(batch_id, "failed", str(e))

    def _apply_mapping(self, row: dict, column_mappings: dict) -> tuple[str, dict]:
        """应用 Schema 映射，返回 (raw_text, metadata)"""
        raw_text = ""
        metadata = {}
        for col_name, mapping_info in column_mappings.items():
            if col_name not in row:
                continue
            value = row[col_name]
            target = mapping_info["target"] if isinstance(mapping_info, dict) else mapping_info
            if target == "raw_text":
                raw_text = value
            elif target.startswith("metadata."):
                metadata[target.split(".", 1)[1]] = value
        return raw_text, metadata

    @staticmethod
    def _detect_format(file_name: str) -> str:
        lower = file_name.lower()
        if lower.endswith(".csv"):
            return "csv"
        elif lower.endswith((".xlsx", ".xls")):
            return "excel"
        raise InvalidFileFormatError(f"不支持的文件格式: {file_name}")

    async def _update_batch_status(self, batch_id, status, error=None):
        stmt = select(IngestionBatch).where(IngestionBatch.id == batch_id)
        result = await self._db.execute(stmt)
        batch = result.scalar_one()
        batch.status = status
        if error:
            batch.error_message = error
        if status in ("completed", "failed"):
            from datetime import datetime, timezone
            batch.completed_at = datetime.now(timezone.utc)
        await self._db.flush()


class InvalidFileFormatError(Exception):
    pass

class EmptyFileError(Exception):
    pass
```

#### 6.7.2 Schema 映射服务（core/schema_mapping_service.py）

```python
import hashlib
import json
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from voc_service.models.schema_mapping import SchemaMapping
from voc_service.pipeline.llm_client import LLMClient
from voc_service.prompts.schema_mapping_v1 import build_schema_mapping_prompt
from voc_service.config import VocServiceSettings


@dataclass
class MappingResult:
    mapping: SchemaMapping
    match_type: str        # "exact" | "llm_auto" | "llm_suggest" | "specified"
    needs_confirmation: bool

    def to_dict(self) -> dict:
        return {
            "id": str(self.mapping.id), "name": self.mapping.name,
            "usage_count": self.mapping.usage_count, "confidence": self.mapping.confidence,
            "match_type": self.match_type,
        }


class SchemaMappingService:
    """LLM Schema 映射 + 模板管理"""

    def __init__(self, db: AsyncSession, llm_client: LLMClient, settings: VocServiceSettings):
        self._db = db
        self._llm = llm_client
        self._settings = settings

    async def find_or_create_mapping(
        self, *, columns: list[str], sample_rows: list[dict], source_format: str,
    ) -> MappingResult:
        """查找匹配模板或通过 LLM 生成新映射"""
        column_hash = self._compute_column_hash(columns)

        existing = await self._find_by_column_hash(column_hash, source_format)
        if existing:
            existing.usage_count += 1
            await self._db.flush()
            return MappingResult(mapping=existing, match_type="exact", needs_confirmation=False)

        messages = build_schema_mapping_prompt(columns, sample_rows, source_format)
        response = await self._llm.chat(
            slot="reasoning", messages=messages, temperature=0.3, max_tokens=2048,
        )
        llm_output = self._parse_llm_mapping_response(response)

        mapping = SchemaMapping(
            name=f"自动映射-{source_format}-{len(columns)}列",
            source_format=source_format, column_mappings=llm_output["mappings"],
            created_by="llm", confidence=llm_output.get("overall_confidence", 0.0),
            column_hash=column_hash, sample_data=sample_rows[:5],
        )
        self._db.add(mapping)
        await self._db.flush()

        needs_confirmation = (mapping.confidence or 0.0) < self._settings.mapping_confidence_auto_threshold
        return MappingResult(
            mapping=mapping,
            match_type="llm_auto" if not needs_confirmation else "llm_suggest",
            needs_confirmation=needs_confirmation,
        )

    async def confirm_mapping(self, *, mapping_id: UUID, confirmed_mappings: dict, template_name: str | None = None) -> SchemaMapping:
        """用户确认/修正映射后保存"""
        mapping = (await self._db.execute(select(SchemaMapping).where(SchemaMapping.id == mapping_id))).scalar_one()
        mapping.column_mappings = confirmed_mappings
        mapping.created_by = "llm+user_confirmed"
        if template_name:
            mapping.name = template_name
        mapping.usage_count += 1
        await self._db.flush()
        return mapping

    async def get_mapping(self, mapping_id: UUID) -> MappingResult:
        mapping = (await self._db.execute(select(SchemaMapping).where(SchemaMapping.id == mapping_id))).scalar_one_or_none()
        if not mapping:
            raise MappingNotFoundError(f"映射模板不存在: {mapping_id}")
        mapping.usage_count += 1
        await self._db.flush()
        return MappingResult(mapping=mapping, match_type="specified", needs_confirmation=False)

    async def _find_by_column_hash(self, column_hash, source_format):
        stmt = select(SchemaMapping).where(
            SchemaMapping.column_hash == column_hash, SchemaMapping.source_format == source_format
        ).order_by(SchemaMapping.usage_count.desc()).limit(1)
        return (await self._db.execute(stmt)).scalar_one_or_none()

    @staticmethod
    def _compute_column_hash(columns: list[str]) -> str:
        normalized = sorted([c.strip().lower() for c in columns])
        return hashlib.sha256(json.dumps(normalized).encode()).hexdigest()

    @staticmethod
    def _parse_llm_mapping_response(response: dict) -> dict:
        content = response["choices"][0]["message"]["content"]
        return json.loads(content)


class MappingNotFoundError(Exception):
    pass
```

#### 6.7.3 AI 管线调度服务（core/processing_service.py）

```python
import asyncio
import logging
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from voc_service.config import VocServiceSettings
from voc_service.models.voice import Voice
from voc_service.pipeline.stage1_splitting import SemanticSplitter
from voc_service.pipeline.stage2_tagging import TagEmergenceProcessor
from voc_service.pipeline.stage3_embedding import EmbeddingProcessor
from voc_service.pipeline.llm_client import LLMClient

logger = logging.getLogger(__name__)


class ProcessingService:
    """AI 管线三阶段调度服务"""

    def __init__(self, db: AsyncSession, llm_client: LLMClient, settings: VocServiceSettings):
        self._db = db
        self._settings = settings
        self._splitter = SemanticSplitter(llm_client, settings)
        self._tagger = TagEmergenceProcessor(llm_client, db, settings)
        self._embedder = EmbeddingProcessor(llm_client, db, settings)
        self._semaphore = asyncio.Semaphore(settings.pipeline_concurrency)

    async def process_batch(self, batch_id: UUID) -> dict:
        """
        处理批次中所有 pending Voice。
        按 batch_size 取 -> 并发处理(semaphore) -> Stage 1 -> Stage 2 -> Stage 3
        """
        processed = failed = 0

        while True:
            stmt = (
                select(Voice)
                .where(Voice.batch_id == batch_id, Voice.processed_status == "pending")
                .limit(self._settings.pipeline_batch_size)
                .with_for_update(skip_locked=True)
            )
            voices = (await self._db.execute(stmt)).scalars().all()
            if not voices:
                break

            await self._db.execute(
                update(Voice).where(Voice.id.in_([v.id for v in voices])).values(processed_status="processing")
            )
            await self._db.flush()

            results = await asyncio.gather(
                *[self._process_one(v) for v in voices], return_exceptions=True
            )

            for voice, result in zip(voices, results):
                if isinstance(result, Exception):
                    failed += 1
                    voice.processed_status = "failed"
                    voice.processing_error = str(result)[:1000]
                    voice.retry_count += 1
                    logger.error(f"处理 Voice {voice.id} 失败: {result}")
                else:
                    processed += 1

            await self._db.flush()

        return {"processed": processed, "failed": failed}

    async def _process_one(self, voice: Voice) -> None:
        """单条 Voice 完整管线：Stage 1 -> Stage 2 -> Stage 3"""
        async with self._semaphore:
            units = await self._splitter.split(voice)      # Stage 1
            await self._tagger.tag(units)                  # Stage 2
            await self._embedder.embed(units)              # Stage 3
            voice.processed_status = "completed"
```

#### 6.7.4 Stage 1 语义拆解（pipeline/stage1_splitting.py）

```python
import json
import logging
from uuid import UUID

from voc_service.config import VocServiceSettings
from voc_service.models.voice import Voice
from voc_service.models.semantic_unit import SemanticUnit
from voc_service.pipeline.llm_client import LLMClient
from voc_service.pipeline.guards import FormatGuard, STAGE1_SCHEMA
from voc_service.prompts.stage1_splitting_v1 import build_stage1_prompt, build_stage1_simplified_prompt

logger = logging.getLogger(__name__)


class SemanticSplitter:
    """Stage 1: Voice -> N 个 SemanticUnit（三级降级策略）"""

    def __init__(self, llm_client: LLMClient, settings: VocServiceSettings):
        self._llm = llm_client
        self._settings = settings
        self._guard = FormatGuard()

    async def split(self, voice: Voice) -> list[SemanticUnit]:
        """
        三级降级：
        1. 正常 Prompt + L1 校验
        2. 简化 Prompt + L1 校验
        3. 兜底：整条 Voice 存为单个 SemanticUnit（confidence=0）
        """
        # Level 1
        try:
            messages = build_stage1_prompt(voice.raw_text)
            response = await self._llm.chat(
                slot="reasoning", messages=messages, temperature=0.5,
                max_tokens=4096, response_format={"type": "json_object"},
            )
            parsed = json.loads(response["choices"][0]["message"]["content"])
            self._guard.validate(parsed, STAGE1_SCHEMA)
            return self._create_units(voice.id, parsed["units"])
        except (json.JSONDecodeError, FormatGuard.ValidationError) as e:
            logger.warning(f"Voice {voice.id} L1 校验失败，简化重试: {e}")

        # Level 2
        try:
            messages = build_stage1_simplified_prompt(voice.raw_text)
            response = await self._llm.chat(
                slot="reasoning", messages=messages, temperature=0.3,
                max_tokens=2048, response_format={"type": "json_object"},
            )
            parsed = json.loads(response["choices"][0]["message"]["content"])
            self._guard.validate(parsed, STAGE1_SCHEMA)
            return self._create_units(voice.id, parsed["units"])
        except Exception as e:
            logger.warning(f"Voice {voice.id} 简化重试失败，兜底存储: {e}")

        # Level 3
        return [SemanticUnit(
            voice_id=voice.id, text=voice.raw_text, summary=voice.raw_text[:100],
            intent="unclassified", sentiment="neutral", confidence=0.0, sequence_index=0,
        )]

    def _create_units(self, voice_id: UUID, unit_dicts: list[dict]) -> list[SemanticUnit]:
        return [
            SemanticUnit(
                voice_id=voice_id, text=u["text"], summary=u.get("summary", u["text"][:100]),
                intent=u.get("intent", "unknown"), sentiment=u.get("sentiment", "neutral"),
                confidence=u.get("confidence", 0.5), sequence_index=i,
            )
            for i, u in enumerate(unit_dicts)
        ]
```

#### 6.7.5 Stage 2 标签涌现 + 标准化（pipeline/stage2_tagging.py）

```python
import json
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from voc_service.config import VocServiceSettings
from voc_service.models.semantic_unit import SemanticUnit
from voc_service.models.emergent_tag import EmergentTag
from voc_service.models.unit_tag_association import UnitTagAssociation
from voc_service.pipeline.llm_client import LLMClient
from voc_service.pipeline.guards import FormatGuard, STAGE2_SCHEMA
from voc_service.prompts.stage2_tagging_v1 import build_stage2_tagging_prompt
from voc_service.prompts.stage2_normalize_v1 import build_normalize_prompt

logger = logging.getLogger(__name__)


class TagEmergenceProcessor:
    """Stage 2: 标签涌现（reasoning 槽位） + 标准化（fast 槽位）"""

    def __init__(self, llm_client: LLMClient, db: AsyncSession, settings: VocServiceSettings):
        self._llm = llm_client
        self._db = db
        self._settings = settings
        self._guard = FormatGuard()

    async def tag(self, units: list[SemanticUnit]) -> list[EmergentTag]:
        if not units:
            return []

        # 1. reasoning 槽位生成原始标签
        unit_dicts = [{"text": u.text, "summary": u.summary, "intent": u.intent, "sentiment": u.sentiment} for u in units]
        messages = build_stage2_tagging_prompt(unit_dicts)
        response = await self._llm.chat(
            slot="reasoning", messages=messages, temperature=0.5,
            max_tokens=4096, response_format={"type": "json_object"},
        )
        parsed = json.loads(response["choices"][0]["message"]["content"])
        self._guard.validate(parsed, STAGE2_SCHEMA)

        # 2. fast 槽位标准化
        raw_names = set()
        for tu in parsed["tagged_units"]:
            for t in tu["tags"]:
                raw_names.add(t["raw_name"])

        existing_tags = await self._get_existing_tag_names()
        norm_map = await self._normalize_tags(list(raw_names), existing_tags)

        # 3. UPSERT 标签 + 创建关联
        all_tags = []
        for tu in parsed["tagged_units"]:
            idx = tu["unit_index"]
            if idx >= len(units):
                continue
            unit = units[idx]
            for t in tu["tags"]:
                name = norm_map.get(t["raw_name"], t["raw_name"])
                tag = await self._upsert_tag(name, t["raw_name"], t.get("confidence", 0.5))
                all_tags.append(tag)
                self._db.add(UnitTagAssociation(
                    unit_id=unit.id, tag_id=tag.id,
                    relevance=t.get("relevance", 1.0), is_primary=t.get("is_primary", False),
                ))
        await self._db.flush()
        return all_tags

    async def _normalize_tags(self, raw_names, existing_tags):
        if not raw_names:
            return {}
        messages = build_normalize_prompt(raw_names, existing_tags)
        response = await self._llm.chat(
            slot="fast", messages=messages, temperature=0.2,
            max_tokens=2048, response_format={"type": "json_object"},
        )
        parsed = json.loads(response["choices"][0]["message"]["content"])
        return {
            item["raw_name"]: (item.get("merged_into") or item.get("normalized_name", item["raw_name"]))
            for item in parsed.get("normalized", [])
        }

    async def _upsert_tag(self, name, raw_name, confidence):
        existing = (await self._db.execute(select(EmergentTag).where(EmergentTag.name == name))).scalar_one_or_none()
        if existing:
            existing.usage_count += 1
            return existing
        tag = EmergentTag(name=name, raw_name=raw_name, usage_count=1, confidence=confidence)
        self._db.add(tag)
        await self._db.flush()
        return tag

    async def _get_existing_tag_names(self, limit=200):
        stmt = select(EmergentTag.name).where(EmergentTag.status == "active").order_by(EmergentTag.usage_count.desc()).limit(limit)
        return [r[0] for r in (await self._db.execute(stmt)).all()]
```

#### 6.7.6 Stage 3 向量化（pipeline/stage3_embedding.py）

```python
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from voc_service.config import VocServiceSettings
from voc_service.models.semantic_unit import SemanticUnit
from voc_service.pipeline.llm_client import LLMClient

logger = logging.getLogger(__name__)


class EmbeddingProcessor:
    """Stage 3: SemanticUnit -> embedding vector (Qwen-Embedding-8B, 4096 维)"""

    def __init__(self, llm_client: LLMClient, db: AsyncSession, settings: VocServiceSettings):
        self._llm = llm_client
        self._db = db
        self._batch_size = settings.embedding_batch_size

    async def embed(self, units: list[SemanticUnit]) -> None:
        """批量向量化，按 batch_size 分批调用 embedding 槽位"""
        if not units:
            return
        for i in range(0, len(units), self._batch_size):
            batch = units[i:i + self._batch_size]
            try:
                vectors = await self._llm.embedding(texts=[u.text for u in batch])
                for unit, vector in zip(batch, vectors):
                    unit.embedding = vector
                await self._db.flush()
            except Exception as e:
                logger.error(f"向量化批次失败（{len(batch)} 条）: {e}")
                # 向量化失败不阻塞整体流程，后续可重处理补充
                continue
```

#### 6.7.7 守卫层（pipeline/guards.py）

```python
import json
import logging
import jsonschema
from voc_service.pipeline.llm_client import LLMClient
from voc_service.prompts.guard_l2_v1 import build_guard_l2_prompt

logger = logging.getLogger(__name__)

STAGE1_SCHEMA = {
    "type": "object",
    "required": ["units"],
    "properties": {
        "units": {
            "type": "array", "minItems": 1, "maxItems": 10,
            "items": {
                "type": "object",
                "required": ["text", "summary", "intent", "sentiment", "confidence"],
                "properties": {
                    "text": {"type": "string", "minLength": 1},
                    "summary": {"type": "string", "maxLength": 500},
                    "intent": {"type": "string"},
                    "sentiment": {"enum": ["positive", "negative", "neutral", "mixed"]},
                    "confidence": {"type": "number", "minimum": 0.0, "maximum": 1.0},
                },
            },
        },
    },
}

STAGE2_SCHEMA = {
    "type": "object",
    "required": ["tagged_units"],
    "properties": {
        "tagged_units": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["unit_index", "tags"],
                "properties": {
                    "unit_index": {"type": "integer", "minimum": 0},
                    "tags": {
                        "type": "array", "minItems": 1, "maxItems": 5,
                        "items": {
                            "type": "object",
                            "required": ["raw_name", "relevance", "is_primary"],
                            "properties": {
                                "raw_name": {"type": "string", "minLength": 1, "maxLength": 200},
                                "relevance": {"type": "number", "minimum": 0.0, "maximum": 1.0},
                                "is_primary": {"type": "boolean"},
                                "confidence": {"type": "number", "minimum": 0.0, "maximum": 1.0},
                            },
                        },
                    },
                },
            },
        },
    },
}


class FormatGuard:
    """L1 守卫层：JSON Schema 格式校验"""

    class ValidationError(Exception):
        def __init__(self, message: str, errors: list[str]):
            super().__init__(message)
            self.errors = errors

    def validate(self, data: dict, schema: dict) -> None:
        try:
            jsonschema.validate(data, schema)
        except jsonschema.ValidationError as e:
            raise self.ValidationError(f"L1 格式校验失败: {e.message}", errors=[e.message]) from e


class SemanticGuard:
    """L2 守卫层：语义一致性检查（调用 fast 槽位）"""

    def __init__(self, llm_client: LLMClient):
        self._llm = llm_client

    async def check_consistency(self, raw_text: str, units: list[dict]) -> dict:
        """返回 {"consistent": bool, "confidence": float, "issues": [...]}"""
        messages = build_guard_l2_prompt(raw_text, units)
        response = await self._llm.chat(
            slot="fast", messages=messages, temperature=0.2,
            max_tokens=1024, response_format={"type": "json_object"},
        )
        result = json.loads(response["choices"][0]["message"]["content"])
        if not result.get("consistent", True):
            logger.warning(f"L2 语义一致性问题: {result.get('issues', [])}")
        return result
```

#### 6.7.8 搜索服务（core/search_service.py）

```python
from uuid import UUID
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from voc_service.config import VocServiceSettings
from voc_service.models.emergent_tag import EmergentTag
from voc_service.models.unit_tag_association import UnitTagAssociation
from voc_service.pipeline.llm_client import LLMClient


class SearchService:
    """语义搜索服务：query -> embedding -> pgvector ANN -> (可选 rerank) -> 结果"""

    def __init__(self, db: AsyncSession, llm_client: LLMClient, settings: VocServiceSettings):
        self._db = db
        self._llm = llm_client
        self._settings = settings

    async def vector_search(
        self, *, query: str, top_k: int = 20,
        min_confidence: float = 0.0, filters: dict | None = None, rerank: bool = False,
    ) -> dict:
        # 1. 查询文本向量化
        query_vectors = await self._llm.embedding(texts=[query])
        query_vector = query_vectors[0]

        # 2. pgvector ANN 搜索
        candidate_count = top_k * self._settings.search_candidate_multiplier
        vector_str = "[" + ",".join(str(v) for v in query_vector) + "]"

        sql = text("""
            SELECT su.id, su.text, su.summary, su.intent, su.sentiment,
                   su.confidence, su.voice_id, su.sequence_index,
                   (su.embedding <=> :query_vector::vector) AS distance
            FROM voc.semantic_units su
            WHERE su.embedding IS NOT NULL AND su.confidence >= :min_confidence
            ORDER BY su.embedding <=> :query_vector::vector
            LIMIT :limit
        """)
        candidates = (await self._db.execute(sql, {
            "query_vector": vector_str, "min_confidence": min_confidence, "limit": candidate_count,
        })).fetchall()

        # 3. 可选 rerank
        if rerank and candidates:
            rerank_results = await self._llm.rerank(
                query=query, documents=[r.text for r in candidates], top_n=top_k,
            )
            final = [
                {"row": candidates[rr["index"]], "similarity_score": 1.0 - candidates[rr["index"]].distance, "rerank_score": rr["relevance_score"]}
                for rr in rerank_results
            ]
        else:
            final = [{"row": r, "similarity_score": 1.0 - r.distance, "rerank_score": None} for r in candidates[:top_k]]

        # 4. 补充标签信息
        enriched = []
        for item in final:
            r = item["row"]
            tags = await self._get_unit_tags(r.id)
            enriched.append({
                "unit_id": str(r.id), "text": r.text, "summary": r.summary,
                "intent": r.intent, "sentiment": r.sentiment,
                "confidence": r.confidence,
                "confidence_tier": self._tier(r.confidence),
                "similarity_score": round(item["similarity_score"], 4),
                "rerank_score": round(item["rerank_score"], 4) if item["rerank_score"] else None,
                "tags": tags, "voice": {"id": str(r.voice_id)},
            })
        return {"query": query, "total": len(enriched), "results": enriched}

    async def _get_unit_tags(self, unit_id: UUID) -> list[dict]:
        stmt = (
            select(EmergentTag, UnitTagAssociation)
            .join(UnitTagAssociation, EmergentTag.id == UnitTagAssociation.tag_id)
            .where(UnitTagAssociation.unit_id == unit_id)
            .order_by(UnitTagAssociation.relevance.desc())
        )
        return [
            {"id": str(tag.id), "name": tag.name, "relevance": round(assoc.relevance, 2), "is_primary": assoc.is_primary}
            for tag, assoc in (await self._db.execute(stmt)).all()
        ]

    def _tier(self, confidence):
        if confidence is None:
            return "low"
        if confidence >= self._settings.confidence_high_threshold:
            return "high"
        if confidence >= self._settings.confidence_medium_threshold:
            return "medium"
        return "low"
```

---

## 7. 错误处理与弹性

### 7.1 异常分类体系

```python
# === 基础异常（继承自 shared 模块） ===

class VocServiceError(Exception):
    """voc-service 基础异常"""
    def __init__(self, code: str, message: str, status_code: int = 500):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


# === 文件解析异常（400 系列） ===

class InvalidFileFormatError(VocServiceError):
    def __init__(self, detail: str = ""):
        super().__init__("INVALID_FILE_FORMAT", f"不支持的文件格式: {detail}", 400)

class FileTooLargeError(VocServiceError):
    def __init__(self, size_bytes: int, max_bytes: int):
        super().__init__("FILE_TOO_LARGE", f"文件大小 {size_bytes} 超过限制 {max_bytes}", 400)

class FileEncodingError(VocServiceError):
    def __init__(self):
        super().__init__("FILE_ENCODING_ERROR", "文件编码无法识别，请使用 UTF-8 或 GBK 编码", 400)

class EmptyFileError(VocServiceError):
    def __init__(self):
        super().__init__("EMPTY_FILE", "文件为空或无有效数据行", 400)


# === 映射异常 ===

class MappingConfirmationRequiredError(VocServiceError):
    def __init__(self):
        super().__init__("MAPPING_CONFIRMATION_REQUIRED", "Schema 映射需要人工确认", 400)

class InvalidMappingError(VocServiceError):
    def __init__(self, detail: str = ""):
        super().__init__("INVALID_MAPPING", f"映射配置无效: {detail}", 400)

class MappingNotFoundError(VocServiceError):
    def __init__(self, mapping_id: str):
        super().__init__("MAPPING_NOT_FOUND", f"映射模板不存在: {mapping_id}", 404)


# === 资源不存在（404） ===

class BatchNotFoundError(VocServiceError):
    def __init__(self, batch_id: str):
        super().__init__("BATCH_NOT_FOUND", f"导入批次不存在: {batch_id}", 404)

class TagNotFoundError(VocServiceError):
    def __init__(self, tag_id: str):
        super().__init__("TAG_NOT_FOUND", f"标签不存在: {tag_id}", 404)

class UnitNotFoundError(VocServiceError):
    def __init__(self, unit_id: str):
        super().__init__("UNIT_NOT_FOUND", f"语义单元不存在: {unit_id}", 404)

class VoiceNotFoundError(VocServiceError):
    def __init__(self, voice_id: str):
        super().__init__("VOICE_NOT_FOUND", f"Voice 不存在: {voice_id}", 404)


# === 搜索异常 ===

class EmptyQueryError(VocServiceError):
    def __init__(self):
        super().__init__("EMPTY_QUERY", "搜索词不能为空", 400)

class QueryTooLongError(VocServiceError):
    def __init__(self, length: int, max_length: int):
        super().__init__("QUERY_TOO_LONG", f"搜索词长度 {length} 超过限制 {max_length}", 400)


# === 反馈异常 ===

class InvalidFeedbackTypeError(VocServiceError):
    def __init__(self, feedback_type: str):
        super().__init__("INVALID_FEEDBACK_TYPE", f"无效的反馈类型: {feedback_type}", 400)


# === 上游服务异常（503） ===

class LLMUnavailableError(VocServiceError):
    def __init__(self, detail: str = ""):
        super().__init__("LLM_UNAVAILABLE", f"LLM 服务不可用: {detail}", 503)

class EmbeddingUnavailableError(VocServiceError):
    def __init__(self):
        super().__init__("EMBEDDING_UNAVAILABLE", "向量化服务不可用", 503)

class RerankUnavailableError(VocServiceError):
    def __init__(self):
        super().__init__("RERANK_UNAVAILABLE", "重排序服务不可用", 503)


# === 去重异常 ===

class AllDuplicatesError(VocServiceError):
    def __init__(self):
        super().__init__("ALL_DUPLICATES", "所有数据已存在，无需重复导入", 409)
```

### 7.2 全局异常处理器（api/exception_handlers.py）

```python
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import logging

logger = logging.getLogger(__name__)


def register_exception_handlers(app: FastAPI):
    """注册全局异常处理器"""

    @app.exception_handler(VocServiceError)
    async def voc_error_handler(request: Request, exc: VocServiceError):
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {"code": exc.code, "message": exc.message},
                "meta": {"request_id": getattr(request.state, "request_id", None)},
            },
        )

    @app.exception_handler(Exception)
    async def generic_error_handler(request: Request, exc: Exception):
        logger.exception(f"未捕获异常: {exc}")
        return JSONResponse(
            status_code=500,
            content={
                "error": {"code": "INTERNAL_ERROR", "message": "服务内部错误"},
                "meta": {"request_id": getattr(request.state, "request_id", None)},
            },
        )
```

### 7.3 重试策略

| 场景 | 重试次数 | 退避策略 | 降级行为 |
|------|----------|---------|---------|
| LLM Chat 调用失败（5xx） | 3 次 | 指数退避（1s, 2s, 4s） | 抛出 LLMUnavailableError |
| LLM Embedding 调用失败 | 3 次 | 指数退避 | 跳过该批次，不阻塞主流程 |
| LLM Rerank 调用失败 | 1 次 | 无退避 | 降级为纯向量相似度排序 |
| Stage 1 L1 校验失败 | 1 次（简化 Prompt） | 无退避 | 兜底：整条 Voice 存为单 Unit |
| Stage 2 标签生成失败 | 1 次 | 无退避 | 跳过标签生成，Unit 无标签关联 |
| 文件解析失败 | 0 次 | 无 | 返回错误，终止导入 |
| Schema 映射 LLM 调用失败 | 3 次 | 指数退避 | 返回 503，用户可手动指定映射 |

### 7.4 降级策略详解

#### 7.4.1 AI 管线三级降级

```
Level 1: 正常处理
├── 完整 System Prompt + few-shot 示例（如有）
├── JSON Schema 约束（response_format: json_object）
├── L1 格式校验（jsonschema.validate）
├── L2 语义一致性检查（fast 槽位，不阻塞，仅记录警告）
└── 成功 → SemanticUnit 列表入库

Level 2: 简化重试（L1 校验失败时触发）
├── 精简 System Prompt（去掉 few-shot、减少规则描述）
├── 降低 temperature（0.5 → 0.3）
├── 降低 max_tokens（4096 → 2048）
├── L1 格式校验
└── 成功 → SemanticUnit 列表入库

Level 3: 兜底存储（Level 2 仍失败时触发）
├── 整条 Voice.raw_text 存为单个 SemanticUnit
├── intent = "unclassified"
├── sentiment = "neutral"
├── confidence = 0.0
└── 保证数据不丢失，后续可人工处理或重新提交管线
```

#### 7.4.2 搜索降级

```
正常路径: query → embedding → pgvector ANN → rerank → 返回

降级 1: rerank 不可用
→ 跳过 rerank，直接按 cosine similarity 排序

降级 2: embedding 不可用
→ 返回 503 EMBEDDING_UNAVAILABLE
（搜索功能完全依赖向量化，无法降级为关键词搜索）
```

#### 7.4.3 Schema 映射降级

```
正常路径: LLM reasoning 槽位自动映射

降级 1: LLM 不可用
→ 检查是否有 column_hash 精确匹配的已有模板
→ 有 → 复用模板
→ 无 → 返回 503，提示用户手动指定映射或稍后重试

降级 2: LLM 映射置信度 < 0.5
→ 拒绝映射，提示用户手动指定
```

### 7.5 数据一致性保障

| 场景 | 保障机制 |
|------|---------|
| 导入过程中服务重启 | IngestionBatch.status 停留在 importing/processing；重启后可手动重触发 |
| AI 管线处理到一半失败 | Voice.processed_status = failed + retry_count++；已创建的 SemanticUnit 保留（不回滚） |
| 重复导入 | content_hash UNIQUE 索引 + ON CONFLICT DO NOTHING |
| 标签 UPSERT 竞争 | SELECT ... FOR UPDATE + 乐观锁 usage_count 递增 |
| 反馈 UPSERT 竞争 | UNIQUE(tag_id, user_id) + ON CONFLICT 更新 |

---

## 8. 测试计划

### 8.1 测试层次总览

```
┌─────────────────────────────────────────────────────────┐
│ Layer 3: Golden Dataset 测试（Prompt 变更时触发）          │
│   Prompt 质量回归：拆解质量、标签一致性、映射准确率         │
├─────────────────────────────────────────────────────────┤
│ Layer 2: 集成测试（CI 触发，Mock LLM）                    │
│   端到端流程：导入 → 管线 → 搜索 → 反馈                    │
├─────────────────────────────────────────────────────────┤
│ Layer 1: 单元测试（CI 触发，纯逻辑）                      │
│   解析器、映射、去重、守卫层、置信度计算                     │
└─────────────────────────────────────────────────────────┘
```

### 8.2 单元测试（Layer 1）

**原则**：不调用 LLM、不连接数据库，纯逻辑测试。

#### 8.2.1 文件解析器测试

```python
# tests/unit/test_csv_parser.py

import io
import pytest
from voc_service.parsers.csv_parser import CsvParser


@pytest.fixture
def csv_parser():
    return CsvParser()


class TestCsvParser:
    async def test_parse_header_utf8(self, csv_parser):
        """UTF-8 编码 CSV 文件头解析"""
        content = "评论内容,发布时间,用户\n这车不错,2026-01-01,张三\n油耗高,2026-01-02,李四"
        file = io.BytesIO(content.encode("utf-8"))
        header = await csv_parser.parse_header(file, sample_count=5)
        assert header.columns == ["评论内容", "发布时间", "用户"]
        assert header.total_rows == 2
        assert header.detected_encoding == "utf-8"
        assert len(header.sample_rows) == 2

    async def test_parse_header_gbk(self, csv_parser):
        """GBK 编码 CSV 文件自动检测"""
        content = "评论内容,发布时间\n这车不错,2026-01-01"
        file = io.BytesIO(content.encode("gbk"))
        header = await csv_parser.parse_header(file)
        assert "评论内容" in header.columns

    async def test_parse_chunk(self, csv_parser):
        """分块读取"""
        lines = ["col1,col2"] + [f"val{i},data{i}" for i in range(100)]
        file = io.BytesIO("\n".join(lines).encode("utf-8"))
        chunk = await csv_parser.parse_chunk(file, offset=0, limit=50)
        assert len(chunk.rows) == 50
        assert chunk.has_more is True

    async def test_parse_empty_file(self, csv_parser):
        """空文件处理"""
        file = io.BytesIO(b"")
        header = await csv_parser.parse_header(file)
        assert header.total_rows == 0
```

```python
# tests/unit/test_excel_parser.py

import pytest
from voc_service.parsers.excel_parser import ExcelParser


class TestExcelParser:
    async def test_parse_header(self, tmp_path):
        """Excel 文件头解析"""
        # 使用 openpyxl 创建测试文件
        from openpyxl import Workbook
        wb = Workbook()
        ws = wb.active
        ws.append(["评论内容", "评分", "日期"])
        ws.append(["很好", "5", "2026-01-01"])
        ws.append(["一般", "3", "2026-01-02"])
        path = tmp_path / "test.xlsx"
        wb.save(path)

        parser = ExcelParser()
        with open(path, "rb") as f:
            header = await parser.parse_header(f)
        assert header.columns == ["评论内容", "评分", "日期"]
        assert header.total_rows == 2

    async def test_supported_extensions(self):
        parser = ExcelParser()
        assert ".xlsx" in parser.supported_extensions()
        assert ".xls" in parser.supported_extensions()
```

#### 8.2.2 去重逻辑测试

```python
# tests/unit/test_deduplication.py

import hashlib
import pytest


class TestDeduplication:
    def test_content_hash_deterministic(self):
        """同一内容生成相同 hash"""
        text = "这车空间很大，后排坐三个人完全不挤"
        hash1 = hashlib.sha256(text.encode("utf-8")).hexdigest()
        hash2 = hashlib.sha256(text.encode("utf-8")).hexdigest()
        assert hash1 == hash2

    def test_content_hash_different(self):
        """不同内容生成不同 hash"""
        hash1 = hashlib.sha256("文本A".encode("utf-8")).hexdigest()
        hash2 = hashlib.sha256("文本B".encode("utf-8")).hexdigest()
        assert hash1 != hash2

    def test_content_hash_whitespace_sensitive(self):
        """hash 对空格敏感（不做 trim，保持精确去重）"""
        hash1 = hashlib.sha256("文本A ".encode("utf-8")).hexdigest()
        hash2 = hashlib.sha256("文本A".encode("utf-8")).hexdigest()
        assert hash1 != hash2
```

#### 8.2.3 守卫层测试

```python
# tests/unit/test_guards.py

import pytest
from voc_service.pipeline.guards import FormatGuard, STAGE1_SCHEMA, STAGE2_SCHEMA


class TestFormatGuard:
    @pytest.fixture
    def guard(self):
        return FormatGuard()

    def test_stage1_valid(self, guard):
        """合法的 Stage 1 输出"""
        data = {
            "units": [
                {"text": "文本", "summary": "摘要", "intent": "complaint",
                 "sentiment": "negative", "confidence": 0.9}
            ]
        }
        guard.validate(data, STAGE1_SCHEMA)  # 不抛异常

    def test_stage1_missing_required(self, guard):
        """缺少必填字段"""
        data = {"units": [{"text": "文本"}]}
        with pytest.raises(FormatGuard.ValidationError):
            guard.validate(data, STAGE1_SCHEMA)

    def test_stage1_invalid_sentiment(self, guard):
        """非法的 sentiment 值"""
        data = {
            "units": [
                {"text": "x", "summary": "x", "intent": "x",
                 "sentiment": "angry", "confidence": 0.5}
            ]
        }
        with pytest.raises(FormatGuard.ValidationError):
            guard.validate(data, STAGE1_SCHEMA)

    def test_stage1_confidence_out_of_range(self, guard):
        """置信度超出范围"""
        data = {
            "units": [
                {"text": "x", "summary": "x", "intent": "x",
                 "sentiment": "positive", "confidence": 1.5}
            ]
        }
        with pytest.raises(FormatGuard.ValidationError):
            guard.validate(data, STAGE1_SCHEMA)

    def test_stage2_valid(self, guard):
        """合法的 Stage 2 输出"""
        data = {
            "tagged_units": [
                {"unit_index": 0, "tags": [
                    {"raw_name": "标签名", "relevance": 0.9, "is_primary": True, "confidence": 0.8}
                ]}
            ]
        }
        guard.validate(data, STAGE2_SCHEMA)

    def test_stage1_empty_units(self, guard):
        """空 units 列表"""
        data = {"units": []}
        with pytest.raises(FormatGuard.ValidationError):
            guard.validate(data, STAGE1_SCHEMA)
```

#### 8.2.4 Schema 映射逻辑测试

```python
# tests/unit/test_schema_mapping.py

import pytest
from voc_service.core.schema_mapping_service import SchemaMappingService


class TestColumnHash:
    def test_hash_order_independent(self):
        """列名顺序不影响 hash"""
        hash1 = SchemaMappingService._compute_column_hash(["评论", "时间", "用户"])
        hash2 = SchemaMappingService._compute_column_hash(["用户", "评论", "时间"])
        assert hash1 == hash2

    def test_hash_case_insensitive(self):
        """列名大小写不影响 hash"""
        hash1 = SchemaMappingService._compute_column_hash(["Content", "Date"])
        hash2 = SchemaMappingService._compute_column_hash(["content", "date"])
        assert hash1 == hash2

    def test_hash_whitespace_trimmed(self):
        """列名前后空格不影响 hash"""
        hash1 = SchemaMappingService._compute_column_hash(["评论内容", "时间"])
        hash2 = SchemaMappingService._compute_column_hash(["  评论内容  ", " 时间 "])
        assert hash1 == hash2
```

### 8.3 集成测试（Layer 2）

**原则**：使用 Mock LLM + 真实 PostgreSQL，测试端到端流程。

#### 8.3.1 Mock LLM Fixture

```python
# tests/conftest.py

import pytest
from unittest.mock import AsyncMock
from voc_service.pipeline.llm_client import LLMClient


@pytest.fixture
def mock_llm_client() -> LLMClient:
    """Mock LLM 客户端"""
    client = AsyncMock(spec=LLMClient)

    # Mock Stage 1 响应
    client.chat.return_value = {
        "choices": [{
            "message": {
                "content": '{"units": [{"text": "测试文本", "summary": "测试摘要", "intent": "complaint", "sentiment": "negative", "confidence": 0.9}]}'
            }
        }]
    }

    # Mock Embedding 响应
    client.embedding.return_value = [[0.1] * 4096]

    # Mock Rerank 响应
    client.rerank.return_value = [{"index": 0, "relevance_score": 0.95}]

    return client


@pytest.fixture
async def db_session():
    """测试数据库 session（使用事务回滚隔离）"""
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    engine = create_async_engine("postgresql+asyncpg://prism:prism@localhost:5432/prism")
    async with engine.begin() as conn:
        # 确保 voc schema 存在
        await conn.execute(text("CREATE SCHEMA IF NOT EXISTS voc"))
    async with AsyncSession(engine) as session:
        async with session.begin():
            yield session
            await session.rollback()
    await engine.dispose()
```

#### 8.3.2 导入流程集成测试

```python
# tests/integration/test_import_flow.py

import io
import pytest

class TestImportFlow:
    async def test_csv_import_end_to_end(self, db_session, mock_llm_client):
        """CSV 导入完整流程：解析 -> 映射 -> 去重 -> 入库 -> 管线"""
        # 准备 mock 映射响应
        mock_llm_client.chat.side_effect = [
            # Schema 映射调用
            {"choices": [{"message": {"content": '{"mappings": {"评论": {"target": "raw_text", "confidence": 0.95}}, "unmapped_columns": [], "overall_confidence": 0.95}'}}]},
            # Stage 1 调用
            {"choices": [{"message": {"content": '{"units": [{"text": "好评", "summary": "好评", "intent": "praise", "sentiment": "positive", "confidence": 0.9}]}'}}]},
            # Stage 2 标签生成
            {"choices": [{"message": {"content": '{"tagged_units": [{"unit_index": 0, "tags": [{"raw_name": "好评", "relevance": 0.9, "is_primary": true, "confidence": 0.8}]}]}'}}]},
            # Stage 2 标签标准化
            {"choices": [{"message": {"content": '{"normalized": [{"raw_name": "好评", "normalized_name": "正面评价", "merged_into": null}]}'}}]},
        ]

        csv_content = "评论\n这车空间很大\n油耗偏高"
        file = io.BytesIO(csv_content.encode("utf-8"))

        # ... ImportService 调用和断言

    async def test_duplicate_import_skipped(self, db_session, mock_llm_client):
        """重复导入应跳过已存在的数据"""
        # 第一次导入
        # 第二次导入同一文件
        # 验证 duplicate_count > 0, new_count = 0
```

#### 8.3.3 搜索流程集成测试

```python
# tests/integration/test_search_flow.py

class TestSearchFlow:
    async def test_vector_search_basic(self, db_session, mock_llm_client):
        """基本语义搜索流程"""
        # 1. 准备测试数据（预先插入带 embedding 的 SemanticUnit）
        # 2. 调用 SearchService.vector_search
        # 3. 验证返回结果包含相关字段

    async def test_vector_search_with_rerank(self, db_session, mock_llm_client):
        """搜索 + rerank"""
        # 验证 rerank_score 字段存在且合理

    async def test_search_empty_query_rejected(self, db_session, mock_llm_client):
        """空查询应被拒绝"""
```

### 8.4 Golden Dataset 测试（Layer 3）

**触发时机**：Prompt 模板变更时（`prompts/*.py` 文件修改），非每次 CI 运行。

```python
# tests/golden/test_golden_datasets.py

import json
import pytest


class TestSplittingGolden:
    """Stage 1 语义拆解质量回归测试"""

    @pytest.fixture
    def golden_data(self):
        with open("tests/golden/datasets/splitting_golden.json") as f:
            return json.load(f)

    @pytest.mark.golden
    async def test_splitting_quality(self, golden_data, real_llm_client):
        """
        使用真实 LLM 验证拆解质量。
        golden_data 格式：
        [
          {
            "input": "原始反馈文本",
            "expected_unit_count": 2,
            "expected_intents": ["complaint", "suggestion"],
            "expected_sentiments": ["negative", "neutral"]
          }
        ]
        """
        from voc_service.pipeline.stage1_splitting import SemanticSplitter
        splitter = SemanticSplitter(real_llm_client, settings)

        correct = 0
        total = len(golden_data)

        for case in golden_data:
            # 构造 mock Voice
            voice = MockVoice(raw_text=case["input"])
            units = await splitter.split(voice)

            # 验证拆解数量在合理范围
            if abs(len(units) - case["expected_unit_count"]) <= 1:
                correct += 1

        accuracy = correct / total
        assert accuracy >= 0.7, f"拆解质量回归：准确率 {accuracy:.2%} < 70%"


class TestTaggingGolden:
    """Stage 2 标签涌现质量回归测试"""

    @pytest.mark.golden
    async def test_tagging_consistency(self, real_llm_client):
        """
        同一输入多次处理，标签重叠率 > 70%（PRD KPI）。
        对同一组语义单元运行两次标签生成，计算标签集合的 Jaccard 相似度。
        """
        # ... 实现标签一致性测试
```

#### Golden Dataset 文件结构

```json
// tests/golden/datasets/splitting_golden.json
[
  {
    "id": "split-001",
    "input": "这车空间很大，后排坐三个人完全不挤。但是油耗偏高，百公里12个油，城市通勤有点心疼。",
    "expected_unit_count": 2,
    "expected_intents": ["praise", "complaint"],
    "expected_sentiments": ["positive", "negative"]
  },
  {
    "id": "split-002",
    "input": "拿铁太甜了",
    "expected_unit_count": 1,
    "expected_intents": ["complaint"],
    "expected_sentiments": ["negative"]
  }
]
```

```json
// tests/golden/datasets/mapping_golden.json
[
  {
    "id": "map-001",
    "columns": ["评论内容", "发布时间", "用户名", "评分"],
    "sample_rows": [
      {"评论内容": "很好", "发布时间": "2026-01-01", "用户名": "张三", "评分": "5"}
    ],
    "expected_mappings": {
      "评论内容": "raw_text",
      "发布时间": "metadata.published_at",
      "用户名": "metadata.author_name",
      "评分": "metadata.rating"
    }
  }
]
```

### 8.5 测试运行命令

```bash
# 单元测试（CI 必跑，无外部依赖）
uv run pytest tests/unit/ -v

# 集成测试（CI 必跑，需 PostgreSQL）
uv run pytest tests/integration/ -v

# Golden Dataset 测试（Prompt 变更时手动触发，需真实 LLM）
uv run pytest tests/golden/ -v -m golden

# 全部测试
uv run pytest tests/ -v

# 覆盖率
uv run pytest tests/ --cov=voc_service --cov-report=html
```

---

## 9. 里程碑与工时

### 9.1 M3 数据底座（W0+7 周，28 人天）

| 任务 | 工时 | 依赖 | 负责人 | 验收标准 |
|------|------|------|--------|---------|
| T1 项目脚手架 | 2 天 | 无 | 李维 | `uv run python -m voc_service.main` 启动，`/health` 返回 200 |
| T2 ORM 模型 + Alembic 迁移 | 2 天 | T1 | 李维 | 7 张表创建成功，索引就位 |
| T3 文件解析器（CSV + Excel） | 3 天 | T1 | 李维 | 单元测试通过：UTF-8/GBK CSV、Excel 解析、分块读取 |
| T4 LLM 客户端封装 | 1 天 | T1 | 陈思琪 | 可调用 llm-service chat/embedding/rerank |
| T5 Schema 映射服务 | 4 天 | T3, T4 | 陈思琪 | LLM 映射准确率 > 90%（Golden Dataset）；模板匹配复用 |
| T6 导入编排服务 | 3 天 | T3, T5 | 李维 | 1000 行 CSV 导入 < 30s；去重正确；IngestionBatch 状态追踪 |
| T7 Stage 1 语义拆解 | 4 天 | T4 | 陈思琪 | Prompt 质量验证；三级降级通过；L1 守卫通过 |
| T8 Stage 2 标签涌现 + 标准化 | 4 天 | T7 | 陈思琪 | 涌现标签 > 20 个（1000 条数据）；标准化去重工作 |
| T9 导入 + 管线集成 + API | 3 天 | T6, T8 | 李维 | 端到端：上传 CSV → 映射确认 → 导入 → Stage 1 → Stage 2 |
| T10 合成数据冷启动 | 2 天 | T9 | 陈思琪 | 生成 1000 条合成数据，涌现 > 50 个标签 |

**M3 验收检查清单**：
- [ ] CSV 上传：列名为中文的 CSV 文件可成功导入
- [ ] Excel 上传：.xlsx 文件可成功导入
- [ ] LLM 映射：未知格式文件触发 LLM 映射，置信度 < 0.8 时弹出确认面板
- [ ] 模板复用：同格式文件第二次上传自动匹配模板，跳过确认
- [ ] 增量去重：相同文件重复上传，duplicate_count > 0
- [ ] Stage 1：1000 条数据产出 > 2000 个 SemanticUnit
- [ ] Stage 2：产出 > 20 个涌现标签
- [ ] 降级测试：手动构造 LLM 异常响应，验证三级降级
- [ ] 状态追踪：`GET /api/voc/import/{id}/status` 返回正确进度
- [ ] 合成数据：1000 条种子数据处理完成

### 9.2 M4 语义搜索（W0+9 周，14 人天）

| 任务 | 工时 | 依赖 | 负责人 | 验收标准 |
|------|------|------|--------|---------|
| T11 Stage 3 向量化 | 2 天 | M3 | 陈思琪 | SemanticUnit.embedding 已填充；IVFFlat 索引工作 |
| T12 vector_search API | 3 天 | T11 | 李维 | P95 < 2s（10 万条）；Top-5 命中率 > 60% |
| T13 可选 rerank | 2 天 | T12 | 陈思琪 | rerank=true 时使用 rerank 槽位精排 |
| T14 守卫层 L1 + L2 完善 | 2 天 | M3 | 陈思琪 | L2 语义一致性检查集成到 Stage 1 |
| T15 标签反馈 API | 1 天 | M3 | 李维 | UPSERT 逻辑正确；反馈统计正确 |
| T16 标签列表 + 详情 API | 2 天 | M3 | 李维 | 分页、排序、置信度档位过滤 |
| T17 集成测试 + 修复 | 2 天 | T11-T16 | 共同 | 全端点集成测试通过 |

**M4 验收检查清单**：
- [ ] 搜索"支付卡顿"返回"结账时转了好久的菊花"等语义相关结果
- [ ] 搜索 P95 < 2s
- [ ] rerank 模式：Top-5 结果优于纯向量排序
- [ ] L2 守卫：检测到信息遗漏时记录警告日志
- [ ] 标签反馈：useful/useless/error 三种反馈正确存储
- [ ] 标签列表：按 usage_count 降序，置信度三档正确

### 9.3 M5 前端集成联调（W0+12 周，10 人天）

| 任务 | 工时 | 依赖 | 负责人 | 验收标准 |
|------|------|------|--------|---------|
| T18 映射预览 API 完善 | 1 天 | M4 | 李维 | 前端可消费映射预览 + 确认接口 |
| T19 标签对比视图 API | 3 天 | M4 | 陈思琪 | 涌现 vs 预设分类对比数据正确 |
| T20 Voice/Unit 详情 API 完善 | 1 天 | M4 | 李维 | 包含完整关联信息 |
| T21 全端点联调 | 3 天 | T18-T20 + 前端 | 共同 | 端到端演示流程 5 分钟内完成 |
| T22 性能调优 | 2 天 | T21 | 共同 | pgvector 索引参数调优；批量处理优化 |

**M5 验收检查清单**：
- [ ] 端到端演示：上传 → 映射确认 → 导入 → 标签列表 → 搜索 → 溯源
- [ ] 对比视图：涌现标签 vs 预设分类可视化对比
- [ ] 性能：1000 条批量处理 < 30 分钟
- [ ] pgvector 10 万向量查询 P95 < 100ms
- [ ] 所有 API 返回统一 `{data, meta}` 格式
- [ ] 错误响应包含 `{error: {code, message}}` 结构

### 9.4 工时汇总

| 里程碑 | 工时 | 累计 |
|--------|------|------|
| M3 数据底座 | 28 人天 | 28 人天 |
| M4 语义搜索 | 14 人天 | 42 人天 |
| M5 前端集成 | 10 人天 | 52 人天 |
| **合计** | **52 人天** | - |

### 9.5 关键依赖

```
外部依赖：
├── llm-service 4 槽位已就位（M1 完成后）
│   ├── reasoning 槽位 → Stage 1, Stage 2 标签涌现, Schema 映射, 合成数据
│   ├── fast 槽位 → Stage 2 标签标准化, L2 守卫
│   ├── embedding 槽位 → Stage 3, 搜索向量化
│   └── rerank 槽位 → 搜索精排（可选）
├── PostgreSQL + pgvector 已就位（Phase 1 基础设施）
├── shared 模块（JWT 认证, DB session）
└── 前端数据导入页 + 搜索页 + 标签列表页（M5 联调）

内部依赖：
T5(映射) → T3(解析器) + T4(LLM客户端)
T6(导入) → T3 + T5
T7(Stage1) → T4
T8(Stage2) → T7
T9(集成) → T6 + T8
T11(Stage3) → T4
T12(搜索) → T11
```

### 9.6 风险缓冲

| 风险 | 概率 | 缓冲 |
|------|------|------|
| LLM 映射 Prompt 需多轮迭代 | 高 | T5 预留 1 天缓冲（4→5 天） |
| pgvector IVFFlat 索引调优 | 中 | T22 专项 2 天 |
| 标签标准化效果不佳 | 中 | T8 预留 Golden Dataset 迭代 |
| 前端联调接口变更 | 低 | API 契约在 M4 冻结 |
