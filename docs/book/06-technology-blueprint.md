# 技术蓝图

---

## TL;DR（高管速读版）

技术选型不是购物——不是"市场上什么最火就选什么"，而是"在我们的约束条件下，什么组合能让团队以最低认知负荷、最高交付速度前进"。

Prism 的技术栈可以用一句话概括：**Python 异步全栈 + PostgreSQL 一库多 Schema + 前端渐进式 React**。这不是最"性感"的组合，但它是在"3-5 人团队、AI 密集型产品、快速迭代"这个约束空间里的全局最优解。

核心选型逻辑：
- **后端选 FastAPI**，不是因为它快（Go 更快），而是因为 AI/ML 生态 90% 在 Python，切换语言意味着放弃整个工具链
- **数据库选 PostgreSQL + pgvector**，不是因为它新（Pinecone 更新），而是因为"关系数据 + 向量数据"共存于同一事务边界，省掉了数据一致性的噩梦
- **前端选 React + shadcn/ui**，不是因为团队偏好（Vue 也行），而是因为 AI 辅助编码在 React 生态上的训练数据最充分，开发效率有实证优势
- **包管理选 uv workspace**，不是因为它流行（poetry 更流行），而是因为 monorepo 场景下它是唯一能做到"一个 lockfile 管多个子项目"的方案

每一项选型背后都有明确的替代方案和淘汰理由。技术蓝图不是"信仰宣言"，而是"约束条件下的工程决策备忘录"。

---

## 1. 技术选型矩阵

### 1.1 后端：为什么是 Python + FastAPI，而不是 Go 或 Node.js

| 组件 | 选型 | 核心理由 |
|------|------|---------|
| Web 框架 | FastAPI | 原生 async、自动 OpenAPI 文档、Pydantic 深度集成 |
| ORM | SQLAlchemy 2.0 (async) | 20 年生态积累、完整的 async 支持、类型注解友好 |
| 数据库迁移 | Alembic | SQLAlchemy 标配、支持多 Schema 独立迁移 |
| 数据验证 | Pydantic v2 | 性能提升 5-50x（Rust 核心）、FastAPI 原生集成 |
| HTTP 客户端 | httpx | 异步支持、与 OpenAI 兼容 API 格式对齐 |
| LLM 调用层 | LiteLLM | 覆盖 100+ Provider、统一接口、支持流式 |
| 任务调度 | APScheduler | Provider 健康检查等轻量级定时任务 |
| 密码哈希 | passlib + bcrypt | OWASP 推荐方案 |

**为什么不选 Go？**

Go 的编译速度和运行时性能确实优于 Python。但 Prism 是 AI 密集型产品——LLM 调用、Embedding 生成、语义分析、Prompt 工程——这些场景的工具链 90% 在 Python 生态中。选 Go 意味着要么用 CGo 桥接 Python 库（性能收益全部被桥接开销吃掉），要么自己用 Go 重写这些工具（团队规模不允许）。

更关键的是：Prism 的性能瓶颈不在 Web 框架的请求处理速度上，而在外部 LLM API 的网络延迟上。一次 LLM 调用 500ms-3s，框架本身快 10ms 还是快 1ms，对用户体验的影响可以忽略。

**为什么不选 Node.js/TypeScript？**

Node.js 的异步模型确实成熟，全栈 TypeScript 的类型一致性也有吸引力。但 Node.js 在科学计算和 AI/ML 领域的生态远不如 Python。LiteLLM、LangChain、各种 Embedding 库——这些工具的 Node.js 版本要么不存在，要么是社区维护的二等公民。

**选型结论**：在 AI 产品赛道上，Python 不是"最好的语言"，而是"没有替代品的语言"。FastAPI 则是 Python 异步 Web 框架中 DX（开发者体验）最好的那个——自动文档、自动验证、自动序列化，让团队可以把精力放在业务逻辑上，而不是样板代码上。

### 1.2 前端：React 19 + Vite + shadcn/ui

