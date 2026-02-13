# D2：共识梳理 + 开发原则提取

> 本文档综合 D0 独立立场宣言和 D1 三场聚焦辩论的全部决议，解决残余分歧，提取 Prism Phase 1 开发原则清单。

**日期**：开发启动前
**输入**：D0-position-statements.md、D1-debate-a/b/c.md
**参与者**：赵一凡（主持）、陈思琪、王磊、周安、张晨曦、李维

---

## 1. D1 决议汇总

### 1.1 议题组 A：架构与代码

| # | 决议 | 投票 | 来源 |
|---|------|------|------|
| A1 | 后端服务采用两层结构（`api/` + `core/`），`core/` 单文件超 400 行时拆分为 `service/` + `repository/` | 5:1 | D1-a §1.6 |
| A2 | `api/` 层作为安全边界，承担所有输入验证和权限检查 | 6:0 | D1-a §1.6 |
| A3 | AI 管线使用独立 `pipeline/` 目录，不套用 Web 服务分层 | 6:0 | D1-a §1.6 |
| A4 | Prompt 模板集中在 `prompts/` 目录，版本化管理 | 6:0 | D1-a §1.6 |
| A5 | 爬虫脚本独立在 `tools/crawlers/` 下 | 6:0 | D1-a §1.6 |
| A6 | 配置管理统一使用 `pydantic-settings`，每个服务独立 Settings 类 | 5:1 | D1-a §1.6 |
| A7 | DB 迁移每个 Schema 独立 Alembic 环境 | 6:0 | D1-a §1.6 |
| A8 | 使用 `import-linter` 自动检查导入方向 | 5:1 | D1-a §2.4 |
| A9 | 删除自建 Provider 适配器，全面采用 LiteLLM | 6:0 | D1-a §3.5 |
| A10 | SlotRouter 封装 LiteLLM，承载故障转移/审计/批量分片 | 6:0 | D1-a §3.5 |
| A11 | Embedding 批量分片在 SlotRouter 中处理，不暴露给调用方 | 6:0 | D1-a §3.5 |

### 1.2 议题组 B：API 与测试

| # | 决议 | 投票 | 来源 |
|---|------|------|------|
| B1 | 错误码按域前缀组织：`AUTH_*`、`LLM_*`、`VOC_*`、`VALIDATION_*` | 6:0 | D1-b §B1 |
| B2 | LLM 错误码三层分类：`LLM_PROVIDER_ERROR`、`LLM_RESPONSE_INVALID`、`LLM_GUARD_REJECTED` | 6:0 | D1-b §B1 |
| B3 | `null` 仅用于"值明确不存在"的语义，空集合用 `[]` 不用 `null` | 6:0 | D1-b §B1 |
| B4 | 时间字段统一 ISO 8601 格式（`2026-02-12T10:00:00Z`） | 6:0 | D1-b §B1 |
| B5 | LLM 测试三层策略：Mock 测试(CI 必跑) + Golden Dataset 回归(Prompt 变更时) + 基准测试(里程碑前) | 6:0 | D1-b §B2 |
| B6 | CI 完全隔离：不依赖任何外部服务（LLM/Redis/外部 API） | 6:0 | D1-b §B2 |
| B7 | Prompt 模板变更触发 Golden Dataset 回归测试 | 6:0 | D1-b §B2 |
| B8 | `prompts/` 目录设置 CODEOWNERS，陈思琪为必须审查者 | 6:0 | D1-b §B2 |
| B9 | FastAPI 自动生成 OpenAPI 作为唯一真实来源（不手写 YAML） | 6:0 | D1-b §B3 |
| B10 | CI 中导出 OpenAPI Spec 并检查向后兼容性（字段删除/重命名 → 阻断） | 6:0 | D1-b §B3 |
| B11 | 使用 `openapi-typescript` 自动生成前端类型 | 6:0 | D1-b §B3 |

### 1.3 议题组 C：工作流与协作

