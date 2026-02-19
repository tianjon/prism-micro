## ADDED Requirements

### Requirement: logs 子命令
系统 SHALL 提供 `prism logs` CLI 命令，通过 HTTP 调用 `/api/platform/logs` API 查询日志。

#### Scenario: 默认查询
- **WHEN** 执行 `prism logs`
- **THEN** 输出最新 20 条日志，每行格式为 `[时间] [级别] [服务/模块] 消息`

#### Scenario: tail 参数
- **WHEN** 执行 `prism logs --tail 100`
- **THEN** 输出最新 100 条日志

### Requirement: 服务筛选
系统 SHALL 支持通过 `--service` 参数筛选特定服务的日志。

#### Scenario: 指定服务
- **WHEN** 执行 `prism logs --service voc-service`
- **THEN** 仅输出 voc-service 的日志

### Requirement: 模块筛选
系统 SHALL 支持通过 `--module` 参数筛选特定功能模块的日志。

#### Scenario: 指定模块
- **WHEN** 执行 `prism logs --module pipeline`
- **THEN** 仅输出 pipeline 模块的日志

### Requirement: 级别筛选
系统 SHALL 支持通过 `--level` 参数筛选特定级别的日志。

#### Scenario: 指定级别
- **WHEN** 执行 `prism logs --level error`
- **THEN** 仅输出 error 级别的日志

### Requirement: 时间范围筛选
系统 SHALL 支持通过 `--since` 和 `--until` 参数指定时间范围。

#### Scenario: 指定起始时间
- **WHEN** 执行 `prism logs --since 2026-02-15T10:00:00`
- **THEN** 仅输出该时间之后的日志

#### Scenario: 指定完整时间范围
- **WHEN** 执行 `prism logs --since 2026-02-15T10:00:00 --until 2026-02-15T12:00:00`
- **THEN** 仅输出该时间范围内的日志

### Requirement: 组合筛选
系统 SHALL 支持多个筛选参数组合使用。

#### Scenario: 多条件组合
- **WHEN** 执行 `prism logs --service voc-service --module pipeline --level error --tail 50`
- **THEN** 输出 voc-service pipeline 模块最新 50 条 error 日志

### Requirement: 输出格式
系统 SHALL 支持人类可读和 JSON 两种输出格式。

#### Scenario: 默认人类可读格式
- **WHEN** 执行 `prism logs`（不带 `--format` 参数）
- **THEN** 每行输出格式为 `[时间] [级别] [服务/模块] 消息`，级别使用彩色显示

#### Scenario: JSON 格式输出
- **WHEN** 执行 `prism logs --format json`
- **THEN** 每行输出一个完整的 JSON 对象，包含 `timestamp`、`level`、`service`、`module`、`event` 字段

### Requirement: API 地址配置
系统 SHALL 支持通过 `--api-url` 参数或环境变量指定后端 API 地址。

#### Scenario: 默认 API 地址
- **WHEN** 未指定 `--api-url` 且未设置 `PRISM_API_URL` 环境变量
- **THEN** 使用默认地址 `http://prism.test:8601`

#### Scenario: 环境变量配置
- **WHEN** 设置 `PRISM_API_URL=http://192.168.1.100:8601`
- **THEN** CLI 连接到该地址查询日志

#### Scenario: 命令行参数优先
- **WHEN** 同时设置了 `PRISM_API_URL` 和 `--api-url`
- **THEN** `--api-url` 参数值优先

### Requirement: 认证支持
系统 SHALL 支持通过 `--token` 参数或环境变量传递 JWT token 进行认证。

#### Scenario: token 认证
- **WHEN** 执行 `prism logs --token <jwt-token>`
- **THEN** 请求携带 `Authorization: Bearer <jwt-token>` header

#### Scenario: 未认证错误提示
- **WHEN** 未提供 token 且服务端要求认证
- **THEN** 输出错误信息 `认证失败：请通过 --token 或 PRISM_TOKEN 环境变量提供 JWT token`

### Requirement: 错误处理
系统 SHALL 对连接失败和查询错误提供清晰的错误信息。

#### Scenario: 连接失败
- **WHEN** 后端服务不可达
- **THEN** 输出错误信息 `无法连接到 <api-url>，请确认后端服务是否运行`

#### Scenario: 查询无结果
- **WHEN** 查询条件未匹配到任何日志
- **THEN** 输出提示信息 `未找到匹配的日志条目`
