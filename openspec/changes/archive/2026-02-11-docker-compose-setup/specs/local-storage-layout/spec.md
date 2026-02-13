## ADDED Requirements

### Requirement: 创建统一的本地存储根目录
系统 SHALL 使用 `~/.prism/` 作为项目本地存储的根目录。

#### Scenario: 根目录自动创建
- **WHEN** 执行初始化脚本
- **THEN** `~/.prism/` 目录被创建（如不存在）

### Requirement: 数据目录结构
系统 SHALL 在 `~/.prism/data/` 下为每个基础服务创建独立的数据子目录。

#### Scenario: 数据子目录创建
- **WHEN** 执行初始化脚本
- **THEN** 以下目录被创建：`~/.prism/data/postgres/`、`~/.prism/data/redis/`

### Requirement: 配置目录结构
系统 SHALL 在 `~/.prism/conf/` 下为每个基础服务预留独立的配置子目录。

#### Scenario: 配置子目录创建
- **WHEN** 执行初始化脚本
- **THEN** 以下目录被创建：`~/.prism/conf/postgres/`、`~/.prism/conf/redis/`

### Requirement: 日志目录结构
系统 SHALL 在 `~/.prism/log/` 下为每个基础服务预留独立的日志子目录。

#### Scenario: 日志子目录创建
- **WHEN** 执行初始化脚本
- **THEN** 以下目录被创建：`~/.prism/log/postgres/`、`~/.prism/log/redis/`

### Requirement: 初始化脚本
系统 SHALL 提供 `scripts/init-local-env.sh` 脚本，一键完成目录创建与服务启动。

#### Scenario: 首次初始化
- **WHEN** 在全新环境中执行 `scripts/init-local-env.sh`
- **THEN** 所有 `~/.prism/` 子目录被创建，docker-compose 服务启动成功，脚本输出各服务的连接信息

#### Scenario: 重复执行幂等
- **WHEN** 目录已存在时再次执行 `scripts/init-local-env.sh`
- **THEN** 脚本正常完成，不报错，不覆盖已有数据
