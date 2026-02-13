## ADDED Requirements

### Requirement: Chat 补全代理
系统 SHALL 提供 `POST /api/llm/completions` 端点，接收 `provider_id`、`model_id`、`messages`（OpenAI 格式消息数组）、可选 `stream` 布尔值和可选 `max_tokens`，代理转发至指定 Provider 并返回结果。此端点是 llm-service 的通用网关能力，不与特定消费者绑定。

#### Scenario: 非流式 Chat 补全
- **WHEN** 调用方发送 `{ provider_id, model_id, messages, stream: false }`
- **THEN** 系统向 Provider 转发 Chat 补全请求，返回 `{ content, usage: { prompt_tokens, completion_tokens, total_tokens }, latency_ms, model }`

#### Scenario: 流式 Chat 补全 (SSE)
- **WHEN** 调用方发送 `{ provider_id, model_id, messages, stream: true }`
- **THEN** 系统返回 `text/event-stream` 响应，每个 SSE 事件包含增量内容 `{ delta, finish_reason }`，最终事件包含汇总 `{ usage, latency_ms }`

#### Scenario: Provider 不存在
- **WHEN** 调用方指定不存在的 `provider_id`
- **THEN** 系统返回 HTTP 404，错误码 `SHARED_NOT_FOUND`

#### Scenario: 上游 Provider 返回错误
- **WHEN** Provider 返回非 2xx 响应
- **THEN** 系统返回 HTTP 502，包含 Provider 原始 HTTP 状态码和错误信息

### Requirement: Embedding 代理
系统 SHALL 提供 `POST /api/llm/embeddings` 端点，接收 `provider_id`、`model_id`、`input`（字符串或字符串数组），代理转发至 Provider 的 Embedding 端点。

#### Scenario: 单文本 Embedding
- **WHEN** 调用方发送 `{ provider_id, model_id, input: "测试文本" }`
- **THEN** 系统返回 `{ embeddings: [{ index: 0, values: [...], dimensions }], usage, latency_ms, model }`

#### Scenario: 多文本 Embedding
- **WHEN** 调用方发送 `{ provider_id, model_id, input: ["文本A", "文本B"] }`
- **THEN** 系统返回每个文本的 Embedding 结果数组

#### Scenario: Provider 不支持 Embedding
- **WHEN** Provider 返回 404 或不支持的错误
- **THEN** 系统返回 HTTP 502，说明该 Provider 不支持 Embedding 操作

### Requirement: Rerank 代理
系统 SHALL 提供 `POST /api/llm/rerank` 端点，接收 `provider_id`、`model_id`、`query`、`documents`（候选文档数组），代理转发至 Provider 的 Rerank 端点。

#### Scenario: 正常 Rerank
- **WHEN** 调用方发送 `{ provider_id, model_id, query, documents }`
- **THEN** 系统返回 `{ results: [{ index, document, relevance_score }], latency_ms, model }`，结果按 `relevance_score` 降序

#### Scenario: Provider 不支持 Rerank
- **WHEN** Provider 不支持 Rerank 操作
- **THEN** 系统返回 HTTP 502，说明不支持

### Requirement: 槽位调用（含故障转移）
系统 SHALL 提供 `POST /api/llm/slots/{slot_type}/invoke` 端点，通过 SlotRouter 解析槽位配置后调用模型。主模型失败时 SHALL 按资源池顺序尝试备选模型。

#### Scenario: 主模型调用成功
- **WHEN** 调用方发送 `{ messages }` 到 `slots/fast/invoke`
- **THEN** 系统解析 fast 槽位的主 Provider+Model，执行推理，返回 `{ result: { content, usage, latency_ms }, routing: { provider_name, model_id, slot_type, used_resource_pool: false } }`

#### Scenario: 主模型失败触发故障转移
- **WHEN** 主模型返回错误，资源池中有备选模型
- **THEN** 系统按资源池顺序尝试备选模型，返回结果中 `routing.used_resource_pool` 为 true，`routing.failover_trace` 记录每次尝试的 Provider/Model 和结果

#### Scenario: 所有模型均失败
- **WHEN** 主模型和所有资源池备选模型均返回错误
- **THEN** 系统返回 HTTP 503，错误码 `LLM_ALL_MODELS_FAILED`，`details.failover_trace` 包含每个模型的失败原因

#### Scenario: 槽位未配置
- **WHEN** 调用方调用未配置的槽位
- **THEN** 系统返回 HTTP 503，错误码 `LLM_SLOT_NOT_CONFIGURED`

### Requirement: 权限控制
所有网关代理端点和槽位调用端点 SHALL 要求管理员权限（Phase 1），后续按需开放。

#### Scenario: 非管理员访问
- **WHEN** 普通用户调用任意网关代理端点
- **THEN** 系统返回 HTTP 403
