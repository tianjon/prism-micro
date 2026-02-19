## ADDED Requirements

### Requirement: docker-compose 定义 PostgreSQL 服务
系统 SHALL 在 `docker-compose.yml` 中定义一个 PostgreSQL 服务，使用 `pgvector/pgvector:pg17` 镜像，预装 pgvector 向量存储扩展。

#### Scenario: PostgreSQL 服务正常启动
- **WHEN** 执行 `docker compose up -d`
- **THEN** PostgreSQL 容器启动成功，监听宿主机 5432 端口，可通过 `prism.test:5432` 连接

#### Scenario: pgvector 扩展可用
- **WHEN** PostgreSQL 服务启动后，执行 `CREATE EXTENSION IF NOT EXISTS vector;`
- **THEN** 扩展创建成功，可以使用 `vector` 类型创建列并进行向量检索

### Requirement: docker-compose 定义 Redis 服务
系统 SHALL 在 `docker-compose.yml` 中定义一个 Redis 服务，使用 `redis:7-alpine` 镜像。

#### Scenario: Redis 服务正常启动
- **WHEN** 执行 `docker compose up -d`
- **THEN** Redis 容器启动成功，监听宿主机 6379 端口，可通过 `prism.test:6379` 连接

#### Scenario: Redis 数据持久化
- **WHEN** 向 Redis 写入数据后，执行 `docker compose down` 再 `docker compose up -d`
- **THEN** 之前写入的数据仍然存在

### Requirement: 服务间网络互通
系统 SHALL 创建名为 `prism-net` 的自定义 bridge 网络，所有服务加入该网络。

#### Scenario: 容器间通过服务名访问
- **WHEN** 从任一容器内部访问另一个服务
- **THEN** 可通过服务名（如 `postgres`、`redis`）作为主机名进行连接

### Requirement: 数据卷挂载到本地目录
系统 SHALL 将 PostgreSQL 数据目录挂载到 `~/.prism/data/postgres/`，Redis 数据目录挂载到 `~/.prism/data/redis/`。

#### Scenario: PostgreSQL 数据持久化
- **WHEN** PostgreSQL 容器中创建数据库和表，然后执行 `docker compose down` 再 `docker compose up -d`
- **THEN** 数据库和表数据完整保留

#### Scenario: 数据文件位于指定目录
- **WHEN** 服务启动后检查 `~/.prism/data/postgres/` 和 `~/.prism/data/redis/`
- **THEN** 目录中包含对应服务的数据文件

### Requirement: 服务可扩展
docker-compose.yml 的结构 SHALL 清晰组织，便于未来添加新的基础服务（如 MinIO、Elasticsearch 等），无需修改已有服务定义。

#### Scenario: 添加新服务不影响已有服务
- **WHEN** 在 docker-compose.yml 中新增一个服务定义
- **THEN** 已有的 PostgreSQL 和 Redis 服务配置无需任何修改即可正常运行
