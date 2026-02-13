## ADDED Requirements

### Requirement: uv workspace 配置
系统 SHALL 在根 `pyproject.toml` 中声明 `[tool.uv.workspace]`，将所有服务注册为 workspace member。

#### Scenario: workspace members 包含所有服务
- **WHEN** 读取根 `pyproject.toml` 的 `[tool.uv.workspace].members` 列表
- **THEN** 列表包含 `shared`、`llm-service`、`user-service`、`voc-service`、`agent-service`、`apps/cli`

#### Scenario: uv sync 解析 workspace 成功
- **WHEN** 在项目根目录执行 `uv sync`
- **THEN** 命令成功完成，所有 workspace member 的依赖被解析和安装

### Requirement: shared 包结构
系统 SHALL 提供 `shared/` 目录，包含 `pyproject.toml` 和 `src/prism_shared/__init__.py`，作为可导入的 Python 包。

#### Scenario: shared 包可导入
- **WHEN** 执行 `uv run python -c "import prism_shared"`
- **THEN** 导入成功，无报错

#### Scenario: shared 包目录结构完整
- **WHEN** 检查 `shared/src/prism_shared/` 目录
- **THEN** 存在以下子目录：`auth/`、`db/`、`schemas/`、`config/`、`middleware/`，每个目录包含 `__init__.py`

### Requirement: llm-service 包结构
系统 SHALL 提供 `llm-service/` 目录，包含 `pyproject.toml` 和 `src/llm_service/__init__.py`，声明对 `prism-shared` 的 workspace 依赖。

#### Scenario: llm-service 包可导入
- **WHEN** 执行 `uv run python -c "import llm_service"`
- **THEN** 导入成功，无报错

#### Scenario: llm-service 依赖 shared
- **WHEN** 读取 `llm-service/pyproject.toml` 的 dependencies
- **THEN** 包含 `prism-shared`，且标记为 workspace 源

### Requirement: user-service 包结构
系统 SHALL 提供 `user-service/` 目录，包含 `pyproject.toml` 和 `src/user_service/__init__.py`，声明对 `prism-shared` 的 workspace 依赖。

#### Scenario: user-service 包可导入
- **WHEN** 执行 `uv run python -c "import user_service"`
- **THEN** 导入成功，无报错

### Requirement: voc-service 包结构
系统 SHALL 提供 `voc-service/` 目录，包含 `pyproject.toml` 和 `src/voc_service/__init__.py`，声明对 `prism-shared` 的 workspace 依赖。

#### Scenario: voc-service 包可导入
- **WHEN** 执行 `uv run python -c "import voc_service"`
- **THEN** 导入成功，无报错

#### Scenario: voc-service 目录结构包含 pipeline
- **WHEN** 检查 `voc-service/src/voc_service/` 目录
- **THEN** 存在 `pipeline/` 和 `prompts/` 子目录（AI 管线专用）

### Requirement: agent-service 包结构
系统 SHALL 提供 `agent-service/` 目录，包含 `pyproject.toml` 和 `src/agent_service/__init__.py`，声明对 `prism-shared` 的 workspace 依赖。

#### Scenario: agent-service 包可导入
- **WHEN** 执行 `uv run python -c "import agent_service"`
- **THEN** 导入成功，无报错

### Requirement: CLI 包结构
系统 SHALL 提供 `apps/cli/` 目录，包含 `pyproject.toml` 和 `src/prism_cli/__init__.py`。

#### Scenario: CLI 包可导入
- **WHEN** 执行 `uv run python -c "import prism_cli"`
- **THEN** 导入成功，无报错

### Requirement: 服务目录标准结构
每个后端服务（llm/user/voc/agent）SHALL 包含标准子目录：`api/`、`core/`、`models/`。

#### Scenario: llm-service 标准目录存在
- **WHEN** 检查 `llm-service/src/llm_service/` 目录
- **THEN** 存在 `api/`、`core/`、`models/` 子目录，每个包含 `__init__.py`

#### Scenario: 所有后端服务目录结构一致
- **WHEN** 检查 user-service、voc-service、agent-service 的 `src/<package>/` 目录
- **THEN** 均存在 `api/`、`core/`、`models/` 子目录
