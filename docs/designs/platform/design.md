# 平台基础设施设计

> **文档版本**：v1.0
> **作者**：赵一凡（架构师）
> **适用范围**：shared 共享库、CI/CD 流水线、安全组件、基础设施配置、Neo4j 最小连接层、配置管理体系
> **里程碑**：M1（Phase 2 完成）+ M2（Phase 2.5）

---

## 1. 服务概述

### 1.1 职责定义

平台基础设施不是一个独立服务，而是所有服务共享的底层能力集合。它的核心职责是：

1. **shared 共享库**：提供 DB session factory、JWT 工具、认证中间件（Principal）、通用 Pydantic 模型、统一异常体系
2. **CI/CD 流水线**：ruff + pyright + pytest + import-linter，保障代码质量和依赖方向
3. **安全组件**：API Key 加密存储、审计日志中间件
4. **基础设施配置**：Docker Compose 安全参数、连接池配置（L0 弹性策略）
5. **Neo4j 最小连接层**：连接池 + health check，不含业务逻辑
6. **配置管理体系**：BaseSettings 到各服务 Settings 的继承链

### 1.2 PRD 功能映射

| PRD 功能 | 平台对应组件 | 优先级 |
|----------|-------------|--------|
| F10: voc Schema 独立 | Schema 隔离体系 + Alembic 多 schema 配置 | Must Have |
| F25: Neo4j 最小连接层 | `shared.db.neo4j` 模块 | Must Have |
| F26: 弹性策略 L0 | SQLAlchemy pool_size/max_overflow 显式配置 | Must Have |
| F7: Principal 抽象 | `shared.auth.principal` 中间件 | Must Have |

### 1.3 里程碑

| 里程碑 | 时间 | 交付物 |
|--------|------|--------|
| **M1**（Phase 2 完成） | W0 | shared 基础库（DB session、JWT、异常体系、通用模型）+ CI/CD 流水线 + L0 弹性配置 |
| **M2**（Phase 2.5） | W0 + 3 周 | Principal 中间件（供 Agent 服务使用）+ Neo4j 连接层 + 审计日志中间件 |

### 1.4 不做的事

- shared 不拥有任何数据库表
- shared 不包含任何业务逻辑
- shared 不定义 ORM 模型（各服务自行定义）
- shared 不定义 API 路由

---

## 2. 模块结构

### 2.1 目录树

```
shared/
├── pyproject.toml
└── src/
    └── prism_shared/
        ├── __init__.py
        ├── auth/                     # 认证与授权
        │   ├── __init__.py
        │   ├── jwt.py                # JWT 签发 / 验证工具
        │   ├── deps.py               # FastAPI 认证依赖（get_current_user）
        │   ├── principal.py          # Principal 统一身份中间件
        │   └── api_key.py            # API Key 验证 + 加密存储工具
        ├── db/                       # 数据库连接
        │   ├── __init__.py
        │   ├── session.py            # SQLAlchemy async session factory
        │   ├── base.py               # declarative_base + 通用 Mixin
        │   ├── neo4j.py              # Neo4j 最小连接层
        │   └── pool_config.py        # 连接池配置（L0 弹性）
        ├── schemas/                  # 通用 Pydantic 模型
        │   ├── __init__.py
        │   ├── response.py           # ApiResponse[T], PaginatedResponse[T]
        │   ├── pagination.py         # PaginationParams, PaginatedData
        │   └── error.py              # ErrorResponse, ErrorDetail
        ├── config/                   # 配置管理
        │   ├── __init__.py
        │   └── base.py              # BaseAppSettings（所有服务 Settings 的基类）
        ├── middleware/               # 通用中间件
        │   ├── __init__.py
        │   ├── request_id.py         # X-Request-ID 注入
        │   └── audit.py              # 审计日志中间件
        ├── exceptions.py             # 统一异常体系
        ├── errors.py                 # 域前缀错误码注册表
        └── logging.py               # 结构化日志配置
```

### 2.2 模块职责

| 模块 | 职责 | 暴露接口 |
|------|------|---------|
| `auth.jwt` | JWT token 生成与验证 | `create_access_token()`, `create_refresh_token()`, `decode_token()` |
| `auth.deps` | FastAPI 依赖注入认证 | `get_current_user`, `get_optional_user` |
| `auth.principal` | 统一身份抽象（Human JWT + Agent API Key） | `PrincipalMiddleware`, `Principal`, `get_principal` |
| `auth.api_key` | API Key 加密/验证 | `hash_api_key()`, `verify_api_key()`, `generate_api_key()` |
| `db.session` | 异步 DB session 管理 | `async_session_factory()`, `get_db_session` |
| `db.base` | ORM 基类和通用 Mixin | `Base`, `TimestampMixin`, `UUIDMixin` |
| `db.neo4j` | Neo4j 连接池管理 | `Neo4jPool`, `get_neo4j_session`, `neo4j_health_check()` |
| `db.pool_config` | 连接池参数配置 | `PoolConfig` |
| `schemas.response` | 统一响应封装 | `ApiResponse[T]`, `PaginatedResponse[T]` |
| `config.base` | 配置基类 | `BaseAppSettings` |
| `middleware.request_id` | 请求 ID 链路追踪 | `RequestIdMiddleware` |
| `middleware.audit` | 审计日志 | `AuditMiddleware` |
| `exceptions` | 异常基类 | `AppException`, `NotFoundException`, `AuthenticationException` |
| `errors` | 错误码 | `ErrorCode`, `error_registry` |

### 2.3 依赖方向

