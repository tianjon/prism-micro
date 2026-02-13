# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Prism 是一个 **AI 驱动的 VOC（Voice of Customer）语义分析平台**（monorepo + uv workspace），通过涌现式标签系统帮助产品团队从海量客户反馈中发现未知问题。

### 服务架构

| 服务 | 路径 | 职责 |
|------|------|------|
| shared | `shared/` | 共享库：DB session、JWT 工具、认证中间件、通用模型、异常体系 |
| llm-service | `llm-service/` | LLM 统一网关：4 槽位模型（fast/reasoning/embedding/rerank）、SlotRouter、故障转移 |
| user-service | `user-service/` | 用户认证：注册/登录/JWT/API Key |
| voc-service | `voc-service/` | VOC 数据处理：数据导入、AI 管线（三阶段）、语义搜索、涌现标签 |
| agent-service | `agent-service/` | Agent 运行时：Principal 抽象、SkillRegistry、精简 AgentLoop |
| web | `apps/web/` | 前端 SPA（React + Vite + shadcn/ui） |
| cli | `apps/cli/` | 命令行工具（Typer），供 AI Agent 和爬虫触发使用 |

### 依赖方向（不可逆，`import-linter` 强制检查）

```
apps/web, apps/cli → (HTTP) → llm-service, voc-service, agent-service, user-service → (import) → shared → PostgreSQL, Redis, Neo4j
```

- 各后端服务之间互不 import，仅通过 HTTP API 通信
- shared 不依赖任何上层服务
- 违反依赖方向的代码 CI 自动拦截

### 数据库隔离

共用 PostgreSQL 实例，按 Schema 隔离，每个 Schema 独立 Alembic 迁移环境：

| Schema | 归属 | 说明 |
|--------|------|------|
| `auth` | user-service | 用户、API Key |
| `llm` | llm-service | Provider 配置、ModelSlot（4 槽位） |
| `agent` | agent-service | SkillRegistry、AgentExecutionLog |
| `voc` | voc-service | Voice、SemanticUnit、EmergentTag、TagFeedback、SchemaMapping、IngestionBatch |

跨 Schema 不允许外键（唯一例外：`voc.tag_feedback.user_id → auth.user.id`）。

## 开发环境搭建

