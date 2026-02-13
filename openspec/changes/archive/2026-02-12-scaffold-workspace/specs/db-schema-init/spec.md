## ADDED Requirements

### Requirement: PostgreSQL 多 schema 初始化
系统 SHALL 在 PostgreSQL 容器首次启动时自动创建 4 个 schema：`auth`、`llm`、`agent`、`voc`。

#### Scenario: 容器启动后 schema 存在
- **WHEN** PostgreSQL 容器启动并完成 initdb 脚本执行
- **THEN** 数据库 `prism` 中存在 `auth`、`llm`、`agent`、`voc` 四个 schema

#### Scenario: 脚本幂等执行
- **WHEN** initdb 脚本被重复执行（如容器重启）
- **THEN** 不报错，使用 `CREATE SCHEMA IF NOT EXISTS` 保证幂等性

### Requirement: initdb 脚本执行顺序
系统 SHALL 确保 pgvector 扩展在 schema 创建之前启用，通过文件名排序保证执行顺序。

#### Scenario: 执行顺序正确
- **WHEN** 检查 `scripts/initdb/` 目录中的 SQL 文件
- **THEN** `01-enable-pgvector.sql` 排在 `02-create-schemas.sql` 之前
