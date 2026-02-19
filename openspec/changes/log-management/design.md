## Context

当前 Prism 后端日志基于 structlog，使用 `PrintLoggerFactory` 将日志输出到 stdout，由 `scripts/backend.sh` 通过 `nohup` 重定向到 `.backend.log` 单文件。存在以下问题：

1. **无滚动策略**：日志文件无限增长，无大小/时间切割
2. **无查询能力**：调试时只能手动 `grep`，无按服务/模块/级别筛选
3. **logger 命名不一致**：部分模块用 `get_logger()`（无名称），部分用 `get_logger(__name__)`，缺少统一的 `service` 标识
4. **日志目录已预留**：`local-storage-layout` 规格已定义 `~/.prism/log/`，但尚未使用

约束：
- 统一开发服务器 `main.py` 将 3 个服务挂载到同一进程，日志文件需能区分来源服务
- CLI 骨架 `apps/cli/` 已建立但无任何命令实现
- 不引入外部日志聚合系统（Elasticsearch/Loki），Phase 1 保持文件级方案

## Goals / Non-Goals

**Goals:**

- 日志按天滚动 + 按大小滚动（双策略并行），总空间可配置上限
- 每条日志包含 `service` 和 `module` 结构化字段
- 提供 REST API 查询日志（按 service/module/level/时间范围筛选）
- 前端 `/admin/logs` 页面实时查看日志
- CLI `prism logs` 命令供开发者和 Agent 查询日志

**Non-Goals:**

- 不实现日志聚合到外部系统（Elasticsearch、Loki、CloudWatch）——属于 Phase 6 可观测性范畴
- 不实现实时日志推送（WebSocket/SSE）——当前轮询刷新足够
- 不实现跨实例日志收集——Phase 1 是单实例部署
- 不实现日志分析 / 告警——超出当前范围

## Decisions

### D1：日志输出架构 — structlog → stdlib logging → FileHandler

**选择**：保留 structlog 作为日志门面，将底层 `PrintLoggerFactory` 替换为 `structlog.stdlib.LoggerFactory`，由 Python 标准库 `logging` 模块管理 Handler。

**替代方案**：
- A) 直接用 `logging.FileHandler` 替代 structlog → 放弃 structlog 的结构化能力和 processor 管道，不可取
- B) 用第三方库 loguru → 引入新依赖，与 structlog 重叠，不符合最小依赖原则

**理由**：structlog 的 `stdlib` 集成是官方推荐方案。structlog 负责结构化处理（添加字段、格式化），stdlib logging 负责输出路由（文件、滚动、大小控制）。职责分离清晰，不引入新依赖。

### D2：日志文件策略 — 混合滚动

**选择**：使用 `logging.handlers.TimedRotatingFileHandler`，配合自定义 `namer` 和 `rotator` 实现大小感知：

```
~/.prism/log/app/
├── prism.log              # 当前日志
├── prism.2026-02-14.log   # 昨日日志
├── prism.2026-02-13.log   # 前日日志
└── ...
```

- 主策略：按天滚动（`when='midnight'`）
- 辅助策略：单文件超过 50MB 时在当天内追加序号（`prism.2026-02-15.1.log`）
- 保留天数：`log_rotation_days`（默认 7 天）
- 总空间上限：`log_max_size_mb`（默认 200MB），启动时和每次滚动后检查并清理最旧文件

**替代方案**：
- A) 纯 `RotatingFileHandler`（只按大小）→ 无法按天组织，历史日志难以按日期定位
- B) 双文件流（TimedRotating + Rotating 各一个）→ 日志重复写入两份，浪费 I/O

**理由**：按天是日志查询最常用的时间维度，大小限制是磁盘安全保障。混合方案兼顾两个需求。

### D3：service/module 字段注入 — structlog processor

**选择**：新增 `add_service_context` processor，在 structlog 管道中自动注入：
- `service`：从 `configure_logging(service_name=...)` 参数获取（由各服务 `app.py` 传入）
- `module`：从 logger 的 `__name__` 推导功能模块（如 `voc_service.pipeline.stage1_splitting` → `pipeline`）

**统一开发服务器**：`main.py` 中的 `service_name` 传 `"dev-server"`，各模块的 `module` 通过 `__name__` 自动识别所属服务（`voc_service.*` → service 覆写为 `voc-service`）。

**Logger 命名规范化**：统一所有 `structlog.get_logger()` 调用为 `structlog.get_logger(__name__)`，确保 module 字段可推导。

