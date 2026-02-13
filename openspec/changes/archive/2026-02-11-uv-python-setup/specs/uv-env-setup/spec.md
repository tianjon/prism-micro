## ADDED Requirements

### Requirement: 项目使用 uv 初始化
系统 SHALL 在项目根目录包含 `pyproject.toml`，作为 uv 项目的标准配置文件。

#### Scenario: pyproject.toml 存在且有效
- **WHEN** 在项目根目录执行 `uv sync`
- **THEN** 命令正常执行，不报配置错误

### Requirement: 虚拟环境位于指定路径
系统 SHALL 将 Python 虚拟环境配置在 `~/.base-venv/`，而非项目目录内的默认 `.venv`。

#### Scenario: uv sync 创建虚拟环境到指定路径
- **WHEN** 执行 `uv sync`
- **THEN** 虚拟环境创建在 `~/.base-venv/`，而非项目根目录的 `.venv/`

#### Scenario: uv run 使用指定虚拟环境
- **WHEN** 执行 `uv run python -c "import sys; print(sys.prefix)"`
- **THEN** 输出路径包含 `/.base-venv`

### Requirement: Python 版本锁定
系统 SHALL 通过 `.python-version` 文件锁定 Python 版本，确保团队开发环境一致。

#### Scenario: Python 版本文件存在
- **WHEN** 查看项目根目录的 `.python-version` 文件
- **THEN** 文件内容指定 Python 3.12 版本

### Requirement: Git 忽略配置
系统 SHALL 在 `.gitignore` 中排除虚拟环境、uv 缓存等不需要版本控制的文件。

#### Scenario: 虚拟环境不被提交
- **WHEN** 执行 `git status`
- **THEN** `~/.base-venv/` 相关文件不出现在未跟踪列表中（因路径在项目外，天然不会被跟踪）

#### Scenario: Python 编译缓存被忽略
- **WHEN** 项目中产生 `__pycache__/` 或 `.pyc` 文件
- **THEN** 这些文件被 `.gitignore` 排除
