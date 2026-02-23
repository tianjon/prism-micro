# API 契约对齐与迁移窗口（I0/I5）

## 1. 单一事实源（Source of Truth）

- 目标契约：`/Users/fengyd/ai/prism-micro/docs/prd/02-prd-phase1.md`
- 当前阶段唯一模型路由语义：`4 slots`（`fast/reasoning/embedding/rerank`）
- 本轮不再把“别名系统”作为主路径，仅作为历史背景

## 2. 现状偏差清单

| 主题 | 目标契约 | 改造前现状 | 本轮动作 |
|---|---|---|---|
| 统一身份 | JWT + API Key -> Principal | 各服务各自解析 JWT | 接入 `PrincipalMiddleware` + DB API Key verifier |
| 审计 | 标准化 API 审计字段 | 审计中间件未全量挂载 | 在统一入口和独立 app 工厂挂载 `AuditMiddleware` |
| LLM 管理端点 | `/api/llm/admin/slots/*` | 仅有 `/api/llm/slots/*` | 新增兼容路由，旧路由继续保留 |
| LLM 调用契约 | slot-first（chat/embedding/rerank） | 以 provider/model 直调为主 | 新增 `/api/llm/chat`、`/api/llm/embedding`、`/api/llm/rerank/slot` |
| 前端类型 | OpenAPI 生成 TS 类型 | 手写 `src/api/types.ts` | 增加 `api:gen`/`api:check` 与 `generated.ts` |
| LLM 运行时 | LiteLLM 主路径 + fallback | 仅 HTTP 直连 provider | 在网关层接入 LiteLLM，保留 HTTP fallback 开关 |

## 3. 兼容窗口与下线节奏

### 当前迭代（T0）
- 保留旧路由：
  - `GET/PUT /api/llm/slots*`
  - `POST /api/llm/completions`
  - `POST /api/llm/embeddings`
  - `POST /api/llm/rerank`
- 新增目标契约兼容路由：
  - `GET /api/llm/admin/slots`
  - `PUT /api/llm/admin/slots/{slot_type}`
  - `POST /api/llm/admin/slots/{slot_type}/test`
  - `POST /api/llm/chat`
  - `POST /api/llm/embedding`
  - `POST /api/llm/rerank/slot`

### 下一迭代（T1）
- 前端/CLI 默认迁移到新路由
- 旧路由标记 deprecated（文档 + changelog）

### 下下迭代（T2）
- 回收旧路由（按消费者迁移完成率执行）
- 保留迁移脚本与变更说明

## 4. 本轮剩余技术债（下一迭代）

1. 前端页面从手写类型全面迁移到 OpenAPI generated types
2. `service.py` 拆分后的模块补充更细粒度单元测试
3. `agent-service` 执行日志从内存存储迁移到 `agent` schema 持久化
4. 补齐 CI 中 `api:check` 的真实流水线配置
5. 兼容路由 `stream` 模式的 slot-first 契约统一
