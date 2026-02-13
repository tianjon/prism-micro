# D4: Agent-Service 开源框架评估报告

> **评估日期**：2026-02-12
> **评估人**：赵一凡（架构师）、陈思琪（AI 工程负责人）
> **评估目标**：判断 agent-service 是否应基于开源 Agent 框架实现，还是采用自研方案

---

## 1. 评估背景

### 1.1 agent-service 核心需求（来自 design.md）

| # | 需求 | 优先级 | 说明 |
|---|------|--------|------|
| R1 | ReAct 推理循环 | Must Have | Reasoning → Action → Observation 循环，硬编码 10 次迭代上限 |
| R2 | 自定义 LLM 端点 | Must Have | 调用内部 llm-service 的 `/api/llm/chat`，使用 slot 参数（reasoning/fast） |
| R3 | 结构化输出 | Must Have | LLM 输出 JSON 格式的 `{thought, action}` 决策 |
| R4 | YAML SkillRegistry | Must Have | YAML 定义 Skill → SkillExecutor Protocol → Phase 3 后迁移 DB |
| R5 | Token 预算管理 | Must Have | 8192 上限，< 500 强制终止，截断历史上下文 |
| R6 | 迭代限制 | Must Have | MAX_ITERATIONS = 10，Phase 3 后配置化 |
| R7 | 审计日志入库 | Must Have | 每次 Skill 调用写入 PostgreSQL `agent.execution_logs` |
| R8 | FastAPI 异步集成 | Must Have | 全栈 async/await，Depends() 依赖注入 |
| R9 | Principal 身份集成 | Must Have | Human(JWT) + Agent(API Key) 双身份认证 |
| R10 | 代码量最小化 | Should Have | Phase 2.5 精简版，核心约 540 行 |

### 1.2 候选框架

| 框架 | 版本 | Stars | 许可 | 定位 |
|------|------|-------|------|------|
| **Pydantic AI** | v1.58.0 | 14.8k | MIT | Pydantic 团队出品，FastAPI 式 Agent 开发体验 |
| **SmolAgents** | v1.24.0 | 25.4k | Apache-2.0 | HuggingFace 出品，极简 ReAct 框架（~1000 行核心） |
| **LangGraph** | v1.0.8 | 24.7k | MIT | LangChain 生态，有向图编排的有状态 Agent |
| **CrewAI** | v1.9.3 | ~25k | MIT | 多 Agent 协作编排框架，角色扮演 + 任务委派 |

---

## 2. 逐维度对比

### 2.1 ReAct 推理循环

| 框架 | 支持程度 | 实现方式 | 匹配度 |
|------|---------|---------|--------|
| **Pydantic AI** | 可扩展 | Tool-use 循环（非严格 ReAct，但功能等价），基于 pydantic-graph 状态机 | **高** |
| **SmolAgents** | **原生** | `MultiStepAgent` 就是 ReAct 实现，提供 CodeAgent + ToolCallingAgent 两种模式 | **高** |
| **LangGraph** | **原生** | `create_react_agent` 预构建，model→tools 条件边循环 | **中** |
| **自研** | — | `agent_loop.py` 约 250 行，JSON 格式输出解析 | **完全可控** |

**分析**：三个框架都提供 ReAct 能力。Pydantic AI 的 tool-use 循环更现代（直接利用 LLM 的 function calling），SmolAgents 是经典 ReAct。LangGraph 的 ReAct 绑定 LangChain 的 `AIMessage.tool_calls` 协议。自研方案 250 行即可实现，逻辑透明。

### 2.2 自定义 LLM 端点

| 框架 | 支持程度 | 实现方式 | 匹配度 |
|------|---------|---------|--------|
| **Pydantic AI** | **原生** | `OpenAIProvider(base_url=...)` 指向 llm-service，需 OpenAI 兼容 API | **高**（有前提） |
| **SmolAgents** | **原生** | `OpenAIModel(api_base=...)` 或自定义 `Model` 子类 | **中高** |
| **LangGraph** | 可扩展 | 需写 `BaseChatModel` 子类（~200 行），处理 LangChain 消息类型转换 | **低** |
| **自研** | — | httpx 直接调用 `/api/llm/chat`，slot 参数天然支持 | **完美** |

