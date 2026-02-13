## Why

prism-micro 是一个 Python 微服务项目，当前缺乏统一的依赖管理和虚拟环境配置。需要使用 uv 作为包管理工具，并将虚拟环境统一放置在 `~/.base-venv/`，与项目源码分离，为后续各服务的开发提供标准化的 Python 环境基础。

## What Changes

- 在项目根目录初始化 uv 项目（`pyproject.toml`）
- 配置虚拟环境路径为 `~/.base-venv/`，而非默认的项目内 `.venv`
- 配置 `.python-version` 锁定 Python 版本
- 更新 `.gitignore` 排除虚拟环境相关文件

## Capabilities

### New Capabilities
- `uv-env-setup`: uv 包管理器与 Python 虚拟环境的初始化和配置规范

### Modified Capabilities
<!-- 无已有能力需要修改 -->

## Impact

- **新增文件**：`pyproject.toml`、`.python-version`，可能更新 `.gitignore`
- **依赖**：开发者需预先安装 uv（`curl -LsSf https://astral.sh/uv/install.sh | sh`）
- **环境**：虚拟环境位于 `~/.base-venv/`，所有服务共享同一基础环境
