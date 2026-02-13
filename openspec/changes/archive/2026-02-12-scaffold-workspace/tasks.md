## 1. 根项目配置

- [x] 1.1 更新根 `pyproject.toml`：添加 `[tool.uv.workspace]` 配置，声明 6 个 member；添加 dev 依赖组（pytest, ruff, import-linter 等）
- [x] 1.2 更新 `.gitignore`：补充 Node.js（node_modules/）、IDE（.idea/, .vscode/）、测试（.coverage, htmlcov/）等排除项

## 2. shared 包骨架

- [x] 2.1 创建 `shared/pyproject.toml`（包名 `prism-shared`，无运行时依赖）
- [x] 2.2 创建 `shared/src/prism_shared/__init__.py`（含 `__version__`）
- [x] 2.3 创建子目录及 `__init__.py`：`auth/`、`db/`、`schemas/`、`config/`、`middleware/`
- [x] 2.4 创建 `shared/tests/__init__.py`（测试目录占位）

## 3. 后端服务包骨架

- [x] 3.1 创建 `llm-service/pyproject.toml`（包名 `llm-service`，依赖 `prism-shared` workspace）+ `src/llm_service/__init__.py` + 子目录 `api/`、`core/`、`models/`（各含 `__init__.py`）
- [x] 3.2 创建 `user-service/pyproject.toml` + `src/user_service/__init__.py` + 标准子目录
- [x] 3.3 创建 `voc-service/pyproject.toml` + `src/voc_service/__init__.py` + 标准子目录 + 额外 `pipeline/`、`prompts/` 目录
- [x] 3.4 创建 `agent-service/pyproject.toml` + `src/agent_service/__init__.py` + 标准子目录 + 额外 `skills/` 目录

## 4. CLI 包骨架

- [x] 4.1 创建 `apps/cli/pyproject.toml`（包名 `prism-cli`）+ `src/prism_cli/__init__.py` + `commands/` 子目录

## 5. 代码质量工具

- [x] 5.1 创建 `ruff.toml`：line-length=120, target-version="py312", select=["E","F","I","UP","B","SIM"]
- [x] 5.2 创建 `.importlinter`：3 条 forbidden contract（shared 独立性 + 服务间隔离）

## 6. 数据库 schema 初始化

- [x] 6.1 创建 `scripts/initdb/02-create-schemas.sql`：`CREATE SCHEMA IF NOT EXISTS` 创建 auth、llm、agent、voc 四个 schema

## 7. 验证

- [x] 7.1 执行 `uv sync` 确认所有 workspace member 安装成功
- [x] 7.2 验证 6 个包可导入：`uv run python -c "import prism_shared; import llm_service; import user_service; import voc_service; import agent_service; import prism_cli"`
- [x] 7.3 执行 `uv run ruff check .` 确认无 lint 违规
- [x] 7.4 执行 `uv run lint-imports` 确认依赖方向检查通过
