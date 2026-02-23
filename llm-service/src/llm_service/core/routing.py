"""路由追踪辅助工具。"""

from typing import Any


def build_trace_entry(
    *,
    provider_name: str,
    model_id: str,
    success: bool,
    error: str | None = None,
    latency_ms: int | None = None,
) -> dict[str, Any]:
    """构造统一的故障转移追踪条目。"""
    return {
        "provider_name": provider_name,
        "model_id": model_id,
        "success": success,
        "error": error,
        "latency_ms": latency_ms,
    }


def build_routing_info(
    *,
    provider_name: str,
    model_id: str,
    slot_type: str,
    used_resource_pool: bool,
    failover_trace: list[dict[str, Any]],
) -> dict[str, Any]:
    """构造统一的路由决策信息。"""
    return {
        "provider_name": provider_name,
        "model_id": model_id,
        "slot_type": slot_type,
        "used_resource_pool": used_resource_pool,
        "failover_trace": failover_trace,
    }
