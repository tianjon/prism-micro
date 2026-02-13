## Context

prism-micro 项目包含多个微服务模块（apps、llm-service、user-service），目前均为空目录，尚未初始化任何 Python 项目配置。系统已安装 uv v0.10.2。用户要求虚拟环境放在 `~/.base-venv/` 而非项目目录内。

## Goals / Non-Goals

**Goals:**
- 使用 uv 初始化项目，生成 `pyproject.toml`
- 虚拟环境路径配置为 `~/.base-venv/`
- 锁定 Python 版本，确保团队一致性
- 配置 `.gitignore` 排除不需要提交的文件

**Non-Goals:**
- 不涉及各子服务的具体依赖安装（仅搭建基础环境）
- 不涉及 CI/CD 的 Python 环境配置
- 不涉及 monorepo workspace 结构（后续按需添加）

## Decisions

### 1. 虚拟环境路径：通过 `UV_PROJECT_ENVIRONMENT` 配置

**选择**：在 `pyproject.toml` 的 `[tool.uv]` 中设置 `python-install-dir` 无法直接指定 venv 路径。使用环境变量 `UV_PROJECT_ENVIRONMENT=~/.base-venv` 或在项目的 `.env` 文件中配置。

实际上，uv 支持在 `pyproject.toml` 中通过 `[tool.uv]` 的配置项来指定，但最可靠的方式是结合 `uv.toml` 配置文件：

```toml
# uv.toml
[project]
python-preference = "only-managed"
```

并通过 `.env` 或直接在 `pyproject.toml` 中使用：
```toml
[tool.uv]
python = ">=3.12"
```

最终选择：在项目根目录创建 `uv.toml`，配置 `environment = "~/.base-venv"`，这是 uv 原生支持的项目级配置方式。

**理由**：
- `uv.toml` 是 uv 的项目级配置文件，优先级高于全局配置
- 避免依赖环境变量，团队成员 clone 后即生效
- 与 `pyproject.toml` 分离，职责清晰

### 2. Python 版本：3.12

**选择**：使用 Python 3.12 作为项目基础版本。

**理由**：
- 3.12 是当前广泛支持的稳定版本，性能优于 3.11
- 主流框架和库均已兼容
- 通过 `.python-version` 文件锁定，uv 会自动管理安装

### 3. 项目初始化方式

**选择**：使用 `uv init` 初始化项目，然后手动调整配置。

**理由**：
- `uv init` 生成标准的 `pyproject.toml` 骨架
- 手动补充 `uv.toml` 配置虚拟环境路径
- 执行 `uv sync` 创建虚拟环境并生成 `uv.lock`

## Risks / Trade-offs

- **共享虚拟环境的隔离性** → `~/.base-venv/` 是单一环境，多项目可能冲突。当前 prism-micro 是唯一使用者，未来如需隔离可改为 `~/.base-venv/prism-micro/`。
- **uv 版本差异** → 不同开发者的 uv 版本可能不同，导致 lock 文件差异。建议团队统一 uv 版本，可在文档中注明最低版本要求。
