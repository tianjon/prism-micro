## 1. 项目初始化

- [x] 1.1 在项目根目录执行 `uv init`，生成 `pyproject.toml` 和 `.python-version`
- [x] 1.2 创建 `.env`，通过 `UV_PROJECT_ENVIRONMENT` 配置虚拟环境路径为 `~/.base-venv/`

## 2. 环境配置

- [x] 2.1 执行 `uv sync`，创建虚拟环境并生成 `uv.lock`
- [x] 2.2 更新 `.gitignore`，添加 `__pycache__/`、`*.pyc`、`.venv/` 等 Python 相关忽略规则

## 3. 验证

- [x] 3.1 验证虚拟环境路径正确（`~/.base-venv/`）、Python 版本正确、`uv run` 可正常执行
