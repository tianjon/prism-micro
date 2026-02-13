## 1. 后端：推理代理 Pydantic Schema

- [x] 1.1 在 `llm-service/src/llm_service/api/schemas/` 新建 `gateway.py`，定义 Chat/Embedding/Rerank 请求和响应模型（CompletionRequest、CompletionResponse、EmbeddingRequest、EmbeddingResponse、RerankRequest、RerankResponse、UsageInfo）
- [x] 1.2 在 `gateway.py` 中定义 SlotInvokeRequest 和 SlotInvokeResponse（含 RoutingInfo、FailoverTraceItem）
- [x] 1.3 在 `core/errors.py` 中新增 `LLM_UPSTREAM_ERROR`、`LLM_ALL_MODELS_FAILED` 错误码

## 2. 后端：推理代理 Service 层

- [x] 2.1 在 `service.py` 中实现 `call_completion()`：接收 provider_id + model_id + messages + stream + max_tokens，代理调用 Provider 的 `/chat/completions`，返回标准化结果（非流式）
- [x] 2.2 在 `service.py` 中实现 `call_completion_stream()`：流式版本，返回 AsyncGenerator 逐块 yield SSE 数据
- [x] 2.3 在 `service.py` 中实现 `call_embedding()`：代理调用 Provider 的 `/embeddings`，返回标准化的 embedding 结果
- [x] 2.4 在 `service.py` 中实现 `call_rerank()`：代理调用 Provider 的 `/rerank`，返回标准化的排序结果
- [x] 2.5 在 `service.py` 中实现 `invoke_slot()`：解析槽位配置 → 调用主模型 → 失败时按资源池顺序故障转移 → 返回结果 + routing 信息 + failover_trace

## 3. 后端：推理代理 API 路由

- [x] 3.1 新建 `llm-service/src/llm_service/api/gateway.py`，实现 `POST /api/llm/completions` 端点（支持 stream 参数，非流式返回 ApiResponse，流式返回 StreamingResponse）
- [x] 3.2 实现 `POST /api/llm/embeddings` 端点
- [x] 3.3 实现 `POST /api/llm/rerank` 端点
- [x] 3.4 在 `llm-service/src/llm_service/api/slots.py` 中新增 `POST /api/llm/slots/{slot_type}/invoke` 端点
- [x] 3.5 在 `router.py` 中注册 gateway 路由
- [x] 3.6 所有新端点添加 `Depends(require_admin)` 权限控制

## 4. 前端：Studio API 层和类型

- [x] 4.1 在 `apps/web/src/api/types.ts` 中新增 Studio 相关类型（CompletionRequest/Response、EmbeddingRequest/Response、RerankRequest/Response、SlotInvokeRequest/Response、RoutingInfo、FailoverTraceItem）
- [x] 4.2 在 `apps/web/src/api/endpoints.ts` 中新增网关端点常量（COMPLETIONS、EMBEDDINGS、RERANK、SLOT_INVOKE）
- [x] 4.3 新建 `apps/web/src/features/studio/api/studio-api.ts`，封装 callCompletion（含流式）、callEmbedding、callRerank、invokeSlot 函数

## 5. 前端：Playground 页面

- [x] 5.1 新建 `features/studio/pages/PlaygroundPage.tsx`，实现三模式 Tab 切换（Chat / Embedding / Rerank）+ Provider/Model 选择器
- [x] 5.2 新建 `features/studio/components/ChatPanel.tsx`，实现对话气泡 UI、多轮消息管理、SSE 流式渲染、延迟和 Token 用量展示
- [x] 5.3 新建 `features/studio/components/EmbeddingPanel.tsx`，实现多文本输入、向量维度/前 8 维预览、余弦相似度矩阵展示（前端计算）
- [x] 5.4 新建 `features/studio/components/RerankPanel.tsx`，实现 query + 候选文档输入、按分数排序的结果列表展示

## 6. 前端：槽位测试页面

- [x] 6.1 新建 `features/studio/pages/SlotTestPage.tsx`，展示 4 个槽位卡片（复用 `GET /api/llm/slots` 数据）+ 选中槽位的测试面板
- [x] 6.2 新建 `features/studio/components/SlotTestPanel.tsx`，实现消息输入 + 调用 `slot-invoke` + 展示结果（内容、routing 信息、延迟、Token 用量）
- [x] 6.3 新建 `features/studio/components/FailoverTrace.tsx`，实现故障转移时间线可视化（每步的 Provider/Model、成功/失败状态）

## 7. 前端：路由和导航集成

- [x] 7.1 在 `App.tsx` 中新增 `/studio/playground` 和 `/studio/slots` 路由
- [x] 7.2 在 `Sidebar.tsx` 中新增 Studio 导航分组（Playground + 槽位测试），使用分隔线与 Admin 分组区分
- [x] 7.3 在 Playground 和槽位测试页面顶部添加费用提醒提示条

## 8. 质量验证

- [x] 8.1 后端 ruff check + ruff format 通过
- [x] 8.2 前端 TypeScript 类型检查通过
- [ ] 8.3 手动验证：通过 Playground 向已配置 Provider 发送 Chat 请求并收到回复
- [ ] 8.4 手动验证：通过槽位测试发起调用并查看 routing 信息
