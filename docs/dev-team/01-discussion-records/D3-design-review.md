# D3 团队集体评审

> **评审日期**：2026-02-12
> **评审范围**：5 份实现级设计文档（platform、llm-service、voc-service、agent-service、frontend）
> **评审维度**：R1 架构一致性 + R2 功能覆盖
> **参考文档**：PRD v2.0、全局 API 契约、D2 开发原则（22 条）

---

## 评审总结

| 维度 | 问题总数 | 严重 | 一般 | 建议 |
|------|---------|------|------|------|
| R1 架构一致性 | 14 | 5 | 6 | 3 |
| R2 功能覆盖 | 11 | 3 | 4 | 4 |
| **合计** | **25** | **8** | **10** | **7** |

**PRD 功能覆盖率**：22/26 完全覆盖，3/26 部分覆盖，1/26 未覆盖

---

# 第一部分：R1 架构一致性评审

## 评审概况
- 评审文档数：5（平台基础设施、LLM 服务、VOC 服务、Agent 服务、前端 & CLI）
- 参考文档数：2（全局 API 契约、D2 开发原则）
- 发现问题数：14（严重 5 / 一般 6 / 建议 3）

---

## 1. API 契约对齐

### 1.1 发现的问题

**[严重-1] LLM Chat API 请求参数在全局契约与 LLM 设计文档间不一致**

全局 API 契约 (`api-contracts.md`) 定义 Chat 请求使用 `"model": "default-chat"` 参数：
```json
{ "model": "default-chat", "messages": [...] }
```
而 LLM 设计文档 (`designs/llm-service/design.md`) 已改为基于 4 槽位模型的 `"slot": "reasoning"` 参数：
```json
{ "slot": "reasoning", "messages": [...] }
```
两者的请求/响应格式完全不同。全局契约中还保留了 `model` 和 `resolved_model` 字段，这在 LLM 设计文档中已被 `slot`、`provider`、`model` 替代。**全局 API 契约文档尚未同步 R5-B（4 槽位替代别名系统）的决议。**

**[严重-2] LLM Embedding API 响应格式在全局契约和 LLM 设计文档间不一致**

全局契约响应格式：
```json
{ "data": { "model": "default-embedding", "resolved_model": "...", "data": [...] } }
```
LLM 设计文档响应格式：
```json
{ "data": { "slot": "embedding", "provider": "siliconflow", "model": "...", "data": [...] } }
```
字段命名和结构不同：全局契约使用 `model`/`resolved_model`，设计文档使用 `slot`/`provider`/`model`。

**[严重-3] Rerank API 响应格式不一致**

全局契约的 results 中不包含 `document` 字段：
```json
"results": [{ "index": 0, "relevance_score": 0.95 }]
```
LLM 设计文档的 results 中包含 `document` 字段：
```json
"results": [{ "index": 0, "relevance_score": 0.95, "document": "原文本" }]
```

**[一般-1] VOC 搜索 API 请求格式在 VOC 设计文档和前端设计文档间不一致**

VOC 设计文档搜索请求使用 `top_k`、`min_confidence`、`filters`、`rerank` 参数：
```json
{ "query": "支付卡顿", "top_k": 20, "min_confidence": 0.5, "filters": {...}, "rerank": true }
```
前端设计文档使用 `page`、`page_size` 参数：
```json
{ "query": "支付卡顿", "page": 1, "page_size": 20 }
```
搜索结果的响应结构也不同（VOC 返回 `data.results` 嵌套 vs 前端期望 `data` 直接数组 + `pagination`）。两者在分页策略上存在根本分歧（语义搜索 `top_k` 模式 vs 传统分页模式）。

**[一般-2] 导入 API 字段命名不一致**

- VOC 设计文档使用 `batch_id` 作为标识符
- 前端设计文档使用 `import_id` 作为标识符
- 前端 TypeScript 类型使用 `id` 作为标识符

三处命名不统一。

**[一般-3] 导入状态枚举值不一致**