| 组件 | 选型 | 核心理由 |
|------|------|---------|
| UI 框架 | React 19 | 生态最大、AI 辅助编码训练数据最充分 |
| 构建工具 | Vite | 冷启动 <300ms、HMR 即时生效 |
| 组件库 | shadcn/ui + Tailwind CSS | 组件代码直接 copy 进项目、完全可控 |
| 路由 | React Router v7 | React 生态标准选择 |
| 状态管理 | Zustand | 2KB gzip、API 极简、无 Provider 嵌套 |
| HTTP | 原生 fetch + SWR | 自动缓存、自动重验证、无需额外抽象层 |

**为什么选 shadcn/ui 而不是 Ant Design 或 MUI？**

这个选择需要特别解释，因为它违反了"选最成熟的"这个常见直觉。

Ant Design 和 MUI 都是"黑盒组件库"——你引入一个 `<Table>` 组件，它的 DOM 结构、CSS 样式、交互逻辑都是封装好的。这在做"标准 CRUD 后台"时很高效，但在做"需要深度定制交互的 AI 产品"时就成了枷锁。当你需要在表格里嵌入一个流式输出的 LLM 对话气泡时，Ant Design 的 Table 组件会让你痛不欲生。

shadcn/ui 的哲学完全不同：它不是一个"库"，而是一个"组件代码生成器"。你运行 `npx shadcn-ui add button`，它会把 Button 组件的源代码直接复制到你的项目里。从此这个组件就是你的代码，你可以随意修改。这对于 AI 辅助编码尤其友好——Claude 或 Cursor 可以直接读取和修改组件源码，而不需要理解某个 UI 库的内部 API。

**为什么选 Zustand 而不是 Redux？**

一个字：简单。Redux 解决的是"大型团队在大型应用中管理复杂状态"的问题。Prism 的前端在 Phase 1-3 的复杂度远未达到需要 Redux 的程度。Zustand 的 store 定义只需要 10 行代码，Redux 需要 50 行（action + reducer + selector + thunk）。当未来复杂度确实增长时，Zustand 到 Redux 的迁移成本也很低——两者的状态管理哲学是兼容的。

### 1.3 AI 层：LiteLLM + pgvector

| 组件 | 选型 | 核心理由 |
|------|------|---------|
| LLM 统一调用 | LiteLLM | 100+ Provider 统一接口、免去自建 N 个适配器 |
| 向量存储 | pgvector (PostgreSQL 扩展) | 与业务数据同一事务边界、无需运维额外服务 |
| Embedding 模型 | BGE-large-zh-v1.5 (via 硅基流动) | 中文语义理解最优、1024 维向量 |
| 向量索引 | HNSW (pgvector) | 高召回率、支持增量插入、无需重建索引 |

**为什么选 LiteLLM 而不是自建 Provider 适配器？**

Prism 的早期设计中确实规划了自建的 Provider 适配层（`providers/base.py` + 各 Provider 实现）。但深入分析后发现：四家 Provider（硅基流动、OpenRouter、Kimi、MiniMax）都兼容 OpenAI API 格式，差异仅在 Base URL、额外 Headers 和能力矩阵。这类"协议层适配"的工作，LiteLLM 已经做到了极致——覆盖 100+ Provider，社区持续维护。

自建适配器的价值 = 定制灵活性。但这个灵活性的代价是：每新增一个 Provider 就要写适配代码、写测试、处理各种边缘情况。LiteLLM 通过抽象层隔离了这些脏活。Prism 自建的 `providers/` 层退化为 LiteLLM 的配置映射层，只负责"把数据库里的 Provider 配置翻译成 LiteLLM 的参数格式"。

**为什么选 pgvector 而不是 Pinecone / Milvus？**

这是一个"运维复杂度 vs 性能极限"的权衡。

| 方案 | 向量性能 | 运维成本 | 事务一致性 |
|------|---------|---------|-----------|
| Pinecone | 最优 | 最低（全托管） | 无（独立系统） |
| Milvus | 优秀 | 高（需独立部署集群） | 无 |
| **pgvector** | 良好 | **最低**（PostgreSQL 扩展） | **有（同一事务）** |

Prism 选择 pgvector 的决定性理由是"事务一致性"。当一条 Voice 被拆解为 SemanticUnit 并生成 Embedding 时，这三个操作必须在同一个数据库事务中完成——要么全成功，要么全回滚。如果 Embedding 存储在外部系统（Pinecone/Milvus），就需要引入分布式事务或最终一致性方案，复杂度飙升。

