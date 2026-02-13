"""结构化日志配置。"""

import structlog
from structlog._log_levels import NAME_TO_LEVEL


def configure_logging(log_level: str = "INFO", json_output: bool = True) -> None:
    """
    配置结构化日志。
    开发环境输出可读格式，生产环境输出 JSON 格式。
    """
    processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
    ]

    if json_output:
        processors.append(structlog.processors.JSONRenderer())
    else:
        processors.append(structlog.dev.ConsoleRenderer())

    level_num = NAME_TO_LEVEL.get(log_level.lower(), NAME_TO_LEVEL["info"])

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(level_num),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )
