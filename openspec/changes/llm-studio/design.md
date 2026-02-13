## Context

平台已具备 Provider CRUD、API Key 加密存储、4 槽位模型配置（含资源池）以及连通性测试。但 llm-service 当前只是一个"配置管理器"——缺少通用推理代理能力，无法作为 LLM 网关被应用层调用。前端也缺少验证模型和槽位配置效果的交互工具。

核心架构原则：**llm-service 是通用 LLM 网关，提供标准化的推理代理 API；LLM Studio 是纯前端应用层模块，组合消费网关 API 构建测试体验。** 两者之间通过 HTTP API 通信，Studio 不侵入 llm-service 内部。

## Goals / Non-Goals

**Goals:**
- 补全 llm-service 的网关能力：通用推理代理（Chat/Embedding/Rerank）+ 槽位调用（含资源池故障转移）
- 网关 API 是通用的、面向所有应用层消费者的，不包含 Studio 特定逻辑
- Chat 代理支持 SSE 流式输出
- 槽位调用端点实现基础故障转移：主模型失败 → 按顺序尝试资源池备选
- 前端 LLM Studio 模块提供 Playground（Chat/Embedding/Rerank）和槽位测试两个界面
- Studio 前端纯消费网关 API，不依赖任何 Studio 专属后端端点

**Non-Goals:**
- 不构建 Chat 历史持久化（对话不入库）
- 不实现高级路由策略（加权轮询、健康探测、熔断器）—— Phase 1 仅顺序故障转移
- 不做模型基准测试或批量评估
- 不将 SlotRouter 的完整生产级实现纳入本次变更（仅基础版）

## Decisions

### D1: 网关 API 是 llm-service 的通用能力，非 Studio 专属

**选择**: 推理代理端点放在 llm-service 的通用路由中（`/api/llm/completions` 等），不使用 `/api/llm/studio/*` 前缀。

**理由**: 推理代理是 LLM 网关的核心职责，未来 voc-service 的 AI 管线、agent-service 等应用层也会调用。Studio 只是第一个消费者。使用通用路径确保 API 语义正确，不与特定消费者绑定。

**替代方案**: 放在 `/api/llm/studio/*` → 拒绝，违反关注点分离，网关能力不应以消费者命名。

### D2: 槽位调用端点挂在 slots 路由下

**选择**: `POST /api/llm/slots/{slot_type}/invoke`，作为 slots 路由的子资源。

**理由**: 槽位调用语义上是"通过槽位发起推理"，是 slot 资源的动作。与现有的 `GET /api/llm/slots/{type}`（读配置）和 `PUT /api/llm/slots/{type}`（写配置）形成资源一致性。

### D3: Chat 流式输出采用 SSE

**选择**: `POST /api/llm/completions` 支持 `stream: true` 参数，返回 `text/event-stream`。后端使用 FastAPI `StreamingResponse`，前端用 `fetch` + `ReadableStream` 消费。

**理由**: OpenAI 兼容 API 原生支持 SSE 流式，复用其协议最自然。

### D4: 故障转移实现在 service 层

**选择**: `service.py` 中新增 `invoke_slot()` 函数，实现"主模型 → 资源池顺序尝试"的基础故障转移逻辑，并返回 `failover_trace`（每次尝试的 Provider/Model/结果）。

**理由**: 故障转移是 LLM 网关的核心业务逻辑，属于 service 层。API 层只做请求转发和响应格式化。

### D5: Studio 前端放在 `features/studio/`

**选择**: 新建 `apps/web/src/features/studio/`，包含 `pages/`、`components/`、`api/`。侧边栏新增 Studio 分组。

**理由**: 遵循功能域组织模式。Studio 是独立功能域，与 admin 平级。

### D6: API 端点汇总

```
# 通用推理代理（llm-service 网关能力）
POST /api/llm/completions         # Chat 补全代理（支持 stream）
POST /api/llm/embeddings          # Embedding 代理
POST /api/llm/rerank              # Rerank 代理

# 槽位调用（llm-service 网关能力）
POST /api/llm/slots/{type}/invoke # 通过槽位调用（含故障转移）
```

所有端点 Phase 1 需 `require_admin`。

## Risks / Trade-offs

- **[成本] 网关代理端点产生 API 费用** → 前端 Studio 显示提示；网关端点本身不做限流（Phase 1 仅管理员可用）
- **[安全] 代理端点暴露了间接调用能力** → Phase 1 仅管理员；生产部署前需增加 rate limiting 和审计日志
- **[复杂度] SSE 流式增加前后端复杂度** → 先实现非流式作为基线，SSE 作为增强体验
- **[故障转移简化] 顺序故障转移非最优策略** → Phase 1 足够验证配置正确性；后续可演进为加权轮询/健康探测