pgvector 的性能在百万级向量规模内完全够用（HNSW 索引的 ANN 召回率 >95%），而 Prism Phase 3-4 的数据量预期不会超过这个量级。当数据量真的增长到需要专用向量数据库时，迁移路径也是清晰的：将 pgvector 中的向量数据导出到 Milvus，业务层只需改查询目标。

### 1.4 基础设施：PostgreSQL 17 + Redis 7 + Docker Compose + uv

| 组件 | 选型 | 核心理由 |
|------|------|---------|
| 关系数据库 | PostgreSQL 17 + pgvector | ACID 事务 + 向量检索统一 |
| 缓存 | Redis 7 (Alpine) | 健康状态缓存、Token 黑名单、执行上下文快照 |
| 容器编排 | Docker Compose | 开发环境一键启动、生产环境可平滑过渡 K8s |
| Python 包管理 | uv (workspace 模式) | Monorepo 唯一可行方案、速度是 pip 的 10-100x |

**为什么选 uv 而不是 poetry 或 pip？**

这个选择在 2025-2026 年的 Python 生态中需要特别说明。Poetry 是过去三年的主流选择，但它对 monorepo workspace 的支持非常有限——多个子项目之间的 path dependency 处理有大量 bug，lockfile 策略也不支持跨子项目的统一锁定。

uv 由 Astral（ruff 的作者团队）开发，用 Rust 实现。它的 workspace 模式完美匹配 Prism 的 monorepo 结构：

```toml
# 根 pyproject.toml
[tool.uv.workspace]
members = ["shared", "llm-service", "user-service", "apps/cli"]
```

所有子项目共享同一个 `uv.lock`，依赖解析速度比 pip 快 10-100 倍。更重要的是，子项目之间可以通过 path dependency 直接引用，开发时无需发布包：

```toml
# llm-service/pyproject.toml
[project]
dependencies = ["prism-shared"]

[tool.uv.sources]
prism-shared = { workspace = true }
```

---

## 2. 后端架构详解

### 2.1 Monorepo + uv Workspace 策略

Prism 采用"一个仓库、多个子项目、统一工具链"的 monorepo 策略。这不是唯一选择，但在当前阶段是最合理的选择。

**Monorepo vs Polyrepo 对比**：

| 维度 | Monorepo (Prism 选择) | Polyrepo |
|------|---------------------|----------|
| 代码共享 | path dependency，零发布成本 | 需要私有 PyPI 或 Git submodule |
| 重构 | 跨服务重构一次 PR 搞定 | 需要协调多个仓库的 PR |
| CI/CD | 需要智能构建（只构建变更的子项目） | 每个仓库独立 pipeline |
| 适合团队规模 | < 20 人 | > 20 人 |

3-5 人团队选 polyrepo 是自找麻烦。当团队规模增长到需要拆分时，从 monorepo 到 polyrepo 的迁移路径是清晰的——因为每个子项目已经有独立的 `pyproject.toml` 和 `migrations/`。

**虚拟环境策略**：

Prism 使用统一的外部虚拟环境（`~/.base-venv/`），而非项目内的 `.venv/`。通过 `.env` 文件中的 `UV_PROJECT_ENVIRONMENT` 指向该路径。所有子项目共享同一个 Python 环境，避免了多环境同步的维护负担。

### 2.2 服务间通信：HTTP REST + JSON

当前阶段，所有服务间通信通过 HTTP REST API，使用 JSON 作为数据格式。这是一个"刻意保守"的选择。

gRPC 性能更好、类型更安全，为什么不用？因为：

1. **调试成本**：HTTP + JSON 可以用 curl 直接调试，gRPC 需要专用工具
2. **前端兼容**：浏览器原生支持 HTTP，gRPC-Web 需要额外的代理层
3. **CLI 兼容**：Typer CLI 调用 HTTP API 是天然的，调用 gRPC 需要生成 stub
4. **当前瓶颈不在这**：服务间通信的主要延迟来自 LLM API 调用（500ms-3s），不在序列化格式上

当未来出现真正的性能瓶颈（例如 Agent Loop 每秒需要高频调用多个内部服务），再针对性引入 gRPC。

### 2.3 异步管线编排

