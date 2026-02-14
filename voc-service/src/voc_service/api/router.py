"""路由注册总入口。"""

from fastapi import APIRouter

from voc_service.api.import_routes import router as import_router

api_router = APIRouter()
api_router.include_router(import_router)
