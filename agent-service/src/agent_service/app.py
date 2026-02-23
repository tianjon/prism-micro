"""agent-service FastAPI 应用工厂。"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from agent_service.api.router import router
from agent_service.core.config import AgentServiceSettings
from prism_shared.auth import PrincipalMiddleware, create_db_api_key_verifier
from prism_shared.db import create_engine, create_session_factory
from prism_shared.exception_handlers import register_exception_handlers
from prism_shared.logging import configure_logging
from prism_shared.middleware import AuditMiddleware, RequestIdMiddleware
from prism_shared.schemas import ApiResponse


def create_app(settings: AgentServiceSettings | None = None) -> FastAPI:
    settings = settings or AgentServiceSettings()
    configure_logging(log_level=settings.log_level, json_output=not settings.debug)

    engine = create_engine(settings.database_url)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        yield
        await engine.dispose()

    app = FastAPI(
        title="Prism Agent Service",
        version="0.1.0",
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
        lifespan=lifespan,
    )

    app.state.settings = settings
    app.state.agent_settings = settings
    app.state.engine = engine
    app.state.session_factory = create_session_factory(engine)
    api_key_verifier = create_db_api_key_verifier(app.state.session_factory)

    app.add_middleware(AuditMiddleware)
    app.add_middleware(
        PrincipalMiddleware,
        jwt_secret=settings.jwt_secret,
        api_key_verifier=api_key_verifier,
    )
    app.add_middleware(RequestIdMiddleware)

    register_exception_handlers(app)
    app.include_router(router)

    @app.get("/health", tags=["health"])
    async def health_check() -> JSONResponse:
        return JSONResponse(
            content=ApiResponse(data={"status": "ok", "service": "agent-service"}).model_dump(mode="json")
        )

    return app
