# Prism 技术路线图

本文档定义 Prism 平台从基础设施到 AI Agent 平台的演进路径。各阶段按依赖关系排列，后一阶段以前一阶段交付为前提。

---

## 对齐说明（2026-02-20）

- 当前阶段模型路由以 **4 槽位**（`fast/reasoning/embedding/rerank`）为唯一语义，替代别名系统主路径。
- LLM API 采用“旧路由保留 + 新契约兼容路由”并行策略，详见 `docs/prd/04-contract-alignment-migration.md`。
- Agent 路线在本轮落地最小闭环（`/api/agent/skills`、`/api/agent/execute`、`/api/agent/executions/{id}`）。

---

## Phase 1：基础设施 + 模型配置（当前）

**目标**：搭建微服务骨架，完成模型资源配置和连通性验证。

**交付内容**：

- **shared**：DB session、JWT 工具、认证中间件、通用 schemas
- **user-service**：用户注册 / 登录 / JWT 签发 / API Key 管理
- **llm-service**：Provider 注册、4 槽位配置、连通性测试
- **Web UI**：登录页 + 模型配置管理页面（Provider / Slot 配置）
- **基础设施**：Docker Compose（PostgreSQL + pgvector + Redis）、uv workspace

**验收标准**：见 [phase1-deliverables.md](./phase1-deliverables.md)

---

## Phase 2：LLM 调用能力

**目标**：llm-service 从"配置管理"升级为"可用的 LLM 网关"，支持实际的模型调用。

**交付内容**：

- **Chat API**（`/api/llm/chat`）：支持非流式 slot-first 调用，自动故障转移
- **Embedding API**（`/api/llm/embedding`）：文本向量化
- **Rerank API**（`/api/llm/rerank`）：结果重排序
- **底层调用层**：引入 [LiteLLM](https://github.com/BerriAI/litellm) 替代自建 provider 适配器
  - LiteLLM 已覆盖 100+ provider 的统一接口，避免重复造轮子
  - 自建的 `providers/` 层退化为 LiteLLM 的配置映射
- **故障转移 / 降级**：槽位绑定的降级链（primary → fallback）自动切换
- **CLI 基础版**：`prism chat`、`prism embed`、`prism model list/test`

**关键决策**：

| 决策 | 选择 | 理由 |
|------|------|------|
| LLM 调用层 | LiteLLM | 覆盖广、社区活跃、支持流式，避免自建 N 个 provider 适配器 |
| 流式协议 | SSE（Server-Sent Events） | 与 OpenAI 兼容格式一致，前端原生支持 |

---

## Phase 3：VOC 数据层

**目标**：建立 VOC（Voice of Customer）数据的采集、存储、向量化和检索能力。

**交付内容**：

- **VOC 数据模型**：评论、反馈、工单等结构化存储（新增 `voc` schema）
- **数据采集**：批量导入接口（CSV / JSON），后续扩展爬虫 / Webhook
- **向量索引**：基于 pgvector 的 embedding 存储和 ANN 检索
- **数据检索 API**：
  - 语义搜索（embedding 相似度）
  - 结构化过滤（时间、来源、标签）
  - 混合检索（语义 + 结构化）

**关键决策**：

| 决策 | 选择 | 理由 |
|------|------|------|
| 向量存储 | pgvector（复用 PostgreSQL） | 避免引入独立向量数据库，降低运维复杂度；数据量级在 pgvector 能力范围内 |
| 数据 schema | 独立 `voc` schema | 延续 schema 隔离策略，与 `llm` / `auth` 平级 |

---

## Phase 4：Agent 引擎

**目标**：构建 Agent 运行时，使系统具备根据用户意图自主编排工具、完成数据分析任务的能力。

**交付内容**：

- **Agent 运行时**：
  - 工具注册表（Tool Registry）：声明式工具定义 + 自动发现
  - 调用循环（Agent Loop）：LLM 推理 → 工具调用 → 结果整合 → 继续/终止
  - 上下文管理：对话历史、工具调用记录、中间结果
- **内置工具集**：
  - 数据获取：VOC 检索、SQL 查询
  - 数据分析：统计汇总、趋势分析、情感分析
  - 数据可视化：图表生成（表格、柱状图、折线图）
- **CLI 作为 Agent 工具接口**：Agent 可通过 CLI 命令调用外部工具
- **Web UI**：基础 Agent 对话界面

**候选技术**：

| 方案 | 优势 | 劣势 | 适用场景 |
|------|------|------|----------|
| [LangGraph](https://github.com/langchain-ai/langgraph) | 灵活的图式编排、支持复杂分支/循环、多 LLM 支持 | 学习曲线较陡、依赖 LangChain 生态 | 需要复杂工作流编排 |
| [Claude Agent SDK](https://github.com/anthropics/claude-code) | 与 Claude 深度集成、工具调用体验优秀 | 绑定 Anthropic 生态 | 以 Claude 为主力模型的场景 |
| 自建轻量 Agent Loop | 完全可控、无外部依赖 | 开发成本高、需自行处理边界情况 | 需求简单且明确 |

> **决策时机**：Phase 4 启动前根据 Phase 2/3 积累的实际需求做最终选型。当前倾向 LangGraph（灵活度优先）。

---

## Phase 5：Agent 平台化

**目标**：将 Agent 能力从"开发者工具"升级为"可配置的分析平台"，面向业务用户。

**交付内容**：

- **Agent 交互界面**：Web UI 中的完整 Agent 对话体验（流式输出、工具调用可视化、结果展示）
- **自定义工具**：用户可注册自定义工具（API 端点、脚本、数据源）
- **工作流编排**：可视化工作流编辑器，定义多步骤分析流程
- **多 Agent 协作**：多个专业 Agent 协同完成复杂任务（如一个负责数据获取，一个负责分析）
- **任务管理**：异步任务队列、进度追踪、结果缓存

---

## 阶段依赖关系

```
Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4 ──→ Phase 5
基础设施      LLM 调用     VOC 数据     Agent 引擎   Agent 平台化
```

- Phase 1 → 2：有了模型配置，才能实现模型调用
- Phase 2 → 3：有了 LLM 调用（特别是 embedding），才能做向量化
- Phase 3 → 4：有了数据层，Agent 才有数据可分析
- Phase 4 → 5：有了 Agent 引擎，才能做平台化封装

---

## 设计原则（贯穿全阶段）

1. **渐进式架构**：每个阶段独立可交付，不为未来过度设计
2. **Schema 隔离**：新增数据域使用独立 PostgreSQL schema（`llm` / `auth` / `voc` / `agent`）
3. **API 优先**：所有能力先以 API 暴露，再构建 UI
4. **可替换性**：外部依赖（LiteLLM、LangGraph 等）通过抽象层隔离，保留替换空间
