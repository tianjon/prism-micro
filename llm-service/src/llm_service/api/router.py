"""路由注册总入口。"""

from fastapi import APIRouter

from llm_service.api.compat import router as compat_router
from llm_service.api.gateway import router as gateway_router
from llm_service.api.providers import router as providers_router
from llm_service.api.slots import router as slots_router

api_router = APIRouter()
api_router.include_router(providers_router)
api_router.include_router(slots_router)
api_router.include_router(gateway_router)
api_router.include_router(compat_router)
