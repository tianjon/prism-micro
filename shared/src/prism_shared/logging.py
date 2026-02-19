"""结构化日志配置。

structlog → stdlib logging → FileHandler 架构：
- structlog 负责结构化处理（字段注入、格式化）
- stdlib logging 负责输出路由（文件滚动、大小控制）
"""

import logging
import logging.handlers
import os
from pathlib import Path

import structlog

# 服务名 → __name__ 前缀的映射，用于统一开发服务器中推导 service 字段
_SERVICE_PREFIX_MAP: dict[str, str] = {
    "voc_service": "voc-service",
    "llm_service": "llm-service",
    "user_service": "user-service",
    "prism_shared": "shared",
}

# 默认 service 名称（由 configure_logging 设置）
_default_service_name: str = "prism"


def _infer_service(logger_name: str) -> str:
    """从 logger __name__ 推导 service 名称。"""
    for prefix, service in _SERVICE_PREFIX_MAP.items():
        if logger_name.startswith(prefix):
            return service
    return _default_service_name


def _infer_module(logger_name: str) -> str:
    """从 logger __name__ 提取功能模块（第二级包名）。"""
    parts = logger_name.split(".")
    if len(parts) >= 3:
        return parts[2]  # e.g. voc_service.pipeline.stage1 → pipeline
    if len(parts) >= 2:
        return parts[1]  # e.g. voc_service.app → app
    return parts[0]


def add_service_context(
    logger: logging.Logger,
    method_name: str,
    event_dict: dict,
) -> dict:
    """structlog processor：自动注入 service 和 module 字段。"""
    logger_name = event_dict.get("_logger_name", "") or ""

    if "service" not in event_dict:
        event_dict["service"] = _infer_service(logger_name)
    if "module" not in event_dict:
        event_dict["module"] = _infer_module(logger_name)

    return event_dict


def _add_logger_name(
    logger: logging.Logger,
    method_name: str,
    event_dict: dict,
) -> dict:
    """将 structlog 的 logger name 存入 event_dict 供后续 processor 使用。"""
    record = event_dict.get("_record")
    if record:
        event_dict["_logger_name"] = record.name
    return event_dict


def _cleanup_internal_keys(
    logger: logging.Logger,
    method_name: str,
    event_dict: dict,
) -> dict:
    """移除内部使用的 key，不让它们出现在最终输出中。"""
    event_dict.pop("_logger_name", None)
    return event_dict


def _enforce_log_space(log_dir: Path, max_size_mb: int) -> None:
    """检查日志目录总大小，超限时删除最旧的归档文件。"""
    max_bytes = max_size_mb * 1024 * 1024
    log_files = sorted(log_dir.glob("prism.*.log"), key=lambda f: f.stat().st_mtime)

    total = sum(f.stat().st_size for f in log_dir.glob("prism*.log"))
    while total > max_bytes and log_files:
        oldest = log_files.pop(0)
        total -= oldest.stat().st_size
        oldest.unlink(missing_ok=True)


class _SizeAwareTimedHandler(logging.handlers.TimedRotatingFileHandler):
    """扩展 TimedRotatingFileHandler，支持当天内按大小追加序号滚动。"""

    def __init__(
        self,
        filename: str,
        when: str = "midnight",
        backup_count: int = 7,
        max_bytes: int = 50 * 1024 * 1024,
        log_dir: Path | None = None,
        max_total_mb: int = 200,
    ) -> None:
        self._max_bytes = max_bytes
        self._log_dir = log_dir
        self._max_total_mb = max_total_mb
        self._intraday_index = 0
        super().__init__(
            filename,
            when=when,
            backupCount=backup_count,
            encoding="utf-8",
            utc=False,
        )

    def shouldRollover(self, record: logging.LogRecord) -> int:
        # 先检查 TimedRotating 的日期滚动
        if super().shouldRollover(record):
            self._intraday_index = 0
            return 1
        # 再检查大小
        if self._max_bytes > 0 and self.stream:
            self.stream.seek(0, 2)
            if self.stream.tell() >= self._max_bytes:
                return 1
        return 0

    def doRollover(self) -> None:
        if self.stream:
            self.stream.close()
            self.stream = None  # type: ignore[assignment]

        # 如果是大小滚动（当天内），追加序号
        import time

        current_time = int(time.time())
        time_tuple = time.localtime(current_time)
        date_suffix = time.strftime("%Y-%m-%d", time_tuple)

        if self._intraday_index > 0 or (
            self._max_bytes > 0
            and Path(self.baseFilename).exists()
            and Path(self.baseFilename).stat().st_size >= self._max_bytes
        ):
            self._intraday_index += 1
            dest = f"{self.baseFilename}.{date_suffix}.{self._intraday_index}.log"
        else:
            dest = f"{self.baseFilename}.{date_suffix}.log"

        # 当前文件重命名
        src = self.baseFilename
        if os.path.exists(src):
            # 避免覆盖已存在的归档
            if os.path.exists(dest):
                self._intraday_index += 1
                dest = f"{self.baseFilename}.{date_suffix}.{self._intraday_index}.log"
            os.rename(src, dest)

        # 清理过期 + 超限文件
        if self._log_dir:
            self._cleanup_old_files()
            _enforce_log_space(self._log_dir, self._max_total_mb)

        # 打开新文件
        if not self.delay:
            self.stream = self._open()

        # 更新 rolloverAt（下一个午夜）
        new_rollover = self.computeRollover(current_time)
        while new_rollover <= current_time:
            new_rollover += self.interval
        self.rolloverAt = new_rollover

    def _cleanup_old_files(self) -> None:
        """删除超过保留天数的归档文件。"""
        if not self._log_dir or self.backupCount <= 0:
            return

        import time

        cutoff = time.time() - self.backupCount * 86400
        for f in self._log_dir.glob("prism.*.log"):
            if f.stat().st_mtime < cutoff:
                f.unlink(missing_ok=True)


