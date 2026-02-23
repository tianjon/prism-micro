"""FastAPI 应用工厂。"""

import os

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from llm_service.api.router import api_router
from llm_service.core.config import LLMServiceSettings
from prism_shared.auth import PrincipalMiddleware, create_db_api_key_verifier
from prism_shared.db import PoolConfig, create_engine, create_session_factory
from prism_shared.exception_handlers import register_exception_handlers
from prism_shared.logging import configure_logging
from prism_shared.middleware import AuditMiddleware, RequestIdMiddleware
from prism_shared.schemas import ApiResponse


def create_app(settings: LLMServiceSettings | None = None) -> FastAPI:
    """
    创建 FastAPI 应用实例。
    - 注册路由、中间件、异常处理器
    - 初始化数据库连接
    """
    settings = settings or LLMServiceSettings()
    os.environ.setdefault("PRISM_LLM_RUNTIME_MODE", settings.llm_runtime_mode)
    os.environ.setdefault(
        "PRISM_LLM_RUNTIME_HTTP_FALLBACK",
        "true" if settings.llm_runtime_http_fallback else "false",
    )

    configure_logging(log_level=settings.log_level, json_output=not settings.debug)

    app = FastAPI(
        title="Prism LLM Service",
        description="LLM 统一网关：4 槽位模型、Provider 管理、故障转移",
        version="0.1.0",
    )

    # 存入 app.state 供依赖注入使用
    app.state.settings = settings

    # 数据库引擎 & session 工厂
    pool_config = PoolConfig(
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
    )
    engine = create_engine(settings.database_url, pool_config)
    app.state.engine = engine
    app.state.session_factory = create_session_factory(engine)
    api_key_verifier = create_db_api_key_verifier(app.state.session_factory)

    auth_skip_paths = {"/api/llm/providers/presets"}

    # 中间件（顺序：最外层最后注册）
    app.add_middleware(AuditMiddleware, skip_paths=auth_skip_paths)
    app.add_middleware(
        PrincipalMiddleware,
        jwt_secret=settings.jwt_secret,
        api_key_verifier=api_key_verifier,
        skip_paths=auth_skip_paths,
    )
    app.add_middleware(RequestIdMiddleware)

    # 异常处理器
    register_exception_handlers(app)

    # 路由
    app.include_router(api_router)

    # 健康检查
    @app.get("/health", tags=["health"])
    async def health_check():
        return JSONResponse(
            content=ApiResponse(data={"status": "ok", "service": "llm-service"}).model_dump(mode="json")
        )

    # 生命周期：关闭引擎
    @app.on_event("shutdown")
    async def shutdown():
        await engine.dispose()

    return app