```
shared 的依赖（仅外部库，不依赖任何上层服务）:
  ├── fastapi
  ├── sqlalchemy[asyncio]
  ├── pydantic / pydantic-settings
  ├── python-jose[cryptography]    # JWT
  ├── passlib[bcrypt]              # 密码哈希
  ├── neo4j                        # Neo4j Python Driver
  ├── redis                        # Redis 客户端
  └── structlog                    # 结构化日志

上层服务对 shared 的依赖:
  llm-service     → import prism_shared
  user-service    → import prism_shared
  agent-service   → import prism_shared
  voc-service     → import prism_shared
```

**import-linter 规则**（保障依赖方向不可逆）：

```ini
# .importlinter
[importlinter]
root_packages = prism_shared, llm_service, user_service, agent_service

[importlinter:contract:shared-independence]
name = shared 不得依赖任何上层服务
type = forbidden
source_modules =
    prism_shared
forbidden_modules =
    llm_service
    user_service
    agent_service

[importlinter:contract:service-isolation]
name = 服务间不得直接 import
type = forbidden
source_modules =
    llm_service
forbidden_modules =
    user_service
    agent_service
```

---

## 3. 数据模型

### 3.1 设计原则

shared 不拥有任何数据库表。它提供 ORM 基类和 Session Factory，由各服务自行定义模型。

### 3.2 ORM 基类

```python
# shared/src/prism_shared/db/base.py

import uuid
from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """所有 ORM 模型的基类。各服务通过继承此类定义自己的模型。"""
    pass


class UUIDMixin:
    """UUID 主键 Mixin。"""
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )


class TimestampMixin:
    """创建时间 / 更新时间 Mixin。"""
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
```

### 3.3 Schema 隔离体系

每个服务独立 Alembic 迁移，使用不同的 PostgreSQL schema：

| Schema | 服务 | Alembic 配置路径 |
|--------|------|-----------------|
| `auth` | user-service | `user-service/alembic.ini` |
| `llm` | llm-service | `llm-service/alembic.ini` |
| `agent` | agent-service | `agent-service/alembic.ini` |
| `voc` | voc-service（Phase 3） | `voc-service/alembic.ini` |

**Alembic env.py 模板**（各服务参照使用）：

```python
# 各服务 alembic/env.py 的关键配置
from alembic import context

# 指定 schema
SCHEMA_NAME = "agent"  # 各服务替换为自己的 schema

def run_migrations_online():
    connectable = engine_from_config(...)
    with connectable.connect() as connection:
        # 确保 schema 存在
        connection.execute(text(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA_NAME}"))
        connection.commit()

        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            version_table_schema=SCHEMA_NAME,
            include_schemas=[SCHEMA_NAME],
        )
        with context.begin_transaction():
            context.run_migrations()
```

### 3.4 Session Factory

```python
# shared/src/prism_shared/db/session.py

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from prism_shared.db.pool_config import PoolConfig


def create_engine(database_url: str, pool_config: PoolConfig | None = None) -> AsyncEngine:
    """创建异步数据库引擎。"""
    pc = pool_config or PoolConfig()
    return create_async_engine(
        database_url,
        pool_size=pc.pool_size,
        max_overflow=pc.max_overflow,
        pool_timeout=pc.pool_timeout,
        pool_recycle=pc.pool_recycle,
        pool_pre_ping=True,  # L0 弹性：连接有效性预检
        echo=False,
    )


def create_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    """创建异步 session 工厂。"""
    return async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )


async def get_db_session(
    session_factory: async_sessionmaker[AsyncSession],
) -> AsyncSession:
    """FastAPI 依赖：获取数据库 session，自动管理事务。"""
    async with session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
```

### 3.5 ER 图描述

shared 本身不拥有表，但定义了跨服务的 Schema 隔离拓扑：

```
PostgreSQL 实例: prism
├── auth schema (user-service 管理)
│   ├── auth.users
│   └── auth.api_keys
├── llm schema (llm-service 管理)
│   ├── llm.providers
│   ├── llm.model_slots
│   └── llm.usage_logs
├── agent schema (agent-service 管理)
│   ├── agent.skill_definitions
│   └── agent.execution_logs
└── voc schema (voc-service 管理, Phase 3)
    ├── voc.voices
    ├── voc.semantic_units
    ├── voc.emergent_tags
    ├── voc.unit_tag_associations
    └── voc.tag_feedback

跨 Schema 引用：
  voc.tag_feedback.user_id → auth.users.id  (唯一允许的跨 schema 外键)
```

---

## 4. API 设计

shared 不直接暴露 API，但提供统一的请求/响应模型供所有服务使用。

### 4.1 统一响应模型

```python
# shared/src/prism_shared/schemas/response.py

from datetime import datetime
from typing import Generic, TypeVar
from uuid import UUID, uuid4

from pydantic import BaseModel, Field

T = TypeVar("T")


class Meta(BaseModel):
    """响应元信息。"""
    request_id: UUID = Field(default_factory=uuid4)
    timestamp: datetime = Field(default_factory=datetime.now)


class ApiResponse(BaseModel, Generic[T]):
    """统一成功响应。"""
    data: T
    meta: Meta = Field(default_factory=Meta)


class ErrorDetail(BaseModel):
    """错误详情。"""
    code: str
    message: str
    details: dict | None = None


class ErrorResponse(BaseModel):
    """统一错误响应。"""
    error: ErrorDetail
    meta: Meta = Field(default_factory=Meta)


class PaginationMeta(BaseModel):
    """分页信息。"""
    page: int
    page_size: int
    total: int


class PaginatedResponse(BaseModel, Generic[T]):
    """统一分页响应。"""
    data: list[T]
    pagination: PaginationMeta
    meta: Meta = Field(default_factory=Meta)
```

