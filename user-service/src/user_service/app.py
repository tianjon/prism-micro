"""FastAPI 应用工厂。"""

from fastapi import FastAPI

from prism_shared.exception_handlers import register_exception_handlers
from prism_shared.logging import configure_logging
from prism_shared.middleware.request_id import RequestIdMiddleware
from prism_shared.schemas.response import ApiResponse
from user_service.api.router import router
from user_service.core.config import UserServiceSettings


def create_app(settings: UserServiceSettings | None = None) -> FastAPI:
    """创建并配置 FastAPI 应用实例。"""
    if settings is None:
        settings = UserServiceSettings()

    configure_logging(log_level=settings.log_level, json_output=not settings.debug)

    app = FastAPI(
        title="Prism User Service",
        version="0.1.0",
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
    )

    # 中间件（注册顺序与执行顺序相反，RequestIdMiddleware 最先执行）
    app.add_middleware(RequestIdMiddleware)

    # 异常处理器
    register_exception_handlers(app)

    # 路由
    app.include_router(router)

    # 健康检查
    @app.get("/health", tags=["health"])
    async def health_check() -> ApiResponse[dict]:
        return ApiResponse(
            data={
                "status": "healthy",
                "service": "user-service",
                "version": "0.1.0",
            }
        )

    return app