**关键前提**：Pydantic AI 和 SmolAgents 都需要 llm-service 暴露 **OpenAI 兼容端点**（`/v1/chat/completions`）。当前 llm-service 使用自定义格式。LangGraph 更重，需要实现完整的 LangChain `BaseChatModel` 适配器。

### 2.3 结构化输出

| 框架 | 支持程度 | 实现方式 | 匹配度 |
|------|---------|---------|--------|
| **Pydantic AI** | **原生** | Pydantic v2 BaseModel 作为 `output_type`，自动校验+重试 | **非常高** |
| **SmolAgents** | 可扩展 | 支持 `response_format`，但不直接支持 Pydantic 模型定义 | **中** |
| **LangGraph** | **原生** | `response_format` 传入 Pydantic BaseModel | **中** |
| **自研** | — | `json.loads()` + 手工降级处理 | **够用** |

**分析**：Pydantic AI 在结构化输出方面优势明显——它能用 Pydantic 模型约束 LLM 输出，校验失败自动要求 LLM 重新生成。这比自研的 `json.JSONDecodeError` 降级更健壮。

### 2.4 工具/技能调用 + YAML 动态加载

| 框架 | 工具注册 | YAML 加载 | 匹配度 |
|------|---------|----------|--------|
| **Pydantic AI** | 装饰器 + `AbstractToolset` 基类 | 可通过 Toolset 桥接 | **高** |
| **SmolAgents** | `@tool` 装饰器 + `Tool` 基类 | 需自行编写适配层 | **中** |
| **LangGraph** | LangChain `@tool` + `BaseTool` | 需自行编写适配层，且与 SkillRegistry 设计冲突 | **低** |
| **自研** | `SkillExecutor` Protocol + `SkillRegistry` | YAML 原生驱动，Phase 3 迁移 DB | **完美** |

**分析**：Pydantic AI 的 `AbstractToolset` 是最佳桥接点——可以实现一个 `YamlSkillToolset` 子类保留现有 YAML 配置格式。LangGraph 的工具系统与自研的 Protocol-based 设计冲突最大。

### 2.5 Token 预算管理

| 框架 | 支持程度 | 匹配度 |
|------|---------|--------|
| **Pydantic AI** | **原生** | `UsageLimits(total_tokens_limit=8192)` 完全覆盖需求 | **非常高** |
| **SmolAgents** | 仅计数 | 有 `TokenUsage` 统计，但无预算限制机制 | **低中** |
| **LangGraph** | **不支持** | 无内置 token 管理，需完全自研 | **不适用** |
| **自研** | — | `TokenCounter` 约 60 行，budget + consume + estimate | **完全可控** |

**分析**：Pydantic AI 的 `UsageLimits` 完全替代自研的 `TokenCounter`，且功能更丰富（区分 input/output token、支持请求数限制）。SmolAgents 和 LangGraph 在这方面无法提供帮助。

### 2.6 迭代限制

| 框架 | 支持程度 | 匹配度 |
|------|---------|--------|
| **Pydantic AI** | **原生** | `UsageLimits(request_limit=10)` | **完全匹配** |
| **SmolAgents** | **原生** | `max_steps=10` | **高** |
| **LangGraph** | **原生** | `recursion_limit=20` | **高（但粗粒度）** |
| **自研** | — | `MAX_ITERATIONS = 10` | **完全可控** |

### 2.7 审计日志

