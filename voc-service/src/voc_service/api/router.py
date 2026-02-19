"""路由注册总入口。"""

from fastapi import APIRouter

from voc_service.api.data_routes import router as data_router
from voc_service.api.detail_routes import router as detail_router
from voc_service.api.import_routes import router as import_router
from voc_service.api.pipeline_routes import router as pipeline_router
from voc_service.api.search_routes import router as search_router
from voc_service.api.tag_routes import router as tag_router

api_router = APIRouter()
api_router.include_router(data_router)
api_router.include_router(detail_router)
api_router.include_router(import_router)
api_router.include_router(pipeline_router)
api_router.include_router(search_router)
api_router.include_router(tag_router)