Prism 的核心数据处理流程是异步的。一条 Voice 从进入系统到完成分析，需要经过多个步骤——文本清洗、语义拆解、Embedding 生成、标签提取、关系推断——每一步都涉及 LLM 调用或向量计算。

FastAPI 的 async/await 模型为这种 IO 密集型工作流提供了天然支持。以语义拆解管线为例：

```
Voice 进入 → [清洗] → [LLM 拆解] → [Embedding 生成] → [标签提取] → [写入 DB]
                          ↓               ↓                ↓
                      异步 LLM 调用   异步 Embedding API   异步 LLM 调用
```

每一步都是 `async` 函数，IO 等待期间不阻塞事件循环。当多条 Voice 并发处理时，Python 的单线程事件循环能同时管理数十个并发 LLM 调用——瓶颈永远是外部 API 的响应速度，而非框架本身。

### 2.4 多 Schema 隔离与迁移策略

所有服务共用一个 PostgreSQL 实例（`prism` 数据库），通过 Schema 实现逻辑隔离：

| Schema | 所属服务 | 核心表 |
|--------|---------|--------|
| `auth` | user-service | users, api_keys |
| `llm` | llm-service | providers, models, aliases |
| `voc` | voice-service (Phase 3) | voices, semantic_units, emergent_tags, unit_tags |
| `agent` | agent-runtime (Phase 2.5) | skills, executions, contexts |

**Alembic per-Schema 迁移**：每个服务维护独立的 Alembic 迁移目录（`migrations/`），迁移脚本通过 `target_metadata` 绑定到对应的 Schema。这意味着 `llm-service` 的表结构变更不会影响 `user-service` 的迁移历史，反之亦然。

这种隔离策略的升级路径非常清晰：当某个 Schema 的数据量增长到需要独立扩展时，只需将该 Schema 迁移到独立的 PostgreSQL 实例，修改对应服务的连接字符串即可——应用代码零改动。

---

## 3. 前端架构详解

### 3.1 渐进式 UI 策略

Prism 的前端不是一次性交付的"完整产品"，而是按阶段渐进构建的：

| 阶段 | UI 交付物 | 复杂度 |
|------|----------|--------|
| Phase 1-2 | 登录页 + LLM Provider/Model/Alias 配置页 | 标准 CRUD |
| Phase 3 | VOC 数据浏览 + 语义片段检索 | 列表/详情 + 搜索 |
| Phase 4 | 概念治理台（标签合并、层级管理） | 拖拽交互 + 批量操作 |
| Phase 5-6 | Agent 对话界面 + 分析工作台 | SSE 流式 + 多会话 + 可视化 |

这种渐进策略的好处是：前端的技术复杂度与产品复杂度同步增长，而不是在 Day 1 就引入所有你"将来可能需要"的库。

### 3.2 类型安全 API 客户端层

后端使用 FastAPI，天然生成 OpenAPI 3.0 规范文档。前端可以基于这份规范自动生成 TypeScript 类型定义，实现端到端的类型安全：

```
FastAPI 路由定义 → 自动生成 OpenAPI JSON → openapi-typescript 生成 TS 类型 → 前端 fetch 函数带类型
```

这消除了前后端"接口文档不同步"的经典痛点。当后端修改了一个 API 的响应字段，前端在编译期就能捕获类型错误，而不是在运行时才发现 `undefined`。

### 3.3 SSE 流式通信

LLM 的流式输出是 Prism 的核心交互体验。从 Phase 2 开始，Chat API 支持 SSE（Server-Sent Events）流式响应，前端实时展示 LLM 的逐 token 输出。

**为什么选 SSE 而不是 WebSocket？**

SSE 是单向通信（服务端 → 客户端），WebSocket 是双向通信。LLM 流式输出场景下，客户端发一次请求，服务端持续推送 token——这是典型的单向流。SSE 基于标准 HTTP，不需要额外的握手协议，与 OpenAI 的流式响应格式完全一致。这意味着前端处理 Prism 的流式响应和处理 OpenAI 的流式响应，可以复用同一套代码。

### 3.4 状态管理演进

前端状态管理遵循"按需升级"原则：