### 4.2 统一错误码体系

```python
# shared/src/prism_shared/errors.py

from enum import StrEnum


class ErrorDomain(StrEnum):
    """错误码域前缀。"""
    SHARED = "SHARED"
    AUTH = "AUTH"
    LLM = "LLM"
    AGENT = "AGENT"
    VOC = "VOC"


# 各域错误码范围：
#   SHARED: 10000-19999
#   AUTH:   20000-29999
#   LLM:   30000-39999
#   AGENT:  40000-49999
#   VOC:    50000-59999
#   DATA-INGESTION: 60000-69999

class SharedErrorCode(StrEnum):
    """shared 层通用错误码。"""
    INTERNAL_ERROR = "SHARED_INTERNAL_ERROR"
    VALIDATION_ERROR = "SHARED_VALIDATION_ERROR"
    NOT_FOUND = "SHARED_NOT_FOUND"
    UNAUTHORIZED = "SHARED_UNAUTHORIZED"
    FORBIDDEN = "SHARED_FORBIDDEN"
    DATABASE_ERROR = "SHARED_DATABASE_ERROR"
    REDIS_ERROR = "SHARED_REDIS_ERROR"
    NEO4J_ERROR = "SHARED_NEO4J_ERROR"
    RATE_LIMITED = "SHARED_RATE_LIMITED"
```

### 4.3 Health Check 端点模板

```python
# 各服务复用的 health check 端点模式

from fastapi import APIRouter
from prism_shared.schemas.response import ApiResponse

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check() -> ApiResponse[dict]:
    """健康检查端点（各服务必须实现）。"""
    return ApiResponse(data={
        "status": "healthy",
        "service": "SERVICE_NAME",  # 各服务替换
        "version": "0.1.0",
    })
```

---

## 5. 核心流程

### 5.1 认证流程（Principal 中间件）

```mermaid
sequenceDiagram
    participant Client
    participant Middleware as PrincipalMiddleware
    participant JWTVerifier as JWT 验证
    participant APIKeyVerifier as API Key 验证
    participant Handler as 业务处理器

    Client->>Middleware: HTTP Request
    Middleware->>Middleware: 检查 Authorization Header

    alt Bearer Token（Human 用户）
        Middleware->>JWTVerifier: decode_token(token)
        JWTVerifier-->>Middleware: TokenPayload{user_id, email, role}
        Middleware->>Middleware: 构造 Principal(type="human", id=user_id)
    else X-API-Key Header（Agent）
        Middleware->>APIKeyVerifier: verify_api_key(key)
        APIKeyVerifier-->>Middleware: APIKeyInfo{key_id, user_id, name}
        Middleware->>Middleware: 构造 Principal(type="agent", id=key_id)
    else 无认证头
        Middleware-->>Client: 401 SHARED_UNAUTHORIZED
    end

    Middleware->>Handler: request.state.principal = Principal
    Handler->>Handler: 执行业务逻辑
    Handler-->>Client: 200 ApiResponse
```

### 5.2 数据库 Session 生命周期

```mermaid
sequenceDiagram
    participant FastAPI as FastAPI 框架
    participant Dep as get_db_session 依赖
    participant SF as SessionFactory
    participant DB as PostgreSQL

    FastAPI->>Dep: 注入依赖
    Dep->>SF: async_sessionmaker()
    SF->>DB: 从连接池获取连接
    DB-->>SF: Connection
    SF-->>Dep: AsyncSession
    Dep-->>FastAPI: yield session

    Note over FastAPI: 业务逻辑执行...

    alt 无异常
        FastAPI->>Dep: 退出 yield
        Dep->>DB: session.commit()
    else 抛出异常
        FastAPI->>Dep: 异常传播
        Dep->>DB: session.rollback()
    end

    Dep->>DB: session.close()（归还连接到池）
```

### 5.3 Neo4j 连接生命周期

```mermaid
sequenceDiagram
    participant Service as 业务服务
    participant Pool as Neo4jPool
    participant Driver as Neo4j Driver
    participant Neo4j as Neo4j Server

    Note over Pool: 应用启动时初始化连接池

    Service->>Pool: get_session()
    Pool->>Driver: driver.session()
    Driver->>Neo4j: 从连接池获取连接
    Neo4j-->>Driver: Bolt Connection
    Driver-->>Pool: Neo4j Session
    Pool-->>Service: yield session

    Note over Service: 执行图查询...

    Service->>Pool: 退出上下文
    Pool->>Driver: session.close()
    Driver->>Neo4j: 归还连接到池

    Note over Pool: 定期 health check

    Pool->>Driver: driver.verify_connectivity()
    Driver->>Neo4j: RETURN 1
    Neo4j-->>Driver: OK
    Driver-->>Pool: 连接正常
```

### 5.4 审计日志中间件流程

```mermaid
sequenceDiagram
    participant Client
    participant AuditMW as AuditMiddleware
    participant Handler as 业务处理器
    participant Logger as 结构化日志

    Client->>AuditMW: HTTP Request
    AuditMW->>AuditMW: 记录请求开始时间
    AuditMW->>AuditMW: 提取 Principal 信息
    AuditMW->>Handler: 转发请求

    Handler-->>AuditMW: 响应

    AuditMW->>AuditMW: 计算 duration_ms
    AuditMW->>Logger: 写入审计记录
    Note over Logger: {principal_type, principal_id,<br/>method, path, status_code,<br/>duration_ms, request_id}

    AuditMW-->>Client: 响应
```