### 前置依赖
- Docker & Docker Compose
- [uv](https://docs.astral.sh/uv/)（Python 包管理器）
- Node.js（前端开发）

### 一键初始化
```bash
scripts/init-local-env.sh
```

### Python 环境
虚拟环境位于 `~/.base-venv/`（非项目内 `.venv`），通过 `.env` 中的 `UV_PROJECT_ENVIRONMENT` 配置。

```bash
uv run python main.py                          # uv run 自动读取 .env
UV_PROJECT_ENVIRONMENT=~/.base-venv uv sync     # uv sync 需显式设置
```

Python 版本锁定为 3.12（见 `.python-version`）。

## 基础设施

| 服务 | 镜像 | 端口 | 连接信息 |
|------|------|------|----------|
| PostgreSQL + pgvector | pgvector/pgvector:pg17 | 5432 | `prism`/`prism`/`prism` |
| Redis | redis:7-alpine | 6379 | 无密码 |
| Neo4j | neo4j:5 | 7474/7687 | `neo4j`/`prism`（Phase 1 仅最小连接层） |

数据持久化到 `~/.prism/data/{postgres,redis,neo4j}/`。

## 技术选型

- **后端**: FastAPI + SQLAlchemy 2.0 (async) + Alembic + Pydantic v2
- **LLM 调用**: LiteLLM（通过 SlotRouter 封装，业务代码不直接调用 LiteLLM API）
- **前端**: React + Vite + shadcn/ui + Tailwind CSS + Zustand
- **前端设计系统**: Liquid Glass（Dark Mode Only），定义在 `apps/web/src/styles/globals.css`
- **前端图标**: Lucide React + `ICON_SIZE` 常量体系（`apps/web/src/lib/icon-sizes.ts`）
- **CLI**: Typer
- **HTTP 客户端**: httpx
- **向量检索**: pgvector（4096 维，Qwen-Embedding-8B）

## 关键设计

### LLM 4 槽位模型（替代原别名系统）

4 个能力槽位，每个槽位配置主模型 + 降级链：

| 槽位 | 用途 | 典型模型 |
|------|------|---------|
| `fast` | 格式校验、快速分类、标签标准化 | Qwen2.5-7B |
| `reasoning` | 语义拆解、标签涌现、合成数据 | Qwen2.5-72B |
| `embedding` | 文本向量化 | Qwen-Embedding-8B |
| `rerank` | 搜索结果重排序 | BGE-reranker-v2-m3 |

SlotRouter 封装 LiteLLM 调用，承载故障转移、审计日志、Embedding 批量分片。

### AI 管线（三阶段）

```
Stage 1（语义拆解）→ Stage 2（标签涌现 + 标准化）→ Stage 3（向量化）
```

管线代码组织在 voc-service 的 `pipeline/` 目录下，Prompt 模板在 `prompts/` 下版本化管理。

### API 路径约定

| 路径前缀 | 服务 |
|----------|------|
| `/api/auth/*` | user-service |
| `/api/llm/*` | llm-service |
| `/api/voc/*` | voc-service |
| `/api/agent/*` | agent-service |

### 响应格式

```json
// 成功
{ "data": ..., "meta": { "request_id": "uuid", "timestamp": "ISO 8601" } }

// 列表
{ "data": [...], "pagination": { "page": 1, "page_size": 20, "total": 100 }, "meta": {...} }

// 错误
{ "error": { "code": "DOMAIN_ERROR_NAME", "message": "..." }, "meta": {...} }
```

错误码按域前缀组织：`AUTH_*`、`LLM_*`、`VOC_*`、`AGENT_*`、`VALIDATION_*`。

## 项目结构（Phase 1 目标状态）

```
prism-micro/
├── pyproject.toml                  # 根项目（uv workspace）
├── docker-compose.yml              # 基础设施
├── CLAUDE.md                       # 本文件
├── scripts/                        # 运维脚本
├── shared/                         # 共享库
│   └── src/prism_shared/
│       ├── auth/                   # 认证中间件
│       ├── db/                     # DB session
│       ├── schemas/                # 通用 Pydantic 模型
│       └── exceptions.py           # 统一异常体系
├── llm-service/                    # LLM 统一网关
│   └── src/llm_service/
│       ├── api/                    # API 路由
│       ├── core/                   # SlotRouter、故障转移、LiteLLM 封装
│       ├── models/                 # SQLAlchemy ORM
│       └── migrations/             # Alembic（llm schema）
├── user-service/                   # 用户认证
│   └── src/user_service/
│       ├── api/
│       ├── core/
│       ├── models/
│       └── migrations/             # Alembic（auth schema）
├── voc-service/                    # VOC 数据处理
│   └── src/voc_service/
│       ├── api/                    # VOC API 路由
│       ├── core/                   # 业务逻辑
│       ├── pipeline/               # AI 管线（Stage 1/2/3）
│       ├── prompts/                # Prompt 模板（版本化）
│       ├── models/                 # SQLAlchemy ORM
│       └── migrations/             # Alembic（voc schema）
├── agent-service/                  # Agent 运行时
│   └── src/agent_service/
│       ├── api/
│       ├── core/                   # Principal、SkillRegistry、AgentLoop
│       ├── skills/                 # Skill 定义（YAML）
│       ├── models/
│       └── migrations/             # Alembic（agent schema）
├── apps/
│   ├── web/                        # 前端 React SPA
│   │   └── src/features/           # 按功能域组织
│   │       ├── auth/
│   │       ├── import/
│   │       ├── search/
│   │       ├── tags/
│   │       ├── admin/
│   │       └── studio/
│   └── cli/                        # CLI 工具
│       └── src/prism_cli/
│           └── commands/           # 子命令
├── tools/
│   └── crawlers/                   # 爬虫脚本（独立包，Wave 2）
│       ├── dongchedi/
│       └── weibo/
├── tests/
│   └── fixtures/
│       └── golden/                 # Golden Dataset（AI 管线回归测试）
├── docs/
│   ├── prd/                        # 产品需求文档
│   │   └── 02-prd-phase1.md        # PRD v2.0（权威需求来源）
│   ├── designs/                    # 实现级设计文档
│   │   ├── platform/design.md
│   │   ├── llm-service/design.md
│   │   ├── voc-service/design.md
│   │   ├── agent-service/design.md
│   │   └── frontend/design.md
│   ├── dev-team/                   # 开发团队与辩论记录
│   └── roadmap.md                  # 技术路线图
└── openspec/                       # OpenSpec 规格
```

### 前端架构要点

- **布局体系**：`Layout.tsx` 提供主侧边栏（支持收缩），页面通过 `<PageContainer>` 自行决定限宽
- **设计系统**：Liquid Glass（`glass-*` CSS 工具类），完整规范见 `.claude/rules/frontend-ui.md`
- **功能域**：`features/admin/`（Provider/Slot 管理）、`features/studio/`（Playground/槽位测试）、`features/auth/`（登录）
- **Studio 架构**：Playground 采用 OpenAI 风格左右分栏（`PlaygroundHeader` + `PlaygroundSidebar` + 内容区切换 Chat/Embedding/Rerank）

## 设计文档

### 权威文档（当前有效）
- `docs/prd/02-prd-phase1.md` — PRD v2.0（产品需求权威来源）
- `docs/designs/platform/design.md` — 平台基础设施设计
- `docs/designs/llm-service/design.md` — LLM 服务设计（4 槽位模型）
- `docs/designs/voc-service/design.md` — VOC 服务设计（AI 管线、数据导入、搜索）
- `docs/designs/agent-service/design.md` — Agent 服务设计（精简版）
- `docs/designs/frontend/design.md` — 前端 & CLI 设计

### 参考文档
- `docs/roadmap.md` — 技术路线图

## OpenSpec 工作流

项目使用 OpenSpec（spec-driven schema）管理变更，通过 `/opsx:*` 技能调用。

已有规格（`openspec/specs/`）：
- `infra-docker-compose` — 容器编排规格
- `local-storage-layout` — 本地存储目录规范
- `uv-env-setup` — Python 环境配置规范
