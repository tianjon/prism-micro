## Why

当前新建 Provider 时，用户必须手动填写 `base_url`，而主流 LLM 平台（OpenRouter、Kimi、智谱、AIPing、MiniMax）的 API 地址是固定且公开的。这一冗余步骤增加了配置出错概率，降低了开箱体验。通过内置预设，用户只需选择平台、填入 API Key 即可完成配置。

## What Changes

- 后端新增 **内置 Provider 预设注册表**，定义 5 个平台（OpenRouter、Kimi、智谱、AIPing、MiniMax）的固定元数据（`base_url`、`provider_type`、显示名称、图标标识）
- `Provider` 数据模型的 `base_url` 字段改为 **可选**（nullable）——选择内置平台时由系统自动填充，仅自定义平台需手动输入
- `ProviderCreate` API Schema 的 `base_url` 改为 Optional，后端根据是否匹配内置预设自动补全
- 前端 Provider 创建流程重构：使用 **页内（inline）卡片选择 + 表单** 替代当前的侧边抽屉（Sheet），内置平台以品牌卡片展示，选中后自动隐藏 Base URL 输入项
- 保留"自定义 Provider"入口，用户仍可手动输入任意 `base_url`

## Capabilities

### New Capabilities

- `builtin-provider-registry`: 后端内置 Provider 预设注册表（平台元数据定义、API 自动补全逻辑、预设查询接口）
- `provider-creation-flow`: 前端 Provider 创建流程重构（卡片选择式 UI，取代侧边抽屉设计，内置平台自动隐藏 base_url 输入）

### Modified Capabilities

（无现有 spec 需要修改）

## Impact

- **llm-service**
  - `models/provider.py`: `base_url` 列改为 nullable
  - `api/schemas/provider.py`: `ProviderCreate.base_url` 改为 `Optional[str]`
  - `core/service.py`: `create_provider` 增加预设匹配与自动补全逻辑
  - 新增 `core/presets.py`: 内置 Provider 预设注册表
  - 新增 API 端点: `GET /api/llm/providers/presets` 返回可用预设列表
  - Alembic 迁移: `base_url` 列 `ALTER COLUMN ... DROP NOT NULL`
- **apps/web**
  - `CreateProviderSheet.tsx` 重构为页内创建组件（不再使用 Sheet）
  - 新增品牌卡片选择组件，展示内置平台 logo/名称
  - 表单逻辑调整：选择内置平台时隐藏 Base URL 输入
- **API 兼容性**: `base_url` 从 required → optional 为向后兼容变更，不影响已有调用方