---

## 6. 关键实现

### 6.1 Principal 统一身份抽象

```python
# shared/src/prism_shared/auth/principal.py

from dataclasses import dataclass
from enum import StrEnum
from typing import Any
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from prism_shared.auth.jwt import decode_token
from prism_shared.auth.api_key import verify_api_key


class PrincipalType(StrEnum):
    HUMAN = "human"
    AGENT = "agent"


@dataclass(frozen=True)
class Principal:
    """统一身份对象。Type 1 决策——一旦定义，所有上游服务必须遵循。"""
    type: PrincipalType
    id: str                          # human: user_id; agent: api_key_id
    display_name: str                # human: username; agent: key_name
    owner_id: str | None = None      # agent 关联的 human user_id
    metadata: dict[str, Any] | None = None


class PrincipalMiddleware(BaseHTTPMiddleware):
    """
    认证中间件：从 JWT 或 API Key 解析出 Principal，注入 request.state。
    跳过 health check 和 docs 端点。
    """

    SKIP_PATHS = {"/health", "/docs", "/openapi.json", "/redoc"}

    def __init__(self, app, api_key_verifier=None, jwt_secret: str = ""):
        super().__init__(app)
        self._api_key_verifier = api_key_verifier
        self._jwt_secret = jwt_secret

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        if request.url.path in self.SKIP_PATHS:
            return await call_next(request)

        # 尝试 Bearer Token
        auth_header = request.headers.get("Authorization", "")
        api_key_header = request.headers.get("X-API-Key", "")

        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            payload = decode_token(token, self._jwt_secret)
            if payload is None:
                return _unauthorized_response("无效或过期的 JWT token")
            request.state.principal = Principal(
                type=PrincipalType.HUMAN,
                id=str(payload["sub"]),
                display_name=payload.get("username", "unknown"),
            )
        elif api_key_header:
            key_info = await self._api_key_verifier(api_key_header)
            if key_info is None:
                return _unauthorized_response("无效的 API Key")
            request.state.principal = Principal(
                type=PrincipalType.AGENT,
                id=str(key_info["key_id"]),
                display_name=key_info.get("name", "agent"),
                owner_id=str(key_info["user_id"]),
            )
        else:
            return _unauthorized_response("缺少认证信息")

        return await call_next(request)


def get_principal(request: Request) -> Principal:
    """FastAPI 依赖：获取当前请求的 Principal。"""
    principal = getattr(request.state, "principal", None)
    if principal is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未认证",
        )
    return principal


def require_human(principal: Principal = Depends(get_principal)) -> Principal:
    """FastAPI 依赖：要求 Human 类型的 Principal。"""
    if principal.type != PrincipalType.HUMAN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="此操作仅限人类用户",
        )
    return principal
```

### 6.2 JWT 工具

```python
# shared/src/prism_shared/auth/jwt.py

from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt


def create_access_token(
    data: dict[str, Any],
    secret: str,
    expires_delta: timedelta = timedelta(hours=1),
    algorithm: str = "HS256",
) -> str:
    """生成 access token。"""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, secret, algorithm=algorithm)


def create_refresh_token(
    data: dict[str, Any],
    secret: str,
    expires_delta: timedelta = timedelta(days=7),
    algorithm: str = "HS256",
) -> str:
    """生成 refresh token。"""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, secret, algorithm=algorithm)


def decode_token(
    token: str,
    secret: str,
    algorithm: str = "HS256",
) -> dict[str, Any] | None:
    """解码并验证 token。返回 None 表示验证失败。"""
    try:
        payload = jwt.decode(token, secret, algorithms=[algorithm])
        if payload.get("exp") and datetime.fromtimestamp(
            payload["exp"], tz=timezone.utc
        ) < datetime.now(timezone.utc):
            return None
        return payload
    except JWTError:
        return None
```

### 6.3 API Key 加密存储

```python
# shared/src/prism_shared/auth/api_key.py

import hashlib
import secrets
from typing import Any


API_KEY_PREFIX = "prism_"
API_KEY_LENGTH = 32  # 不含前缀


def generate_api_key() -> tuple[str, str]:
    """
    生成 API Key。返回 (明文 key, hash)。
    明文 key 仅在创建时返回给用户，之后仅存储 hash。
    """
    raw = secrets.token_urlsafe(API_KEY_LENGTH)
    full_key = f"{API_KEY_PREFIX}{raw}"
    key_hash = _hash_key(full_key)
    return full_key, key_hash


def hash_api_key(plain_key: str) -> str:
    """对明文 API Key 计算 SHA-256 hash。"""
    return _hash_key(plain_key)


def verify_api_key(plain_key: str, stored_hash: str) -> bool:
    """验证 API Key 是否匹配。"""
    return _hash_key(plain_key) == stored_hash


def get_key_prefix(plain_key: str) -> str:
    """提取 key 前缀用于列表展示（如 prism_xxxx****）。"""
    if len(plain_key) <= 10:
        return plain_key[:4] + "****"
    return plain_key[:10] + "****"


def _hash_key(key: str) -> str:
    """SHA-256 哈希。"""
    return hashlib.sha256(key.encode("utf-8")).hexdigest()
```

### 6.4 Neo4j 最小连接层

