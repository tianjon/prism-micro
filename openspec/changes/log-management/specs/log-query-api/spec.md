## ADDED Requirements

### Requirement: 日志查询端点
系统 SHALL 提供 `GET /api/platform/logs` 端点，支持按多维度筛选日志并返回分页结果。

#### Scenario: 基础查询
- **WHEN** 发送 `GET /api/platform/logs?page=1&page_size=50`
- **THEN** 返回最新 50 条日志，响应格式为 `{ data: LogEntry[], pagination: { page, page_size, total }, meta: { request_id, timestamp } }`

#### Scenario: 按服务筛选
- **WHEN** 发送 `GET /api/platform/logs?service=voc-service`
- **THEN** 仅返回 `service` 字段值为 `"voc-service"` 的日志条目

#### Scenario: 按模块筛选
- **WHEN** 发送 `GET /api/platform/logs?module=pipeline`
- **THEN** 仅返回 `module` 字段值为 `"pipeline"` 的日志条目

#### Scenario: 按级别筛选
- **WHEN** 发送 `GET /api/platform/logs?level=error`
- **THEN** 仅返回 `level` 字段值为 `"error"` 的日志条目

#### Scenario: 按时间范围筛选
- **WHEN** 发送 `GET /api/platform/logs?since=2026-02-15T00:00:00Z&until=2026-02-15T23:59:59Z`
- **THEN** 仅返回 `timestamp` 在指定范围内的日志条目

#### Scenario: 多条件组合筛选
- **WHEN** 发送 `GET /api/platform/logs?service=voc-service&module=pipeline&level=error`
- **THEN** 返回同时满足所有筛选条件的日志条目

### Requirement: 日志条目响应格式
系统 SHALL 返回的每条日志包含完整的结构化字段。

#### Scenario: LogEntry 字段
- **WHEN** 查询返回日志条目
- **THEN** 每条 LogEntry 包含：`timestamp`（ISO 8601）、`level`（日志级别）、`service`（服务名）、`module`（功能模块）、`event`（日志消息）、`extra`（其他结构化字段，可选）

### Requirement: 查询性能保护
系统 SHALL 对单次查询的扫描范围进行限制，防止大文件阻塞。

#### Scenario: 扫描行数上限
- **WHEN** 查询匹配的日志文件行数超过 10,000 行
- **THEN** 系统停止扫描，返回已匹配的结果，并在响应中标记 `truncated: true`

#### Scenario: 日期定位优化
- **WHEN** 查询包含 `since` 和/或 `until` 参数
- **THEN** 系统仅扫描日期范围内的日志文件，跳过范围外的归档文件

### Requirement: 最新日志优先
系统 SHALL 默认按时间倒序返回日志（最新的在前）。

#### Scenario: 默认排序
- **WHEN** 未指定排序参数
- **THEN** 返回的日志条目按 `timestamp` 降序排列

### Requirement: 认证保护
系统 SHALL 要求有效的 JWT 认证才能访问日志查询端点。

#### Scenario: 未认证访问
- **WHEN** 未携带有效 JWT token 发送日志查询请求
- **THEN** 返回 401 Unauthorized

### Requirement: 可用筛选值查询
系统 SHALL 提供 `GET /api/platform/logs/filters` 端点，返回当前可用的筛选选项。

#### Scenario: 返回可用筛选值
- **WHEN** 发送 `GET /api/platform/logs/filters`
- **THEN** 返回 `{ data: { services: string[], modules: string[], levels: string[] } }`，值从日志文件中提取