```
Phase 1-2: React useState + SWR（服务端状态缓存）
    ↓ 当需要跨组件共享状态时
Phase 3-4: Zustand store（全局状态管理）
    ↓ 当需要管理多个并发会话时
Phase 5-6: Zustand + 会话隔离 store（多 Agent 会话）
```

不在 Day 1 引入 Redux Toolkit + RTK Query 的全套方案。状态管理的复杂度应该跟随业务复杂度自然生长，而不是预先过度设计。

---

## 4. AI 基础设施

### 4.1 LLM 统一调用层

Prism 的 LLM 调用架构分为三层——这是整个系统最关键的技术设计之一：

```
┌─────────────────────────────────────────────────────┐
│  别名层 (Alias)                                      │
│  default-chat → 解析到 Model + Provider              │
│  default-embedding → 解析到 Model + Provider          │
├─────────────────────────────────────────────────────┤
│  路由层 (Router)                                     │
│  别名解析 → 健康检查 → 故障转移 → 降级链               │
├─────────────────────────────────────────────────────┤
│  适配层 (LiteLLM)                                    │
│  统一 API → 各 Provider 的差异屏蔽                     │
│  硅基流动 / OpenRouter / Kimi / MiniMax / ...         │
└─────────────────────────────────────────────────────┘
```

**别名层**是 Prism 的核心创新。调用方使用 `default-chat` 这样的语义化别名，而非 `siliconflow/Qwen/Qwen2.5-72B-Instruct` 这样的具体模型标识。别名背后绑定了主模型和有序降级链，路由层负责自动解析、健康检查和故障转移。

这种设计让"更换 Provider"或"升级模型"变成一次数据库配置变更，而非代码改动。产品团队甚至可以在管理界面上自助完成这个操作。

**故障转移机制**：

```
调用 default-chat
  ├─ 主模型: siliconflow / Qwen2.5-72B → 成功则返回
  ├─ 降级 1: openrouter / Qwen2.5-72B → 成功则返回（标记 degraded=true）
  └─ 降级 2: kimi / moonshot-v1-8k    → 成功则返回（标记 degraded=true）
                                        → 全部失败则返回 503
```

健康检查采用"被动检测 + 主动恢复"双机制：调用失败时立即标记 Provider 为不健康（状态缓存在 Redis），不健康的 Provider 每 60 秒做一次恢复探测。这避免了将流量持续发往已知故障的 Provider。

### 4.2 Embedding + pgvector 向量检索

向量检索是 Prism VOC 分析能力的基石。每条 SemanticUnit 在创建时同步生成 Embedding 向量，存储在 PostgreSQL 的 pgvector 扩展中。

**索引策略**：

| 索引类型 | 适用场景 | Prism 选择 |
|---------|---------|-----------|
| IVFFlat | 数据量大、可接受略低召回率 | Phase 3 初期（数据量 < 10 万） |
| HNSW | 需要高召回率、支持增量插入 | Phase 4 起（数据量增长后切换） |

HNSW 索引的核心优势是：新数据插入时不需要重建索引，这对持续摄入 Voice 数据的场景至关重要。IVFFlat 虽然构建速度快，但增量插入需要周期性重新训练聚类中心。

**查询模式**：

```sql
-- 语义近邻搜索：找到与目标片段语义最相似的 20 条
SELECT id, content, summary,
       embedding <=> $1 AS distance
FROM voc.semantic_units
WHERE tenant_id = $2
ORDER BY embedding <=> $1
LIMIT 20;
```

pgvector 的 `<=>` 操作符执行余弦距离计算，结合 HNSW 索引可以在毫秒级完成百万规模的近邻搜索。

### 4.3 Prompt 工程规范

Prism 的 LLM 调用不是"随便写一段提示词然后祈祷"。所有 Prompt 遵循结构化模板，确保输出的稳定性和可预测性：

```
# 角色定义 → 限定 LLM 的行为边界
# 任务说明 → 明确输入/输出的映射关系
# 输出格式 → JSON Schema 严格约束
# 约束条件 → 边界情况处理规则
# 少样本示例 → 通过实例校准输出质量
# 错误处理 → 异常输入的降级策略
```

