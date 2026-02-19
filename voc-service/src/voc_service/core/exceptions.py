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


class BatchNotFoundError(VocServiceError):
    """导入批次不存在。"""

    def __init__(self, batch_id: str):
        super().__init__(
            code="VOC_BATCH_NOT_FOUND",
            message=f"导入批次不存在: {batch_id}",
            status_code=404,
        )


class MappingNotFoundError(VocServiceError):
    """映射模板不存在。"""

    def __init__(self, mapping_id: str):
        super().__init__(
            code="VOC_MAPPING_NOT_FOUND",
            message=f"映射模板不存在: {mapping_id}",
            status_code=404,
        )


class VoiceNotFoundError(VocServiceError):
    """Voice 记录不存在。"""

    def __init__(self, voice_id: str):
        super().__init__(
            code="VOC_VOICE_NOT_FOUND",
            message=f"Voice 记录不存在: {voice_id}",
            status_code=404,
        )


class BatchInProgressError(VocServiceError):
    """导入批次正在处理中，无法删除。"""

    def __init__(self, batch_id: str, status: str):
        super().__init__(
            code="VOC_BATCH_IN_PROGRESS",
            message=f"导入批次正在处理中（{status}），无法删除: {batch_id}",
            status_code=409,
        )


class MappingInUseError(VocServiceError):
    """映射模板被进行中的批次引用，无法删除。"""

    def __init__(self, mapping_id: str):
        super().__init__(
            code="VOC_MAPPING_IN_USE",
            message=f"映射模板被进行中的批次引用，无法删除: {mapping_id}",
            status_code=409,
        )
