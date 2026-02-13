#!/usr/bin/env bash
# Prism 前端服务管理脚本
# 用法: scripts/frontend.sh {start|stop|restart|status}
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
WEB_DIR="$PROJECT_DIR/apps/web"
PID_FILE="$PROJECT_DIR/.frontend.pid"
LOG_FILE="$PROJECT_DIR/.frontend.log"
PORT=3000

# ---------- 辅助函数 ----------

_info()  { echo "  [frontend] $*"; }
_error() { echo "  [frontend] 错误: $*" >&2; }

_is_running() {
    if [ -f "$PID_FILE" ]; then
        local pid
        pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            return 0
        fi
        rm -f "$PID_FILE"
    fi
    return 1
}

_ensure_deps() {
    if [ ! -d "$WEB_DIR/node_modules" ]; then
        _info "安装前端依赖..."
        cd "$WEB_DIR" && npm install --silent
        _info "依赖安装完成"
    fi
}

# ---------- 命令实现 ----------

do_start() {
    if _is_running; then
        local pid
        pid=$(cat "$PID_FILE")
        _info "前端已在运行（PID: $pid, 端口: ${PORT}）"
        return 0
    fi

    # 检查 apps/web 目录
    if [ ! -f "$WEB_DIR/package.json" ]; then
        _error "前端项目不存在: $WEB_DIR"
        return 1
    fi

    # 幂等：确保依赖已安装
    _ensure_deps

    # 启动 Vite dev server
    _info "启动前端开发服务器 (localhost:$PORT)..."
    cd "$WEB_DIR"
    nohup npm run dev > "$LOG_FILE" 2>&1 &

    local pid=$!
    echo "$pid" > "$PID_FILE"

    # 等待服务就绪
    local max_wait=15 waited=0
    while [ $waited -lt $max_wait ]; do
        if curl -sf "http://localhost:$PORT" > /dev/null 2>&1; then
            _info "前端已启动（PID: $pid, 端口: ${PORT}）"
            _info "访问地址: http://localhost:$PORT"
            _info "日志文件: $LOG_FILE"
            return 0
        fi
        sleep 1
        waited=$((waited + 1))
    done

    _error "前端启动超时，查看日志: $LOG_FILE"
    return 1
}

do_stop() {
    if ! _is_running; then
        _info "前端未在运行"
        return 0
    fi

    local pid
    pid=$(cat "$PID_FILE")
    _info "停止前端服务（PID: ${pid}）..."

    # Vite 可能有子进程，用进程组杀
    kill "$pid" 2>/dev/null || true
    # 也清理占用端口的 node 进程
    lsof -ti :"$PORT" 2>/dev/null | xargs kill 2>/dev/null || true

    local max_wait=5 waited=0
    while [ $waited -lt $max_wait ] && kill -0 "$pid" 2>/dev/null; do
        sleep 1
        waited=$((waited + 1))
    done

    if kill -0 "$pid" 2>/dev/null; then
        kill -9 "$pid" 2>/dev/null || true
    fi

    rm -f "$PID_FILE"
    _info "前端已停止"
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

        if curl -sf "http://localhost:$PORT" > /dev/null 2>&1; then
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
        echo "  start   — 安装依赖 + 启动前端（幂等）"
        echo "  stop    — 停止前端"
        echo "  restart — 重启前端"
        echo "  status  — 查看运行状态"
        exit 1
        ;;
esac