| # | 决议 | 投票 | 来源 |
|---|------|------|------|
| C1 | 改良版 GitHub Flow：main + 短命功能分支（建议 ≤ 3 天，硬限 5 天） | 6:0 | D1-c §C1 |
| C2 | main 分支保护：至少 1 个 Approval + CI 全绿 | 6:0 | D1-c §C1 |
| C3 | 安全/认证/数据模型变更需 2 个 Approval | 6:0 | D1-c §C1 |
| C4 | Conventional Commits 格式（`feat:`、`fix:`、`refactor:`、`docs:`） | 6:0 | D1-c §C1 |
| C5 | 设计文档三级制：新 API/Schema/依赖 → 必须写；重构/优化 → 建议写；Bug 修复 → 不需要 | 6:0 | D1-c §C2 |
| C6 | 设计文档使用简短模板：问题、方案、接口、否决的替代方案 | 6:0 | D1-c §C2 |
| C7 | Prompt 变更独立 PR，附带变更原因和样本对比结果 | 6:0 | D1-c §C2 |
| C8 | PR 大小限制：建议 < 300 行，超过 500 行建议拆分 | 6:0 | D1-c §C3 |
| C9 | PR 审查时限：< 200 行 24h，200-500 行 48h | 6:0 | D1-c §C3 |
| C10 | 领域审查清单：后端/前端/AI 管线/安全各有专门审查维度 | 6:0 | D1-c §C3 |
| C11 | 代码风格自动化（ruff + ESLint）在 pre-commit hook 执行，不作为 PR 讨论话题 | 6:0 | D1-c §C3 |

---

## 2. 残余分歧解决

### 2.1 分歧 1：两层 vs 三层何时切换

**状态**：D1 中赵一凡有条件接受两层，但对"400 行触发拆分"的阈值存疑。

**最终决议**：
- 初始采用两层（`api/` + `core/`）
- `core/` 中单文件超过 **400 行**（不含空行和注释），由该服务负责人发起拆分讨论
- 拆分不是自动触发三层，而是根据实际情况决定拆分策略（可能是按功能域拆多文件，不一定是引入 repository 层）
- **赵一凡接受此方案**，条件是 voc-service 在 M3 里程碑后必须审查是否需要拆分

### 2.2 分歧 2：前端契约何时冻结

**状态**：张晨曦要求契约冻结后才开始前端开发，王磊认为过早冻结限制后端灵活性。

**最终决议**：
- API Design Doc 阶段确定端点、请求/响应结构、错误码（文档级冻结）
- 后端实现过程中允许**新增字段**（backward compatible），不允许删除/重命名已定义字段
- 前端可在 Design Doc 确认后立即启动开发（使用 MSW Mock）
- 后端 API 合并到 main 后，CI 自动导出 OpenAPI Spec 并检查兼容性

### 2.3 分歧 3：LLM 回归测试成本

**状态**：陈思琪要求 Prompt 变更触发真实 LLM 测试，周安担心 CI 不确定性和成本。

**最终决议**：
- 真实 LLM 回归测试**不纳入常规 CI**（不阻塞 PR 合并）
- 作为**手动触发**的 GitHub Action（`workflow_dispatch`），Prompt 变更时由陈思琪手动触发
- 里程碑前的基准测试由陈思琪在本地/专用环境执行
- LLM 测试费用纳入项目预算，每月上限 ¥200

---

## 3. 开发原则清单

基于 D0-D1 全部讨论和上述残余分歧解决，提取以下 22 条开发原则。

### 3.1 架构原则（6 条）