| 框架 | 支持程度 | 持久化到 PostgreSQL | 匹配度 |
|------|---------|-------------------|--------|
| **Pydantic AI** | **原生** | OTel 集成 + `agent.iter()` 逐节点控制，需自行写入 DB | **中高** |
| **SmolAgents** | 可扩展 | `step_callbacks` 回调，需自行写入 DB | **中** |
| **LangGraph** | 可扩展 | 依赖 LangSmith/Langfuse（外部服务），需自行写入 DB | **低** |
| **自研** | — | 直接写 PostgreSQL `agent.execution_logs` | **完美** |

**分析**：所有框架都不内置 PostgreSQL 持久化。无论选哪个框架，`ExecutionLog` ORM 模型和 `AuditService` 都需要自己实现。但 Pydantic AI 的结构化事件流（`agent.iter()`）比 SmolAgents 的回调和 LangGraph 的外部追踪更容易提取审计数据。

### 2.8 FastAPI 异步集成

| 框架 | 异步支持 | FastAPI 集成 | 匹配度 |
|------|---------|-------------|--------|
| **Pydantic AI** | **全异步** | 有官方 FastAPI 示例，`run_stream()` + SSE | **非常高** |
| **SmolAgents** | **同步** | 需 `asyncio.to_thread()` 包装，阻塞线程 | **低中** |
| **LangGraph** | **全异步** | `await graph.ainvoke()`，社区模板丰富 | **中** |
| **自研** | — | 原生 async/await，Depends() 注入 | **完美** |

**分析**：SmolAgents 的同步核心是架构级硬伤。Pydantic AI 和 LangGraph 都支持 async，但 Pydantic AI 有官方 FastAPI 集成示例，更贴合 prism-micro 的技术栈。

### 2.9 依赖注入

| 框架 | DI 系统 | 与 FastAPI Depends 兼容 | 匹配度 |
|------|--------|----------------------|--------|
| **Pydantic AI** | **原生** | `RunContext[DepsType]`，与 FastAPI DI 互补 | **非常高** |
| **SmolAgents** | 无 | 需手动组装 | **低** |
| **LangGraph** | 有限 | `ToolRuntime` 仅限工具层，与 FastAPI DI 不兼容 | **低** |
| **自研** | — | 完全使用 FastAPI Depends() | **完美** |

### 2.10 代码量与依赖影响

| 框架 | 核心包大小 | 额外依赖 | 代码量变化 |
|------|----------|---------|-----------|
| **Pydantic AI** | 轻量 | `pydantic-ai-slim`（无 torch/transformers） | **净减 ~380 行** |
| **SmolAgents** | 轻量 | `huggingface_hub` + `rich` + `jinja2` | 净减 ~150 行，但需 ~200 行适配代码 |
| **LangGraph** | 中等 | 5 个包 + `langchain-core`，150-250MB 内存 | 需 ~300 行适配代码，净增复杂度 |
| **自研** | 0 | 仅 httpx + pyyaml（已有） | 核心 ~540 行 |

---

## 3. 综合评分矩阵

| 维度 (权重) | Pydantic AI | SmolAgents | LangGraph | CrewAI | 自研 |
|------------|:-----------:|:----------:|:---------:|:------:|:----:|
| R1: ReAct 循环 (15%) | ★★★★ | ★★★★★ | ★★★ | ★★★★ | ★★★★ |
| R2: 自定义 LLM (15%) | ★★★★ | ★★★ | ★★ | ★★★ | ★★★★★ |
| R3: 结构化输出 (10%) | ★★★★★ | ★★★ | ★★★ | ★★★★ | ★★★ |
| R4: YAML Skill (10%) | ★★★★ | ★★★ | ★★ | ★★★ | ★★★★★ |
| R5: Token 预算 (10%) | ★★★★★ | ★★ | ★ | ★ | ★★★★ |
| R6: 迭代限制 (5%) | ★★★★★ | ★★★★ | ★★★ | ★★★★ | ★★★★ |
| R7: 审计日志 (10%) | ★★★★ | ★★★ | ★★ | ★★★ | ★★★★★ |
| R8: FastAPI 集成 (10%) | ★★★★★ | ★★ | ★★★ | ★★★ | ★★★★★ |
| R9: DI 兼容 (5%) | ★★★★★ | ★★ | ★★ | ★ | ★★★★★ |
| R10: 代码量 (10%) | ★★★★★ | ★★★ | ★★ | ★ | ★★★★ |
| **加权总分** | **4.35** | **3.00** | **2.30** | **2.60** | **4.35** |

