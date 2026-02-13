## Why

项目 prism-micro 是一个微服务架构，各服务依赖 PostgreSQL 和 Redis 等基础设施。当前缺乏统一的本地开发环境定义，需要通过 docker-compose 标准化基础依赖的启动和管理，降低开发环境搭建成本，同时为未来新增基础依赖提供可扩展的基础。

## What Changes

- 新增 `docker-compose.yml`，定义 PostgreSQL（含 pgvector 向量存储扩展）和 Redis 服务
- 建立统一的本地数据目录规范 `~/.prism/`，包含：
  - `~/.prism/data/` — 数据持久化目录（PostgreSQL、Redis 数据文件）
  - `~/.prism/conf/` — 配置文件目录（各服务配置）
  - `~/.prism/log/` — 日志目录
- docker-compose 中所有服务的数据卷挂载到 `~/.prism/` 下对应子目录
- 提供初始化脚本，自动创建所需目录结构

## Capabilities

### New Capabilities
- `infra-docker-compose`: 基础设施容器编排定义，管理 PostgreSQL（pgvector）、Redis 等服务的生命周期
- `local-storage-layout`: 本地存储目录规范（`~/.prism/`），统一数据、配置、日志的存放路径

### Modified Capabilities
<!-- 无已有能力需要修改 -->

## Impact

- **新增文件**：项目根目录新增 `docker-compose.yml` 及可能的初始化脚本
- **依赖**：Docker 和 Docker Compose（开发者需预先安装）
- **外部端口**：PostgreSQL（5432）、Redis（6379）将占用本地端口
- **磁盘**：`~/.prism/` 目录将持久化存储数据，需关注磁盘空间