| # | 原则 | 简述 | 来源 |
|---|------|------|------|
| P01 | **依赖方向不可逆** | `shared → services → apps`，违反此方向的代码不允许合并。`import-linter` 自动检查。 | PRD + A8 |
| P02 | **Schema 隔离** | 4 个 PostgreSQL Schema（auth/llm/agent/voc）各自独立 Alembic 环境，不允许跨 Schema 外键（唯一例外：`voc.tag_feedback.user_id → auth.user.id`）。 | PRD §4.6 |
| P03 | **两层起步，按需演进** | 后端服务初始 `api/` + `core/` 两层；`core/` 单文件超 400 行时讨论拆分策略。不提前引入 repository 层。 | A1 |
| P04 | **API 层即安全边界** | `api/` 层承担全部输入验证、权限检查、请求清洗。业务逻辑层信任 `api/` 层已校验的输入。 | A2 |
| P05 | **AI 管线独立结构** | AI 管线使用 `pipeline/` 目录组织（DAG 而非 RPC），Prompt 模板集中在 `prompts/` 下版本化管理。 | A3, A4 |
| P06 | **外部依赖封装隔离** | LiteLLM 通过 SlotRouter 封装，业务代码不直接调用 LiteLLM API。所有外部依赖通过抽象层隔离，保留替换空间。 | A9, A10 |

### 3.2 API 设计原则（5 条）

| # | 原则 | 简述 | 来源 |
|---|------|------|------|
| P07 | **统一响应格式** | 成功：`{ data, meta }`；列表：`{ data, pagination, meta }`；错误：`{ error: { code, message }, meta }`。 | PRD §4.3 |
| P08 | **域前缀错误码** | `AUTH_*`、`LLM_*`、`VOC_*`、`VALIDATION_*`。字符串格式，自文档化。 | B1 |
| P09 | **API 向后兼容** | 已冻结的 API 不允许 breaking change（删除字段、重命名字段）。新增字段始终允许。CI 自动检查 OpenAPI Spec 兼容性。 | PRD §4.3, B10 |
| P10 | **null 语义明确** | `null` 仅表示"值明确不存在"。空集合用 `[]`，空对象用 `{}`。禁止用 `null` 表示"未加载"或"默认值"。 | B3 |
| P11 | **时间格式统一** | 所有时间字段使用 ISO 8601 格式（`2026-02-12T10:00:00Z`），UTC 时区。 | B4 |

### 3.3 测试原则（4 条）

| # | 原则 | 简述 | 来源 |
|---|------|------|------|
| P12 | **CI 完全隔离** | CI 环境不依赖任何外部服务。LLM/外部 API 全部 Mock，数据库使用 TestContainers 或 SQLite。 | B6 |
| P13 | **LLM 测试三层** | 第一层：Mock 测试（CI 必跑，测编排逻辑）；第二层：Golden Dataset 回归（Prompt 变更时手动触发）；第三层：基准测试（里程碑前执行）。 | B5 |
| P14 | **测试优先级** | API 集成测试 > 关键路径单元测试 > E2E 测试。不为私有方法写专门的单元测试。测试 ROI 最高的是 API 端点测试。 | D1-b |
| P15 | **真实数据样本** | 数据管线测试使用脱敏后的真实格式样本（含编码边界、空值、特殊字符），不使用 Faker 生成的假数据。 | D1-b |

### 3.4 代码质量原则（4 条）

| # | 原则 | 简述 | 来源 |
|---|------|------|------|
| P16 | **代码风格自动化** | Python：`ruff format` + `ruff check`；TypeScript：ESLint + Prettier。在 pre-commit hook 中执行，不作为 PR 讨论话题。 | C11 |
| P17 | **配置集中管理** | 所有配置通过 `pydantic-settings` 从环境变量加载，每个服务独立 Settings 类。禁止硬编码配置值。 | A6 |
| P18 | **类型安全** | Python：关键接口使用类型注解，按需使用 pyright。TypeScript：`strict: true`，禁用 `any`。 | D0, D1-c |
| P19 | **Prompt 即代码** | Prompt 模板变更等同于业务逻辑变更：独立 PR、附变更原因、CODEOWNERS 审查、版本化管理。 | B7, B8, C7 |

### 3.5 流程原则（3 条）

