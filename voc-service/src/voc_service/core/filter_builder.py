"""通用筛选条件构建器。

将前端传入的 filter conditions 构建为 SQLAlchemy WHERE 条件。
支持新格式 { logic, conditions } 和旧格式（纯数组），向后兼容。
"""

import json
from datetime import datetime

import structlog
from sqlalchemy import Column, or_

logger = structlog.get_logger(__name__)

# 支持的操作符白名单
ALLOWED_OPERATORS = {
    "eq", "ne", "contains", "starts_with",
    "gt", "gte", "lt", "lte",
    "is_null", "is_not_null",
    "in",
}


def parse_filter_conditions(filters_json: str | None) -> tuple[list[dict], str]:
    """解析前端传入的 JSON 筛选条件字符串。

    支持两种格式：
    - 新格式：{"logic": "and"|"or", "conditions": [...]}
    - 旧格式：[{"field": ..., "op": ..., "value": ...}, ...]（兼容，默认 and）

    Returns:
        (conditions, logic) 元组
    """
    if not filters_json:
        return [], "and"
    try:
        parsed = json.loads(filters_json)

        # 新格式：对象包含 logic 和 conditions
        if isinstance(parsed, dict):
            conditions = parsed.get("conditions", [])
            logic = parsed.get("logic", "and")
            if not isinstance(conditions, list):
                return [], "and"
            if logic not in ("and", "or"):
                logic = "and"
            return conditions, logic

        # 旧格式：纯数组
        if isinstance(parsed, list):
            return parsed, "and"

        return [], "and"
    except (json.JSONDecodeError, TypeError):
        logger.warning("筛选条件 JSON 解析失败", raw=filters_json)
        return [], "and"


def build_filters(
    model_class: type,
    filter_conditions: list[dict],
    allowed_fields: set[str],
    *,
    field_overrides: dict[str, Column] | None = None,
    logic: str = "and",
) -> list:
    """将前端传入的 filter conditions 构建为 SQLAlchemy WHERE 条件。

    Args:
        model_class: SQLAlchemy 模型类
        filter_conditions: 筛选条件列表
        allowed_fields: 允许筛选的字段名白名单
        field_overrides: 字段名到列对象的映射覆盖（用于 JOIN 的列，如 mapping_name）
        logic: 条件组合逻辑，"and"（默认）或 "or"

    Returns:
        SQLAlchemy WHERE 条件列表
    """
    where_clauses = []

    for cond in filter_conditions:
        field = cond.get("field", "")
        op = cond.get("op", "")
        value = cond.get("value", "")

        # 字段白名单校验（支持 metadata.* 前缀通配）
        if field not in allowed_fields and not (
            "metadata.*" in allowed_fields and field.startswith("metadata.")
        ):
            continue

        # 操作符白名单校验
        if op not in ALLOWED_OPERATORS:
            continue

        # 获取列对象
        if field_overrides and field in field_overrides:
            col = field_overrides[field]
        elif field.startswith("metadata."):
            # JSONB 字段：metadata.xxx → metadata_->>'xxx'（文本提取）
            meta_key = field[len("metadata."):]
            meta_col = getattr(model_class, "metadata_", None)
            if meta_col is None:
                continue
            col = meta_col[meta_key].astext
        else:
            col = getattr(model_class, field, None)
            if col is None:
                continue

        clause = _build_single_clause(col, op, value)
        if clause is not None:
            where_clauses.append(clause)

    # OR 逻辑：多个条件合并为一个 OR 表达式
    if logic == "or" and len(where_clauses) > 1:
        return [or_(*where_clauses)]

    return where_clauses


def _build_single_clause(col: Column, op: str, value):
    """根据操作符构建单个 WHERE 条件。"""
    # 无值操作符
    if op == "is_null":
        return col.is_(None)
    if op == "is_not_null":
        return col.isnot(None)

    # IN 操作符：值为数组
    if op == "in":
        if not isinstance(value, list) or len(value) == 0:
            return None
        # 安全限制：最多 100 个值
        if len(value) > 100:
            value = value[:100]
        typed_values = [_try_cast(col, v) for v in value]
        return col.in_(typed_values)

    # 有值操作符：需要值非空
    if not value and value != "0":
        return None

    # 尝试类型转换
    typed_value = _try_cast(col, value)

    if op == "eq":
        return col == typed_value
    if op == "ne":
        return col != typed_value
    if op == "gt":
        return col > typed_value
    if op == "gte":
        return col >= typed_value
    if op == "lt":
        return col < typed_value
    if op == "lte":
        return col <= typed_value
    if op == "contains":
        return col.ilike(f"%{value}%")
    if op == "starts_with":
        return col.ilike(f"{value}%")

    return None


def _try_cast(col: Column, value: str):
    """根据列类型尝试转换值。"""
    try:
        col_type = str(col.type).upper() if hasattr(col, "type") else ""

        if "INT" in col_type or "BIGINT" in col_type:
            return int(value)
        if "FLOAT" in col_type or "NUMERIC" in col_type or "DOUBLE" in col_type:
            return float(value)
        if "TIMESTAMP" in col_type or "DATE" in col_type:
            return datetime.fromisoformat(value)
    except (ValueError, TypeError):
        pass

    return value