```python
# shared/src/prism_shared/db/neo4j.py

from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
from neo4j import AsyncDriver, AsyncGraphDatabase, AsyncSession

logger = structlog.get_logger(__name__)


class Neo4jPool:
    """
    Neo4j 最小连接层。Phase 1 仅提供：
    - 连接池管理
    - Health check
    - Session 获取

    不含任何业务逻辑。Phase 2 启用知识图谱时通过 label 前缀隔离域。
    """

    def __init__(
        self,
        uri: str = "bolt://prism.test:7687",
        username: str = "neo4j",
        password: str = "prism",
        max_connection_pool_size: int = 10,
        connection_acquisition_timeout: float = 30.0,
    ):
        self._uri = uri
        self._username = username
        self._password = password
        self._driver: AsyncDriver | None = None
        self._max_pool_size = max_connection_pool_size
        self._acquisition_timeout = connection_acquisition_timeout

    async def connect(self) -> None:
        """初始化连接池。应在应用启动时调用。"""
        self._driver = AsyncGraphDatabase.driver(
            self._uri,
            auth=(self._username, self._password),
            max_connection_pool_size=self._max_pool_size,
            connection_acquisition_timeout=self._acquisition_timeout,
        )
        logger.info("neo4j_pool_initialized", uri=self._uri)

    async def close(self) -> None:
        """关闭连接池。应在应用关闭时调用。"""
        if self._driver:
            await self._driver.close()
            self._driver = None
            logger.info("neo4j_pool_closed")

    async def health_check(self) -> bool:
        """
        Health check：验证 Neo4j 连接可用性。
        返回 True 表示连接正常，False 表示异常。
        """
        if not self._driver:
            return False
        try:
            await self._driver.verify_connectivity()
            return True
        except Exception as e:
            logger.warning("neo4j_health_check_failed", error=str(e))
            return False

    @asynccontextmanager
    async def get_session(
        self, database: str = "neo4j"
    ) -> AsyncGenerator[AsyncSession, None]:
        """获取 Neo4j session（上下文管理器）。"""
        if not self._driver:
            raise RuntimeError("Neo4j pool 未初始化，请先调用 connect()")
        async with self._driver.session(database=database) as session:
            yield session
```

### 6.5 连接池配置（L0 弹性策略）

```python
# shared/src/prism_shared/db/pool_config.py

from pydantic import Field
from pydantic_settings import BaseSettings


class PoolConfig(BaseSettings):
    """
    数据库连接池配置。L0 弹性策略的核心参数。

    调优原则：
    - pool_size: 常驻连接数，按服务并发量设置
    - max_overflow: 峰值额外连接，超过后新请求等待
    - pool_timeout: 等待连接的超时时间
    - pool_recycle: 连接最大存活时间（防止 PG 端超时断开）
    """

    pool_size: int = Field(
        default=5,
        description="常驻连接数",
        ge=1,
        le=50,
    )
    max_overflow: int = Field(
        default=10,
        description="允许的额外临时连接数",
        ge=0,
        le=100,
    )
    pool_timeout: int = Field(
        default=30,
        description="等待可用连接的超时时间（秒）",
        ge=5,
        le=120,
    )
    pool_recycle: int = Field(
        default=3600,
        description="连接最大存活时间（秒），防止服务端超时断开",
        ge=300,
        le=7200,
    )

    model_config = {"env_prefix": "DB_POOL_"}
```

### 6.6 配置管理基类

```python
# shared/src/prism_shared/config/base.py

from pydantic_settings import BaseSettings, SettingsConfigDict


class BaseAppSettings(BaseSettings):
    """
    所有服务 Settings 的基类。
    各服务继承并添加自己的配置项。
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- 通用配置 ---
    app_name: str = "prism"
    debug: bool = False
    log_level: str = "INFO"

    # --- 数据库 ---
    database_url: str = "postgresql+asyncpg://prism:prism@prism.test:5432/prism"

    # --- Redis ---
    redis_url: str = "redis://prism.test:6379/0"

    # --- JWT ---
    jwt_secret: str = "change-me-in-production"
    jwt_access_token_expire_minutes: int = 60
    jwt_refresh_token_expire_days: int = 7

    # --- Neo4j ---
    neo4j_uri: str = "bolt://prism.test:7687"
    neo4j_username: str = "neo4j"
    neo4j_password: str = "prism"
```

各服务继承示例：

```python
# agent-service/src/agent_service/config.py

from prism_shared.config.base import BaseAppSettings


class AgentSettings(BaseAppSettings):
    """Agent 服务配置。"""

    model_config = {"env_prefix": "AGENT_"}

    # Agent 特有配置
    max_iterations: int = 10
    iteration_timeout_seconds: int = 60
    max_tokens_per_iteration: int = 8192
    skill_config_path: str = "configs/skills.yaml"
```

### 6.7 统一异常体系

```python
# shared/src/prism_shared/exceptions.py

from typing import Any


class AppException(Exception):
    """
    统一异常基类。所有业务异常必须继承此类。
    各服务通过 exception handler 将其转换为 ErrorResponse。
    """

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 500,
        details: dict[str, Any] | None = None,
    ):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details
        super().__init__(message)


class NotFoundException(AppException):
    def __init__(self, resource: str, resource_id: str | None = None):
        msg = f"{resource} 不存在"
        if resource_id:
            msg = f"{resource}({resource_id}) 不存在"
        super().__init__(
            code="SHARED_NOT_FOUND",
            message=msg,
            status_code=404,
        )


class AuthenticationException(AppException):
    def __init__(self, message: str = "认证失败"):
        super().__init__(
            code="SHARED_UNAUTHORIZED",
            message=message,
            status_code=401,
        )


class ForbiddenException(AppException):
    def __init__(self, message: str = "权限不足"):
        super().__init__(
            code="SHARED_FORBIDDEN",
            message=message,
            status_code=403,
        )


class ValidationException(AppException):
    def __init__(self, message: str, details: dict | None = None):
        super().__init__(
            code="SHARED_VALIDATION_ERROR",
            message=message,
            status_code=422,
            details=details,
        )
```

