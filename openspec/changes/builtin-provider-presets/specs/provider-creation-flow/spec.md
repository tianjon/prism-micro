## ADDED Requirements

### Requirement: 平台选择卡片网格

Provider 创建流程的第一步 SHALL 展示平台选择卡片网格，包含 5 个内置平台卡片和 1 个"自定义"入口卡片。

卡片网格使用页内（inline）渲染，不使用 Sheet 抽屉或 Modal 弹窗。

每张内置平台卡片 MUST 显示：平台名称、一句话描述。"自定义"入口卡片 MUST 显示明确的"自定义 Provider"文案，引导用户手动配置。

#### Scenario: 初始状态展示 6 张卡片

- **WHEN** 用户在 Provider 管理页点击"添加 Provider"操作
- **THEN** 页面内展示 6 张卡片（OpenRouter、Kimi、智谱 AI、AIPing、MiniMax、自定义），无弹出层或抽屉

#### Scenario: 卡片数据来源于预设 API

- **WHEN** 平台选择卡片网格渲染时
- **THEN** 前端从 `GET /api/llm/providers/presets` 获取内置平台列表，动态渲染卡片（非前端硬编码）

#### Scenario: 选中卡片高亮

- **WHEN** 用户点击某张平台卡片
- **THEN** 该卡片呈现选中态（视觉高亮），其余卡片恢复默认态

---

### Requirement: 内置平台精简配置表单

选中内置平台卡片后，SHALL 展示精简配置表单，仅包含必要字段。

精简表单字段：
- **名称**（name）：自动填充为平台显示名称，用户可修改
- **标识符**（slug）：自动从名称生成，用户可修改
- **API Key**：必填，密码输入框

精简表单 MUST NOT 显示 `base_url` 和 `provider_type` 输入项——这两个字段由预设自动填充。

#### Scenario: 选中内置平台后展示精简表单

- **WHEN** 用户点击"OpenRouter"卡片
- **THEN** 卡片下方或右侧展开配置表单，名称自动填充"OpenRouter"，slug 自动填充"openrouter"，仅显示 API Key 输入框，不显示 base_url 输入

#### Scenario: 提交精简表单

- **WHEN** 用户在精简表单中填入 API Key 并提交
- **THEN** 前端发送 `POST /api/llm/providers`，请求体包含 `preset_id`、`name`、`slug`、`api_key`，不包含 `base_url`

---

### Requirement: 自定义 Provider 完整配置表单

选中"自定义"卡片后，SHALL 展示完整配置表单，包含所有字段。

完整表单字段：
- **名称**（name）：必填
- **标识符**（slug）：必填
- **Provider 类型**（provider_type）：必填，提供 openai/anthropic/custom 选项
- **Base URL**（base_url）：必填
- **API Key**：必填

#### Scenario: 选中自定义后展示完整表单

- **WHEN** 用户点击"自定义"卡片
- **THEN** 展开完整配置表单，包含 provider_type、base_url、API Key 等所有字段

#### Scenario: 提交完整表单

- **WHEN** 用户填写完所有字段并提交
- **THEN** 前端发送 `POST /api/llm/providers`，请求体不包含 `preset_id`，包含 `base_url` 和 `provider_type`

---

### Requirement: 创建成功反馈

Provider 创建成功后 SHALL 收起表单，刷新 Provider 列表，展示新创建的 Provider 卡片。

#### Scenario: 创建成功后更新列表

- **WHEN** `POST /api/llm/providers` 返回 201
- **THEN** 平台选择卡片和配置表单收起，Provider 列表刷新并展示新条目

#### Scenario: 创建失败显示错误

- **WHEN** `POST /api/llm/providers` 返回错误（如 slug 冲突 409）
- **THEN** 表单保持展开状态，在表单内显示错误信息，用户可修改后重新提交

---

### Requirement: 已配置平台的视觉提示

卡片网格中，如果某个内置平台已被配置为 Provider，SHALL 在对应卡片上展示"已配置"标识，避免用户重复添加。

#### Scenario: 已配置平台卡片显示标识

- **WHEN** 平台选择卡片网格渲染时，且 Provider 列表中已存在 `config.preset_id` 为 `"openrouter"` 的记录
- **THEN** OpenRouter 卡片显示"已配置"标识（如勾选图标或文字标签）

#### Scenario: 已配置平台仍可点击

- **WHEN** 用户点击"已配置"的平台卡片
- **THEN** 仍可展开表单进行再次添加（允许同一平台多实例，如不同 API Key）
