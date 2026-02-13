## 1. 本地存储目录初始化

- [x] 1.1 创建 `scripts/init-local-env.sh` 脚本，自动创建 `~/.prism/` 及所有子目录（data/postgres、data/redis、conf/postgres、conf/redis、log/postgres、log/redis），脚本须幂等
- [x] 1.2 为脚本添加可执行权限，并在脚本末尾输出各服务连接信息（host、port）

## 2. Docker Compose 编排

- [x] 2.1 在项目根目录创建 `docker-compose.yml`，定义自定义 bridge 网络 `prism-net`
- [x] 2.2 定义 PostgreSQL 服务：使用 `pgvector/pgvector:pg17` 镜像，映射 5432 端口，数据卷挂载到 `~/.prism/data/postgres/`，加入 `prism-net` 网络
- [x] 2.3 添加 PostgreSQL 初始化脚本，在首次启动时自动执行 `CREATE EXTENSION IF NOT EXISTS vector;`
- [x] 2.4 定义 Redis 服务：使用 `redis:7-alpine` 镜像，映射 6379 端口，数据卷挂载到 `~/.prism/data/redis/`，启用 AOF 持久化，加入 `prism-net` 网络

## 3. 集成与验证

- [x] 3.1 在 `init-local-env.sh` 中集成 `docker compose up -d` 启动命令，并等待服务健康检查通过
- [x] 3.2 验证：执行初始化脚本，确认目录创建、容器启动、端口可连接、pgvector 扩展可用、Redis 数据持久化
