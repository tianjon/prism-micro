#!/usr/bin/env bash
set -euo pipefail

PRISM_HOME="$HOME/.prism"

# --- 创建目录结构（幂等） ---
dirs=(
  "$PRISM_HOME/data/postgres"
  "$PRISM_HOME/data/redis"
  "$PRISM_HOME/data/neo4j"
  "$PRISM_HOME/conf/postgres"
  "$PRISM_HOME/conf/redis"
  "$PRISM_HOME/log/postgres"
  "$PRISM_HOME/log/redis"
)

for dir in "${dirs[@]}"; do
  mkdir -p "$dir"
done

echo "✓ 目录结构已就绪: $PRISM_HOME"

# --- 启动服务 ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.yml"

docker compose -f "$COMPOSE_FILE" up -d

# --- 等待所有服务健康检查通过 ---
echo "等待服务就绪..."

EXPECTED_HEALTHY=3  # postgres, redis, neo4j
MAX_WAIT=60
WAIT=0

while [ $WAIT -lt $MAX_WAIT ]; do
  HEALTHY_COUNT=$(docker compose -f "$COMPOSE_FILE" ps --format json | grep -c '"Health":"healthy"' || true)
  if [ "$HEALTHY_COUNT" -ge "$EXPECTED_HEALTHY" ]; then
    break
  fi
  sleep 1
  WAIT=$((WAIT + 1))
done

if [ $WAIT -ge $MAX_WAIT ]; then
  echo "⚠ 部分服务可能未就绪（$HEALTHY_COUNT/$EXPECTED_HEALTHY healthy），请手动检查:"
  docker compose -f "$COMPOSE_FILE" ps
else
  echo "✓ 所有服务已就绪（$HEALTHY_COUNT/$EXPECTED_HEALTHY healthy）"
fi

# --- 输出连接信息 ---
echo ""
echo "========================================="
echo "  Prism 基础服务连接信息"
echo "========================================="
echo "  PostgreSQL: localhost:5432"
echo "    用户: prism / 密码: prism"
echo "    数据库: prism"
echo ""
echo "  Redis: localhost:6379"
echo ""
echo "  Neo4j: http://localhost:7474"
echo "    用户: neo4j / 密码: prism"
echo "    Bolt: bolt://localhost:7687"
echo "========================================="
