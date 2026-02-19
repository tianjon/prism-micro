"""FastAPI 异常处理器注册。"""

import structlog
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from prism_shared.exceptions import AppException
from prism_shared.schemas.response import ErrorDetail, ErrorResponse, Meta

logger = structlog.get_logger(__name__)


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


async def _validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """将 Pydantic 校验错误转换为统一 ErrorResponse。"""
    request_id = getattr(request.state, "request_id", None)
    meta = Meta(request_id=request_id) if request_id else Meta()
    errors = exc.errors()
    first_msg = errors[0]["msg"] if errors else "请求参数校验失败"
    return JSONResponse(
        status_code=422,
        content=ErrorResponse(
            error=ErrorDetail(
                code="VALIDATION_ERROR",
                message=first_msg,
                details={
                    "errors": [
                        {
                            "field": " → ".join(str(loc) for loc in e.get("loc", [])),
                            "message": e.get("msg", ""),
                        }
                        for e in errors
                    ]
                },
            ),
            meta=meta,
        ).model_dump(mode="json"),
    )


async def _unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """兜底：将未处理异常转换为统一 ErrorResponse，同时记录日志。"""
    request_id = getattr(request.state, "request_id", None)
    meta = Meta(request_id=request_id) if request_id else Meta()
    logger.error(
        "未处理异常",
        exc_info=True,
        error_type=type(exc).__name__,
        error=str(exc),
        path=request.url.path,
    )
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            error=ErrorDetail(
                code="INTERNAL_ERROR",
                message="服务器内部错误，请稍后重试",
            ),
            meta=meta,
        ).model_dump(mode="json"),
    )


def register_exception_handlers(app: FastAPI) -> None:
    """注册通用异常处理器到 FastAPI 应用。各服务在 main.py 中调用。"""
    app.add_exception_handler(AppException, _app_exception_handler)
    app.add_exception_handler(RequestValidationError, _validation_exception_handler)
    app.add_exception_handler(Exception, _unhandled_exception_handler)