| # | 原则 | 简述 | 来源 |
|---|------|------|------|
| P20 | **短命分支 + 强制审查** | 功能分支生命周期 ≤ 3 天（硬限 5 天）。main 分支保护：1 Approval + CI 全绿。安全相关变更需 2 Approval。 | C1, C2, C3 |
| P21 | **设计先于编码** | 新 API、新 Schema、新依赖引入必须先提 Design Doc PR。文档模板：问题 → 方案 → 接口 → 否决的替代方案。 | C5, C6 |
| P22 | **契约驱动并行** | 前后端基于 OpenAPI Schema 并行开发。FastAPI 自动生成 Spec → CI 导出 → openapi-typescript 生成前端类型 → MSW Mock 驱动前端开发。 | B9, B11 |

---

## 4. CLAUDE.md 优化草案

基于上述 22 条开发原则，建议对 CLAUDE.md 进行以下修改：

### 4.1 需修复的内容

| 现有内容 | 修改为 | 原因 |
|---------|--------|------|
| "LLM 别名系统" | "LLM 4 槽位模型" | R5-B 决议已替代 |
| 基础设施表缺少 Neo4j | 补充 Neo4j（7474/7687） | docker-compose.yml 已包含 |
| 数据库隔离仅列 `llm` 和 `auth` | 补充 `agent` 和 `voc` Schema | PRD §4.2 |
| 设计文档列表引用 llm-service-design.md 和 phase1-deliverables.md | 标注 SUPERSEDED + 添加新设计文档 | 文档已过时 |

### 4.2 需新增的内容

| 段落 | 内容 | 来源 |
|------|------|------|
| 服务架构表 | 新增 voc-service、agent-service | PRD |
| 开发原则 | P01-P22 精炼版 | D2 §3 |
| 代码规范 | Python ruff + TypeScript ESLint + Conventional Commits | D1-c |
| 测试命令 | pytest 执行方式 + Golden Dataset 回归 | D1-b |
| Git 工作流 | GitHub Flow + 分支规则 + PR 规范 | D1-c |
| 项目结构 | 更新后的完整目录树（含 voc-service、agent-service、tools/crawlers） | D1-a |
| 服务开发指南 | 新建服务的 checklist（Settings、迁移、API 注册、测试配置） | D1-a |

### 4.3 需归档引用的内容

| 文件 | 处理 |
|------|------|
| `docs/phase1-deliverables.md` | 顶部标注 SUPERSEDED，指向 PRD v2.0 |
| `docs/llm-service-design.md` | 顶部标注 SUPERSEDED，指向 `docs/designs/llm-service/design.md` |

---

## 5. 原则验证

### 5.1 与 PRD v2.0 决策对齐检查

| PRD 决策 | 对应原则 | 状态 |
|---------|---------|------|
| 依赖方向不可逆 | P01 | 完全对齐 |
| Schema 隔离 | P02 | 完全对齐 |
| 4 槽位模型替代别名 | P06（SlotRouter 封装） | 完全对齐 |
| API 契约冻结 | P09 | 完全对齐 |
| 统一响应格式 | P07 | 完全对齐 |
| LLM 守卫层 L1/L2 | P04（API 安全边界）+ P13（测试策略） | 完全对齐 |
| 置信度展示 | 交由前端设计文档处理 | 不在开发原则范围 |
| 爬虫独立脚本 | A5（tools/crawlers/） | 完全对齐 |

### 5.2 团队签署

| 成员 | 签署状态 | 保留意见 |
|------|---------|---------|
| 赵一凡 | 同意 | M3 后审查 voc-service 是否需要拆分至三层 |
| 陈思琪 | 同意 | Prompt 回归测试费用纳入预算 |
| 王磊 | 同意 | 无 |
| 周安 | 同意 | 安全审查清单在 Phase 2 完成前落地 |
| 张晨曦 | 同意 | OpenAPI 自动生成管线在前端启动前就绪 |
| 李维 | 同意 | 无 |

---

*本文档综合了 D0 独立立场和 D1 三场辩论的全部决议，解决了 3 项残余分歧，提取了 22 条开发原则。这些原则将直接指导 CLAUDE.md 优化和后续设计文档撰写。所有 6 位团队成员签署同意。*