**FastAPI Exception Handler**（各服务注册）：

```python
# 各服务 main.py 中注册

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from prism_shared.exceptions import AppException
from prism_shared.schemas.response import ErrorDetail, ErrorResponse, Meta

app = FastAPI()


@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            error=ErrorDetail(
                code=exc.code,
                message=exc.message,
                details=exc.details,
            ),
            meta=Meta(request_id=request.state.request_id),
        ).model_dump(mode="json"),
    )
```

### 6.8 审计日志中间件

```python
# shared/src/prism_shared/middleware/audit.py

import time
from typing import Callable

import structlog
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

logger = structlog.get_logger("audit")


class AuditMiddleware(BaseHTTPMiddleware):
    """
    审计日志中间件。记录所有 API 请求的 Principal、方法、路径、状态码、耗时。
    Phase 1 输出到结构化日志；Phase 2+ 可扩展到持久化存储。
    """

    SKIP_PATHS = {"/health", "/docs", "/openapi.json", "/redoc"}

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        if request.url.path in self.SKIP_PATHS:
            return await call_next(request)

        start_time = time.monotonic()
        response = await call_next(request)
        duration_ms = int((time.monotonic() - start_time) * 1000)

        principal = getattr(request.state, "principal", None)
        request_id = getattr(request.state, "request_id", "unknown")

        logger.info(
            "api_audit",
            request_id=str(request_id),
            principal_type=principal.type if principal else "anonymous",
            principal_id=principal.id if principal else None,
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=duration_ms,
            query_params=str(request.query_params) if request.query_params else None,
        )

        return response
```

### 6.9 CI/CD 流水线设计

```yaml
# .github/workflows/ci.yml (设计参考)

name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v3
      - run: uv sync --all-packages
      - name: ruff check
        run: uv run ruff check .
      - name: ruff format check
        run: uv run ruff format --check .

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v3
      - run: uv sync --all-packages
      - name: pyright
        run: uv run pyright

  dependency-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v3
      - run: uv sync --all-packages
      - name: import-linter
        run: uv run lint-imports

  test-shared:
    runs-on: ubuntu-latest
    needs: [lint, typecheck, dependency-check]
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v3
      - run: uv sync --all-packages
      - name: pytest shared
        run: uv run pytest shared/tests/ -v --tb=short

  test-services:
    runs-on: ubuntu-latest
    needs: [test-shared]
    strategy:
      matrix:
        service: [llm-service, user-service, agent-service]
    services:
      postgres:
        image: pgvector/pgvector:pg17
        env:
          POSTGRES_USER: prism
          POSTGRES_PASSWORD: prism
          POSTGRES_DB: prism
        ports: ["5432:5432"]
      redis:
        image: redis:7-alpine
        ports: ["6379:6379"]
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v3
      - run: uv sync --all-packages
      - name: pytest ${{ matrix.service }}
        run: uv run pytest ${{ matrix.service }}/tests/ -v --tb=short
        env:
          DATABASE_URL: postgresql+asyncpg://prism:prism@prism.test:5432/prism
          REDIS_URL: redis://prism.test:6379/0
```

**CI 隔离原则**：
- 各服务的测试完全独立运行（matrix 策略）
- shared 测试优先执行，作为其他服务测试的前置
- lint、typecheck、dependency-check 三个检查并行
- 集成测试使用 GitHub Actions services 提供真实数据库

---

## 7. 错误处理与弹性

### 7.1 异常分类

| 分类 | 异常类型 | HTTP 状态码 | 处理策略 |
|------|---------|-----------|---------|
| 客户端错误 | `ValidationException` | 422 | 直接返回错误详情 |
| 认证失败 | `AuthenticationException` | 401 | 返回错误码，不暴露内部细节 |
| 权限不足 | `ForbiddenException` | 403 | 返回错误码 |
| 资源不存在 | `NotFoundException` | 404 | 返回错误码 + 资源标识 |
| 数据库错误 | `AppException(SHARED_DATABASE_ERROR)` | 500 | 日志记录完整堆栈，返回模糊错误信息 |
| Redis 错误 | `AppException(SHARED_REDIS_ERROR)` | 500 | Phase 1: 日志记录; L3 弹性: 降级到 DB 直查 |
| Neo4j 错误 | `AppException(SHARED_NEO4J_ERROR)` | 500 | Phase 1: 记录日志，不影响核心流程 |
| 未预期异常 | `Exception` | 500 | 全局 handler 捕获，日志记录，返回 INTERNAL_ERROR |

### 7.2 L0 弹性策略

```python
# L0 弹性核心：连接池配置 + pool_pre_ping

# 1. SQLAlchemy 连接池
engine = create_async_engine(
    database_url,
    pool_size=5,          # 常驻 5 个连接
    max_overflow=10,      # 峰值允许额外 10 个
    pool_timeout=30,      # 等待可用连接超时 30s
    pool_recycle=3600,    # 连接 1 小时后回收重建
    pool_pre_ping=True,   # 每次使用前验证连接有效性
)

# 2. Redis 连接池（通过 redis-py 内置池）
redis_pool = redis.ConnectionPool.from_url(
    redis_url,
    max_connections=20,
    socket_timeout=5,
    socket_connect_timeout=5,
    retry_on_timeout=True,
)

# 3. Neo4j 连接池
neo4j_pool = Neo4jPool(
    uri=neo4j_uri,
    max_connection_pool_size=10,
    connection_acquisition_timeout=30.0,
)
```

