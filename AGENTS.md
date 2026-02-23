# Repository Guidelines

## Project Structure & Module Organization
- `shared/src/prism_shared`: shared auth, DB/session, schemas, middleware, and cross-service utilities.
- `llm-service/src/llm_service`, `user-service/src/user_service`, `voc-service/src/voc_service`, `agent-service/src/agent_service`: backend service code.
- `apps/cli/src/prism_cli`: Typer-based CLI.
- `apps/web/src`: React + Vite frontend, organized by feature folders under `features/`.
- `scripts/`: local environment/bootstrap and start-stop scripts.
- `docs/`: PRD/design references. `openspec/`: change proposals/spec artifacts.
- Tests live in `<package>/tests` (example: `voc-service/tests`).

## Build, Test, and Development Commands
Run from repo root unless noted.
- `uv sync`: install/update Python workspace dependencies.
- `scripts/init-local-env.sh`: create `~/.prism` data dirs and start PostgreSQL/Redis/Neo4j via Docker.
- `scripts/backend.sh start|stop|status`: run unified backend dev server (`main.py`) on `:8601`.
- `scripts/frontend.sh start|stop|status`: run frontend dev server on `:3000`.
- `uv run ruff format --check .` and `uv run ruff check .`: Python formatting/lint checks.
- `uv run lint-imports`: enforce dependency direction rules from `.importlinter`.
- `uv run pytest voc-service/tests -v`: run backend tests (swap path for target package).
- `cd apps/web && npm run lint && npm run type-check && npm run build`: frontend validation.

## Coding Style & Naming Conventions
- Python: 4-space indentation, max line length `120`, Python `3.12`, Ruff-managed formatting.
- Prefer double quotes in Python (Ruff formatter default).
- Respect boundaries: services do not import each other; shared stays dependency-free of upper layers.
- Naming: Python modules/packages `snake_case`, classes `PascalCase`.
- Frontend: TypeScript + ESLint; component/page files use `PascalCase`, hooks use `useXxx`.

## Testing Guidelines
- Backend testing uses `pytest` + `pytest-asyncio`.
- Place tests in `<service>/tests` and name files `test_*.py`.
- Prefer async API/integration-style tests with `httpx.AsyncClient` for FastAPI endpoints.
- No repo-enforced global coverage threshold is configured; use `pytest-cov` for touched modules (example: `uv run pytest voc-service/tests --cov=voc_service`).

## Commit & Pull Request Guidelines
- Follow Conventional Commit style used in history: `feat:`, `fix:`, `docs:` (example: `fix: align import schema types`).
- Keep commits scoped to one service/feature when possible.
- PRs should include: change summary, affected services/schemas, commands run (`ruff`, `pytest`, frontend checks), and UI screenshots for `apps/web` changes.
