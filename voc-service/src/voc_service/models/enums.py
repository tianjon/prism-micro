"""VOC 服务枚举类型定义。"""

from enum import StrEnum


class IngestionSource(StrEnum):
    """数据导入来源。"""

    CSV = "csv"
    EXCEL = "excel"
    SYNTHETIC = "synthetic"
    CRAWLER_DONGCHEDI = "crawler_dongchedi"
    CRAWLER_WEIBO = "crawler_weibo"


class BatchStatus(StrEnum):
    """导入批次状态。"""

    PENDING = "pending"
    PARSING = "parsing"
    MAPPING = "mapping"
    IMPORTING = "importing"
    PROCESSING = "processing"
    COMPLETED = "completed"
    PARTIALLY_COMPLETED = "partially_completed"
    FAILED = "failed"


class ProcessedStatus(StrEnum):
    """Voice 处理状态。"""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Sentiment(StrEnum):
    """情感倾向。"""

    POSITIVE = "positive"
    NEGATIVE = "negative"
    NEUTRAL = "neutral"
    MIXED = "mixed"


class TagStatus(StrEnum):
    """涌现标签状态。"""

    ACTIVE = "active"
    MERGED = "merged"
    DEPRECATED = "deprecated"


class FeedbackType(StrEnum):
    """标签反馈类型。"""

    USEFUL = "useful"
    USELESS = "useless"
    ERROR = "error"


class SourceFormat(StrEnum):
    """数据源文件格式。"""

    CSV = "csv"
    EXCEL = "excel"
    JSON = "json"


class MappingCreatedBy(StrEnum):
    """映射模板创建方式。"""

    LLM = "llm"
    USER = "user"
    LLM_USER_CONFIRMED = "llm_user_confirmed"
