# LLM Service 实现级设计文档

> 负责人：王磊（后端负责人）
> 版本：v1.0
> 基线：PRD v2.0 + R5-B 决议（4 槽位模型替代别名系统）
> 适用范围：M1（Phase 2 完成）交付

---

## 1. 服务概述

### 1.1 职责定义

llm-service 是 Prism 平台的 LLM 统一网关，屏蔽上游 Provider 差异，为所有下游消费者（voc-service、agent-service、前端、CLI）提供统一的模型调用接口。

核心职责：

| 职责 | 说明 |
|------|------|
| 4 槽位模型管理 | fast/reasoning/embedding/rerank 四种能力槽位，替代原别名系统（R5-B 决议） |
| SlotRouter | 封装 LiteLLM 的核心路由层，承载故障转移、审计日志、Embedding 批量分片 |
| Provider 管理 | Provider 的 CRUD + 连通性测试 + API Key 加密存储 |
| LiteLLM 集成 | 统一调用层，替代自建 Provider 适配器（Phase 2 关键决策） |
| 健康检查机制 | 被动标记 + 主动恢复探测 + Redis 健康状态缓存 |
| 弹性 L0 | 连接池显式配置（R5-C 决议） |
| 推理代理网关 | 通用 completions/embeddings/rerank 代理端点，供前端 Studio 和其他应用层消费 |
| Provider 内置预设 | 常用 Provider（OpenAI、Anthropic、DeepSeek 等）一键导入 |

### 1.2 PRD 功能映射

| PRD 功能 | 映射 | 本服务交付物 |
|----------|------|-------------|
| F21: 4 槽位模型 | 完整实现 | model_slots 表 + SlotRouter + Admin API |
| 现有 Chat API | 槽位化改造 | POST /api/llm/chat（slot 参数） |
| 现有 Embedding API | 固定 embedding 槽位 | POST /api/llm/embedding + 批量分片 |
| 现有 Rerank API | 固定 rerank 槽位 | POST /api/llm/rerank |
| F26: 弹性 L0 | 连接池配置 | SQLAlchemy pool_size/max_overflow 显式配置 |
| F27: LLM Studio 网关 | 后端部分 | POST /api/llm/completions + /embeddings + /rerank + /slots/{type}/invoke |

### 1.3 里程碑

**M1（W0）**：Phase 2 完成

- 4 槽位模型可配置且正常路由
- SlotRouter + LiteLLM 集成
- Chat/Embedding/Rerank API 可用
- 故障转移降级链生效
- 弹性 L0（连接池配置）
- Go/No-Go 条件：Chat API 可用 + 降级演示通过 + 4 槽位可配置

---

## 2. 模块结构

### 2.1 目录树

```
llm-service/
├── pyproject.toml
├── alembic.ini
├── src/
│   └── llm_service/
│       ├── __init__.py
│       ├── main.py                    # FastAPI app 入口
│       ├── config.py                  # 服务配置（Pydantic Settings）
│       │
│       ├── api/                       # API 路由层（薄层，仅参数校验 + 调用 core）
│       │   ├── __init__.py
│       │   ├── router.py             # 路由注册总入口
│       │   ├── chat.py               # POST /api/llm/chat
│       │   ├── embedding.py          # POST /api/llm/embedding
│       │   ├── rerank.py             # POST /api/llm/rerank
│       │   ├── gateway.py            # 推理代理端点（completions/embeddings/rerank）
│       │   ├── admin_providers.py    # Provider CRUD + 连通性测试
│       │   ├── admin_slots.py        # 槽位管理
│       │   ├── health.py             # GET /health
│       │   ├── schemas/              # Pydantic 请求/响应模型
│       │   │   ├── __init__.py
│       │   │   ├── chat.py
│       │   │   ├── embedding.py
│       │   │   ├── rerank.py
│       │   │   ├── gateway.py        # 代理请求/响应模型
│       │   │   ├── provider.py
│       │   │   ├── slot.py
│       │   │   └── common.py         # 通用响应包装
│       │   └── deps.py               # FastAPI 依赖注入
│       │
│       ├── core/                      # 核心业务逻辑层
│       │   ├── __init__.py
│       │   ├── slot_router.py        # SlotRouter（核心类）
│       │   ├── provider_service.py   # Provider CRUD + 加密
│       │   ├── slot_service.py       # 槽位配置 CRUD
│       │   ├── health_checker.py     # 健康检查（被动 + 主动恢复）
│       │   ├── litellm_adapter.py    # LiteLLM 封装层
│       │   ├── presets.py            # Provider 内置预设（OpenAI/Anthropic/DeepSeek 等）
│       │   └── encryption.py         # API Key 加解密
│       │
│       ├── models/                    # SQLAlchemy ORM 模型
│       │   ├── __init__.py
│       │   ├── provider.py           # llm.providers
│       │   └── slot.py               # llm.model_slots
│       │
│       └── migrations/                # Alembic 迁移
│           ├── env.py
│           └── versions/
│
└── tests/
    ├── conftest.py
    ├── unit/
    │   ├── test_slot_router.py
    │   ├── test_provider_service.py
    │   ├── test_slot_service.py
    │   ├── test_health_checker.py
    │   └── test_litellm_adapter.py
    └── integration/
        ├── test_chat_api.py
        ├── test_embedding_api.py
        ├── test_rerank_api.py
        └── test_admin_api.py
```

### 2.2 模块职责

| 模块 | 职责 | 依赖 |
|------|------|------|
| `api/` | HTTP 请求处理：参数验证、认证、响应封装 | `core/`、`prism_shared` |
| `api/schemas/` | Pydantic 模型定义：请求体、响应体、校验规则 | 无 |
| `core/slot_router.py` | 核心路由：槽位解析 → LiteLLM 调用 → 故障转移 → 审计日志 | `litellm_adapter`、`health_checker`、`models/` |
| `core/litellm_adapter.py` | LiteLLM 封装：统一 LiteLLM 的 acompletion/aembedding/arerank 调用 | `litellm` |
| `core/health_checker.py` | 健康检查：被动标记 + 主动恢复 + Redis 缓存 | Redis |
| `core/provider_service.py` | Provider 管理：CRUD + 加密 + 连通性测试 | `models/`、`encryption` |
| `core/slot_service.py` | 槽位管理：CRUD + 配置热加载 | `models/` |
| `core/encryption.py` | AES-256-GCM 加解密 API Key | 无 |
| `models/` | ORM 模型定义 | SQLAlchemy |

### 2.3 依赖关系

```
api/
 ├── core/slot_router.py     ← 调用类 API 的核心入口
 ├── core/provider_service.py ← Provider Admin API
 ├── core/slot_service.py    ← Slot Admin API
 └── prism_shared.auth.deps  ← 认证中间件

core/slot_router.py
 ├── core/litellm_adapter.py ← LLM 实际调用
 ├── core/health_checker.py  ← 故障转移决策依据
 ├── core/slot_service.py    ← 读取槽位配置
 └── core/encryption.py      ← 解密 API Key 传给 LiteLLM

core/health_checker.py
 └── Redis                   ← 健康状态缓存

外部依赖：
 ├── litellm                 ← LLM 统一调用库
 ├── prism_shared             ← DB session、JWT、认证中间件
 ├── PostgreSQL (llm schema) ← 持久化存储
 └── Redis                   ← 健康状态缓存
```

---

## 3. 数据模型

### 3.1 完整 DDL