**四条核心原则**：
1. **明确任务边界**：不说"分析反馈"，要说"将反馈拆解为独立语义片段，每个片段表达一个完整观点"
2. **结构化输出**：所有 LLM 输出必须是 JSON 格式，附带 JSON Schema 校验
3. **提供示例**：每个 Prompt 至少包含 2-3 个少样本示例，校准输出风格
4. **错误处理指引**：告诉 LLM 遇到空输入、非目标内容、敏感信息时如何降级处理

### 4.4 LLM 输出守卫：三级降级

LLM 的输出不可控是所有 AI 产品的共同挑战。Prism 设计了三级降级机制来应对：

| 级别 | 触发条件 | 处理方式 |
|------|---------|---------|
| L1: Schema 校验 | LLM 输出不符合预期 JSON Schema | 提取可用字段、缺失字段填充默认值 |
| L2: 重试 | L1 校验失败且无法部分解析 | 换用更强模型重新调用（最多 2 次） |
| L3: 人工兜底 | L2 重试全部失败 | 标记为处理失败、进入人工审核队列 |

这种设计确保了系统的鲁棒性——LLM 不是黑盒赌博，而是有明确 SLA 保障的服务组件。

---

## 5. 数据模型概览

### 5.1 领域模型关系图

Prism 的 VOC 数据模型围绕"语义片段"这一核心概念构建，形成一个多维数据立方体：

```
                        ┌──────────────────────┐
                        │    Source (来源渠道)    │
                        │  feedback / review /  │
                        │  interview / social   │
                        └──────────┬───────────┘
                                   │ 1:N
                        ┌──────────▼───────────┐
                        │    Voice (原始声音)    │
                        │  content, status,     │
                        │  author, language     │
                        └──────────┬───────────┘
                                   │ 1:N 语义拆解
                        ┌──────────▼───────────┐
              ┌────────│  SemanticUnit (语义片段) │────────┐
              │        │  content, summary,      │        │
              │        │  intent, sentiment,     │        │
              │        │  embedding              │        │
              │        └──────────┬──────────────┘        │
              │                   │                        │
         N:M 关联            N:M 关联                 N:M 关系
              │                   │                        │
    ┌─────────▼─────┐   ┌───────▼────────┐   ┌──────────▼──────────┐
    │ EmergentTag    │   │   UnitTag      │   │   UnitRelation      │
    │ (涌现式标签)   │   │ (片段-标签关联) │   │ (片段间关系)         │
    │ name, category │   │ relevance,     │   │ type: similar /     │
    │ trend, usage   │   │ source, rank   │   │ contradicts /       │
    │ sentiment_avg  │   │                │   │ elaborates / ...    │
    └───────────────┘   └────────────────┘   └─────────────────────┘
```

**核心设计理念**：

- **Voice 是不可变的原始记录**——进入系统后只读，保证数据可追溯
- **SemanticUnit 是分析的原子单位**——每个片段表达一个独立完整的观点，可向量化、可检索
- **EmergentTag 是涌现式标签**——不预设标签体系，由 LLM 在处理过程中自由生成，通过标准化和合并自然收敛
- **UnitRelation 构建语义网络**——片段间的相似、矛盾、因果等关系，是深层洞察的基础

### 5.2 关键表设计

**LLM Schema 核心表**：

```
providers                          models                           aliases
┌─────────────────────┐           ┌─────────────────────┐          ┌─────────────────────┐
│ id          UUID PK │◄──────────│ provider_id UUID FK  │          │ id          UUID PK │
│ name        VARCHAR │    1:N    │ id          UUID PK │◄─────────│ primary_model_id FK │
│ slug        VARCHAR │           │ model_id    VARCHAR │          │ alias       VARCHAR │
│ provider_type       │           │ model_type  VARCHAR │          │ alias_type  VARCHAR │
│ base_url    VARCHAR │           │ display_name        │          │ fallback_models     │
│ api_key_encrypted   │           │ is_enabled  BOOLEAN │          │   UUID[]            │
│ is_enabled  BOOLEAN │           │ config      JSONB   │          │ is_enabled  BOOLEAN │
│ config      JSONB   │           └─────────────────────┘          └─────────────────────┘
└─────────────────────┘
```

**索引策略**：
- `providers.slug` 唯一索引——别名解析的热路径
- `models(provider_id, model_id)` 联合唯一索引——防止同一 Provider 下重复注册
- `aliases.alias` 唯一索引——全局别名唯一性保证