### 7.3 Docker Compose 安全参数

```yaml
# docker-compose.yml 中的安全增强配置（设计规范）

services:
  postgres:
    # L0 弹性：health check 确保容器就绪后才接受连接
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U prism"]
      interval: 5s
      timeout: 3s
      retries: 5
    # 安全：限制资源使用
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: "2.0"

  redis:
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: "0.5"

  neo4j:
    healthcheck:
      test: ["CMD", "cypher-shell", "-u", "neo4j", "-p", "prism", "RETURN 1"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: "1.0"
```

### 7.4 结构化日志

**架构**：`structlog → stdlib logging → FileHandler`

- structlog 负责结构化处理（字段注入、格式化）
- stdlib logging 负责输出路由（文件滚动、大小控制）

**日志文件滚动策略**：

| 策略 | 说明 |
|------|------|
| 按天滚动 | `TimedRotatingFileHandler(when="midnight")`，每日产生新归档 |
| 按大小追加序号 | 单文件超过 `log_file_max_mb`（默认 50MB）时追加序号 `prism.YYYY-MM-DD.N.log` |
| 空间上限 | `log_max_size_mb`（默认 200MB），超限时删除最旧归档文件 |
| 保留天数 | `log_rotation_days`（默认 7 天），自动清理过期归档 |

**service / module 字段自动注入**：

`add_service_context` processor 在每条日志中自动注入：
- `service`：优先使用 `configure_logging(service_name=...)` 传入的值；统一开发服务器中按 `__name__` 前缀推导（`voc_service.*` → `voc-service`）
- `module`：从 `__name__` 提取第二级包名（`voc_service.pipeline.stage1` → `pipeline`）

**开发模式双输出**：

`json_output=False` 时同时输出到控制台（ConsoleRenderer）和文件（JSONRenderer），文件始终 JSON 格式以支持查询 API。

**配置项**（`BaseAppSettings`）：

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `log_dir` | `~/.prism/log/app` | 日志目录 |
| `log_max_size_mb` | `200` | 日志目录总大小上限 |
| `log_rotation_days` | `7` | 归档保留天数 |
| `log_file_max_mb` | `50` | 单文件大小上限 |

**日志查询 API**（`shared/platform/`）：

| 端点 | 说明 |
|------|------|
| `GET /api/platform/logs` | 分页查询日志，支持 service/module/level/时间范围筛选，倒序排列，扫描上限 10,000 行 |
| `GET /api/platform/logs/filters` | 获取可用筛选值（services/modules/levels） |

查询引擎基于文件扫描，逐行 JSON 解析，按归档文件名中的日期跳过不相关文件。响应复用 `PaginatedResponse`，额外追加 `truncated` 字段标识扫描是否达到上限。

认证采用轻量 JWT-only 方式（`_require_auth`），仅校验 token 有效性，不查询数据库。

---

## 8. 测试计划

### 8.1 单元测试

| 模块 | 测试范围 | 策略 |
|------|---------|------|
| `auth.jwt` | token 生成、验证、过期处理 | 纯函数测试，无外部依赖 |
| `auth.principal` | Principal 构造、PrincipalMiddleware 逻辑 | Mock HTTP request |
| `auth.api_key` | key 生成、hash、验证 | 纯函数测试 |
| `db.pool_config` | 配置校验、边界值 | Pydantic 模型测试 |
| `schemas.response` | 序列化/反序列化 | Pydantic 模型测试 |
| `exceptions` | 异常构造、属性 | 纯 Python 测试 |

```python
# shared/tests/unit/test_jwt.py

import pytest
from datetime import timedelta
from prism_shared.auth.jwt import create_access_token, decode_token

SECRET = "test-secret"


def test_create_and_decode_access_token():
    token = create_access_token(
        data={"sub": "user-123", "username": "testuser"},
        secret=SECRET,
    )
    payload = decode_token(token, SECRET)
    assert payload is not None
    assert payload["sub"] == "user-123"
    assert payload["type"] == "access"


def test_expired_token_returns_none():
    token = create_access_token(
        data={"sub": "user-123"},
        secret=SECRET,
        expires_delta=timedelta(seconds=-1),  # 已过期
    )
    assert decode_token(token, SECRET) is None


def test_invalid_token_returns_none():
    assert decode_token("invalid.token.here", SECRET) is None
```

### 8.2 集成测试

| 模块 | 测试范围 | 外部依赖 | Mock 策略 |
|------|---------|---------|----------|
| `db.session` | session 创建、事务提交/回滚 | PostgreSQL | 使用真实 testcontainers 或 CI services |
| `db.neo4j` | 连接池、health check、session 获取 | Neo4j | CI services 或 testcontainers |
| `middleware.audit` | 审计日志输出格式 | 无 | Mock logger |
| `auth.principal` + `auth.deps` | 端到端认证流程 | 无 | ASGI TestClient |

