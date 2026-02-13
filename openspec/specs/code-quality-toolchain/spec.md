## ADDED Requirements

### Requirement: ruff 格式化与 lint 配置
系统 SHALL 在项目根目录提供 `ruff.toml`，统一所有 Python 代码的格式化和 lint 规则。

#### Scenario: ruff format 可执行
- **WHEN** 在项目根目录执行 `uv run ruff format --check .`
- **THEN** 命令成功执行，所有已有 Python 文件符合格式规范

#### Scenario: ruff check 可执行
- **WHEN** 在项目根目录执行 `uv run ruff check .`
- **THEN** 命令成功执行，无 lint 违规

#### Scenario: ruff 规则覆盖关键检查项
- **WHEN** 读取 `ruff.toml` 的 `select` 配置
- **THEN** 至少包含 `E`（pycodestyle）、`F`（pyflakes）、`I`（isort）、`UP`（pyupgrade）、`B`（bugbear）

### Requirement: import-linter 依赖方向检查
系统 SHALL 在项目根目录提供 `.importlinter` 配置，强制以下依赖方向约束：
1. `prism_shared` 不得导入任何上层服务模块
2. 各后端服务之间不得互相导入

#### Scenario: shared 独立性检查
- **WHEN** 执行 `uv run lint-imports`
- **THEN** 验证 `prism_shared` 未导入 `llm_service`、`user_service`、`agent_service`、`voc_service` 中的任何模块

#### Scenario: 服务间隔离检查
- **WHEN** 执行 `uv run lint-imports`
- **THEN** 验证各服务（llm_service, user_service, agent_service, voc_service）未互相导入