---

## 4. 决策分析

### 4.1 排除项

**SmolAgents ❌**
- 同步核心与全栈 async 设计冲突（架构级硬伤）
- API 标注 "experimental"，生产环境风险高
- 适配代码量可能超过自研 ReAct 循环本身
- 引入 `huggingface_hub` 等无关依赖

**LangGraph ❌**
- 依赖链重（5 个包 + langchain-core，150-250MB 内存）
- 与 llm-service 的 slot 机制、SkillRegistry 的 Protocol 设计均冲突
- Token 预算管理不支持，审计日志依赖外部服务
- 框架版本更新频繁，破坏性变更时有发生
- "杀鸡用牛刀"——Phase 2.5 的单次同步执行不需要有向图编排

**CrewAI ❌**
- **定位根本性错位**：多 Agent 协作编排框架，用于单 Agent ReAct 循环属于"大炮打蚊子"
- **依赖链极重**：128 个依赖包（含 chromadb、onnxruntime、numpy、kubernetes、grpcio），微服务不可接受
- **同步核心**：推理循环同步执行，FastAPI 集成需 `asyncio.to_thread()` 包装
- **无 DI 系统**：与 FastAPI `Depends()` + SQLAlchemy async session 生态完全脱节
- **无 Token 预算管理**：仅有单次 `max_tokens`，无全局预算控制
- **内置遥测**：核心依赖含 `posthog`（数据收集），存在隐私/安全顾虑
- **自定义 LLM 有摩擦**：社区 Issue 显示自定义端点兼容性问题频繁

### 4.2 真正的抉择：Pydantic AI vs 自研

两个方案加权总分持平（4.35 vs 4.35），但优劣势互补：

#### Pydantic AI 优势

| 优势 | 影响 |
|------|------|
| 消除最高风险模块 `agent_loop.py`（250 行手工 JSON 解析） | 降低 LLM 输出解析失败率 |
| 内置 `UsageLimits` 替代自研 `TokenCounter` | 功能更全（区分 input/output、请求数限制） |
| 结构化输出自动重试 | 比手工 `json.JSONDecodeError` 降级更健壮 |
| `RunContext[DepsType]` 类型安全 DI | 消除 `dict[str, Any]` 类型不安全问题 |
| Pydantic 团队长期维护（14.8k stars, 381 contributors） | 生态风险低 |

#### Pydantic AI 代价

| 代价 | 影响 |
|------|------|
| **llm-service 必须暴露 OpenAI 兼容端点** | 额外 1-2 天工时（但对整个生态有利） |
| SkillRegistry 需实现 `AbstractToolset` 桥接 | 约 1 天工时 |
| 新增外部依赖 `pydantic-ai-slim` | 依赖管理成本 |
| 团队需学习 Pydantic AI API | 学习曲线（但与 FastAPI 风格一致） |

#### 自研优势

| 优势 | 影响 |
|------|------|
| 零外部依赖，完全可控 | 无框架升级风险 |
| 与 llm-service 自定义 API 天然兼容 | 无需 OpenAI 兼容层 |
| 540 行总量，逻辑清晰透明 | 调试成本最低 |
| SkillRegistry Protocol 设计无缝衔接 | Phase 3 迁移路径清晰 |

#### 自研代价

| 代价 | 影响 |
|------|------|
| 手工 JSON 解析存在脆弱性 | LLM 输出不规范时降级逻辑复杂 |
| TokenCounter 功能有限 | 仅计总量，不区分 input/output |
| 无结构化输出自动重试 | 需自行处理 LLM 格式错误 |
| `LoopContext` 大量 `dict[str, Any]` | 类型不安全 |

---