```python
# shared/tests/integration/test_db_session.py

import pytest
from sqlalchemy import text

from prism_shared.db.session import create_engine, create_session_factory
from prism_shared.db.pool_config import PoolConfig

DATABASE_URL = "postgresql+asyncpg://prism:prism@prism.test:5432/prism"


@pytest.fixture
async def session_factory():
    engine = create_engine(DATABASE_URL, PoolConfig(pool_size=2, max_overflow=3))
    factory = create_session_factory(engine)
    yield factory
    await engine.dispose()


@pytest.mark.asyncio
async def test_session_commit(session_factory):
    async with session_factory() as session:
        result = await session.execute(text("SELECT 1"))
        assert result.scalar() == 1


@pytest.mark.asyncio
async def test_session_rollback_on_error(session_factory):
    async with session_factory() as session:
        with pytest.raises(Exception):
            await session.execute(text("SELECT 1/0"))
```

```python
# shared/tests/integration/test_neo4j.py

import pytest
from prism_shared.db.neo4j import Neo4jPool


@pytest.fixture
async def neo4j_pool():
    pool = Neo4jPool(uri="bolt://prism.test:7687", username="neo4j", password="prism")
    await pool.connect()
    yield pool
    await pool.close()


@pytest.mark.asyncio
async def test_neo4j_health_check(neo4j_pool):
    assert await neo4j_pool.health_check() is True


@pytest.mark.asyncio
async def test_neo4j_session_query(neo4j_pool):
    async with neo4j_pool.get_session() as session:
        result = await session.run("RETURN 1 AS n")
        record = await result.single()
        assert record["n"] == 1
```

### 8.3 Mock 策略

| 场景 | Mock 方式 | 理由 |
|------|----------|------|
| JWT 验证 | 直接构造 token | 纯计算，无需 Mock |
| DB session | testcontainers / CI services | 集成测试必须验证真实 SQL |
| Neo4j | testcontainers / CI services | 验证 Bolt 协议兼容性 |
| Redis | fakeredis | 单元测试中 Mock Redis |
| Principal 中间件 | ASGI TestClient + mock headers | 验证请求解析逻辑 |
| 审计日志 | Mock structlog | 验证日志格式和字段 |

---

## 9. 里程碑与工时

### 9.1 M1 任务拆解（Phase 2 完成）

| 任务 | 工时 | 依赖 | 交付物 |
|------|------|------|--------|
| T1: shared 项目脚手架 | 0.5 天 | 无 | pyproject.toml, `__init__.py`, 目录结构 |
| T2: DB session + pool_config | 1 天 | T1 | `db/session.py`, `db/pool_config.py`, `db/base.py` |
| T3: JWT 工具 | 0.5 天 | T1 | `auth/jwt.py` |
| T4: API Key 工具 | 0.5 天 | T1 | `auth/api_key.py` |
| T5: 统一异常体系 | 0.5 天 | T1 | `exceptions.py`, `errors.py` |
| T6: 通用 Pydantic 模型 | 0.5 天 | T5 | `schemas/response.py`, `schemas/pagination.py`, `schemas/error.py` |
| T7: 配置管理基类 | 0.5 天 | T1 | `config/base.py` |
| T8: 结构化日志 | 0.5 天 | T1 | `logging.py` |
| T9: Request-ID 中间件 | 0.5 天 | T6 | `middleware/request_id.py` |
| T10: CI/CD 流水线 | 1 天 | T1-T9 | `.github/workflows/ci.yml`, `.importlinter`, `ruff.toml` |
| T11: 单元测试 | 1 天 | T2-T9 | `shared/tests/unit/` |
| **M1 合计** | **7 天** | | |

### 9.2 M2 任务拆解（Phase 2.5）

| 任务 | 工时 | 依赖 | 交付物 |
|------|------|------|--------|
| T12: Principal 中间件 | 1.5 天 | T3, T4 | `auth/principal.py`, `auth/deps.py` 更新 |
| T13: Neo4j 连接层 | 1 天 | T7 | `db/neo4j.py` |
| T14: 审计日志中间件 | 0.5 天 | T12, T8 | `middleware/audit.py` |
| T15: 集成测试 | 1 天 | T12-T14 | `shared/tests/integration/` |
| T16: import-linter 规则完善 | 0.5 天 | T10 | `.importlinter` 更新 |
| **M2 合计** | **4.5 天** | | |

### 9.3 总工时

| 阶段 | 工时 | 人力 |
|------|------|------|
| M1（Phase 2 完成） | 7 天 | 后端 x1 |
| M2（Phase 2.5） | 4.5 天 | 后端 x1 |
| **合计** | **11.5 天** | |

### 9.4 检查清单

**M1 验收**：
- [ ] `uv run ruff check shared/` 无错误
- [ ] `uv run ruff format --check shared/` 无差异
- [ ] `uv run pytest shared/tests/unit/ -v` 全部通过
- [ ] `uv run lint-imports` 依赖方向检查通过
- [ ] DB session 可连接 PostgreSQL 并执行查询
- [ ] JWT token 生成/验证正常
- [ ] API Key 生成/hash/验证正常
- [ ] 统一响应模型可正确序列化
- [ ] 异常可被 FastAPI exception handler 正确捕获并返回 ErrorResponse

**M2 验收**：
- [ ] PrincipalMiddleware 可从 JWT 解析出 Human Principal
- [ ] PrincipalMiddleware 可从 API Key 解析出 Agent Principal
- [ ] 无认证请求被正确拒绝（401）
- [ ] Neo4j health check 返回 True（容器运行时）
- [ ] Neo4j session 可执行简单 Cypher 查询
- [ ] 审计日志中间件输出结构化 JSON 日志
- [ ] import-linter 检查 agent-service 对 shared 的依赖方向
- [ ] `uv run pytest shared/tests/ -v` 全部通过（含集成测试）
