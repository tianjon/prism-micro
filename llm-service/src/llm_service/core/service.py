"""llm-service 核心业务逻辑兼容导出层。"""

from llm_service.core.gateway_service import (
    call_completion,
    call_completion_stream,
    call_embedding,
    call_rerank,
    invoke_embedding_slot,
    invoke_rerank_slot,
    invoke_slot,
)
from llm_service.core.provider_service import (
    create_provider,
    delete_provider,
    get_provider,
    list_provider_models,
    list_providers,
    test_provider_connectivity,
    update_provider,
)
from llm_service.core.slot_service import configure_slot, find_referencing_slots, get_slot, list_slots, resolve_slot

__all__ = [
    "call_completion",
    "call_completion_stream",
    "call_embedding",
    "call_rerank",
    "configure_slot",
    "create_provider",
    "delete_provider",
    "find_referencing_slots",
    "get_provider",
    "get_slot",
    "invoke_embedding_slot",
    "invoke_rerank_slot",
    "invoke_slot",
    "list_provider_models",
    "list_providers",
    "list_slots",
    "resolve_slot",
    "test_provider_connectivity",
    "update_provider",
]