## 5. 最终建议

### 推荐方案：**Pydantic AI**（条件性采纳）

**理由**：

1. **消除最脆弱的模块**：`agent_loop.py` 中的手工 JSON 解析 + ReAct 编排是最容易出 bug 的部分，恰好是 Pydantic AI 最成熟的能力。

2. **生态一致性**：项目已深度使用 Pydantic v2 + FastAPI，Pydantic AI 是最自然的延伸。`RunContext` 的 DI 风格与 FastAPI 的 `Depends()` 设计理念完全一致。

3. **净减 ~380 行代码**：移除 `agent_loop.py`（250 行）+ `token_counter.py`（60 行）+ `llm_client.py`（80 行），新增 `agent_factory.py`（~80 行）。

4. **llm-service OpenAI 兼容端点是"还债"而非"额外成本"**：这个端点不仅服务于 Pydantic AI，也能让 llm-service 接入整个 OpenAI 兼容生态（LiteLLM、各种评估工具、第三方客户端），是架构上正确的投资。

### 前提条件

| # | 条件 | 负责人 | 工时 |
|---|------|--------|------|
| 1 | llm-service 增加 `/v1/chat/completions` 兼容端点 | 王磊 | 1-2 天 |
| 2 | 实现 `YamlSkillToolset(AbstractToolset)` 桥接 | 赵一凡 | 1 天 |
| 3 | 团队完成 Pydantic AI 基础 API 学习 | 全员 | 0.5 天 |

### 保留的自研组件

| 组件 | 保留理由 |
|------|---------|
| `api/schemas/` | API 层 Pydantic 模型不变 |
| `api/routers/` | FastAPI 路由层不变 |
| `models/execution_log.py` | 审计日志 ORM 模型是业务需求 |
| `services/audit_service.py` | 从 Pydantic AI 事件提取数据写入 DB |
| `configs/skills.yaml` | YAML 配置格式不变 |

### 备选方案

如果 llm-service 暴露 OpenAI 兼容端点的优先级较低（排在 Phase 2.5 之后），则：
- Phase 2.5 先用**自研方案**，540 行代码实现全部功能
- Phase 3 引入 Pydantic AI，在 llm-service 兼容端点就绪后切换
- 设计时保持 `SkillExecutor` Protocol 和 `LoopResult` 数据结构的稳定，降低迁移成本

---

## 6. 附录：框架详细对比数据

### A. 依赖链对比

```
Pydantic AI:
  pydantic-ai-slim → pydantic (已有) + httpx (已有) + openai
  总新增依赖: 1-2 个

SmolAgents:
  smolagents → huggingface_hub + requests + rich + jinja2 + pillow
  总新增依赖: 5+ 个

LangGraph:
  langgraph → langgraph-checkpoint + langgraph-prebuilt + langgraph-sdk + langchain-core
  总新增依赖: 5+ 个，内存 +150-250MB

CrewAI:
  crewai → chromadb + onnxruntime + numpy + openai + instructor + kubernetes + grpcio + posthog + ...
  总新增依赖: 128 个，含多个重量级组件
```

### B. 异步兼容性

```
Pydantic AI: 全异步（asyncio 原生）     ✅ 与 FastAPI 完美契合
SmolAgents:  全同步（需 to_thread）      ⚠️ 架构阻抗
LangGraph:   全异步（ainvoke/astream）    ✅ 但依赖链重
CrewAI:      同步核心（kickoff_async 是线程包装）  ⚠️ 架构阻抗
```

### C. 社区活跃度（2026-02）

```
Pydantic AI: 14.8k ⭐ | 381 contributors | 1720 commits | MIT
SmolAgents:  25.4k ⭐ | 204 contributors | ~1000 行核心  | Apache-2.0
LangGraph:   24.7k ⭐ | Python 99.3%     | v1.0.8        | MIT
CrewAI:      ~25k  ⭐ | MIT + SaaS       | 128 依赖      | MIT（有商业云平台）
```
