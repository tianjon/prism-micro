## Why

项目设计阶段已完成（PRD v2.0 + 5 份实现级设计文档），但代码实现为 0%。所有服务目录为空。需要先搭建 monorepo 工程骨架——uv workspace 配置、6 个 Python 服务包、代码质量工具链、DB schema 初始化——作为后续所有编码工作的基础。

## What Changes

- 将根 `pyproject.toml` 配置为 uv workspace，声明 6 个 member（shared, llm-service, user-service, voc-service, agent-service, apps/cli）
- 为每个服务创建 `pyproject.toml` + `src/<package>/__init__.py` + 标准目录结构（api/, core/, models/, migrations/）
- 创建 `ruff.toml` 统一 lint/format 规则
- 创建 `.importlinter` 配置强制依赖方向（shared 不导入上层服务，服务间不互相导入）
- 扩展 `scripts/initdb/` 增加各 schema 创建脚本（auth, llm, agent, voc）
- 更新 `.gitignore` 补充 Python/Node.js 常见排除项

## Capabilities

### New Capabilities
- `monorepo-workspace`: uv workspace 配置，6 个 Python 服务包的 pyproject.toml 和目录结构
- `code-quality-toolchain`: ruff lint/format 规则、import-linter 依赖方向检查
- `db-schema-init`: PostgreSQL 多 schema 初始化脚本（auth, llm, agent, voc）

### Modified Capabilities
- `uv-env-setup`: workspace members 声明扩展了原有的 uv 项目配置

## Impact

- **项目结构**: 从单一 pyproject.toml 变为 monorepo workspace，新增 6 个子包
- **依赖管理**: 各服务独立声明依赖，通过 workspace 引用 shared
- **代码质量**: ruff + import-linter 规则，后续所有代码提交必须通过
- **数据库**: initdb 脚本确保 PostgreSQL 启动时自动创建 4 个 schema
