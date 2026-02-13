"""FastAPI 异常处理器注册。"""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from prism_shared.exceptions import AppException
from prism_shared.schemas.response import ErrorDetail, ErrorResponse, Meta


async def _app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    """将 AppException 转换为统一 ErrorResponse。"""
    request_id = getattr(request.state, "request_id", None)
    meta = Meta(request_id=request_id) if request_id else Meta()
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            error=ErrorDetail(
                code=exc.code,
                message=exc.message,
                details=exc.details,
            ),
            meta=meta,
        ).model_dump(mode="json"),
    )


def register_exception_handlers(app: FastAPI) -> None:
    """注册通用异常处理器到 FastAPI 应用。各服务在 main.py 中调用。"""
    app.add_exception_handler(AppException, _app_exception_handler)
