## ADDED Requirements

### Requirement: 内置 Provider 预设注册表

系统 SHALL 维护一个编译期常量注册表，包含以下 5 个内置 LLM 平台的预设配置：

| preset_id     | 显示名称     | provider_type | base_url |
|---------------|-------------|---------------|----------|
| `openrouter`  | OpenRouter  | `openai`      | `https://openrouter.ai/api/v1` |
| `kimi`        | Kimi        | `openai`      | `https://api.moonshot.cn/v1` |
| `zhipu`       | 智谱 AI     | `openai`      | `https://open.bigmodel.cn/api/paas/v4` |
| `aiping`      | AIPing      | `openai`      | `https://api.aiping.ai/v1` |
| `minimax`     | MiniMax     | `openai`      | `https://api.minimax.chat/v1` |

每个预设条目 MUST 包含：`preset_id`（唯一标识）、`name`（显示名称）、`provider_type`（LiteLLM 类型）、`base_url`（API 地址）、`description`（一句话描述）。

#### Scenario: 预设注册表可被代码引用

- **WHEN** 系统启动时加载 `llm_service.core.presets` 模块
- **THEN** `BUILTIN_PRESETS` 字典包含 5 个条目，键为 preset_id，值包含完整的预设元数据

#### Scenario: 预设条目字段完整性

- **WHEN** 遍历 `BUILTIN_PRESETS` 中任意条目
- **THEN** 该条目 MUST 包含 `preset_id`、`name`、`provider_type`、`base_url`、`description` 五个字段且均非空

---

### Requirement: 预设查询 API

系统 SHALL 提供 `GET /api/llm/providers/presets` 端点，返回所有内置预设的公开信息。

该端点无需认证（预设是公开常量），响应格式遵循项目统一 `{ data, meta }` 格式。

#### Scenario: 获取全部预设列表

- **WHEN** 客户端发送 `GET /api/llm/providers/presets`
- **THEN** 响应状态码为 200，`data` 为数组，包含 5 个预设对象，每个对象包含 `preset_id`、`name`、`provider_type`、`description` 字段（不包含 `base_url`，避免泄露内部地址细节）

#### Scenario: 无需认证即可访问

- **WHEN** 客户端未携带 Authorization header 发送 `GET /api/llm/providers/presets`
- **THEN** 响应状态码仍为 200，正常返回预设列表

---

### Requirement: 基于预设创建 Provider

`POST /api/llm/providers` 端点 SHALL 支持通过 `preset_id` 字段创建 Provider。当请求包含有效 `preset_id` 时，系统自动从预设注册表填充 `base_url` 和 `provider_type`，用户无需手动提供这两个字段。

#### Scenario: 使用预设创建 Provider（最简请求）

- **WHEN** 客户端发送 `POST /api/llm/providers`，请求体包含 `preset_id: "openrouter"`、`name`、`slug`、`api_key`，不包含 `base_url` 和 `provider_type`
- **THEN** 系统从预设注册表查找 `openrouter`，自动填充 `base_url` 为 `https://openrouter.ai/api/v1`、`provider_type` 为 `openai`，创建成功，响应状态码 201

#### Scenario: 使用预设但用户覆盖 base_url

- **WHEN** 客户端发送 `POST /api/llm/providers`，请求体包含 `preset_id: "kimi"` 且同时提供了自定义 `base_url`
- **THEN** 系统使用用户提供的 `base_url` 覆盖预设值，其余预设字段（`provider_type`）仍从预设填充

#### Scenario: 无效 preset_id

- **WHEN** 客户端发送 `POST /api/llm/providers`，请求体包含 `preset_id: "unknown_platform"`
- **THEN** 响应状态码为 400，错误码为 `LLM_INVALID_PRESET`，消息说明该预设不存在

#### Scenario: 无 preset_id 且无 base_url

- **WHEN** 客户端发送 `POST /api/llm/providers`，请求体不包含 `preset_id` 且不包含 `base_url`
- **THEN** 响应状态码为 422（Pydantic 验证失败）或 400，提示 `base_url` 为必填（非预设模式下）

---

### Requirement: Provider 记录标记预设来源

通过预设创建的 Provider 记录 SHALL 在 `config` JSONB 字段中存储 `preset_id` 标记，用于前端识别该 Provider 的预设来源。

#### Scenario: 预设创建的 Provider 包含来源标记

- **WHEN** 通过 `preset_id: "zhipu"` 创建 Provider 后查询该 Provider 详情
- **THEN** 响应中 `config` 字段包含 `{"preset_id": "zhipu"}`

#### Scenario: 自定义创建的 Provider 无预设标记

- **WHEN** 不使用 `preset_id` 创建 Provider 后查询该 Provider 详情
- **THEN** 响应中 `config` 字段不包含 `preset_id` 键

---

### Requirement: base_url 数据模型调整

`Provider` ORM 模型的 `base_url` 字段 SHALL 改为 nullable，对应数据库迁移 `ALTER COLUMN base_url DROP NOT NULL`。

#### Scenario: 数据库允许 base_url 为空

- **WHEN** Alembic 迁移执行完成后
- **THEN** `llm.providers` 表的 `base_url` 列允许 NULL 值

#### Scenario: 现有 Provider 记录不受影响

- **WHEN** 迁移前已存在的 Provider 记录
- **THEN** 迁移后其 `base_url` 值保持不变（非空）