```sql
-- ========================================
-- Schema: llm
-- 归属：llm-service
-- ========================================

CREATE SCHEMA IF NOT EXISTS llm;

-- ----------------------------------------
-- 表：llm.providers
-- 用途：LLM Provider 配置
-- ----------------------------------------
CREATE TABLE llm.providers (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100)    UNIQUE NOT NULL,            -- 显示名称，如 "硅基流动"
    slug            VARCHAR(50)     UNIQUE NOT NULL,            -- 标识符，如 "siliconflow"
    provider_type   VARCHAR(50)     NOT NULL,                   -- LiteLLM provider 类型：openai/openai_like 等
    base_url        VARCHAR(500)    NOT NULL,                   -- API Base URL
    api_key_encrypted TEXT          NOT NULL,                   -- AES-256-GCM 加密存储的 API Key
    is_enabled      BOOLEAN         DEFAULT true,               -- 启用/禁用
    config          JSONB           DEFAULT '{}'::jsonb,        -- 额外配置（自定义 headers、超时等）
    created_at      TIMESTAMPTZ     DEFAULT now(),
    updated_at      TIMESTAMPTZ     DEFAULT now()
);

-- 索引
CREATE INDEX idx_providers_is_enabled ON llm.providers (is_enabled) WHERE is_enabled = true;
CREATE INDEX idx_providers_slug ON llm.providers (slug);

-- config JSONB 结构示例：
-- {
--   "extra_headers": {"HTTP-Referer": "https://prism.ai"},
--   "timeout_s": 60,
--   "max_retries": 2
-- }

-- ----------------------------------------
-- 类型：llm.slot_type
-- 用途：4 槽位枚举
-- ----------------------------------------
CREATE TYPE llm.slot_type AS ENUM ('fast', 'reasoning', 'embedding', 'rerank');

-- ----------------------------------------
-- 表：llm.model_slots
-- 用途：4 槽位模型配置
-- ----------------------------------------
CREATE TABLE llm.model_slots (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_type           llm.slot_type   UNIQUE NOT NULL,            -- 每种类型有且仅有一行
    primary_provider_id UUID            NOT NULL REFERENCES llm.providers(id) ON DELETE RESTRICT,
    primary_model_id    VARCHAR(200)    NOT NULL,                   -- Provider 侧模型 ID
    fallback_chain      JSONB           DEFAULT '[]'::jsonb,       -- 有序降级链
    is_enabled          BOOLEAN         DEFAULT true,
    config              JSONB           DEFAULT '{}'::jsonb,        -- 调用参数覆盖
    created_at          TIMESTAMPTZ     DEFAULT now(),
    updated_at          TIMESTAMPTZ     DEFAULT now()
);

-- 索引
CREATE INDEX idx_model_slots_slot_type ON llm.model_slots (slot_type);
CREATE INDEX idx_model_slots_primary_provider ON llm.model_slots (primary_provider_id);

-- fallback_chain JSONB 结构：
-- [
--   {"provider_id": "550e8400-...", "model_id": "Qwen/Qwen2.5-72B-Instruct"},
--   {"provider_id": "6ba7b810-...", "model_id": "moonshot-v1-8k"}
-- ]

-- config JSONB 结构：
-- {
--   "temperature": 0.7,
--   "max_tokens": 4096,
--   "timeout_ms": 30000,
--   "top_p": 0.9
-- }

-- ----------------------------------------
-- 表：llm.audit_logs
-- 用途：SlotRouter 调用审计日志
-- ----------------------------------------
CREATE TABLE llm.audit_logs (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id      UUID            NOT NULL,                   -- 请求追踪 ID
    slot_type       llm.slot_type   NOT NULL,
    provider_id     UUID            REFERENCES llm.providers(id),
    model_id        VARCHAR(200),
    status          VARCHAR(20)     NOT NULL,                   -- success / failed / degraded
    latency_ms      INTEGER,
    token_usage     JSONB,                                      -- {"prompt_tokens": N, "completion_tokens": N}
    error_message   TEXT,
    is_fallback     BOOLEAN         DEFAULT false,              -- 是否使用了降级
    fallback_depth  INTEGER         DEFAULT 0,                  -- 降级深度（0=主模型）
    created_at      TIMESTAMPTZ     DEFAULT now()
);

-- 索引
CREATE INDEX idx_audit_logs_request_id ON llm.audit_logs (request_id);
CREATE INDEX idx_audit_logs_created_at ON llm.audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_slot_type ON llm.audit_logs (slot_type, created_at DESC);
CREATE INDEX idx_audit_logs_status ON llm.audit_logs (status) WHERE status != 'success';
```

### 3.2 槽位与 AI 管线映射

| 槽位 | 能力类型 | 下游消费场景 |
|------|----------|-------------|
| `fast` | 低延迟文本生成 | 守卫层 L1 格式校验、Stage 2 标签标准化、Schema 映射 |
| `reasoning` | 深度推理 | Stage 1 语义拆解、Stage 2 标签涌现、合成数据生成 |
| `embedding` | 文本向量化 | Stage 3 向量化、语义搜索 query embedding |
| `rerank` | 搜索结果重排序 | 语义搜索结果优化 |

### 3.3 ORM 模型

```python
# models/provider.py
from sqlalchemy import Column, String, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from prism_shared.db import Base
import uuid

class Provider(Base):
    __tablename__ = "providers"
    __table_args__ = {"schema": "llm"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False)
    slug = Column(String(50), unique=True, nullable=False)
    provider_type = Column(String(50), nullable=False)
    base_url = Column(String(500), nullable=False)
    api_key_encrypted = Column(Text, nullable=False)
    is_enabled = Column(Boolean, default=True)
    config = Column(JSONB, default=dict)
    created_at = Column(TIMESTAMPTZ, server_default=func.now())
    updated_at = Column(TIMESTAMPTZ, server_default=func.now(), onupdate=func.now())
```

```python
# models/slot.py
import enum
from sqlalchemy import Column, String, Boolean, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from prism_shared.db import Base
import uuid

class SlotType(str, enum.Enum):
    FAST = "fast"
    REASONING = "reasoning"
    EMBEDDING = "embedding"
    RERANK = "rerank"

class ModelSlot(Base):
    __tablename__ = "model_slots"
    __table_args__ = {"schema": "llm"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slot_type = Column(Enum(SlotType, schema="llm", name="slot_type"), unique=True, nullable=False)
    primary_provider_id = Column(UUID(as_uuid=True), ForeignKey("llm.providers.id", ondelete="RESTRICT"), nullable=False)
    primary_model_id = Column(String(200), nullable=False)
    fallback_chain = Column(JSONB, default=list)
    is_enabled = Column(Boolean, default=True)
    config = Column(JSONB, default=dict)
    created_at = Column(TIMESTAMPTZ, server_default=func.now())
    updated_at = Column(TIMESTAMPTZ, server_default=func.now(), onupdate=func.now())
```

---

## 4. API 设计

### 4.1 调用类 API

#### POST /api/llm/chat

Chat 调用，支持 `slot` 参数指定槽位。

**请求**：
```json
{
    "messages": [
        {"role": "system", "content": "你是一个有帮助的助手。"},
        {"role": "user", "content": "Hello"}
    ],
    "slot": "reasoning",
    "temperature": 0.7,
    "max_tokens": 2048,
    "stream": false
}
```

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| messages | array | 是 | - | OpenAI 格式消息列表 |
| slot | string | 否 | `"reasoning"` | 槽位类型：`fast` 或 `reasoning` |
| temperature | float | 否 | 槽位配置 | 温度参数 |
| max_tokens | int | 否 | 槽位配置 | 最大生成 token |
| stream | bool | 否 | `false` | 是否流式输出 |

**成功响应**（200）：
```json
{
    "data": {
        "id": "chatcmpl-abc123",
        "slot": "reasoning",
        "provider": "siliconflow",
        "model": "Qwen/Qwen2.5-72B-Instruct",
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": "你好！有什么我可以帮你的吗？"
                },
                "finish_reason": "stop"
            }
        ],
        "usage": {
            "prompt_tokens": 25,
            "completion_tokens": 12,
            "total_tokens": 37
        },
        "degraded": false,
        "fallback_depth": 0
    },
    "meta": {
        "request_id": "550e8400-e29b-41d4-a716-446655440000",
        "timestamp": "2026-02-12T10:00:00Z"
    }
}
```

**降级响应**（200，`degraded: true`）：
```json
{
    "data": {
        "id": "chatcmpl-xyz789",
        "slot": "reasoning",
        "provider": "openrouter",
        "model": "qwen/qwen-2.5-72b-instruct",
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": "你好！"
                },
                "finish_reason": "stop"
            }
        ],
        "usage": {
            "prompt_tokens": 25,
            "completion_tokens": 5,
            "total_tokens": 30
        },
        "degraded": true,
        "fallback_depth": 1
    },
    "meta": {
        "request_id": "550e8400-e29b-41d4-a716-446655440001",
        "timestamp": "2026-02-12T10:00:01Z"
    }
}
```