**VOC Schema 核心表（Phase 3）**：
- `voices` 按 `tenant_id` + `collected_at` 建立复合索引，支持按租户按时间范围查询
- `semantic_units` 按 `voice_id` 索引，支持从原始声音到语义片段的快速关联查询
- `semantic_units.embedding` 建立 HNSW 向量索引，支持语义近邻搜索
- `emergent_tags.normalized_name` 唯一索引，防止标签重复

---

## 6. API 设计规范

### 6.1 统一响应格式

所有 API 遵循统一的响应信封格式，消除客户端解析的不确定性：

**成功响应**：
```json
{
    "data": { "id": "uuid", "name": "..." },
    "meta": {
        "request_id": "uuid",
        "timestamp": "2026-02-11T10:00:00Z"
    }
}
```

**列表响应**：
```json
{
    "data": [ ... ],
    "pagination": { "page": 1, "page_size": 20, "total": 100 },
    "meta": { "request_id": "uuid", "timestamp": "..." }
}
```

**错误响应**：
```json
{
    "error": {
        "code": "PROVIDER_UNAVAILABLE",
        "message": "所有 Provider 均不可用"
    },
    "meta": { "request_id": "uuid", "timestamp": "..." }
}
```

`meta.request_id` 贯穿全链路——从前端发起请求到后端日志到 LLM Provider 调用，同一个 request_id 串联所有环节，使问题排查成为可能。

### 6.2 认证方案：JWT + API Key

Prism 支持两种认证方式，分别服务于人类用户和 AI Agent：

| 认证方式 | 请求头 | 适用场景 | 生命周期 |
|---------|--------|---------|---------|
| JWT | `Authorization: Bearer <token>` | 人类用户通过 Web UI 登录 | 短期（小时级） |
| API Key | `X-API-Key: prism_xxxx` | Agent / CLI / 外部系统 | 长期（可配置过期） |

两种方式在认证通过后，都会被解析为统一的 Principal 身份对象。下游的所有服务不关心认证方式，只认 Principal。这就是第三章（平台架构）中讨论的"双用户模型"在技术层面的具体落地。

### 6.3 错误处理规范

错误码采用大写蛇形命名，按领域前缀组织：

| 前缀 | 领域 | 示例 |
|------|------|------|
| `AUTH_*` | 认证授权 | `AUTH_TOKEN_EXPIRED`, `AUTH_INVALID_KEY` |
| `PROVIDER_*` | LLM Provider | `PROVIDER_UNAVAILABLE`, `PROVIDER_AUTH_FAILED` |
| `MODEL_*` | 模型相关 | `MODEL_NOT_FOUND`, `MODEL_DISABLED` |
| `ALIAS_*` | 别名相关 | `ALIAS_NOT_FOUND`, `ALIAS_NO_AVAILABLE_MODEL` |
| `VALIDATION_*` | 参数验证 | `VALIDATION_FAILED` |

HTTP 状态码与错误码的映射关系是确定性的：401 永远是认证问题，502 永远是上游 Provider 问题，503 永远是所有 Provider 不可用。客户端可以基于状态码做粗粒度分支，基于错误码做精细化处理。

---

## 7. DevOps 与可观测性

### 7.1 Docker Compose 开发环境

开发环境通过 Docker Compose 一键启动 PostgreSQL 和 Redis：

```yaml
# 核心基础设施
services:
  postgres:
    image: pgvector/pgvector:pg17    # 自带 pgvector 扩展
    ports: ["5432:5432"]
    volumes: ["~/.prism/data/postgres:/var/lib/postgresql/data"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes: ["~/.prism/data/redis:/data"]
```

数据持久化到 `~/.prism/data/` 目录，而非项目内的 `docker-volumes/`。这确保了多个开发分支可以共享同一份数据（通常是开发中需要的），同时避免了 `.gitignore` 中遗漏 volume 目录的风险。

初始化脚本 `scripts/init-local-env.sh` 自动完成：环境变量配置、Docker 服务启动、数据库 Schema 创建、pgvector 扩展启用、Alembic 迁移执行。新成员 clone 代码后运行这一个脚本即可获得完整的开发环境。

### 7.2 日志规范

