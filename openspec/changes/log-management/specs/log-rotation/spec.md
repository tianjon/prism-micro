## ADDED Requirements

### Requirement: 结构化日志写入文件
系统 SHALL 将 structlog 输出通过 Python 标准库 `logging` 模块写入日志文件，每条日志为一行 JSON。

#### Scenario: 日志文件自动创建
- **WHEN** 后端服务启动
- **THEN** 在 `log_dir` 配置目录下创建 `prism.log` 日志文件（目录不存在时自动创建）

#### Scenario: JSON 格式输出
- **WHEN** 任意模块通过 `structlog.get_logger(__name__)` 记录日志
- **THEN** 日志以单行 JSON 写入文件，包含 `timestamp`、`level`、`service`、`module`、`event` 字段

### Requirement: service 和 module 字段注入
系统 SHALL 在每条日志中自动注入 `service`（服务名）和 `module`（功能模块）结构化字段。

#### Scenario: service 字段来源
- **WHEN** `configure_logging(service_name="voc-service")` 被调用
- **THEN** 该进程内所有后续日志的 `service` 字段值为 `"voc-service"`

#### Scenario: module 字段从 logger 名称推导
- **WHEN** `voc_service.pipeline.stage1_splitting` 模块记录日志
- **THEN** 日志的 `module` 字段值为 `"pipeline"`

#### Scenario: 统一开发服务器的 service 推导
- **WHEN** 统一开发服务器（main.py）运行，`voc_service.*` 模块记录日志
- **THEN** 日志的 `service` 字段自动推导为 `"voc-service"`（而非 `"dev-server"`）

### Requirement: 按天滚动
系统 SHALL 在每天午夜（本地时间）将当前日志文件滚动为带日期后缀的归档文件。

#### Scenario: 午夜滚动
- **WHEN** 系统时间跨过午夜（00:00）
- **THEN** 当前 `prism.log` 重命名为 `prism.YYYY-MM-DD.log`（前一天日期），新的 `prism.log` 开始写入

### Requirement: 按大小滚动
系统 SHALL 在单个日志文件超过配置大小时，在当天内追加序号滚动。

#### Scenario: 文件大小超限
- **WHEN** `prism.log` 文件大小超过 50MB（默认值，可通过 `log_file_max_mb` 配置）
- **THEN** 当前文件重命名为 `prism.YYYY-MM-DD.1.log`，新的 `prism.log` 继续写入

### Requirement: 总空间上限控制
系统 SHALL 将日志目录总占用空间控制在 `log_max_size_mb` 配置值以内。

#### Scenario: 空间超限自动清理
- **WHEN** 日志目录总大小超过 `log_max_size_mb`（默认 200MB）
- **THEN** 系统自动删除最旧的归档日志文件，直到总大小降至上限以下

#### Scenario: 当前日志不被清理
- **WHEN** 空间清理触发
- **THEN** 当前正在写入的 `prism.log` 文件不被删除

### Requirement: 过期日志自动清理
系统 SHALL 自动删除超过保留天数的归档日志文件。

#### Scenario: 过期文件删除
- **WHEN** 归档日志文件的日期超过 `log_rotation_days`（默认 7 天）
- **THEN** 该文件在下次滚动时被自动删除

### Requirement: 日志配置项
系统 SHALL 通过 `BaseAppSettings` 提供以下日志配置项，均可通过环境变量覆盖。

#### Scenario: 配置项及默认值
- **WHEN** 未设置任何日志相关环境变量
- **THEN** 使用以下默认值：`log_dir` = `~/.prism/log/app`、`log_max_size_mb` = `200`、`log_rotation_days` = `7`、`log_file_max_mb` = `50`

### Requirement: 开发模式双输出
系统 SHALL 在 `debug=True` 时同时输出到控制台（人类可读格式）和文件（JSON 格式）。

#### Scenario: 开发模式控制台 + 文件
- **WHEN** `debug=True`
- **THEN** 日志同时写入控制台（ConsoleRenderer）和文件（JSONRenderer），开发者在终端可直接看到日志

#### Scenario: 生产模式仅文件
- **WHEN** `debug=False`
- **THEN** 日志仅写入文件（JSON 格式），不输出到控制台

### Requirement: logger 命名规范化
系统 SHALL 统一所有 `structlog.get_logger()` 调用为 `structlog.get_logger(__name__)`。

#### Scenario: 无参数 get_logger 消除
- **WHEN** 代码中存在 `structlog.get_logger()`（无参数）
- **THEN** 统一修改为 `structlog.get_logger(__name__)`，确保 module 字段可推导
