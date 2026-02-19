## Why

当前后端日志通过 `nohup` 重定向到单个 `.backend.log` 文件，无滚动策略、无大小限制、无查询能力。随着 VOC 管线（Stage 1/2/3）在生产环境持续运行，日志文件会无限增长并占满磁盘。同时，开发者和 AI Agent 在调试管线异常时，缺乏按服务/模块筛选日志的能力，只能手动 `grep` 原始日志文件——这与 PRD 5.3 Phase 3 要求的「结构化日志 + 错误追踪」目标不匹配。

## What Changes

- **日志滚动与空间控制**：将 structlog 输出从 `PrintLoggerFactory`（stdout）切换到基于 Python `logging` 标准库的 `TimedRotatingFileHandler` + `RotatingFileHandler` 组合，支持按天滚动 + 按文件大小滚动，总占用空间上限可通过 `BaseAppSettings.log_max_size_mb` 配置
- **结构化日志增强**：在每条日志中注入 `service`（服务名）和 `module`（功能模块）字段，为后续筛选提供元数据
- **日志查询 API**：新增 `GET /api/platform/logs` 端点（挂载在统一开发服务器），支持按 service、module、level、时间范围筛选，返回分页结果
- **Web 日志查看器**：前端新增 `/admin/logs` 页面，提供实时日志浏览界面，支持服务/模块/级别筛选
- **CLI 日志查询命令**：`prism logs` 命令，为 AI Agent 提供结构化日志查询能力，支持 `--service`、`--module`、`--level`、`--since`、`--tail` 等参数

## Capabilities

### New Capabilities

- `log-rotation`: 日志文件滚动策略与空间控制（按天/按大小滚动、总空间上限、自动清理过期日志）
- `log-query-api`: 日志查询 REST API（按 service/module/level/时间范围筛选、分页返回）
- `log-viewer`: Web 日志查看器页面（实时浏览、筛选、自动刷新）
- `cli-logs`: CLI 日志查询命令（面向开发者和 AI Agent 的命令行日志查询工具）

### Modified Capabilities

（无现有规格需要修改）

## Impact

### 代码影响

| 模块 | 影响 | 说明 |
|------|------|------|
| `shared/logging.py` | 重构 | 从 `PrintLoggerFactory` 切换到文件日志 handler，新增 service/module 字段注入 |
| `shared/config/base.py` | 修改 | 新增 `log_dir`、`log_max_size_mb`、`log_rotation_days` 等配置项 |
| `main.py` | 修改 | 日志查询路由挂载 |
| `apps/web/` | 新增页面 | `/admin/logs` 日志查看器 |
| `apps/cli/` | 新增命令 | `prism logs` 命令 |
| `scripts/backend.sh` | 调整 | 日志输出路径变更（从 `.backend.log` 到 `log_dir` 配置目录） |

### API 影响

- 新增 `GET /api/platform/logs` 端点（不影响现有 API）

### 依赖影响

- 无新增外部依赖（`TimedRotatingFileHandler` 和 `RotatingFileHandler` 均为 Python 标准库）
