## ADDED Requirements

### Requirement: Playground 页面
系统 SHALL 在 `/studio/playground` 提供交互式 Playground 页面，支持 Chat、Embedding、Rerank 三种模式切换。Playground 纯前端消费 llm-service 的 `/api/llm/completions`、`/api/llm/embeddings`、`/api/llm/rerank` 通用网关 API。

#### Scenario: Chat 模式交互
- **WHEN** 用户选择 Chat 模式，选定 Provider 和 Model，输入消息并发送
- **THEN** 页面调用 `/api/llm/completions`，以对话气泡形式展示用户消息和模型回复（流式时逐字显示），底部展示延迟和 Token 用量

#### Scenario: 多轮对话
- **WHEN** 用户在同一会话中连续发送多条消息
- **THEN** 页面将完整对话历史作为 `messages` 数组传递，模型回复基于上下文生成

#### Scenario: Embedding 模式交互
- **WHEN** 用户选择 Embedding 模式，输入一段或多段文本并提交
- **THEN** 页面调用 `/api/llm/embeddings`，展示每段文本的向量维度和前 8 维数值预览；多段文本时展示余弦相似度矩阵（前端计算）

#### Scenario: Rerank 模式交互
- **WHEN** 用户选择 Rerank 模式，输入 query 和多个候选文档并提交
- **THEN** 页面调用 `/api/llm/rerank`，展示按相关性分数排序的文档列表，每项显示原始序号、文档内容和分数

#### Scenario: Provider 和 Model 选择
- **WHEN** 用户打开 Playground 页面
- **THEN** 页面提供 Provider 选择器（复用 ProviderCombobox）和 Model 选择器（复用 ModelCombobox）

### Requirement: 槽位测试页面
系统 SHALL 在 `/studio/slots` 提供槽位测试页面，通过调用 `/api/llm/slots/{type}/invoke` 测试槽位行为和故障转移。

#### Scenario: 槽位总览
- **WHEN** 用户打开槽位测试页面
- **THEN** 页面展示 4 个槽位卡片，每张显示：槽位类型、主 Provider/Model、资源池大小、启用状态（数据来源：`GET /api/llm/slots`）

#### Scenario: 发起槽位调用测试
- **WHEN** 用户选中一个槽位，输入测试内容并点击"测试"
- **THEN** 页面调用 `POST /api/llm/slots/{type}/invoke`，展示：模型回复内容、路由决策（Provider/Model、是否使用资源池）、延迟和 Token 用量

#### Scenario: 故障转移可视化
- **WHEN** 槽位调用触发了资源池故障转移
- **THEN** 页面展示 failover_trace：每个尝试的 Provider+Model、成功/失败状态、最终使用的模型

### Requirement: Studio 导航入口
系统 SHALL 在侧边栏新增 LLM Studio 分组，包含"Playground"和"槽位测试"两个导航入口。

#### Scenario: 侧边栏导航
- **WHEN** 用户查看侧边栏
- **THEN** 在管理功能（模型槽位、Provider 管理）之外，显示 Studio 分组，包含"Playground"（/studio/playground）和"槽位测试"（/studio/slots）链接

### Requirement: 费用提醒
Studio 页面 SHALL 在发起推理请求前显示明确提示，告知用户此操作将消耗 API 额度。

#### Scenario: 发送前提示
- **WHEN** 用户首次在 Playground 或槽位测试中点击发送
- **THEN** 页面顶部展示持久提示条："Studio 中的每次调用均会消耗 API 额度"
