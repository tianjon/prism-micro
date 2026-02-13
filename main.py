"""Prism 统一开发服务器。

本地开发时将 user-service 和 llm-service 的路由挂载到同一个 FastAPI 实例，
前端通过 Vite 代理 /api/* 到此端口（默认 8601）。

启动方式：
    uv run uvicorn main:app --host 0.0.0.0 --port 8601 --reload
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from llm_service.api.router import api_router as llm_router
from llm_service.core.config import LLMServiceSettings
from prism_shared.db import PoolConfig, create_engine, create_session_factory
from prism_shared.exception_handlers import register_exception_handlers
from prism_shared.logging import configure_logging
from prism_shared.middleware import RequestIdMiddleware
from prism_shared.schemas import ApiResponse
from user_service.api.router import router as user_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理。"""
    yield
    # 关闭数据库引擎
    if hasattr(app.state, "engine"):
        await app.state.engine.dispose()


def create_app() -> FastAPI:
    """创建统一开发服务器。"""
    settings = LLMServiceSettings()

    configure_logging(log_level=settings.log_level, json_output=False)

    app = FastAPI(
        title="Prism Dev Server",
        description="统一开发服务器（user-service + llm-service）",
        version="0.1.0",
        lifespan=lifespan,
    )

    # CORS（开发模式允许前端本地端口）
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 中间件
    app.add_middleware(RequestIdMiddleware)

    # 异常处理器
    register_exception_handlers(app)

    # 数据库引擎（所有服务共用同一个连接池）
    pool_config = PoolConfig(
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
    )
    engine = create_engine(settings.database_url, pool_config)
    app.state.engine = engine
    app.state.session_factory = create_session_factory(engine)
    app.state.settings = settings

    # 挂载各服务路由
    app.include_router(user_router)  # /api/auth/*
    app.include_router(llm_router)   # /api/llm/*

    # 健康检查
    @app.get("/health", tags=["health"])
    async def health_check() -> ApiResponse[dict]:
        return ApiResponse(data={"status": "healthy", "service": "prism-dev-server"})

    return app


app = create_app()
