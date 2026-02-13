"""统一异常体系。"""

from typing import Any


class AppException(Exception):
    """
    统一异常基类。所有业务异常必须继承此类。
    各服务通过 exception handler 将其转换为 ErrorResponse。
    """

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 500,
        details: dict[str, Any] | None = None,
    ):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details
        super().__init__(message)


class NotFoundException(AppException):
    """资源不存在异常。"""

    def __init__(self, resource: str, resource_id: str | None = None):
        msg = f"{resource} 不存在"
        if resource_id:
            msg = f"{resource}({resource_id}) 不存在"
        super().__init__(
            code="SHARED_NOT_FOUND",
            message=msg,
            status_code=404,
        )


class AuthenticationException(AppException):
    """认证失败异常。"""

    def __init__(self, message: str = "认证失败"):
        super().__init__(
            code="SHARED_UNAUTHORIZED",
            message=message,
            status_code=401,
        )


class ForbiddenException(AppException):
    """权限不足异常。"""

    def __init__(self, message: str = "权限不足"):
        super().__init__(
            code="SHARED_FORBIDDEN",
            message=message,
            status_code=403,
        )


class ValidationException(AppException):
    """数据校验异常。"""

    def __init__(self, message: str, details: dict[str, Any] | None = None):
        super().__init__(
            code="SHARED_VALIDATION_ERROR",
            message=message,
            status_code=422,
            details=details,
        )
