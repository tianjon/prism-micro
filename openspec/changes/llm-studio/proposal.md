## Why

平台已完成 Provider 管理和 4 槽位模型配置，但缺少两个关键闭环：一是 llm-service 缺少通用推理代理 API（当前仅有轻量连通性测试），无法作为真正的 LLM 网关被应用层调用；二是前端缺少直观的交互式工具来验证模型能力和槽位行为。需要先补全 llm-service 的网关接口，再在前端构建 LLM Studio 模块形成测试闭环。

## What Changes

- **llm-service 补全网关接口**：新增通用推理代理端点（Chat 补全 / Embedding / Rerank），支持直接指定 Provider+Model 调用；新增槽位调用端点，通过 SlotRouter 解析并执行推理，支持资源池故障转移
- **前端新增 LLM Studio 模块**（`apps/web/src/features/studio/`）：纯前端应用层，调用 llm-service 通用 API，提供 Playground 和槽位测试两个交互界面
- 前端新增 `/studio` 路由，侧边栏增加入口

## Capabilities

### New Capabilities

- `llm-gateway-api`: llm-service 通用推理网关 API——Chat 补全（含 SSE 流式）、Embedding 向量化、Rerank 重排序的代理端点，以及通过槽位调用的端点（含资源池故障转移）
- `studio-frontend`: LLM Studio 前端模块——Playground 交互界面（Chat / Embedding / Rerank 三模式）和槽位测试界面，纯前端消费 llm-service 网关 API

### Modified Capabilities

（无需修改现有 spec 级别的行为）

## Impact

- **后端 API**: llm-service 新增 `/api/llm/completions`、`/api/llm/embeddings`、`/api/llm/rerank`、`/api/llm/slots/{type}/invoke` 等通用网关端点
- **前端路由**: 新增 `/studio` 页面，侧边栏增加 Studio 入口
- **边界清晰**: llm-service 只提供通用网关接口，不含 Studio 特定逻辑；Studio 是纯前端应用层
- **安全**: 网关端点需管理员权限（Phase 1），后续可按需开放