- VOC 设计文档：`pending`, `parsing`, `mapping`, `importing`, `processing`, `completed`, `failed`
- 前端设计文档：`pending`, `mapping`, `confirming`, `importing`, `processing`, `completed`, `failed`

差异：VOC 有 `parsing` 无 `confirming`；前端有 `confirming` 无 `parsing`。

**[一般-4] 映射确认 API 请求格式不一致**

VOC 设计文档使用嵌套结构：
```json
{ "confirmed_mappings": { "评论内容": {"target": "raw_text"} } }
```
前端设计文档使用扁平键值对：
```json
{ "confirmed_mappings": { "评论内容": "content" } }
```
不仅结构不同，连目标字段名都不同（`raw_text` vs `content`）。

**[一般-5] 标签反馈 API 响应格式不一致**

VOC 设计文档返回完整反馈记录（含 id、user_id、created_at），前端设计文档返回简化版本（仅 tag_id、feedback_type、message）。

### 1.2 对齐确认

以下接口在相关文档间已确认对齐：
- LLM Admin Provider/Slot CRUD API（LLM 设计文档内部自洽）
- Agent Execute/Skills API（Agent 设计文档内部自洽）
- 认证 API（前端与全局契约对齐：`/api/auth/login`、`/api/auth/refresh`）
- Health Check 端点（各服务统一 `GET /health`）
- 统一响应格式 `{ data, meta: { request_id, timestamp } }` 在各服务 API 响应示例中均有体现

---

## 2. 数据模型对齐

### 2.1 发现的问题

**[一般-6] 跨 Schema 引用的描述不完全一致**

平台设计文档声明：
> 跨 Schema 引用：voc.tag_feedback.user_id -> auth.users.id（唯一允许的跨 schema 外键）

但 Agent 服务的 `execution_logs.principal_id` 也是逻辑上引用 `auth.users.id` 或 `auth.api_keys.id`。平台文档的"唯一允许"措辞需修正。

**[建议-1] `principal_id` 字段类型不够统一**

- Agent 服务 `execution_logs.principal_id` 类型为 `VARCHAR(200)`
- VOC 服务 `tag_feedback.user_id` 类型为 `UUID`
- 平台 shared 中 `Principal.id` 类型为 `str`

同样表示身份标识但类型不一致，建议统一为 `UUID` 或 `VARCHAR(36)`。

### 2.2 对齐确认

