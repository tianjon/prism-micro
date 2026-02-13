#!/usr/bin/env bash
# Prism 后端服务管理脚本
# 用法: scripts/backend.sh {start|stop|restart|status}
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PID_FILE="$PROJECT_DIR/.backend.pid"
LOG_FILE="$PROJECT_DIR/.backend.log"
HOST="0.0.0.0"
PORT=8601

# ---------- 辅助函数 ----------

_info()  { echo "  [backend] $*"; }
_error() { echo "  [backend] 错误: $*" >&2; }

_is_running() {
    if [ -f "$PID_FILE" ]; then
        local pid
        pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            return 0
        fi
        # PID 文件存在但进程已死，清理残留
        rm -f "$PID_FILE"
    fi
    return 1
}

_wait_for_postgres() {
    _info "等待 PostgreSQL 就绪..."
    local max_wait=30 waited=0
    while [ $waited -lt $max_wait ]; do
        if docker exec prism-postgres pg_isready -U prism -q 2>/dev/null; then
            return 0
        fi
        sleep 1
        waited=$((waited + 1))
    done
    _error "PostgreSQL 未就绪（等待 ${max_wait}s 超时）"
    return 1
}

_ensure_db_schemas() {
    # 幂等：CREATE SCHEMA IF NOT EXISTS
    _info "确保数据库 schema 存在..."
    docker exec prism-postgres psql -U prism -d prism -q -c "
        CREATE SCHEMA IF NOT EXISTS auth;
        CREATE SCHEMA IF NOT EXISTS llm;
        CREATE SCHEMA IF NOT EXISTS agent;
        CREATE SCHEMA IF NOT EXISTS voc;
    " 2>/dev/null
    _info "数据库 schema 就绪（auth, llm, agent, voc）"
}

_run_migrations() {
    # 幂等：Alembic 自动跳过已执行的版本
    _info "执行 Alembic 迁移..."
    cd "$PROJECT_DIR/user-service" && uv run alembic upgrade head 2>&1 | while read -r line; do _info "  [user-service] $line"; done
    cd "$PROJECT_DIR/llm-service" && uv run alembic upgrade head 2>&1 | while read -r line; do _info "  [llm-service] $line"; done
    cd "$PROJECT_DIR"
    _info "数据库迁移完成"
}

# ---------- 命令实现 ----------

do_start() {
    if _is_running; then
        local pid
        pid=$(cat "$PID_FILE")
        _info "后端已在运行（PID: $pid, 端口: ${PORT}）"
        return 0
    fi

    # 前置检查：PostgreSQL 必须在线
    _wait_for_postgres || return 1

    # 幂等初始化：schema + 迁移
    _ensure_db_schemas
    _run_migrations

    # 启动 uvicorn
    _info "启动后端服务 ($HOST:$PORT)..."
    cd "$PROJECT_DIR"
    nohup uv run uvicorn main:app \
        --host "$HOST" \
        --port "$PORT" \
        --reload \
        --reload-dir shared/src \
        --reload-dir user-service/src \
        --reload-dir llm-service/src \
        > "$LOG_FILE" 2>&1 &

    local pid=$!
    echo "$pid" > "$PID_FILE"

    # 等待服务就绪
    local max_wait=10 waited=0
    while [ $waited -lt $max_wait ]; do
        if curl -sf "http://localhost:$PORT/health" > /dev/null 2>&1; then
            _info "后端已启动（PID: $pid, 端口: ${PORT}）"
            _info "API 文档: http://localhost:$PORT/docs"
            _info "日志文件: $LOG_FILE"
            return 0
        fi
        sleep 1
        waited=$((waited + 1))
    done

    _error "后端启动超时，查看日志: $LOG_FILE"
    return 1
}

do_stop() {
    if ! _is_running; then
        _info "后端未在运行"
        return 0
    fi

    local pid
    pid=$(cat "$PID_FILE")
    _info "停止后端服务（PID: ${pid}）..."

    # 优雅关闭：先 TERM，等 5 秒，再 KILL
    kill "$pid" 2>/dev/null || true
    local max_wait=5 waited=0
    while [ $waited -lt $max_wait ] && kill -0 "$pid" 2>/dev/null; do
        sleep 1
        waited=$((waited + 1))
    done

    if kill -0 "$pid" 2>/dev/null; then
        kill -9 "$pid" 2>/dev/null || true
        _info "强制终止进程"
    fi

    rm -f "$PID_FILE"
    _info "后端已停止"
}

do_restart() {
    do_stop
    sleep 1
    do_start
}

do_status() {
    if _is_running; then
        local pid
        pid=$(cat "$PID_FILE")
        _info "运行中（PID: $pid, 端口: ${PORT}）"

        if curl -sf "http://localhost:$PORT/health" > /dev/null 2>&1; then
            _info "健康检查: 正常"
        else
            _info "健康检查: 异常（进程存活但 HTTP 无响应）"
        fi
    else
        _info "未运行"
    fi
}

# ---------- 入口 ----------

case "${1:-}" in
    start)   do_start   ;;
    stop)    do_stop    ;;
    restart) do_restart ;;
    status)  do_status  ;;
    *)
        echo "用法: $0 {start|stop|restart|status}"
        echo ""
        echo "  start   — 初始化数据库 + 启动后端（幂等）"
        echo "  stop    — 停止后端"
        echo "  restart — 重启后端"
        echo "  status  — 查看运行状态"
        exit 1
        ;;
esac
