"""FastAPI 应用工厂。"""

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from prism_shared.db import PoolConfig, create_engine, create_session_factory
from prism_shared.exception_handlers import register_exception_handlers
from prism_shared.logging import configure_logging
from prism_shared.middleware import RequestIdMiddleware
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

    configure_logging(log_level=settings.log_level, json_output=not settings.debug)

    app = FastAPI(
        title="Prism VOC Service",
        description="VOC 数据处理：数据导入、AI 管线、语义搜索、涌现标签",
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

    # 中间件
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

    # 生命周期：关闭引擎
    @app.on_event("shutdown")
    async def shutdown():
        await engine.dispose()

    return app