**流式响应**（SSE，`stream: true`）：
```
data: {"id":"chatcmpl-abc123","slot":"reasoning","choices":[{"index":0,"delta":{"role":"assistant","content":"你"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","slot":"reasoning","choices":[{"index":0,"delta":{"content":"好"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","slot":"reasoning","choices":[{"index":0,"delta":{"content":"！"},"finish_reason":"stop"}],"usage":{"prompt_tokens":25,"completion_tokens":3,"total_tokens":28}}

data: [DONE]
```

#### POST /api/llm/embedding

Embedding 调用，固定使用 `embedding` 槽位。

**请求**：
```json
{
    "input": ["文本1", "文本2", "文本3"]
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| input | array[string] | 是 | 待向量化文本列表，单次最大 100 条 |

**成功响应**（200）：
```json
{
    "data": {
        "slot": "embedding",
        "provider": "siliconflow",
        "model": "Qwen/Qwen-Embedding-8B",
        "data": [
            {"index": 0, "embedding": [0.0123, -0.0456, 0.0789, "..."]},
            {"index": 1, "embedding": [0.0321, -0.0654, 0.0987, "..."]},
            {"index": 2, "embedding": [0.0111, -0.0222, 0.0333, "..."]}
        ],
        "usage": {
            "prompt_tokens": 15,
            "total_tokens": 15
        },
        "degraded": false
    },
    "meta": {
        "request_id": "550e8400-e29b-41d4-a716-446655440002",
        "timestamp": "2026-02-12T10:00:02Z"
    }
}
```

#### POST /api/llm/rerank

Rerank 调用，固定使用 `rerank` 槽位。

**请求**：
```json
{
    "query": "汽车变速箱异响",
    "documents": [
        "我的车变速箱嗡嗡响",
        "空间很大，适合家用",
        "换挡的时候有顿挫感"
    ],
    "top_n": 2
}
```

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| query | string | 是 | - | 查询文本 |
| documents | array[string] | 是 | - | 待排序文档，最大 100 条 |
| top_n | int | 否 | `len(documents)` | 返回前 N 条 |

**成功响应**（200）：
```json
{
    "data": {
        "slot": "rerank",
        "provider": "siliconflow",
        "model": "BAAI/bge-reranker-v2-m3",
        "results": [
            {"index": 0, "relevance_score": 0.95, "document": "我的车变速箱嗡嗡响"},
            {"index": 2, "relevance_score": 0.72, "document": "换挡的时候有顿挫感"}
        ]
    },
    "meta": {
        "request_id": "550e8400-e29b-41d4-a716-446655440003",
        "timestamp": "2026-02-12T10:00:03Z"
    }
}
```

### 4.2 管理类 API

#### GET /api/llm/admin/providers

**成功响应**（200）：
```json
{
    "data": [
        {
            "id": "550e8400-e29b-41d4-a716-446655440010",
            "name": "硅基流动",
            "slug": "siliconflow",
            "provider_type": "openai",
            "base_url": "https://api.siliconflow.cn/v1",
            "is_enabled": true,
            "config": {},
            "created_at": "2026-02-10T08:00:00Z",
            "updated_at": "2026-02-10T08:00:00Z"
        },
        {
            "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
            "name": "OpenRouter",
            "slug": "openrouter",
            "provider_type": "openai",
            "base_url": "https://openrouter.ai/api/v1",
            "is_enabled": true,
            "config": {
                "extra_headers": {"HTTP-Referer": "https://prism.ai"}
            },
            "created_at": "2026-02-10T08:30:00Z",
            "updated_at": "2026-02-10T08:30:00Z"
        }
    ],
    "meta": {
        "request_id": "uuid",
        "timestamp": "2026-02-12T10:00:00Z"
    }
}
```

> 注：响应中 **不包含** `api_key_encrypted`，安全起见永远不返回密钥。

#### POST /api/llm/admin/providers

**请求**：
```json
{
    "name": "Kimi",
    "slug": "kimi",
    "provider_type": "openai",
    "base_url": "https://api.moonshot.cn/v1",
    "api_key": "sk-xxxxxxxxxxxxxxxx",
    "config": {}
}
```

**成功响应**（201）：
```json
{
    "data": {
        "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "name": "Kimi",
        "slug": "kimi",
        "provider_type": "openai",
        "base_url": "https://api.moonshot.cn/v1",
        "is_enabled": true,
        "config": {},
        "created_at": "2026-02-12T10:05:00Z",
        "updated_at": "2026-02-12T10:05:00Z"
    },
    "meta": {
        "request_id": "uuid",
        "timestamp": "2026-02-12T10:05:00Z"
    }
}
```

#### PUT /api/llm/admin/providers/{id}

**请求**（部分更新）：
```json
{
    "name": "Kimi (月之暗面)",
    "api_key": "sk-new-key",
    "is_enabled": true
}
```

**成功响应**（200）：与 POST 响应结构相同。

#### DELETE /api/llm/admin/providers/{id}

**成功响应**（200）：
```json
{
    "data": {
        "message": "Provider 已删除"
    },
    "meta": {
        "request_id": "uuid",
        "timestamp": "2026-02-12T10:06:00Z"
    }
}
```

**错误响应**（409，有槽位引用）：
```json
{
    "error": {
        "code": "PROVIDER_IN_USE",
        "message": "该 Provider 被以下槽位引用：reasoning, embedding。请先解除引用。",
        "details": {
            "referenced_slots": ["reasoning", "embedding"]
        }
    },
    "meta": {
        "request_id": "uuid",
        "timestamp": "2026-02-12T10:06:00Z"
    }
}
```

#### POST /api/llm/admin/providers/{id}/test

**请求**：
```json
{
    "test_type": "chat",
    "test_model_id": "Qwen/Qwen2.5-7B-Instruct"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| test_type | string | 是 | `chat` / `embedding` / `rerank` |
| test_model_id | string | 否 | 测试用模型 ID，不传则使用该 Provider 的典型模型 |

**成功响应**（200）：
```json
{
    "data": {
        "provider_id": "550e8400-...",
        "status": "ok",
        "latency_ms": 320,
        "test_type": "chat",
        "test_model_id": "Qwen/Qwen2.5-7B-Instruct",
        "message": "连接成功"
    },
    "meta": {
        "request_id": "uuid",
        "timestamp": "2026-02-12T10:07:00Z"
    }
}
```

**失败响应**（200，`status: error`）：
```json
{
    "data": {
        "provider_id": "550e8400-...",
        "status": "error",
        "test_type": "chat",
        "test_model_id": "Qwen/Qwen2.5-7B-Instruct",
        "message": "认证失败: Invalid API Key",
        "error_detail": "AuthenticationError: Incorrect API key provided: sk-xxxx..."
    },
    "meta": {
        "request_id": "uuid",
        "timestamp": "2026-02-12T10:07:00Z"
    }
}
```

#### GET /api/llm/admin/slots

**成功响应**（200）：
```json
{
    "data": [
        {
            "slot_type": "fast",
            "is_enabled": true,
            "primary_provider": {
                "id": "550e8400-...",
                "name": "硅基流动",
                "slug": "siliconflow"
            },
            "primary_model_id": "Qwen/Qwen2.5-7B-Instruct",
            "fallback_chain": [
                {
                    "provider": {"id": "6ba7b810-...", "name": "OpenRouter", "slug": "openrouter"},
                    "model_id": "qwen/qwen-2.5-7b-instruct"
                }
            ],
            "config": {"temperature": 0.3, "max_tokens": 1024},
            "health_status": "healthy",
            "updated_at": "2026-02-11T15:30:00Z"
        },
        {
            "slot_type": "reasoning",
            "is_enabled": true,
            "primary_provider": {
                "id": "550e8400-...",
                "name": "硅基流动",
                "slug": "siliconflow"
            },
            "primary_model_id": "Qwen/Qwen2.5-72B-Instruct",
            "fallback_chain": [
                {
                    "provider": {"id": "6ba7b810-...", "name": "OpenRouter", "slug": "openrouter"},
                    "model_id": "qwen/qwen-2.5-72b-instruct"
                },
                {
                    "provider": {"id": "f47ac10b-...", "name": "Kimi", "slug": "kimi"},
                    "model_id": "moonshot-v1-8k"
                }
            ],
            "config": {"temperature": 0.7, "max_tokens": 4096},
            "health_status": "healthy",
            "updated_at": "2026-02-11T16:00:00Z"
        },
        {
            "slot_type": "embedding",
            "is_enabled": true,
            "primary_provider": {
                "id": "550e8400-...",
                "name": "硅基流动",
                "slug": "siliconflow"
            },
            "primary_model_id": "Qwen/Qwen-Embedding-8B",
            "fallback_chain": [],
            "config": {},
            "health_status": "healthy",
            "updated_at": "2026-02-11T14:00:00Z"
        },
        {
            "slot_type": "rerank",
            "is_enabled": false,
            "primary_provider": null,
            "primary_model_id": null,
            "fallback_chain": [],
            "config": {},
            "health_status": "unknown",
            "updated_at": null
        }
    ],
    "meta": {
        "request_id": "uuid",
        "timestamp": "2026-02-12T10:08:00Z"
    }
}
```

#### PUT /api/llm/admin/slots/{slot_type}

**请求**：
```json
{
    "primary_provider_id": "550e8400-e29b-41d4-a716-446655440010",
    "primary_model_id": "BAAI/bge-reranker-v2-m3",
    "fallback_chain": [
        {
            "provider_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
            "model_id": "BAAI/bge-reranker-v2-m3"
        }
    ],
    "is_enabled": true,
    "config": {
        "timeout_ms": 15000
    }
}
```

**成功响应**（200）：
```json
{
    "data": {
        "slot_type": "rerank",
        "is_enabled": true,
        "primary_provider": {
            "id": "550e8400-...",
            "name": "硅基流动",
            "slug": "siliconflow"
        },
        "primary_model_id": "BAAI/bge-reranker-v2-m3",
        "fallback_chain": [
            {
                "provider": {"id": "6ba7b810-...", "name": "OpenRouter", "slug": "openrouter"},
                "model_id": "BAAI/bge-reranker-v2-m3"
            }
        ],
        "config": {"timeout_ms": 15000},
        "updated_at": "2026-02-12T10:09:00Z"
    },
    "meta": {
        "request_id": "uuid",
        "timestamp": "2026-02-12T10:09:00Z"
    }
}
```

#### POST /api/llm/admin/slots/{slot_type}/test

**请求**（无 body 或空 body）：

**成功响应**（200）：
```json
{
    "data": {
        "slot_type": "rerank",
        "status": "ok",
        "primary_test": {
            "provider": "siliconflow",
            "model_id": "BAAI/bge-reranker-v2-m3",
            "latency_ms": 180,
            "status": "ok"
        },
        "fallback_tests": [
            {
                "provider": "openrouter",
                "model_id": "BAAI/bge-reranker-v2-m3",
                "latency_ms": 250,
                "status": "ok"
            }
        ]
    },
    "meta": {
        "request_id": "uuid",
        "timestamp": "2026-02-12T10:10:00Z"
    }
}
```

### 4.3 推理代理 API

通用推理代理端点，供 Studio Playground 和其他应用层消费。所有端点均需 `require_admin` 权限。

#### POST /api/llm/completions — Chat 补全代理

支持 stream 参数切换流式/非流式。

**请求体**：`CompletionRequest { provider_id, model_id, messages[], stream?, max_tokens? }`

**成功响应**：`CompletionResponse { content, usage, latency_ms, model }`

**流式响应**：SSE `text/event-stream`，增量 delta + 最终 usage 汇总

#### POST /api/llm/embeddings — 向量化代理

**请求体**：`EmbeddingRequest { provider_id, model_id, input }`

**成功响应**：`EmbeddingResponse { embeddings[{index, values, dimensions}], usage, latency_ms, model }`

#### POST /api/llm/rerank — 重排序代理

**请求体**：`RerankRequest { provider_id, model_id, query, documents[] }`

**成功响应**：`RerankResponse { results[{index, document, relevance_score}], latency_ms, model }`

#### POST /api/llm/slots/{slot_type}/invoke — 槽位调用（含故障转移）

**请求体**：`SlotInvokeRequest { messages[], max_tokens? }`

**成功响应**：`SlotInvokeResponse { result: CompletionResponse, routing: RoutingInfo }`

**RoutingInfo**：`{ provider_name, model_id, slot_type, used_resource_pool, failover_trace[] }`

### 4.4 错误码

| HTTP 状态码 | 错误码 | 含义 | 触发场景 |
|-------------|--------|------|----------|
| 400 | `INVALID_SLOT` | 无效的槽位类型 | slot 参数不在 fast/reasoning/embedding/rerank 中 |
| 400 | `INVALID_REQUEST` | 请求参数错误 | messages 为空、input 超过限制等 |
| 401 | `UNAUTHORIZED` | 未认证 | 缺少或无效的 JWT/API Key |
| 404 | `PROVIDER_NOT_FOUND` | Provider 不存在 | 操作不存在的 Provider ID |
| 409 | `PROVIDER_IN_USE` | Provider 被引用 | 删除正在被槽位引用的 Provider |
| 409 | `SLUG_CONFLICT` | slug 重复 | 创建/更新 Provider 时 slug 已存在 |
| 422 | `VALIDATION_ERROR` | 参数验证失败 | Pydantic 验证失败（FastAPI 默认） |
| 502 | `PROVIDER_ERROR` | 上游 Provider 错误 | LiteLLM 返回非预期错误 |
| 503 | `SLOT_NOT_CONFIGURED` | 槽位未配置 | 调用未配置的槽位 |
| 503 | `ALL_PROVIDERS_UNAVAILABLE` | 所有 Provider 不可用 | 主模型 + 降级链全部失败 |
| 502 | `LLM_UPSTREAM_ERROR` | 上游 Provider 代理错误 | 代理调用 Provider API 返回非预期错误 |
| 503 | `LLM_ALL_MODELS_FAILED` | 所有模型失败 | 槽位调用时主模型 + 资源池全部失败 |

---

## 5. 核心流程

### 5.1 Chat 调用时序图

```mermaid
sequenceDiagram
    participant C as 客户端
    participant A as API (chat.py)
    participant SR as SlotRouter
    participant HC as HealthChecker
    participant LA as LiteLLMAdapter
    participant LL as LiteLLM
    participant P1 as 主 Provider
    participant P2 as 降级 Provider
    participant R as Redis
    participant DB as PostgreSQL

    C->>A: POST /api/llm/chat {slot: "reasoning", messages: [...]}
    A->>A: 参数验证 + 认证检查
    A->>SR: chat(slot=reasoning, messages=[...])

    SR->>DB: 查询 model_slots (slot_type=reasoning)
    DB-->>SR: 槽位配置 (provider_id, model_id, fallback_chain)

    SR->>HC: is_healthy(primary_provider_id)
    HC->>R: GET llm:health:{provider_id}
    R-->>HC: healthy

    SR->>LA: acompletion(provider, model, messages)
    LA->>LL: litellm.acompletion(model="openai/Qwen/Qwen2.5-72B-Instruct", api_base=..., api_key=...)
    LL->>P1: HTTPS POST /v1/chat/completions

    alt 主 Provider 成功
        P1-->>LL: 200 OK + 响应
        LL-->>LA: ModelResponse
        LA-->>SR: ChatResponse
        SR->>DB: 写入 audit_log (status=success, fallback_depth=0)
        SR-->>A: ChatResponse (degraded=false)
        A-->>C: 200 OK
    else 主 Provider 失败
        P1-->>LL: 502/503/Timeout
        LL-->>LA: 异常
        LA-->>SR: 抛出 ProviderError

        SR->>HC: mark_unhealthy(primary_provider_id)
        HC->>R: SET llm:health:{provider_id} = unhealthy (TTL=60s)

        SR->>DB: 写入 audit_log (status=failed)

        loop 遍历 fallback_chain
            SR->>HC: is_healthy(fallback_provider_id)
            HC->>R: GET llm:health:{fallback_provider_id}
            R-->>HC: healthy

            SR->>LA: acompletion(fallback_provider, fallback_model, messages)
            LA->>LL: litellm.acompletion(...)
            LL->>P2: HTTPS POST /v1/chat/completions

            alt 降级 Provider 成功
                P2-->>LL: 200 OK
                LL-->>LA: ModelResponse
                LA-->>SR: ChatResponse
                SR->>DB: 写入 audit_log (status=degraded, fallback_depth=N)
                SR-->>A: ChatResponse (degraded=true, fallback_depth=N)
                A-->>C: 200 OK
            else 降级 Provider 也失败
                SR->>HC: mark_unhealthy(fallback_provider_id)
                Note over SR: 继续下一个降级
            end
        end

        SR-->>A: 抛出 AllProvidersUnavailable
        A-->>C: 503 ALL_PROVIDERS_UNAVAILABLE
    end
```

### 5.2 Embedding 批量分片流程

```mermaid
sequenceDiagram
    participant C as 客户端
    participant SR as SlotRouter
    participant LA as LiteLLMAdapter
    participant LL as LiteLLM

    C->>SR: embedding(texts=["t1", ..., "t60"])

    SR->>SR: 分片：chunk_size=20<br/>chunks = [texts[0:20], texts[20:40], texts[40:60]]

    par 并发调用（asyncio.gather）
        SR->>LA: aembedding(texts[0:20])
        LA->>LL: litellm.aembedding(input=texts[0:20])
        LL-->>LA: EmbeddingResponse (20 vectors)
    and
        SR->>LA: aembedding(texts[20:40])
        LA->>LL: litellm.aembedding(input=texts[20:40])
        LL-->>LA: EmbeddingResponse (20 vectors)
    and
        SR->>LA: aembedding(texts[40:60])
        LA->>LL: litellm.aembedding(input=texts[40:60])
        LL-->>LA: EmbeddingResponse (20 vectors)
    end

    SR->>SR: 合并结果，恢复原始索引顺序
    SR-->>C: EmbeddingResponse (60 vectors, index 0-59)
```

### 5.3 健康检查与主动恢复

```mermaid
sequenceDiagram
    participant SR as SlotRouter
    participant HC as HealthChecker
    participant R as Redis
    participant BG as 后台定时任务
    participant LA as LiteLLMAdapter
    participant P as Provider

    Note over HC: 被动标记（调用失败时）
    SR->>HC: mark_unhealthy(provider_id)
    HC->>R: SET llm:health:{provider_id} = unhealthy (TTL=300s)
    HC->>R: SET llm:health:fail_count:{provider_id} = N

    Note over BG: 主动恢复探测（每 60 秒）
    BG->>R: SCAN llm:health:* WHERE value=unhealthy
    R-->>BG: [provider_id_1, provider_id_2]

    loop 对每个不健康的 Provider
        BG->>LA: test_connection(provider)
        LA->>P: 轻量级探测请求
        alt 探测成功
            P-->>LA: 200 OK
            LA-->>BG: ok
            BG->>R: SET llm:health:{provider_id} = healthy
            BG->>R: DEL llm:health:fail_count:{provider_id}
            Note over BG: Provider 恢复，下次调用可用
        else 探测失败
            P-->>LA: 错误
            Note over BG: 继续等待下一次探测周期
        end
    end
```

### 5.4 槽位配置变更

```mermaid
sequenceDiagram
    participant UI as Web UI
    participant A as Admin API
    participant SS as SlotService
    participant DB as PostgreSQL
    participant SR as SlotRouter

    UI->>A: PUT /api/llm/admin/slots/reasoning
    A->>SS: update_slot(reasoning, new_config)

    SS->>DB: 验证 primary_provider_id 存在且 is_enabled
    SS->>DB: 验证 fallback_chain 中所有 provider_id 存在

    alt 验证通过
        SS->>DB: UPDATE model_slots SET ... WHERE slot_type='reasoning'
        SS->>SR: invalidate_cache(reasoning)
        Note over SR: 下次调用时重新从 DB 加载配置
        SS-->>A: 成功
        A-->>UI: 200 OK
        Note over UI: AC4 验证：下次 LLM 调用即使用新配置
    else Provider 不存在
        SS-->>A: 抛出 ProviderNotFound
        A-->>UI: 404 PROVIDER_NOT_FOUND
    end
```

---

## 6. 关键实现

### 6.1 SlotRouter（核心类）

```python
# core/slot_router.py

from uuid import UUID
from typing import Any, Callable, Optional
from llm_service.models.slot import SlotType
from llm_service.core.litellm_adapter import LiteLLMAdapter
from llm_service.core.health_checker import HealthChecker
from llm_service.core.slot_service import SlotService
from llm_service.core.encryption import decrypt_api_key

EMBEDDING_CHUNK_SIZE = 20       # 每片最大条目数
EMBEDDING_MAX_CONCURRENCY = 5   # 最大并发分片数


class SlotRouter:
    """
    核心路由层。
    职责：槽位配置解析 → Provider 选择 → LiteLLM 调用 → 故障转移 → 审计日志。
    """

    def __init__(
        self,
        slot_service: SlotService,
        litellm_adapter: LiteLLMAdapter,
        health_checker: HealthChecker,
        db_session,
    ):
        self._slot_service = slot_service
        self._litellm = litellm_adapter
        self._health = health_checker
        self._db = db_session
        self._slot_cache: dict[SlotType, Any] = {}  # 内存缓存，invalidate_cache 清除

    async def chat(
        self,
        slot: SlotType,
        messages: list[dict],
        *,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        stream: bool = False,
        request_id: UUID,
    ) -> "ChatResponse":
        """Chat 调用入口。slot 仅接受 fast/reasoning。"""
        if slot not in (SlotType.FAST, SlotType.REASONING):
            raise InvalidSlotError(f"Chat 仅支持 fast/reasoning 槽位，收到: {slot}")

        slot_config = await self._get_slot_config(slot)
        merged_params = self._merge_params(slot_config.config, temperature=temperature, max_tokens=max_tokens)

        return await self._try_with_fallback(
            slot=slot,
            slot_config=slot_config,
            operation=lambda provider, model: self._litellm.acompletion(
                provider=provider,
                model=model,
                messages=messages,
                stream=stream,
                **merged_params,
            ),
            request_id=request_id,
        )

    async def embedding(
        self,
        texts: list[str],
        *,
        request_id: UUID,
    ) -> "EmbeddingResponse":
        """Embedding 调用入口。固定 embedding 槽位，自动分片。"""
        slot_config = await self._get_slot_config(SlotType.EMBEDDING)

        if len(texts) <= EMBEDDING_CHUNK_SIZE:
            # 无需分片，直接调用
            return await self._try_with_fallback(
                slot=SlotType.EMBEDDING,
                slot_config=slot_config,
                operation=lambda provider, model: self._litellm.aembedding(
                    provider=provider, model=model, input=texts,
                ),
                request_id=request_id,
            )

        # 分片并发调用
        chunks = [texts[i:i + EMBEDDING_CHUNK_SIZE] for i in range(0, len(texts), EMBEDDING_CHUNK_SIZE)]
        semaphore = asyncio.Semaphore(EMBEDDING_MAX_CONCURRENCY)

        async def _embed_chunk(chunk: list[str]) -> list[list[float]]:
            async with semaphore:
                result = await self._try_with_fallback(
                    slot=SlotType.EMBEDDING,
                    slot_config=slot_config,
                    operation=lambda provider, model: self._litellm.aembedding(
                        provider=provider, model=model, input=chunk,
                    ),
                    request_id=request_id,
                )
                return result.embeddings

        results = await asyncio.gather(*[_embed_chunk(c) for c in chunks])
        # 扁平化并恢复原始索引
        all_embeddings = [emb for chunk_embs in results for emb in chunk_embs]
        return EmbeddingResponse(embeddings=all_embeddings, ...)

    async def rerank(
        self,
        query: str,
        documents: list[str],
        *,
        top_n: Optional[int] = None,
        request_id: UUID,
    ) -> "RerankResponse":
        """Rerank 调用入口。固定 rerank 槽位。"""
        slot_config = await self._get_slot_config(SlotType.RERANK)

        return await self._try_with_fallback(
            slot=SlotType.RERANK,
            slot_config=slot_config,
            operation=lambda provider, model: self._litellm.arerank(
                provider=provider, model=model, query=query,
                documents=documents, top_n=top_n or len(documents),
            ),
            request_id=request_id,
        )

    async def _try_with_fallback(
        self,
        slot: SlotType,
        slot_config: "ModelSlotConfig",
        operation: Callable,
        request_id: UUID,
    ) -> Any:
        """核心故障转移逻辑。依次尝试主模型和降级链中的每个候选。"""
        candidates = [
            (slot_config.primary_provider, slot_config.primary_model_id, 0),
        ]
        for i, fb in enumerate(slot_config.fallback_chain, start=1):
            candidates.append((fb.provider, fb.model_id, i))

        last_error: Optional[Exception] = None

        for provider, model_id, depth in candidates:
            if not await self._health.is_healthy(provider.id):
                continue  # 跳过不健康的 Provider

            try:
                result = await operation(provider, model_id)

                # 审计日志
                await self._write_audit_log(
                    request_id=request_id,
                    slot_type=slot,
                    provider_id=provider.id,
                    model_id=model_id,
                    status="degraded" if depth > 0 else "success",
                    latency_ms=result.latency_ms,
                    token_usage=result.usage,
                    is_fallback=depth > 0,
                    fallback_depth=depth,
                )

                result.degraded = depth > 0
                result.fallback_depth = depth
                return result

            except ProviderError as e:
                last_error = e
                await self._health.mark_unhealthy(provider.id)

                # 失败审计日志
                await self._write_audit_log(
                    request_id=request_id,
                    slot_type=slot,
                    provider_id=provider.id,
                    model_id=model_id,
                    status="failed",
                    error_message=str(e),
                    is_fallback=depth > 0,
                    fallback_depth=depth,
                )

        raise AllProvidersUnavailableError(
            slot=slot,
            attempted=len(candidates),
            last_error=str(last_error),
        )

    async def _get_slot_config(self, slot: SlotType) -> "ModelSlotConfig":
        """获取槽位配置，优先读内存缓存。"""
        if slot not in self._slot_cache:
            config = await self._slot_service.get_slot_with_providers(slot)
            if config is None or not config.is_enabled:
                raise SlotNotConfiguredError(slot=slot)
            self._slot_cache[slot] = config
        return self._slot_cache[slot]

    def invalidate_cache(self, slot: Optional[SlotType] = None):
        """配置变更后清除缓存。slot=None 时清除全部。"""
        if slot:
            self._slot_cache.pop(slot, None)
        else:
            self._slot_cache.clear()

    @staticmethod
    def _merge_params(slot_config: dict, **overrides) -> dict:
        """请求参数覆盖槽位默认配置。请求级参数 > 槽位配置。"""
        params = {**slot_config}
        for k, v in overrides.items():
            if v is not None:
                params[k] = v
        params.pop("timeout_ms", None)  # timeout 由 LiteLLMAdapter 处理
        return params
```

### 6.2 LiteLLMAdapter（LiteLLM 封装层）

```python
# core/litellm_adapter.py

import litellm
from llm_service.core.encryption import decrypt_api_key

# 关闭 LiteLLM 内置日志，使用我们自己的审计日志
litellm.suppress_debug_info = True
litellm.set_verbose = False


class LiteLLMAdapter:
    """
    封装 LiteLLM 调用，统一处理：
    - Provider 配置到 LiteLLM 参数的映射
    - API Key 解密
    - 超时管理
    - 错误归一化
    """

    def __init__(self, encryption_key: str):
        self._encryption_key = encryption_key

    async def acompletion(
        self,
        provider: "ProviderConfig",
        model: str,
        messages: list[dict],
        stream: bool = False,
        **kwargs,
    ) -> "ChatResponse":
        """调用 LiteLLM completion。"""
        api_key = decrypt_api_key(provider.api_key_encrypted, self._encryption_key)
        timeout = provider.config.get("timeout_s", 60)

        litellm_model = self._build_model_string(provider, model)

        try:
            response = await litellm.acompletion(
                model=litellm_model,
                messages=messages,
                api_base=provider.base_url,
                api_key=api_key,
                stream=stream,
                timeout=timeout,
                extra_headers=provider.config.get("extra_headers", {}),
                **kwargs,
            )
            return self._to_chat_response(response)
        except litellm.exceptions.AuthenticationError as e:
            raise ProviderAuthError(provider_id=provider.id, detail=str(e))
        except (litellm.exceptions.Timeout, litellm.exceptions.APIConnectionError) as e:
            raise ProviderTimeoutError(provider_id=provider.id, detail=str(e))
        except litellm.exceptions.RateLimitError as e:
            raise ProviderRateLimitError(provider_id=provider.id, detail=str(e))
        except Exception as e:
            raise ProviderError(provider_id=provider.id, detail=str(e))

    async def aembedding(
        self,
        provider: "ProviderConfig",
        model: str,
        input: list[str],
    ) -> "EmbeddingResponse":
        """调用 LiteLLM embedding。"""
        api_key = decrypt_api_key(provider.api_key_encrypted, self._encryption_key)
        litellm_model = self._build_model_string(provider, model)

        try:
            response = await litellm.aembedding(
                model=litellm_model,
                input=input,
                api_base=provider.base_url,
                api_key=api_key,
                timeout=provider.config.get("timeout_s", 60),
            )
            return self._to_embedding_response(response)
        except Exception as e:
            raise ProviderError(provider_id=provider.id, detail=str(e))

    async def arerank(
        self,
        provider: "ProviderConfig",
        model: str,
        query: str,
        documents: list[str],
        top_n: int,
    ) -> "RerankResponse":
        """调用 LiteLLM rerank。"""
        api_key = decrypt_api_key(provider.api_key_encrypted, self._encryption_key)
        litellm_model = self._build_model_string(provider, model)

        try:
            response = await litellm.arerank(
                model=litellm_model,
                query=query,
                documents=documents,
                top_n=top_n,
                api_base=provider.base_url,
                api_key=api_key,
            )
            return self._to_rerank_response(response)
        except Exception as e:
            raise ProviderError(provider_id=provider.id, detail=str(e))

    @staticmethod
    def _build_model_string(provider: "ProviderConfig", model: str) -> str:
        """
        构建 LiteLLM 的 model 字符串。
        LiteLLM 使用 'provider_prefix/model_name' 格式，如 'openai/Qwen/Qwen2.5-72B-Instruct'。
        因为我们的 Provider 均兼容 OpenAI API，统一使用 'openai/' 前缀 + custom api_base。
        """
        return f"openai/{model}"
```

### 6.3 HealthChecker（健康检查器）

```python
# core/health_checker.py

from uuid import UUID
from datetime import timedelta

HEALTH_KEY_PREFIX = "llm:health:"
FAIL_COUNT_KEY_PREFIX = "llm:health:fail_count:"
UNHEALTHY_TTL = timedelta(seconds=300)     # 不健康状态最大持续时间
CONSECUTIVE_FAILURES_THRESHOLD = 3          # 连续失败 N 次标记为不健康
RECOVERY_PROBE_INTERVAL = 60                # 主动恢复探测间隔（秒）


class HealthChecker:
    """
    Provider 健康检查器。
    - 被动标记：调用失败时 mark_unhealthy
    - 主动恢复：后台定时任务探测不健康的 Provider
    - 状态缓存：Redis（llm:health:{provider_id}）
    """

    def __init__(self, redis_client):
        self._redis = redis_client

    async def is_healthy(self, provider_id: UUID) -> bool:
        """检查 Provider 是否健康。无 Redis 记录视为健康。"""
        key = f"{HEALTH_KEY_PREFIX}{provider_id}"
        status = await self._redis.get(key)
        if status is None:
            return True  # 无记录 = 健康（乐观策略）
        return status == b"healthy"

    async def mark_unhealthy(self, provider_id: UUID) -> None:
        """标记 Provider 为不健康。"""
        key = f"{HEALTH_KEY_PREFIX}{provider_id}"
        await self._redis.set(key, "unhealthy", ex=int(UNHEALTHY_TTL.total_seconds()))

        # 递增失败计数
        fail_key = f"{FAIL_COUNT_KEY_PREFIX}{provider_id}"
        await self._redis.incr(fail_key)
        await self._redis.expire(fail_key, int(UNHEALTHY_TTL.total_seconds()))

    async def mark_healthy(self, provider_id: UUID) -> None:
        """标记 Provider 为健康（恢复）。"""
        key = f"{HEALTH_KEY_PREFIX}{provider_id}"
        fail_key = f"{FAIL_COUNT_KEY_PREFIX}{provider_id}"
        await self._redis.delete(key, fail_key)

    async def get_all_unhealthy(self) -> list[UUID]:
        """获取所有不健康的 Provider ID（供主动恢复任务使用）。"""
        cursor = 0
        unhealthy_ids = []
        while True:
            cursor, keys = await self._redis.scan(
                cursor, match=f"{HEALTH_KEY_PREFIX}*", count=100,
            )
            for key in keys:
                if FAIL_COUNT_KEY_PREFIX not in key.decode():
                    status = await self._redis.get(key)
                    if status == b"unhealthy":
                        provider_id = key.decode().replace(HEALTH_KEY_PREFIX, "")
                        unhealthy_ids.append(UUID(provider_id))
            if cursor == 0:
                break
        return unhealthy_ids
```

### 6.4 主动恢复定时任务

```python
# main.py 中注册后台任务

from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()

@scheduler.scheduled_job("interval", seconds=RECOVERY_PROBE_INTERVAL)
async def recovery_probe():
    """
    主动恢复探测：对所有不健康的 Provider 发送轻量级探测请求。
    探测成功则标记为健康，失败则保持不健康等待下一次探测。
    """
    unhealthy_ids = await health_checker.get_all_unhealthy()
    for provider_id in unhealthy_ids:
        provider = await provider_service.get_by_id(provider_id)
        if provider is None or not provider.is_enabled:
            await health_checker.mark_healthy(provider_id)  # Provider 已删除/禁用，清除状态
            continue
        try:
            await litellm_adapter.test_connection(provider)
            await health_checker.mark_healthy(provider_id)
            logger.info(f"Provider {provider.slug} 恢复健康")
        except Exception:
            logger.debug(f"Provider {provider.slug} 恢复探测失败，等待下次探测")
```

### 6.5 API Key 加解密

```python
# core/encryption.py

import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

NONCE_SIZE = 12  # AES-GCM 推荐 nonce 长度


def encrypt_api_key(plain_key: str, encryption_key: str) -> str:
    """AES-256-GCM 加密 API Key，返回 base64 编码的 nonce + ciphertext。"""
    aesgcm = AESGCM(base64.b64decode(encryption_key))
    nonce = os.urandom(NONCE_SIZE)
    ciphertext = aesgcm.encrypt(nonce, plain_key.encode("utf-8"), None)
    return base64.b64encode(nonce + ciphertext).decode("utf-8")


def decrypt_api_key(encrypted_key: str, encryption_key: str) -> str:
    """AES-256-GCM 解密 API Key。"""
    aesgcm = AESGCM(base64.b64decode(encryption_key))
    raw = base64.b64decode(encrypted_key)
    nonce = raw[:NONCE_SIZE]
    ciphertext = raw[NONCE_SIZE:]
    return aesgcm.decrypt(nonce, ciphertext, None).decode("utf-8")
```

### 6.6 配置项

```python
# config.py

from pydantic_settings import BaseSettings

class LLMServiceSettings(BaseSettings):
    """llm-service 配置，从环境变量读取。"""

    # 数据库
    database_url: str = "postgresql+asyncpg://prism:prism@localhost:5432/prism"
    db_pool_size: int = 10              # SQLAlchemy pool_size（弹性 L0）
    db_max_overflow: int = 20           # SQLAlchemy max_overflow（弹性 L0）
    db_pool_timeout: int = 30           # 连接等待超时（秒）
    db_pool_recycle: int = 3600         # 连接回收时间（秒）

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # 加密
    api_key_encryption_key: str         # AES-256 密钥（base64 编码，32 字节）

    # 健康检查
    health_unhealthy_ttl_s: int = 300   # 不健康状态 TTL
    health_recovery_interval_s: int = 60 # 主动恢复探测间隔

    # Embedding 分片
    embedding_chunk_size: int = 20      # 每片最大条目数
    embedding_max_concurrency: int = 5  # 最大并发分片数

    # 服务
    service_host: str = "0.0.0.0"
    service_port: int = 8601

    # JWT（从 shared 读取）
    jwt_secret: str

    class Config:
        env_prefix = "LLM_"
        env_file = ".env"
```

---

## 7. 错误处理与弹性

### 7.1 异常分类

```python
# 异常层级

class LLMServiceError(Exception):
    """llm-service 基础异常"""
    code: str
    status_code: int

class SlotNotConfiguredError(LLMServiceError):
    """槽位未配置"""
    code = "SLOT_NOT_CONFIGURED"
    status_code = 503

class InvalidSlotError(LLMServiceError):
    """无效的槽位类型"""
    code = "INVALID_SLOT"
    status_code = 400

class ProviderError(LLMServiceError):
    """Provider 调用错误（基类）"""
    code = "PROVIDER_ERROR"
    status_code = 502

class ProviderAuthError(ProviderError):
    """Provider 认证失败"""
    code = "PROVIDER_AUTH_ERROR"

class ProviderTimeoutError(ProviderError):
    """Provider 超时"""
    code = "PROVIDER_TIMEOUT"

class ProviderRateLimitError(ProviderError):
    """Provider 限流"""
    code = "PROVIDER_RATE_LIMITED"

class AllProvidersUnavailableError(LLMServiceError):
    """所有 Provider 不可用"""
    code = "ALL_PROVIDERS_UNAVAILABLE"
    status_code = 503

class ProviderInUseError(LLMServiceError):
    """Provider 被引用，无法删除"""
    code = "PROVIDER_IN_USE"
    status_code = 409
```

### 7.2 故障转移策略

```
调用 chat(slot=reasoning)
  │
  ├─ 读取槽位配置：primary + fallback_chain
  │
  ├─ 候选列表 = [primary, fallback_1, fallback_2, ...]
  │
  ├─ 对每个候选：
  │   ├─ 检查 Redis 健康状态 → 不健康 → 跳过
  │   ├─ 调用 LiteLLM → 成功 → 返回（标记 degraded/fallback_depth）
  │   └─ 调用 LiteLLM → 失败 → mark_unhealthy → 继续下一个
  │
  └─ 所有候选用尽 → 503 ALL_PROVIDERS_UNAVAILABLE
```

**重试策略**：SlotRouter 自身不做重试，LiteLLM 层由 Provider 的 `config.max_retries`（默认 0）控制。故障转移本身就是一种"跨 Provider 重试"。

### 7.3 降级场景与用户感知

| 场景 | 行为 | 用户感知 |
|------|------|----------|
| 主 Provider 超时 | 自动切换到降级链下一个 | `degraded: true, fallback_depth: 1`，延迟增加 |
| 主 Provider 认证失败 | 标记不健康 + 降级 | 同上，管理员需更新 API Key |
| 主 Provider 限流 | 标记不健康（TTL 内）+ 降级 | 同上，TTL 到期后自动恢复 |
| 所有 Provider 不可用 | 返回 503 | 明确的错误提示 |
| 槽位未配置 | 返回 503 SLOT_NOT_CONFIGURED | 明确提示管理员配置槽位 |

### 7.4 弹性 L0（连接池配置）

```python
# 在 shared/db/session.py 中应用

from sqlalchemy.ext.asyncio import create_async_engine

engine = create_async_engine(
    settings.database_url,
    pool_size=settings.db_pool_size,           # 默认 10
    max_overflow=settings.db_max_overflow,      # 默认 20
    pool_timeout=settings.db_pool_timeout,      # 默认 30s
    pool_recycle=settings.db_pool_recycle,      # 默认 3600s
    pool_pre_ping=True,                         # 每次取连接前 ping 一下
)
```

### 7.5 审计日志

每次 SlotRouter 调用（成功或失败）均写入 `llm.audit_logs`：

- **成功**：status=success, latency_ms, token_usage, fallback_depth=0
- **降级成功**：status=degraded, latency_ms, token_usage, is_fallback=true, fallback_depth=N
- **失败**：status=failed, error_message, is_fallback

槽位配置变更产生结构化日志（满足 AC6）：

```python
logger.info(
    "slot_config_changed",
    extra={
        "slot_type": "reasoning",
        "before": {"provider": "siliconflow", "model": "Qwen2.5-72B"},
        "after": {"provider": "openrouter", "model": "qwen-2.5-72b"},
        "changed_by": user_id,
    },
)
```

---

## 8. 测试计划

### 8.1 单元测试

| 测试文件 | 覆盖目标 | Mock 策略 |
|----------|----------|-----------|
| `test_slot_router.py` | SlotRouter 核心逻辑 | Mock LiteLLMAdapter + HealthChecker + SlotService |
| `test_litellm_adapter.py` | LiteLLM 封装 | Mock `litellm.acompletion/aembedding/arerank` |
| `test_health_checker.py` | 健康检查 | Mock Redis（使用 `fakeredis`） |
| `test_provider_service.py` | Provider CRUD | Mock DB Session |
| `test_slot_service.py` | 槽位 CRUD | Mock DB Session |
| `test_encryption.py` | 加解密 | 无 Mock（纯函数） |

**SlotRouter 关键测试用例**：

```python
class TestSlotRouter:
    async def test_chat_success_primary(self):
        """主 Provider 成功，degraded=False, fallback_depth=0"""

    async def test_chat_fallback_on_primary_failure(self):
        """主 Provider 失败，降级到 fallback_chain[0]，degraded=True"""

    async def test_chat_all_providers_fail(self):
        """所有 Provider 失败，抛出 AllProvidersUnavailableError"""

    async def test_chat_skip_unhealthy_provider(self):
        """跳过已知不健康的 Provider"""

    async def test_chat_slot_not_configured(self):
        """未配置的槽位返回 SlotNotConfiguredError"""

    async def test_chat_invalid_slot_for_chat(self):
        """embedding/rerank 槽位不允许 chat 调用"""

    async def test_embedding_auto_chunking(self):
        """超过 chunk_size 时自动分片并发调用"""

    async def test_embedding_preserves_order(self):
        """分片合并后索引顺序正确"""

    async def test_audit_log_on_success(self):
        """成功调用写审计日志"""

    async def test_audit_log_on_failure(self):
        """失败调用写审计日志（含 error_message）"""

    async def test_cache_invalidation(self):
        """invalidate_cache 后下次调用重新从 DB 加载"""

    async def test_merge_params_override(self):
        """请求级参数覆盖槽位默认配置"""
```

### 8.2 集成测试

| 测试文件 | 覆盖场景 | 依赖 |
|----------|----------|------|
| `test_chat_api.py` | Chat API 端到端 | PostgreSQL + Redis + Mock LiteLLM |
| `test_embedding_api.py` | Embedding API + 分片 | PostgreSQL + Redis + Mock LiteLLM |
| `test_rerank_api.py` | Rerank API | PostgreSQL + Redis + Mock LiteLLM |
| `test_admin_api.py` | Provider/Slot CRUD | PostgreSQL |

**集成测试 Fixture**：

```python
# tests/conftest.py

@pytest.fixture
async def test_app():
    """创建测试用 FastAPI app，使用独立的测试数据库。"""
    async with create_test_engine() as engine:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        app = create_app(engine=engine, redis=FakeRedis())
        yield app

@pytest.fixture
async def seeded_providers(test_db_session):
    """预置 2 个 Provider + 4 个槽位配置。"""
    siliconflow = Provider(name="硅基流动", slug="siliconflow", ...)
    openrouter = Provider(name="OpenRouter", slug="openrouter", ...)
    ...
```

### 8.3 Mock 策略

| 外部依赖 | Mock 方式 | 说明 |
|----------|-----------|------|
| LiteLLM | `unittest.mock.patch("litellm.acompletion")` | 返回预定义的 ModelResponse |
| Redis | `fakeredis.aioredis.FakeRedis` | 完整模拟 Redis 行为 |
| PostgreSQL | 测试容器（testcontainers）或 SQLite（async） | 集成测试用 |
| 外部 LLM Provider | 不直接 Mock | 通过 Mock LiteLLM 间接隔离 |

---

## 9. 里程碑与工时

### 9.1 任务拆解

| 任务 | 工时（人天） | 依赖 | 产出 |
|------|-------------|------|------|
| T1: 项目脚手架 + 数据模型 | 1 | shared 库就位 | DDL + ORM + Alembic 迁移 + 配置 |
| T2: Provider CRUD + 加密 | 2 | T1 | Provider API + AES-256-GCM 加解密 |
| T3: 槽位 CRUD | 1 | T1, T2 | Slot Admin API + 配置热加载 |
| T4: LiteLLMAdapter 封装 | 1.5 | T1 | LiteLLM 集成 + 错误归一化 |
| T5: SlotRouter 核心 | 2 | T3, T4 | 故障转移 + 审计日志 + 参数合并 |
| T6: HealthChecker | 1 | Redis 就位 | 被动标记 + 主动恢复 + Redis 缓存 |
| T7: Chat API | 1 | T5, T6 | POST /api/llm/chat（含流式） |
| T8: Embedding API + 分片 | 1 | T5, T6 | POST /api/llm/embedding + 自动分片 |
| T9: Rerank API | 0.5 | T5, T6 | POST /api/llm/rerank |
| T10: 连通性测试 API | 0.5 | T2, T4 | Provider 测试 + 槽位测试 |
| T11: 弹性 L0 | 0.5 | T1 | 连接池显式配置 |
| T12: 单元测试 | 2 | T1-T10 | 覆盖率 > 80% |
| T13: 集成测试 + 联调 | 1.5 | T12 | 端到端验证 |

**总计**：约 15.5 人天

### 9.2 依赖关系

```mermaid
gantt
    title LLM Service M1 任务甘特图
    dateFormat  X
    axisFormat  Day %s

    section 基础
    T1 项目脚手架 + 数据模型    :t1, 0, 1d
    T11 弹性 L0                 :t11, after t1, 0.5d

    section Provider 管理
    T2 Provider CRUD + 加密      :t2, after t1, 2d
    T10 连通性测试 API           :t10, after t2, 0.5d

    section 核心路由
    T4 LiteLLM Adapter          :t4, after t1, 1.5d
    T6 HealthChecker            :t6, after t1, 1d
    T3 槽位 CRUD                :t3, after t2, 1d
    T5 SlotRouter               :t5, after t3, 2d

    section 调用 API
    T7 Chat API                 :t7, after t5, 1d
    T8 Embedding API            :t8, after t5, 1d
    T9 Rerank API               :t9, after t5, 0.5d

    section 测试
    T12 单元测试                :t12, after t9, 2d
    T13 集成测试 + 联调         :t13, after t12, 1.5d
```

### 9.3 检查清单

- [ ] **T1**：`llm` Schema DDL 可执行，Alembic 迁移通过
- [ ] **T2**：Provider CRUD API 可用，API Key 加解密正确
- [ ] **T3**：4 个槽位可配置，配置变更即时生效（AC4）
- [ ] **T4**：LiteLLM acompletion/aembedding/arerank 调用正常
- [ ] **T5**：故障转移链按顺序执行，审计日志完整（含变更前后快照，AC6）
- [ ] **T6**：被动标记 + 主动恢复，Redis 状态正确
- [ ] **T7**：Chat API 非流式/流式均可用，slot 参数生效
- [ ] **T8**：Embedding API 自动分片，60 条文本分 3 片并发，结果索引正确
- [ ] **T9**：Rerank API 返回排序结果
- [ ] **T10**：Provider 连通性测试 10 秒内返回（AC2），槽位连通性测试覆盖主模型 + 降级链
- [ ] **T11**：SQLAlchemy pool_size/max_overflow 显式配置，可通过环境变量调整
- [ ] **T12**：单元测试覆盖率 > 80%，SlotRouter 所有故障转移路径覆盖
- [ ] **T13**：端到端：创建 Provider → 配置槽位 → Chat 调用 → 模拟降级 → 验证审计日志
- [ ] **Go/No-Go**：Chat API 可用 + 降级演示通过 + 4 槽位可配置 + 未配置槽位返回 503 SLOT_NOT_CONFIGURED（AC5）