def configure_logging(
    log_level: str = "INFO",
    json_output: bool = True,
    service_name: str = "prism",
    log_dir: Path | str = Path.home() / ".prism" / "log" / "app",
    log_max_size_mb: int = 200,
    log_rotation_days: int = 7,
    log_file_max_mb: int = 50,
) -> None:
    """
    配置结构化日志。

    - structlog 做结构化处理（字段注入、格式化）
    - stdlib logging 做输出路由（文件滚动、大小控制）
    - 开发模式同时输出到控制台和文件
    """
    global _default_service_name
    _default_service_name = service_name

    log_path = Path(log_dir)
    log_path.mkdir(parents=True, exist_ok=True)
    log_file = log_path / "prism.log"

    # 启动时清理超限空间
    _enforce_log_space(log_path, log_max_size_mb)

    # --- stdlib logging 配置 ---
    root_logger = logging.getLogger()
    root_logger.handlers.clear()

    # structlog level 名映射到 stdlib 数字
    stdlib_level = getattr(logging, log_level.upper(), logging.INFO)
    root_logger.setLevel(stdlib_level)

    # 文件 handler（始终 JSON 格式）
    file_handler = _SizeAwareTimedHandler(
        filename=str(log_file),
        when="midnight",
        backup_count=log_rotation_days,
        max_bytes=log_file_max_mb * 1024 * 1024,
        log_dir=log_path,
        max_total_mb=log_max_size_mb,
    )
    file_handler.setLevel(stdlib_level)
    # 格式交给 structlog，这里只做透传
    file_handler.setFormatter(logging.Formatter("%(message)s"))
    root_logger.addHandler(file_handler)

    # 开发模式：额外添加控制台 handler
    if not json_output:
        console_handler = logging.StreamHandler()
        console_handler.setLevel(stdlib_level)
        console_handler.setFormatter(logging.Formatter("%(message)s"))
        root_logger.addHandler(console_handler)

    # 抑制第三方噪声 logger，减少日志文件膨胀
    for noisy_logger in ("httpx", "httpcore", "uvicorn.access", "watchfiles"):
        logging.getLogger(noisy_logger).setLevel(logging.WARNING)

    # --- structlog 配置 ---
    # 共享 processor（在 renderer 之前）
    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.stdlib.ExtraAdder(),
    ]

    # structlog → stdlib 桥接的 processor 链
    structlog.configure(
        processors=[
            *shared_processors,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # 为文件 handler 配置 JSON 格式的 ProcessorFormatter
    # foreign_pre_chain：处理非 structlog 的第三方 logger（如 httpx、uvicorn），
    # 确保它们的日志也带有 timestamp 和 level 字段
    file_formatter = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=[
            structlog.stdlib.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
        ],
        processors=[
            _add_logger_name,
            add_service_context,
            _cleanup_internal_keys,
            structlog.processors.format_exc_info,
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            structlog.processors.JSONRenderer(),
        ],
    )
    file_handler.setFormatter(file_formatter)

    # 为控制台 handler 配置可读格式的 ProcessorFormatter
    if not json_output:
        console_formatter = structlog.stdlib.ProcessorFormatter(
            foreign_pre_chain=[
                structlog.stdlib.add_log_level,
                structlog.processors.TimeStamper(fmt="iso"),
            ],
            processors=[
                _add_logger_name,
                add_service_context,
                _cleanup_internal_keys,
                structlog.processors.format_exc_info,
                structlog.stdlib.ProcessorFormatter.remove_processors_meta,
                structlog.dev.ConsoleRenderer(),
            ],
        )
        for handler in root_logger.handlers:
            if isinstance(handler, logging.StreamHandler) and not isinstance(
                handler, logging.handlers.TimedRotatingFileHandler
            ):
                handler.setFormatter(console_formatter)
