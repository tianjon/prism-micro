"""voc-service 专属异常体系。

继承 shared.AppException，被全局异常处理器自动捕获。
"""

from prism_shared.exceptions import AppException


class VocServiceError(AppException):
    """voc-service 基础异常。"""

    pass


class TagNotFoundError(VocServiceError):
    """标签不存在。"""

    def __init__(self, tag_id: str):
        super().__init__(
            code="VOC_TAG_NOT_FOUND",
            message=f"标签不存在: {tag_id}",
            status_code=404,
        )


class InvalidFeedbackTypeError(VocServiceError):
    """无效的反馈类型。"""

    def __init__(self, feedback_type: str):
        super().__init__(
            code="VOC_INVALID_FEEDBACK_TYPE",
            message=f"无效的反馈类型: {feedback_type}",
            status_code=400,
        )
