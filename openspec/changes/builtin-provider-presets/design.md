## Context

当前 `llm-service` 的 Provider CRUD 要求用户手动输入 `base_url`（ORM 非空、Pydantic 必填）。前端创建流程使用侧边 Sheet 抽屉，仅支持 openai/anthropic/custom 三种类型。

本变更为 5 个主流 LLM 平台（OpenRouter、Kimi、智谱、AIPing、MiniMax）提供内置预设，使用户无需记忆 API 地址，选择平台后只填 API Key 即可完成配置。

相关代码入口：
- ORM: `llm-service/src/llm_service/models/provider.py` — `Provider.base_url` 当前 `nullable=False`
- Schema: `llm-service/src/llm_service/api/schemas/provider.py` — `ProviderCreate.base_url` 必填
- Service: `llm-service/src/llm_service/core/service.py` — `create_provider()` 直接透传 `base_url`
- 前端: `apps/web/src/features/admin/components/CreateProviderSheet.tsx` — Sheet 抽屉 + 3 步表单

## Goals / Non-Goals

**Goals:**
- 为 5 个内置平台提供零配置 base_url 体验（只需 API Key）
- 预设注册表纯 Python 定义，无需数据库表，方便扩展新平台
- 前端创建流程从 Sheet 抽屉改为页内卡片选择，降低操作层级
- `base_url` 向后兼容：已有 Provider 记录不受影响，自定义 Provider 仍可手动填写

**Non-Goals:**
- 不做模型列表同步（各平台可用模型仍需用户在 Slot 配置时手动指定 model_id）
- 不做 API Key 格式校验（各平台 Key 格式不同，统一校验不现实）
- 不做 Provider 图标/Logo 资源托管（Phase 1 使用文字首字母或 emoji 标识）
- 不做运行时从远端拉取预设列表（全部硬编码在代码中）

## Decisions

### D1: 预设注册表实现方式 — Python dict 常量

**选择**: 在 `llm-service/src/llm_service/core/presets.py` 中定义 `BUILTIN_PRESETS: dict[str, ProviderPreset]` 常量。

**替代方案**:
- 数据库 seed 表 → 增加运维复杂度，预设变更需跑迁移
- YAML/JSON 配置文件 → 多一层文件读取，且仍需重启生效
- 环境变量注入 → 5 个平台各 3+ 字段，膨胀严重

**理由**: 预设是代码级常量（API 地址几乎不变），Python dict 最直接、类型安全、IDE 可跳转，新增平台只需追加一个条目。

### D2: `base_url` 字段处理策略 — ORM nullable + service 层补全

**选择**:
1. ORM `Provider.base_url` 改为 `nullable=True`
2. Pydantic `ProviderCreate.base_url` 改为 `Optional[str] = None`
3. 新增 `ProviderCreate.preset_id: Optional[str] = None` 字段
4. `create_provider()` 中：如果 `preset_id` 非空且匹配预设，从预设填充 `base_url` 和 `provider_type`；如果 `preset_id` 为空，则 `base_url` 必须提供（service 层校验）

**替代方案**:
- DB 层 default 值 → 不同平台 default 不同，无法用单一 default
- `base_url` 保持非空，service 层在入库前填充 → 可行但 ORM 约束与实际逻辑不一致
- 完全去掉 `base_url` 存储，运行时从预设查 → 自定义 Provider 无处存储 URL

**理由**: nullable 真实反映"内置平台不需要用户提供 URL"的业务语义。service 层校验保证自定义 Provider 仍需 `base_url`，两层防线。

### D3: 预设 API 端点设计

**选择**: `GET /api/llm/providers/presets` 返回所有内置预设的公开信息（id、name、provider_type、description），不需认证（预设是公开常量）。

**理由**: 前端需要预设列表来渲染卡片选择 UI。端点轻量级，返回的是编译期常量，无 DB 查询。

### D4: 前端创建流程 — 页内两段式

**选择**: 替换 `CreateProviderSheet`（Sheet 抽屉）为页内组件，分两段：
1. **平台选择**: 品牌卡片网格（5 个内置 + 1 个"自定义"入口），选中后卡片高亮
2. **配置表单**: 选中内置平台后展示精简表单（名称自动填充、隐藏 base_url、只需填 API Key）；选中"自定义"时展示完整表单

**替代方案**:
- 对话框（Dialog/Modal）→ 仍有弹出遮罩，体验略重
- 新页面跳转 → 操作流断裂，创建一个 Provider 不值得独立页面
- 保留 Sheet 但增加预设选择步骤 → 用户明确禁止 Sheet 设计

**理由**: 页内卡片选择符合渐进式展示原则——初始只有 6 张卡片，选中后才展开表单，信息密度合理。

### D5: Provider 记录是否标记预设来源

**选择**: 在 `Provider.config` JSONB 字段中存储 `{"preset_id": "openrouter"}` 标记，不新增数据库列。

**替代方案**:
- 新增 `preset_id` 列 → 需要迁移，且该信息仅用于前端展示优化
- 不存储来源 → 编辑时无法判断是否应隐藏 base_url

**理由**: 利用现有 `config` JSONB 字段，零迁移成本（`base_url` nullable 迁移已有），前端编辑时可据此决定是否显示 base_url 输入。

## Risks / Trade-offs

- **[平台 API 地址变更]** → 内置预设硬编码 base_url，如果平台变更地址需要发版更新。缓解：这些平台的 API 地址数年未变，且变更时通常会保持旧地址兼容。
- **[base_url nullable 影响现有代码]** → `test_provider_connectivity()` 等函数使用 `provider.base_url` 拼接 URL。缓解：内置平台创建时 service 层已从预设填充 base_url 到数据库，运行时不会遇到 null。仅当旧数据迁移后出现 null 行时需处理（当前无生产数据，不存在此问题）。
- **[前端组件重构范围]** → `CreateProviderSheet` 改为页内组件需要调整 `ProvidersPage` 的布局逻辑。缓解：当前 `ProvidersPage` 本身较简单（卡片列表 + 添加按钮），重构影响可控。
