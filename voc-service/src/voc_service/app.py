"""FastAPI 应用工厂。"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from prism_shared.auth import PrincipalMiddleware, create_db_api_key_verifier
from prism_shared.db import PoolConfig, create_engine, create_session_factory
from prism_shared.exception_handlers import register_exception_handlers
from prism_shared.logging import configure_logging
from prism_shared.middleware import AuditMiddleware, RequestIdMiddleware
from prism_shared.schemas import ApiResponse
from voc_service.api.router import api_router
from voc_service.core.config import VocServiceSettings


def create_app(settings: VocServiceSettings | None = None) -> FastAPI:
    """
    创建 FastAPI 应用实例。
    - 注册路由、中间件、异常处理器
    - 初始化数据库连接
    """
    settings = settings or VocServiceSettings()

    configure_logging(
        log_level=settings.log_level,
        json_output=not settings.debug,
        service_name="voc-service",
        log_dir=settings.log_dir,
        log_max_size_mb=settings.log_max_size_mb,
        log_rotation_days=settings.log_rotation_days,
        log_file_max_mb=settings.log_file_max_mb,
    )

    # 数据库引擎 & session 工厂
    pool_config = PoolConfig(
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
    )
    engine = create_engine(settings.database_url, pool_config)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        yield
        await engine.dispose()

    app = FastAPI(
        title="Prism VOC Service",
        description="VOC 数据处理：数据导入、AI 管线、语义搜索、涌现标签",
        version="0.1.0",
        lifespan=lifespan,
    )

    # 存入 app.state 供依赖注入使用
    app.state.settings = settings

    app.state.engine = engine
    app.state.session_factory = create_session_factory(engine)
    api_key_verifier = create_db_api_key_verifier(app.state.session_factory)

    # 中间件（注册顺序与执行顺序相反，RequestIdMiddleware 最先执行）
    app.add_middleware(AuditMiddleware)
    app.add_middleware(
        PrincipalMiddleware,
        jwt_secret=settings.jwt_secret,
        api_key_verifier=api_key_verifier,
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
            content=ApiResponse(data={"status": "ok", "service": "voc-service"}).model_dump(mode="json")
        )

    return app
