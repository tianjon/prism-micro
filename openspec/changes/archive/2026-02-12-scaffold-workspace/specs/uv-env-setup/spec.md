## MODIFIED Requirements

### Requirement: 项目使用 uv 初始化
系统 SHALL 在项目根目录包含 `pyproject.toml`，作为 uv workspace 项目的标准配置文件，声明所有服务为 workspace member。

#### Scenario: pyproject.toml 存在且有效
- **WHEN** 在项目根目录执行 `uv sync`
- **THEN** 命令正常执行，不报配置错误，所有 workspace member 被正确解析

#### Scenario: workspace 配置有效
- **WHEN** 读取根 `pyproject.toml`
- **THEN** 包含 `[tool.uv.workspace]` 配置段，`members` 列表非空