### D4：日志查询 API — 文件扫描 + 流式解析

**选择**：`GET /api/platform/logs` 端点直接读取 `~/.prism/log/app/` 目录下的 JSON 日志文件，逐行解析 + 筛选。

```
GET /api/platform/logs?service=voc-service&module=pipeline&level=error&since=2026-02-15T00:00:00Z&until=2026-02-15T23:59:59Z&page=1&page_size=50
```

响应格式遵循项目统一规范：`{ data: LogEntry[], pagination: {...}, meta: {...} }`

**实现要点**：
- 根据 `since`/`until` 参数定位日期文件，避免扫描全部日志
- 文件从末尾向前读取（最新日志优先）
- 单次查询扫描上限 10,000 行，防止大文件阻塞
- 路由挂载在 `main.py` 统一开发服务器，不属于任何业务服务

**替代方案**：
- A) 日志写入数据库 → 额外 I/O 开销，日志量大时影响业务 DB 性能
- B) 日志写入 SQLite → 多一个数据存储，增加运维复杂度

**理由**：Phase 1 单实例部署，文件扫描性能足够。日志目录结构规整（按天分文件），日期定位高效。不引入额外存储依赖。

### D5：日志查询路由归属 — 独立 platform 模块

**选择**：在 `shared/` 下新增 `platform/log_routes.py`，作为平台级基础设施路由，由 `main.py` 挂载（前缀 `/api/platform`）。

**理由**：日志查询不属于任何业务服务（llm/voc/user），是跨服务的平台能力。放在 `shared/` 中符合其"平台基础设施"定位。生产部署时可选择性挂载或禁用。

### D6：Web 日志查看器 — admin 功能域

**选择**：新增 `apps/web/src/features/admin/pages/LogsPage.tsx`，路由 `/admin/logs`。

页面结构：
- 顶部筛选栏：服务下拉（all/voc-service/llm-service/user-service）、模块下拉（all/pipeline/core/api）、级别下拉（all/debug/info/warning/error）、时间范围选择
- 日志列表：表格形式，列 = 时间 | 级别 | 服务 | 模块 | 消息
- 级别颜色编码：error=红色、warning=琥珀色、info=默认、debug=灰色
- 自动刷新：默认 5 秒轮询，可暂停
- 分页：底部分页控件

**理由**：日志管理属于管理后台功能，放在 `admin` 功能域下。复用现有 glass 设计系统和 PageContainer 布局。

### D7：CLI 命令设计 — Typer 子命令

**选择**：`prism logs` 命令通过 HTTP 调用 `/api/platform/logs` API，输出格式化日志。

```bash
# 查看最近 50 条日志
prism logs --tail 50

# 筛选 voc-service 的 pipeline 模块错误日志
prism logs --service voc-service --module pipeline --level error

# 查看指定时间范围
prism logs --since 2026-02-15T10:00:00 --until 2026-02-15T12:00:00

# JSON 输出（Agent 友好）
prism logs --service voc-service --format json
```

**输出格式**：
- 默认：`[时间] [级别] [服务/模块] 消息`（人类可读，彩色）
- `--format json`：每行一个 JSON 对象（Agent 解析友好）

**理由**：CLI 通过 API 查询而非直接读取文件，确保与 Web 查看器的筛选逻辑一致。Agent 可通过 `--format json` 获取结构化数据。

## Risks / Trade-offs

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 文件扫描在日志量极大时性能下降 | 查询响应变慢 | 按日期定位文件 + 单次扫描行数上限（10,000）+ 按需升级到 Phase 6 日志聚合方案 |
| 统一开发服务器混合 3 个服务日志 | service 字段区分依赖 `__name__` 推导 | processor 中通过模块路径前缀精确映射 service 名 |
| 日志空间清理可能删除仍需查看的历史日志 | 用户丢失历史诊断信息 | 提供 `log_rotation_days` 和 `log_max_size_mb` 两个维度控制，默认保守（7天/200MB） |
| Console 和 File 双输出时开发体验变化 | 开发者习惯看终端输出 | 开发模式保留 Console 输出（同时写文件），`backend.sh` 不再需要 nohup 重定向 |

## Open Questions

- Q1：是否需要支持日志文件压缩（`.gz`）以进一步节省空间？Phase 1 暂不实现，按需后续追加。
- Q2：生产部署时日志查询 API 是否需要额外的认证/权限控制？当前复用已有的 JWT 认证中间件，admin 角色可访问。