所有后端服务使用结构化日志（JSON 格式），包含以下必备字段：

| 字段 | 说明 | 用途 |
|------|------|------|
| `timestamp` | ISO 8601 格式 | 时间线排序 |
| `level` | INFO / WARNING / ERROR | 日志分级 |
| `request_id` | UUID | 全链路追踪 |
| `service` | llm-service / user-service | 服务标识 |
| `message` | 人类可读描述 | 快速理解 |
| `extra` | 结构化上下文 | 详细分析 |

结构化日志的核心价值是"可查询"。当生产环境出现问题时，可以用 `request_id` 从日志系统中精确拉出一次请求在所有服务中的完整链路——而不是在一堆纯文本日志里用 grep 碰运气。

### 7.3 监控演进路线

Prism 的监控策略遵循"按阶段投入"原则，避免在 Day 1 就引入 Prometheus + Grafana + Jaeger + ELK 的全家桶：

| 阶段 | 监控能力 | 工具 |
|------|---------|------|
| Phase 1-2 | 结构化日志 + 健康检查端点 | Python logging + `/health` |
| Phase 3 | 应用指标（请求量、延迟、错误率） | Prometheus + Grafana |
| Phase 4-5 | 分布式追踪（跨服务调用链） | OpenTelemetry + Jaeger |
| Phase 6 | 全栈可观测性 + 告警 | 上述全套 + PagerDuty/飞书告警 |

Phase 1-2 的"健康检查端点"已经足够满足开发期的需求。每个服务暴露 `/health` 端点，返回数据库连接状态、Redis 连接状态、外部 Provider 可达性。这些信息对于快速定位"服务起不来"的原因已经够用。

当 Phase 3 引入 VOC 数据处理管线后，才需要 Prometheus 级别的指标采集——因为这时候系统开始有持续的后台任务（Voice 处理、Embedding 生成），需要监控任务队列深度、处理延迟、失败率等指标。

---

## Key Takeaways

1. **技术选型是约束条件下的最优解，不是信仰宣言**。Python + FastAPI 不是"最好的"，而是在 AI 密集型产品、小团队、快速迭代这个约束空间里的全局最优。选型文档中记录"为什么不选 X"比记录"为什么选 Y"更有长期价值。

2. **pgvector 是 Prism 数据架构的关键赌注**。将向量数据和关系数据放在同一事务边界内，用"单一数据库"换来了"零分布式事务复杂度"。这个赌注在百万级数据量内是成立的，超出后有明确的迁移路径。

3. **LiteLLM 统一调用层消灭了 Provider 适配的重复劳动**。Prism 的别名系统 + LiteLLM 的协议适配，让"换 Provider"从"写代码"变成"改配置"。这是 LLM 产品的核心运维效率。

4. **前端渐进式构建，状态管理按需升级**。不在 Day 1 引入 Redux 全家桶。shadcn/ui 的"源码 Copy"模式比黑盒组件库更适合 AI 辅助编码和深度定制场景。

5. **三级 LLM 输出守卫确保系统鲁棒性**。Schema 校验 → 重试换模型 → 人工兜底，让 LLM 从"不可控的黑盒"变成"有 SLA 保障的服务组件"。

6. **Monorepo + uv workspace 是小团队的最优工程实践**。统一 lockfile、path dependency、跨服务重构一个 PR——这些优势在团队 < 20 人时远超 polyrepo 方案。

7. **监控投入与系统复杂度同步增长**。Phase 1 只需要 `/health` 端点，Phase 3 引入 Prometheus，Phase 5 引入分布式追踪。在你只有两个服务的时候部署 Jaeger，是典型的"解决未来问题的今天的成本"。

8. **API 设计的统一性是最被低估的工程投资**。统一的响应信封 `{ data, meta }`、统一的错误格式 `{ error: { code, message } }`、统一的认证解析到 Principal——这些"无聊"的规范，消除了前后端协作中 80% 的沟通摩擦。

---

*本章从技术选型、架构设计到 DevOps 规范，完整描绘了 Prism 的技术蓝图。下一章（Ch07 发展路线图）将展示这些技术决策如何在六个阶段中逐步落地，每个阶段的交付物、验收标准和 Go/No-Go 评审点。*
