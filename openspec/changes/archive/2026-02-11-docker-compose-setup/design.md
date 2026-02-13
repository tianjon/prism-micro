## Context

prism-micro 是一个微服务架构项目，包含 apps、llm-service、user-service 等模块。当前项目没有定义本地开发环境的基础设施，开发者需自行安装和配置 PostgreSQL、Redis 等依赖。需要一个标准化的容器编排方案来统一开发环境。

## Goals / Non-Goals

**Goals:**
- 通过 docker-compose 一键启动所有基础设施依赖
- PostgreSQL 支持 pgvector 扩展，满足向量存储需求
- 建立统一的本地存储目录规范 `~/.prism/`，数据持久化且路径清晰
- 方案具备可扩展性，未来可轻松添加新的基础服务

**Non-Goals:**
- 不涉及生产环境部署编排（本方案仅针对本地开发）
- 不涉及各微服务自身的容器化（仅基础设施层）
- 不涉及 CI/CD 集成

## Decisions

### 1. PostgreSQL 镜像选择：`pgvector/pgvector:pg17`

**选择**：使用 pgvector 官方镜像而非原生 PostgreSQL 镜像手动安装扩展。

**理由**：
- pgvector 官方镜像基于对应版本的 PostgreSQL 官方镜像构建，预装了 pgvector 扩展
- 避免在 entrypoint 脚本中编译安装扩展，简化配置、加快启动
- 标签 `pg17` 锁定 PostgreSQL 大版本，兼顾新特性与稳定性

**备选方案**：
- 原生 PostgreSQL 镜像 + 初始化脚本安装 pgvector：增加复杂度，构建时间长
- 第三方整合镜像（如 ankane/pgvector）：维护不如官方活跃

### 2. Redis 镜像：`redis:7-alpine`

**选择**：使用 Redis 7 Alpine 版本。

**理由**：
- Alpine 镜像体积小（~30MB vs ~130MB），拉取快
- Redis 7 是当前稳定的主要版本，功能完善
- 本地开发无需额外 Redis 模块

### 3. 本地存储目录结构：`~/.prism/`

**选择**：所有数据统一存放在用户主目录下的 `.prism/` 中。

```
~/.prism/
├── data/
│   ├── postgres/    # PostgreSQL 数据文件
│   └── redis/       # Redis 持久化数据
├── conf/
│   ├── postgres/    # PostgreSQL 自定义配置（预留）
│   └── redis/       # Redis 自定义配置（预留）
└── log/
    ├── postgres/    # PostgreSQL 日志（预留）
    └── redis/       # Redis 日志（预留）
```

**理由**：
- 与项目源码分离，避免污染 Git 仓库
- 统一路径便于文档说明和脚本引用
- `~/` 下的隐藏目录是 Unix 工具的惯例（如 `.docker/`、`.npm/`）

**备选方案**：
- 项目内 `.data/` 目录 + `.gitignore`：多项目共存时可能冲突，且与源码耦合
- `/var/lib/prism/`：需要 sudo 权限，不适合开发环境

### 4. 网络模式：自定义 bridge 网络

**选择**：创建名为 `prism-net` 的自定义 bridge 网络。

**理由**：
- 容器间可通过服务名互相访问（DNS 解析）
- 与其他 docker-compose 项目隔离，避免端口和命名冲突

### 5. 初始化脚本

提供 `scripts/init-local-env.sh` 脚本，负责：
- 创建 `~/.prism/` 及其子目录
- 启动 docker-compose
- 等待服务就绪后输出连接信息

## Risks / Trade-offs

- **端口冲突** → 如果开发者本地已有 PostgreSQL/Redis 占用 5432/6379，需手动修改端口或停止本地服务。可在 docker-compose 中通过环境变量支持端口自定义。
- **数据目录权限** → Docker 容器内进程的 UID 可能与宿主机用户不同，导致 `~/.prism/data/` 内文件权限问题。PostgreSQL 容器默认使用 UID 999，需确保目录权限兼容。
- **pgvector 镜像更新滞后** → pgvector 官方镜像可能在 PostgreSQL 新版本发布后延迟更新。使用 `pg17` 标签而非 `latest` 可降低此风险。
