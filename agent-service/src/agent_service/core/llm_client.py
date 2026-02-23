"""agent-service 调用 llm-service 的客户端。"""

from typing import Any

import httpx


class LLMServiceClient:
    """最小 llm-service 客户端。"""

    def __init__(self, base_url: str, timeout: int = 60) -> None:
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout

    async def chat(
        self,
        *,
        messages: list[dict[str, str]],
        slot: str,
        max_tokens: int | None,
        headers: dict[str, str],
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "messages": messages,
            "slot": slot,
            "stream": False,
        }
        if max_tokens is not None:
            payload["max_tokens"] = max_tokens

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                f"{self._base_url}/api/llm/chat",
                json=payload,
                headers=headers,
            )

        body = response.json()
        if response.status_code >= 400:
            detail = body.get("error", {}).get("message") if isinstance(body, dict) else None
            raise RuntimeError(detail or f"llm-service 调用失败: HTTP {response.status_code}")

        if not isinstance(body, dict):
            raise RuntimeError("llm-service 返回格式无效")

        data = body.get("data")
        if not isinstance(data, dict):
            raise RuntimeError("llm-service 响应缺少 data")
        return data
