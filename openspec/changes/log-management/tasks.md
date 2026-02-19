## 1. 日志基础设施重构（shared）

- [x] 1.1 在 `BaseAppSettings` 中新增日志配置项：`log_dir`（默认 `~/.prism/log/app`）、`log_max_size_mb`（默认 200）、`log_rotation_days`（默认 7）、`log_file_max_mb`（默认 50）
- [x] 1.2 重构 `shared/logging.py`：将 `PrintLoggerFactory` 替换为 `structlog.stdlib.LoggerFactory`，配置 stdlib logging 的 `TimedRotatingFileHandler`
- [x] 1.3 实现混合滚动策略：自定义 `namer` 和 `rotator` 使 `TimedRotatingFileHandler` 支持按大小追加序号（`prism.YYYY-MM-DD.N.log`）
- [x] 1.4 实现空间控制：启动时和每次滚动后检查 `log_dir` 总大小，超过 `log_max_size_mb` 时删除最旧归档文件
- [x] 1.5 新增 `add_service_context` processor：自动注入 `service`（从参数传入或按 `__name__` 前缀推导）和 `module`（从 `__name__` 提取第二级包名）字段
- [x] 1.6 实现开发模式双输出：`debug=True` 时同时输出到控制台（ConsoleRenderer）和文件（JSONRenderer）
- [x] 1.7 更新 `configure_logging()` 签名：新增 `service_name`、`log_dir`、`log_max_size_mb`、`log_rotation_days`、`log_file_max_mb` 参数

## 2. Logger 命名规范化

- [x] 2.1 将 `voc-service` 中所有 `structlog.get_logger()`（无参数）调用统一为 `structlog.get_logger(__name__)`：`import_routes.py`、`import_service.py`、`llm_client.py`、`schema_mapping_service.py`
- [x] 2.2 将 `shared` 中 `structlog.get_logger()` 调用统一为 `structlog.get_logger(__name__)`：`exception_handlers.py`
- [x] 2.3 将 `llm-service` 中 `structlog.get_logger()` 调用统一为 `structlog.get_logger(__name__)`：`service.py`

## 3. 服务启动集成

- [x] 3.1 更新 `main.py`（统一开发服务器）：调用 `configure_logging()` 时传入 `service_name="dev-server"` 和日志配置参数
- [x] 3.2 更新 `voc-service/app.py`：调用 `configure_logging()` 时传入 `service_name="voc-service"` 和日志配置参数
- [x] 3.3 更新 `scripts/backend.sh`：移除 `nohup > .backend.log 2>&1` 重定向（日志已写入文件），改为直接后台运行；更新日志路径提示信息

## 4. 日志查询 API

- [x] 4.1 在 `shared/` 下新建 `platform/` 目录：创建 `__init__.py`、`log_schemas.py`（LogEntry、LogQueryParams、LogFiltersResponse Pydantic 模型）
- [x] 4.2 实现 `shared/platform/log_reader.py`：日志文件扫描引擎——按日期定位文件、逐行 JSON 解析、多维度筛选、倒序排列、扫描行数上限（10,000）
- [x] 4.3 实现 `shared/platform/log_routes.py`：`GET /api/platform/logs` 端点（分页查询 + truncated 标记）和 `GET /api/platform/logs/filters` 端点（可用筛选值）
- [x] 4.4 在 `main.py` 中挂载 `log_routes` router（前缀 `/api/platform`，依赖 JWT 认证）

## 5. 前端日志查看器

- [x] 5.1 在 `apps/web/src/api/endpoints.ts` 中新增 `PLATFORM_LOGS` 和 `PLATFORM_LOG_FILTERS` 端点常量
- [x] 5.2 在 `apps/web/src/api/types.ts` 中新增 `LogEntry`、`LogQueryParams`、`LogFiltersResponse` TypeScript 类型
- [x] 5.3 在 `apps/web/src/api/` 中新增 `platform-api.ts`：`fetchLogs()` 和 `fetchLogFilters()` API 调用函数
- [x] 5.4 实现 `apps/web/src/features/admin/pages/LogsPage.tsx`：筛选栏（服务/模块/级别下拉 + 动态选项加载）、日志表格（时间/级别/服务/模块/消息 + 级别颜色编码）、自动刷新（5 秒轮询 + 暂停/恢复）、分页控件
- [x] 5.5 在 `App.tsx` 中注册路由 `/admin/logs` → `LogsPage`
- [x] 5.6 在 `Sidebar.tsx` 的「管理」导航组中新增「系统日志」导航项（图标：`ScrollText`）

## 6. CLI 日志查询命令

- [x] 6.1 在 `apps/cli/` 中配置 Typer 应用入口：`__init__.py` 中创建 `app = typer.Typer()` 并注册 logs 子命令组
- [x] 6.2 实现 `apps/cli/src/prism_cli/commands/logs.py`：`prism logs` 命令，参数 `--service`、`--module`、`--level`、`--since`、`--until`、`--tail`（默认 20）、`--format`（text/json）、`--api-url`、`--token`
- [x] 6.3 实现人类可读输出格式：`[时间] [级别] [服务/模块] 消息`，级别彩色显示（使用 `rich` 或 Typer 内置着色）
- [x] 6.4 实现 JSON 输出格式：每行一个 JSON 对象，适合 Agent 解析
- [x] 6.5 实现错误处理：连接失败提示、认证失败提示、无结果提示

## 7. 验证与文档

- [x] 7.1 后端验证：`uv run ruff check . && uv run ruff format --check .`，确保 lint 通过
- [x] 7.2 前端验证：`npx tsc --noEmit && npm run build && npx eslint .`，确保编译和 lint 通过
- [ ] 7.3 手动集成测试：启动服务后验证日志文件生成（`~/.prism/log/app/prism.log`）、API 查询（`/api/platform/logs`）、Web 页面（`/admin/logs`）、CLI 命令（`prism logs`）
- [x] 7.4 更新 `docs/designs/platform/design.md`：在日志模块部分补充日志滚动和查询能力的设计说明
- [x] 7.5 更新 `docs/designs/frontend/design.md`：补充 `/admin/logs` 页面和 CLI `prism logs` 命令的说明
