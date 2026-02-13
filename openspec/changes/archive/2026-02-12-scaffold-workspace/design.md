## Context

项目当前状态：
- 根 `pyproject.toml` 已存在，但未配置 workspace
- `docker-compose.yml` + `scripts/init-local-env.sh` 已就绪（PostgreSQL/Redis/Neo4j）
- `scripts/initdb/01-enable-pgvector.sql` 仅启用 pgvector 扩展，无 schema 创建
- `.python-version` 锁定 3.12，`.env` 配置 `UV_PROJECT_ENVIRONMENT=~/.base-venv`
- `llm-service/` 和 `user-service/` 目录存在但为空
- `shared/`、`voc-service/`、`agent-service/`、`apps/cli/` 目录尚未创建

设计文档约定的包命名（Python import path）：
| 服务 | 包名 | 目录 |
|------|------|------|
| shared | `prism_shared` | `shared/src/prism_shared/` |
| llm-service | `llm_service` | `llm-service/src/llm_service/` |
| user-service | `user_service` | `user-service/src/user_service/` |
| voc-service | `voc_service` | `voc-service/src/voc_service/` |
| agent-service | `agent_service` | `agent-service/src/agent_service/` |
| cli | `prism_cli` | `apps/cli/src/prism_cli/` |

## Goals / Non-Goals

**Goals:**
- 所有 6 个 Python 包可通过 `uv sync` 一次性安装到共享虚拟环境
- 各服务 `pyproject.toml` 声明对 `prism-shared` 的 workspace 依赖
- `import-linter` 规则防止依赖方向违反
- `ruff` 统一格式化和 lint 规则
- PostgreSQL 启动时自动创建 4 个 schema（auth, llm, agent, voc）
- `uv run python -c "import prism_shared"` 等基础导入验证通过

**Non-Goals:**
- 不写任何业务代码（API 路由、ORM 模型、业务逻辑）
- 不配置 Alembic 迁移（各服务在自己的 Phase 中配置）
- 不初始化前端项目（apps/web 推迟到 Phase 6）
- 不配置 CI/CD GitHub Actions（推迟到 shared M1）
- 不安装 pre-commit hooks（仅创建配置文件）

## Decisions

### D1: 包命名使用 `prism_shared` 而非 `shared`

**选择**: `prism_shared`
**原因**: `shared` 是 Python 常见词，容易与其他库冲突。`prism_shared` 带项目前缀，import 路径明确无歧义。设计文档已统一使用此命名。

### D2: 各服务的 pyproject.toml 仅声明最小依赖

**选择**: 骨架阶段各服务仅声明 `prism-shared` 的 workspace 依赖，不提前引入 FastAPI 等运行时依赖。
**原因**: 依赖在各服务实现阶段（Phase 2-5）按需添加，避免骨架阶段因依赖解析失败阻塞验证。shared 包本身也仅声明空依赖。

### D3: initdb 脚本编号排序

**选择**: `01-enable-pgvector.sql`（已有）→ `02-create-schemas.sql`（新增），单文件创建所有 schema。
**原因**: PostgreSQL initdb 按文件名排序执行，pgvector 扩展需先于 schema 创建。所有 schema 放在一个文件中，因为它们在同一数据库实例内，逻辑简单。

### D4: import-linter 规则覆盖所有服务

**选择**: 配置 3 条 forbidden contract：shared 独立性、服务间隔离（llm↔user↔agent↔voc 两两禁止）。
**原因**: 依赖方向是架构的硬约束，必须从骨架阶段就建立。虽然骨架阶段无实际代码可检查，但规则文件需就位，后续 Phase 添加代码时即自动生效。

### D5: ruff 规则选择

**选择**: 基于 `select = ["E", "F", "I", "UP", "B", "SIM"]`，line-length 120，target Python 3.12。
**原因**:
- `E`/`F`: pyflakes + pycodestyle 基础检查
- `I`: isort 导入排序
- `UP`: pyupgrade 现代 Python 语法
- `B`: bugbear 常见 bug 检测
- `SIM`: 简化建议
- 120 字符行宽平衡可读性和屏幕利用率

## Risks / Trade-offs

- **[Risk] workspace 依赖解析可能在空包时报错** → 各 `__init__.py` 保持非空（含 `__version__`），确保包可被正确识别
- **[Risk] initdb 脚本在已有数据库上重复执行** → 使用 `CREATE SCHEMA IF NOT EXISTS`，幂等安全
- **[Risk] import-linter 在无代码时无法有效验证** → 接受此限制，规则文件先就位，Phase 2 起生效
