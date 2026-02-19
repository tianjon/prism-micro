"""日志文件扫描引擎。

从 log_dir 中读取 JSON 格式日志文件，支持按 service/module/level/时间范围筛选。
日志文件命名约定：
  - 当前日志：prism.log
  - 归档日志：prism.YYYY-MM-DD.log 或 prism.YYYY-MM-DD.N.log（日内多次滚动）
"""

import json
import re
from datetime import UTC, datetime
from pathlib import Path

import structlog

from prism_shared.platform.log_schemas import LogEntry, LogFiltersResponse, LogQueryParams

logger = structlog.get_logger(__name__)

# 单次查询最大扫描行数，防止内存溢出
_MAX_SCAN_LINES = 10_000

# 匹配归档文件名中的日期部分
_DATE_PATTERN = re.compile(r"prism\.(\d{4}-\d{2}-\d{2})(?:\.\d+)?\.log")


def _parse_log_line(line: str) -> LogEntry | None:
    """解析单行 JSON 日志，解析失败返回 None。"""
    line = line.strip()
    if not line:
        return None
    try:
        data = json.loads(line)
    except json.JSONDecodeError:
        return None

    # timestamp 字段必须存在
    ts_raw = data.get("timestamp")
    if ts_raw is None:
        return None

    # 尝试解析 ISO 格式时间戳
    try:
        if isinstance(ts_raw, str):
            ts = datetime.fromisoformat(ts_raw)
        else:
            return None
    except (ValueError, TypeError):
        return None

    # 提取已知字段，其余放入 extra
    known_keys = {"timestamp", "level", "service", "module", "event"}
    extra = {k: v for k, v in data.items() if k not in known_keys}

    return LogEntry(
        timestamp=ts,
        level=data.get("level", "UNKNOWN"),
        service=data.get("service", "unknown"),
        module=data.get("module", "unknown"),
        event=data.get("event", ""),
        extra=extra if extra else None,
    )


def _normalize_tz(dt: datetime) -> datetime:
    """将 datetime 统一为 UTC-aware，避免 naive/aware 比较异常。"""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt


def _matches_filters(entry: LogEntry, params: LogQueryParams) -> bool:
    """检查日志条目是否匹配筛选条件。"""
    if params.service and entry.service != params.service:
        return False
    if params.module and entry.module != params.module:
        return False
    if params.level and entry.level.upper() != params.level.upper():
        return False
    ts = _normalize_tz(entry.timestamp)
    if params.since and ts < _normalize_tz(params.since):
        return False
    return not (params.until and ts > _normalize_tz(params.until))


def _list_log_files(log_dir: Path) -> list[Path]:
    """列出日志目录中的所有日志文件，按时间倒序（最新在前）。

    优先级：当前日志 prism.log 最新 → 归档文件按日期倒序。
    """
    if not log_dir.exists():
        return []

    current = log_dir / "prism.log"
    archives: list[tuple[str, Path]] = []

    for f in log_dir.glob("prism*.log"):
        if f.name == "prism.log":
            continue
        match = _DATE_PATTERN.match(f.name)
        if match:
            archives.append((match.group(1), f))

    # 归档文件按日期倒序
    archives.sort(key=lambda x: x[0], reverse=True)

    result: list[Path] = []
    if current.exists():
        result.append(current)
    result.extend(f for _, f in archives)
    return result


def _should_scan_file(file_path: Path, params: LogQueryParams) -> bool:
    """根据时间范围判断是否需要扫描该文件。

    对于 prism.log（当前日志），总是扫描。
    对于归档文件，通过文件名中的日期判断是否可能包含目标时间范围内的数据。
    """
    if file_path.name == "prism.log":
        return True

    match = _DATE_PATTERN.match(file_path.name)
    if not match:
        return True  # 无法判断日期，保守扫描

    file_date_str = match.group(1)
    try:
        file_date = datetime.strptime(file_date_str, "%Y-%m-%d").replace(  # noqa: DTZ007
            tzinfo=UTC,
        )
    except ValueError:
        return True

    # 如果文件日期在 since 之前（整天），可以跳过
    if params.since:
        since_date = params.since.replace(hour=0, minute=0, second=0, microsecond=0)
        if file_date < since_date:
            # 文件日期早于查询起始日期整天，可以跳过
            file_end = file_date.replace(hour=23, minute=59, second=59)
            if file_end < params.since:
                return False

    # 如果文件日期在 until 之后，可以跳过
    if params.until:
        until_date = params.until.replace(hour=23, minute=59, second=59, microsecond=0)
        if file_date > until_date:
            return False

    return True


def query_logs(
    log_dir: Path,
    params: LogQueryParams,
) -> tuple[list[LogEntry], int, bool]:
    """查询日志。

    Args:
        log_dir: 日志文件目录
        params: 查询参数

    Returns:
        (日志列表, 匹配总数, 是否被截断)
        日志列表已分页，按时间倒序排列（最新在前）。
        如果扫描行数达到上限 _MAX_SCAN_LINES，truncated 为 True。
    """
    files = _list_log_files(log_dir)
    matched: list[LogEntry] = []
    scanned_lines = 0
    truncated = False

    for file_path in files:
        if not _should_scan_file(file_path, params):
            continue

        try:
            with file_path.open(encoding="utf-8", errors="replace") as f:
                for line in f:
                    scanned_lines += 1
                    if scanned_lines > _MAX_SCAN_LINES:
                        truncated = True
                        break

                    entry = _parse_log_line(line)
                    if entry is None:
                        continue

                    if _matches_filters(entry, params):
                        matched.append(entry)
        except OSError:
            logger.warning("无法读取日志文件", file=str(file_path))
            continue

        if truncated:
            break

    # 按时间倒序排列（最新在前）
    matched.sort(key=lambda e: e.timestamp, reverse=True)

    # 分页
    total = len(matched)
    start = (params.page - 1) * params.page_size
    end = start + params.page_size
    page_data = matched[start:end]

    return page_data, total, truncated


def get_available_filters(log_dir: Path) -> LogFiltersResponse:
    """扫描日志文件，提取可用的 service/module/level 值。

    为避免扫描过多数据，最多扫描 _MAX_SCAN_LINES 行。
    """
    services: set[str] = set()
    modules: set[str] = set()
    levels: set[str] = set()

    files = _list_log_files(log_dir)
    scanned = 0

    for file_path in files:
        try:
            with file_path.open(encoding="utf-8", errors="replace") as f:
                for line in f:
                    scanned += 1
                    if scanned > _MAX_SCAN_LINES:
                        break

                    entry = _parse_log_line(line)
                    if entry is None:
                        continue

                    services.add(entry.service)
                    modules.add(entry.module)
                    levels.add(entry.level)
        except OSError:
            continue

        if scanned > _MAX_SCAN_LINES:
            break

    return LogFiltersResponse(
        services=sorted(services),
        modules=sorted(modules),
        levels=sorted(levels),
    )
