## 1. 后端预设注册表

- [x] 1.1 创建 `llm-service/src/llm_service/core/presets.py`，定义 `ProviderPreset` dataclass 和 `BUILTIN_PRESETS` 字典（5 个平台：OpenRouter、Kimi、智谱、AIPing、MiniMax）
- [x] 1.2 新增 `LLM_INVALID_PRESET` 错误码到 `llm-service/src/llm_service/core/errors.py`

## 2. 数据模型与迁移

- [x] 2.1 修改 `llm-service/src/llm_service/models/provider.py`，将 `base_url` 改为 `nullable=True`（`Mapped[str | None]`）
- [x] 2.2 创建 Alembic 迁移（raw SQL）：`ALTER TABLE llm.providers ALTER COLUMN base_url DROP NOT NULL`

## 3. API Schema 调整

- [x] 3.1 修改 `llm-service/src/llm_service/api/schemas/provider.py`：`ProviderCreate.base_url` 改为 `Optional[str] = None`，新增 `preset_id: Optional[str] = None` 字段
- [x] 3.2 新增 `ProviderPresetResponse` schema（`preset_id`、`name`、`provider_type`、`description`）

## 4. Service 层逻辑

- [x] 4.1 修改 `llm-service/src/llm_service/core/service.py` 中的 `create_provider()`：增加 `preset_id` 参数，匹配预设时自动补全 `base_url` 和 `provider_type`，写入 `config.preset_id` 标记
- [x] 4.2 在 `create_provider()` 中增加校验：无 `preset_id` 且无 `base_url` 时抛出 400 错误；`preset_id` 无效时抛出 `LLM_INVALID_PRESET`

## 5. API 路由

- [x] 5.1 新增 `GET /api/llm/providers/presets` 端点（无需认证），返回预设列表
- [x] 5.2 修改 `POST /api/llm/providers` 路由处理函数，透传 `preset_id` 到 service 层

## 6. 前端：预设 API 集成

- [x] 6.1 在 `apps/web/src/api/client.ts` 或 providers API 模块中新增 `getProviderPresets()` 方法
- [x] 6.2 新增 `ProviderPreset` TypeScript 类型定义

## 7. 前端：Provider 创建流程重构

- [x] 7.1 新建 `CreateProviderInline.tsx` 页内组件，包含平台选择卡片网格（从预设 API 动态加载 + 自定义入口卡片）
- [x] 7.2 实现内置平台精简表单（名称自动填充、slug 自动生成、隐藏 base_url，仅显示 API Key 输入）
- [x] 7.3 实现自定义 Provider 完整表单（包含 provider_type、base_url、API Key 等全部字段）
- [x] 7.4 实现创建成功反馈（收起表单、刷新列表）和创建失败错误提示
- [x] 7.5 实现已配置平台的视觉提示（对比 Provider 列表中的 `config.preset_id`，在卡片上显示"已配置"标识）

## 8. 集成与清理

- [x] 8.1 修改 `ProvidersPage.tsx`，将 `CreateProviderSheet` 替换为 `CreateProviderInline` 组件
- [x] 8.2 删除或标记废弃 `CreateProviderSheet.tsx`
- [x] 8.3 端到端验证：启动后端 → 执行迁移 → 调用预设 API → 通过预设创建 Provider → 前端完整流程测试
