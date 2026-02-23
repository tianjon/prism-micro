"""Prism 统一开发服务器。

本地开发时将 user-service、llm-service、voc-service、agent-service 的路由挂载到同一个 FastAPI 实例，
前端通过 Vite 代理 /api/* 到此端口（默认 8601）。

启动方式：
    uv run uvicorn main:app --host 0.0.0.0 --port 8601 --reload
"""

import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from llm_service.api.router import api_router as llm_router
from llm_service.core.config import LLMServiceSettings
from prism_shared.auth import PrincipalMiddleware, create_db_api_key_verifier
from prism_shared.db import PoolConfig, create_engine, create_session_factory
from prism_shared.exception_handlers import register_exception_handlers
from prism_shared.logging import configure_logging
from prism_shared.middleware import AuditMiddleware, RequestIdMiddleware
from prism_shared.platform.log_routes import router as platform_router
from prism_shared.schemas import ApiResponse
from user_service.api.router import router as user_router
from user_service.core.config import UserServiceSettings
from voc_service.api.router import api_router as voc_router
from voc_service.core.config import VocServiceSettings

try:
    from agent_service.api.router import router as agent_router
    from agent_service.core.config import AgentServiceSettings
except ModuleNotFoundError:
    # workspace 模式下兜底，避免 agent-service 未安装到环境时报错
    agent_src = Path(__file__).resolve().parent / "agent-service" / "src"
    if agent_src.exists():
        sys.path.append(str(agent_src))
        from agent_service.api.router import router as agent_router
        from agent_service.core.config import AgentServiceSettings
    else:  # pragma: no cover
        raise


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理。"""
    yield
    # 关闭数据库引擎
    if hasattr(app.state, "engine"):
        await app.state.engine.dispose()


def create_app() -> FastAPI:
    """创建统一开发服务器。"""
    user_settings = UserServiceSettings()
    llm_settings = LLMServiceSettings()
    voc_settings = VocServiceSettings()
    agent_settings = AgentServiceSettings()
    os.environ.setdefault("PRISM_LLM_RUNTIME_MODE", llm_settings.llm_runtime_mode)
    os.environ.setdefault(
        "PRISM_LLM_RUNTIME_HTTP_FALLBACK",
        "true" if llm_settings.llm_runtime_http_fallback else "false",
    )

    configure_logging(
        log_level=llm_settings.log_level,
        json_output=False,
        service_name="dev-server",
        log_dir=llm_settings.log_dir,
        log_max_size_mb=llm_settings.log_max_size_mb,
        log_rotation_days=llm_settings.log_rotation_days,
        log_file_max_mb=llm_settings.log_file_max_mb,
    )

    app = FastAPI(
        title="Prism Dev Server",
        description="统一开发服务器（user-service + llm-service + voc-service + agent-service）",
        version="0.1.0",
        lifespan=lifespan,
    )

    # CORS（开发模式，Bearer token 认证不需要 credentials）
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 异常处理器
    register_exception_handlers(app)

    # 数据库引擎（所有服务共用同一个连接池）
    pool_config = PoolConfig(
        pool_size=llm_settings.db_pool_size,
        max_overflow=llm_settings.db_max_overflow,
    )
    engine = create_engine(llm_settings.database_url, pool_config)
    app.state.engine = engine
    app.state.session_factory = create_session_factory(engine)
    api_key_verifier = create_db_api_key_verifier(app.state.session_factory)

    # 公开接口白名单：登录/注册/刷新 + Provider 预设
    auth_skip_paths = {
        "/api/auth/login",
        "/api/auth/register",
        "/api/auth/refresh",
        "/api/llm/providers/presets",
    }

    # 中间件（注册顺序与执行顺序相反，RequestIdMiddleware 最先执行）
    app.add_middleware(AuditMiddleware, skip_paths=auth_skip_paths)
    app.add_middleware(
        PrincipalMiddleware,
        jwt_secret=llm_settings.jwt_secret,
        api_key_verifier=api_key_verifier,
        skip_paths=auth_skip_paths,
    )
    app.add_middleware(RequestIdMiddleware)
    # 各服务使用独立的 Settings 实例
    app.state.settings = llm_settings  # llm-service / platform 使用
    app.state.user_settings = user_settings  # user-service 使用
    app.state.voc_settings = voc_settings  # voc-service 使用
    app.state.agent_settings = agent_settings  # agent-service 使用

    # 挂载各服务路由
    app.include_router(user_router)  # /api/auth/*
    app.include_router(llm_router)  # /api/llm/*
    app.include_router(voc_router)  # /api/voc/*
    app.include_router(agent_router)  # /api/agent/*
    app.include_router(platform_router, prefix="/api/platform")  # 日志查询

    # 健康检查
    @app.get("/health", tags=["health"])
    async def health_check() -> ApiResponse[dict]:
        return ApiResponse(data={"status": "healthy", "service": "prism-dev-server"})

    return app


app = create_app()