- Schema 命名统一：`auth`/`llm`/`agent`/`voc` 各文档完全一致
- 主键类型统一：全部使用 `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- 时间戳字段统一：全部使用 `TIMESTAMPTZ DEFAULT now()`
- ORM 基类统一：各服务均从 `prism_shared.db.base` 导入 `Base`

---

## 3. 错误码对齐

### 3.1 发现的问题

**[严重-4] 错误码前缀命名不遵循统一的域前缀规则**

D2 开发原则 P08 明确要求：`AUTH_*`, `LLM_*`, `VOC_*`, `VALIDATION_*` 域前缀。

实际情况：
- **LLM 服务**：`INVALID_SLOT`、`PROVIDER_NOT_FOUND` 等 —— **全部缺少 `LLM_` 前缀**
- **VOC 服务**：`INVALID_FILE_FORMAT`、`EMPTY_QUERY` 等 —— **全部缺少 `VOC_` 前缀**
- **Agent 服务**：`AGENT_INVALID_TASK`、`AGENT_SKILL_NOT_FOUND` 等 —— 唯一遵循域前缀的服务
- **平台 shared**：`SHARED_INTERNAL_ERROR`、`SHARED_UNAUTHORIZED` 等 —— 遵循 `SHARED_` 前缀

5 个服务中仅 Agent 和 Platform(shared) 遵循了域前缀规则。

**[严重-5] LLM 服务异常体系未继承 shared 的统一异常基类 AppException**

平台设计文档定义了统一异常基类 `AppException`，各服务应继承此类。但 LLM 设计文档定义了独立的 `LLMServiceError(Exception)`，直接继承 Exception 而非 AppException。

### 3.2 对齐确认

- 错误码域范围分配已明确定义：SHARED 10000-19999, AUTH 20000-29999, LLM 30000-39999, AGENT 40000-49999, VOC 50000-59999
- 错误响应格式 `{ error: { code, message, details? }, meta }` 在各服务文档中保持一致

---

## 4. 技术栈一致性

### 4.1 发现的问题

**[一般-6] VocServiceSettings 和 LLMServiceSettings 未继承 BaseAppSettings**

平台设计文档定义了配置继承链：`BaseAppSettings` -> 各服务 Settings。Agent 服务正确继承了 `BaseAppSettings`。

但 LLM 和 VOC 服务直接继承 `pydantic_settings.BaseSettings`，无法复用 `BaseAppSettings` 中的通用配置项。

**[建议-2] 服务端口号分配混乱**

- LLM 服务：8601
- VOC 服务：8003
- CLI 默认 base_url 指向 8601

端口号没有统一的分配规范文档。CLI 仅一个 `base_url` 不够调用多个服务。

**[建议-3] VOC 服务使用 `get_current_user` 而非 `get_principal`**

VOC 服务使用旧版 `get_current_user`（仅 JWT），Agent 服务使用新版 `get_principal`（JWT + API Key）。需评估 VOC 是否也需要支持 API Key 认证。

### 4.2 对齐确认

- Python 版本统一 3.12
- 核心库：FastAPI + SQLAlchemy 2.0 (async) + Pydantic v2 各文档一致
- HTTP 客户端统一使用 `httpx`
- 测试框架统一使用 pytest + pytest-asyncio
- 日志库统一使用 `structlog`

---

## 5. 通信模式一致性

### 5.1 对齐确认

- 所有服务间通信均通过 REST HTTP，无直接 import 依赖（符合 P01）
- JWT 传递统一：`Authorization: Bearer <token>` 或 `X-API-Key: <key>`
- 各服务健康检查统一 `GET /health`
- 异步任务：VOC 使用后台任务（非消息队列），Agent Phase 2.5 同步执行
- 无服务使用消息队列，全部基于 HTTP 同步/轮询，当前阶段一致

---

# 第二部分：R2 功能覆盖评审

## 评审概况
- PRD 功能总数：26（F1-F26）
- 完全覆盖：22
- 部分覆盖：3（F16 合成数据、F22 懂车帝爬虫、F23 微博爬虫）
- 未覆盖：1（F17 内部 dogfooding 运营计划——无代码实现需求，但技术支持未定义）

---

## 1. PRD → 设计文档正向映射

| 功能 ID | 功能名称 | 覆盖状态 | 覆盖文档 | 备注 |
|---------|---------|---------|---------|------|
| F1 | CSV/Excel 导入 + LLM Schema 自动映射 | 完全覆盖 | voc-service, frontend | 完整导入 API、映射预览、确认流程 |
| F2 | Stage 2 标签涌现 + 基础标准化 | 完全覆盖 | voc-service | reasoning 槽位 + fast 槽位标准化 |
| F3 | Stage 3 向量化 + pgvector 索引 | 完全覆盖 | voc-service | vector(1024) + HNSW 索引 |
| F4 | vector_search 语义搜索 API | 完全覆盖 | voc-service, frontend | pgvector ANN + 可选 rerank + 过滤器 |
| F5 | LLM 输出守卫层 L1 + L2 | 完全覆盖 | voc-service | FormatGuard + SemanticGuard |
| F6 | 置信度三档展示 + "AI 生成"标注 | 完全覆盖 | voc-service, frontend | ConfidenceBadge + AiDisclaimer 组件 |
| F7 | 精简版 Agent：Principal 抽象 | 完全覆盖 | platform, agent-service | PrincipalMiddleware 完整实现 |
| F8 | 精简版 Agent：YAML SkillRegistry | 完全覆盖 | agent-service | SkillProtocol + YAML 配置 |
| F9 | 精简版 Agent：精简 Agent Loop | 完全覆盖 | agent-service | ReAct 引擎 + token 预算管理 |
| F10 | voc Schema 独立 | 完全覆盖 | platform, voc-service | Schema 隔离 + Alembic 多 schema |
| F11 | 前端：数据导入页 | 完全覆盖 | frontend | ImportPage 组件树完整 |
| F12 | 前端：语义搜索页 | 完全覆盖 | frontend | SearchPage 组件树完整 |
| F13 | 前端：标签列表页 | 完全覆盖 | frontend | TagListPage 组件树完整 |
| F14 | 最小反馈机制 | 完全覆盖 | voc-service, frontend | tag_feedback 表 + FeedbackButtons 乐观更新 |
| F15 | 对比基线验证 | 完全覆盖 | voc-service, frontend | compare API + TagComparePage |
| F16 | 合成数据冷启动 | **部分覆盖** | voc-service | 模块结构中列出但缺少详细设计：Prompt 模板、生成策略、触发入口 |
| F17 | 内部 dogfooding | **部分覆盖** | 无专属文档 | 运营层面功能，无代码实现需求，但技术支持未定义 |
| F18 | Excel 上传支持 | 完全覆盖 | voc-service | ExcelParser 基于 openpyxl |
| F19 | LLM Schema 自动映射服务 | 完全覆盖 | voc-service | SchemaMappingService + column_hash 匹配 |
| F20 | 前端映射确认 UI | 完全覆盖 | frontend, voc-service | MappingPreviewPanel + MappingRow |
| F21 | llm-service 4 槽位模型 | 完全覆盖 | llm-service, frontend | model_slots 表 + SlotRouter + SlotsPage |
| F22 | 懂车帝爬虫 | **部分覆盖** | frontend (CLI) | CLI 命令骨架存在，爬虫核心实现未设计 |
| F23 | 微博爬虫 | **部分覆盖** | frontend (CLI) | 同 F22，缺少登录态/Cookie 管理等设计 |
| F24 | 增量采集/去重引擎 | 完全覆盖 | voc-service | content_hash + ON CONFLICT DO NOTHING |
| F25 | Neo4j 最小连接层 | 完全覆盖 | platform | Neo4jPool 类完整实现 |
| F26 | 弹性策略 L0 | 完全覆盖 | platform, llm-service | PoolConfig 显式定义 |

---

## 2. 设计文档 → PRD 反向映射

### 2.1 合理的技术补充

| 设计文档 | 补充内容 | 评估 |
|---------|---------|------|
| platform | import-linter 依赖方向检查规则 | 合理，自动化检查是必要的工程实践 |
| platform | CI/CD 流水线（ruff + pyright + pytest + import-linter） | 合理，工程基础设施 |
| platform | Request-ID 中间件 | 合理，PRD 统一响应格式要求 `request_id` |
| platform | 统一异常体系（AppException 层级） | 合理，多服务架构必备 |
| platform | 域前缀错误码注册表 | 合理，错误码命名空间隔离 |
| llm-service | audit_logs 审计日志表 | 合理，LLM 网关标准做法 |
| llm-service | LiteLLM 集成替代自建适配器 | 合理，减少维护成本 |
| llm-service | Embedding 批量分片 | 合理，大批量处理标准实践 |
| llm-service | AES-256-GCM API Key 加密 | 合理，数据安全必要补充 |
| voc-service | processing_error/retry_count 字段 | 合理，错误追踪必要补充 |
| voc-service | SchemaMapping column_hash 字段 | 合理，高效模板匹配实现方式 |
| voc-service | 搜索 API filters/rerank 参数 | 合理，语义搜索标准增强 |
| agent-service | session_id + iteration_index | 合理，ReAct 循环追踪 |
| agent-service | Token 预算管理 | 合理，防止 token 爆炸 |
| frontend | API Client 401 自动刷新 | 合理，前端工程基础设施 |
| frontend | 乐观更新策略 | 合理，达到 PRD 500ms 响应指标的关键手段 |

### 2.2 可能的过度设计

| 设计文档 | 内容 | 评估 |
|---------|------|------|
| llm-service | Provider 级别连通性测试（多种 test_type） | 边界可接受，PRD 仅要求槽位级测试 |
| voc-service | 搜索 `min_confidence` 过滤 | 轻微过度，实现成本极低，可保留 |
| frontend | 标签列表 `confidence_tier`/`min_usage` 过滤 | 轻微过度，实现简单且提升可用性 |
| frontend | `tag_type: "preset" | "emergent"` 区分 | 需关注：后端 EmergentTag 模型未定义此字段 |

---

## 3. 前后端契约校验

### 3.1 对齐的端点

| 端点 | 一致性 |
|------|--------|
| `POST /api/auth/login` / `POST /api/auth/refresh` | 一致 |
| `GET /api/llm/admin/providers` | 一致 |
| `GET/PUT /api/llm/admin/slots` | 一致 |
| `POST /api/llm/admin/slots/{slot_type}/test` | 一致 |
| `POST /api/voc/tags/{id}/feedback` | 一致 |
| `GET /api/voc/voices/{id}` | 一致 |

### 3.2 不一致的端点

**[缺失] `POST /api/voc/tags/compare/{id}/vote` 后端未定义**

前端设计了偏好投票端点，后端未定义。PRD US-7 AC2 要求"用户偏好数据正确记录并可查询"。

**[不一致] 导入状态 API 字段差异**

| 字段 | 前端 | 后端 | 差异 |
|------|------|------|------|
| 状态字段 | 含 `confirming` | 含 `parsing` | 命名不同 |
| 映射对象 | `Record<string, string>` | 结构化数组 | 结构差异大 |
| 进度字段 | 单一百分比 | 详细分项计数 | 格式差异 |

**[不一致] 搜索 API 响应结构差异**

| 维度 | 前端 | 后端 |
|------|------|------|
| 响应包装 | `data: SearchResult[]` | `data: {query, total, results}` |
| 分页 | 顶层 `pagination` | 无显式分页（top_k） |
| Voice 字段 | 含 `raw_text_preview` | 仅 id/source/created_at |

**[不一致] 对比视图 API 响应结构差异大**

前端期望扁平 `CompareResult[]`，后端返回嵌套 `{summary, comparisons}`，标签结构也不同。

**[不一致] 映射确认请求结构差异**

前端使用简单 key-value，后端使用嵌套对象。后端支持 `save_as_template` 参数，前端未设计此交互。

---

## 4. 用户故事贯穿验证

| 用户故事 | 状态 | 前端 | 后端 | 缺失环节 |
|---------|------|------|------|---------|
| US-1 数据上传与映射 | 基本完整 | ✓ | ✓ | 前后端映射数据结构不一致；前端缺少"保存为模板"交互（AC7）|
| US-2 爬虫数据采集 | 部分 | △ | △ | 爬虫核心实现未设计；`POST /api/voc/crawl/trigger` API 未在设计文档中出现 |
| US-3 语义搜索与溯源 | 基本完整 | ✓ | ✓ | 搜索响应结构不一致；Voice 预览文本缺失 |
| US-4 标签质量反馈 | 完整 | ✓ | ✓ | — |
| US-5 管理层演示 | 基本完整 | ✓ | ✓ | 演示数据集准备方案未提及 |
| US-6 合成数据冷启动 | 部分 | — | △ | Prompt 策略、触发入口缺失 |
| US-7 标签对比验证 | 部分 | ✓ | △ | 投票 API 后端缺失；预设分类管理机制未明确 |
| US-8 LLM 槽位配置 | 完整 | ✓ | ✓ | — |

---

# 第三部分：汇总修复建议

## P0：严重问题（必须在编码前修复）

| # | 问题 | 来源 | 涉及文档 | 建议修复方式 |
|---|------|------|---------|-------------|
| 1 | 全局 API 契约与 LLM 设计文档严重脱节（model vs slot 范式） | R1 | `api-contracts.md` + `llm-service/design.md` | **更新 `api-contracts.md`**，反映 R5-B 4 槽位模型决议 |
| 2 | LLM/VOC 服务错误码未遵循域前缀规则（P08） | R1 | `llm-service/design.md` + `voc-service/design.md` | LLM 错误码加 `LLM_` 前缀，VOC 加 `VOC_` 前缀 |
| 3 | LLM 异常体系未继承 shared 的 AppException | R1 | `llm-service/design.md` | `LLMServiceError` 改为继承 `AppException` |
| 4 | VOC 搜索 API 请求/响应格式与前端严重不一致 | R1+R2 | `voc-service/design.md` + `frontend/design.md` | 协商统一：建议 VOC 同时支持 `top_k` 和分页模式，或前端适配 |
| 5 | 导入 API `batch_id` vs `import_id` 命名冲突 | R1 | `voc-service/design.md` + `frontend/design.md` | 统一为 `batch_id` |
| 6 | 偏好投票 API 后端缺失 | R2 | `voc-service/design.md` | 新增 `POST /api/voc/tags/compare/{id}/vote` |
| 7 | 前后端导入 API 数据契约不一致 | R2 | `voc-service/design.md` + `frontend/design.md` | 以 voc-service 为权威，前端适配 |
| 8 | 前后端搜索 API 数据契约不一致 | R2 | `voc-service/design.md` + `frontend/design.md` | 以 voc-service 为权威，前端适配；后端搜索响应内联 Voice 预览 |

## P1：一般问题（建议在对应服务编码前修复）

| # | 问题 | 来源 | 建议修复方式 |
|---|------|------|-------------|
| 9 | LLM/VOC Settings 未继承 BaseAppSettings | R1 | 改为继承 `BaseAppSettings` |
| 10 | 导入状态枚举不一致（`parsing` vs `confirming`） | R1 | DDL 补充 `confirming` 或前端适配 `parsing` |
| 11 | 映射确认请求格式不一致（嵌套 vs 扁平） | R1 | 以 voc-service 为准，前端适配 |
| 12 | 预设分类管理机制未明确 | R2 | 后端补充预设分类的存储/管理设计 |
| 13 | 合成数据冷启动缺少详细设计 | R2 | 补充 Prompt 模板、生成策略、触发入口 |
| 14 | 爬虫设计深度不足 | R2 | 补充概要设计：页面解析、反爬策略 |
| 15 | 前端缺少"保存为模板"交互 | R2 | 前端 MappingPreviewPanel 补充此交互 |
| 16 | VOC 使用旧版 `get_current_user` 而非 `get_principal` | R1 | 评估是否需要支持 API Key 认证 |

## P2：建议改进

| # | 问题 | 建议 |
|---|------|------|
| 17 | 服务端口号缺乏统一规范 | 在 CLAUDE.md 中补充端口分配表 |
| 18 | `principal_id` 字段类型不统一 | 统一为 UUID 或 VARCHAR(36) |
| 19 | 跨 Schema 逻辑引用说明需更新 | 平台文档补充 Agent execution_logs 的跨 schema 引用 |
| 20 | 对比视图 API 响应结构差异大 | 联调前协商统一 |
| 21 | 标签 `tag_type` 字段前后端不一致 | 后端 EmergentTag 需补充或业务逻辑推断 |
| 22 | 演示数据集准备方案 | 在合成数据设计中一并考虑 |
| 23 | Dogfooding 技术支持 | 补充批量创建账号、反馈导出等支持计划 |
| 24 | Rerank API 响应 document 字段 | 随全局契约更新统一 |
| 25 | 标签反馈响应格式不一致 | 以 voc-service 为准 |

---

## 评审结论

5 份设计文档在架构层面的基本方向是一致的：依赖方向正确、Schema 隔离完整、技术栈选择统一、通信模式对齐。PRD 26 项功能覆盖率达 **84.6%**（22/26 完全覆盖），核心价值闭环（数据导入 → AI 管线 → 语义搜索 → 标签展示 → 反馈）的设计均已到位。

主要风险集中在三个方面：
1. **前后端 API 契约存在多处结构性不一致**（P0-4/5/7/8），需在 M5 联调前统一
2. **全局 API 契约文档未同步 R5-B 决议**（P0-1），需立即更新
3. **对比视图投票功能后端缺失**（P0-6），这是 M7 Go/No-Go 判定的关键数据源

建议在编码开始前集中修复 8 个 P0 级别问题，P1 在对应服务编码初期解决。
