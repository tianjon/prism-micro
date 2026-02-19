"""llm-service HTTP 客户端。"""

import httpx
import structlog

from prism_shared.exceptions import AppException

logger = structlog.get_logger(__name__)


class LLMClient:
    """封装对 llm-service 的 HTTP 调用。"""

    def __init__(self, base_url: str, timeout: int = 60, default_api_key: str | None = None) -> None:
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout
        self._default_api_key = default_api_key

    async def invoke_slot(
        self,
        *,
        slot: str,
        messages: list[dict],
        temperature: float = 0.3,
        max_tokens: int = 4096,
        api_key: str | None = None,
    ) -> dict:
        """
        调用 llm-service 槽位推理端点。

        Args:
            slot: 槽位类型（fast / reasoning / embedding / rerank）
            messages: 消息列表
            temperature: 温度参数
            max_tokens: 最大生成 token 数
            api_key: JWT token，用于认证

        Returns:
            推理结果 dict（包含 result.content）
        """
        url = f"{self._base_url}/api/llm/slots/{slot}/invoke"
        payload: dict = {
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        token = api_key or self._default_api_key
        headers = {}
        if token:
            headers["Authorization"] = f"Bearer {token}"

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(url, json=payload, headers=headers)
                resp.raise_for_status()
                return resp.json()
        except httpx.ConnectError as e:
            logger.error("llm-service 连接失败", url=url, error=str(e))
            raise AppException(
                code="VOC_LLM_UNAVAILABLE",
                message=f"llm-service 不可用：{e}",
                status_code=503,
            ) from e
        except httpx.TimeoutException as e:
            logger.error("llm-service 调用超时", url=url, error=str(e))
            raise AppException(
                code="VOC_LLM_TIMEOUT",
                message=f"llm-service 调用超时：{e}",
                status_code=504,
            ) from e
        except httpx.HTTPStatusError as e:
            logger.error(
                "llm-service 返回错误",
                url=url,
                status_code=e.response.status_code,
                body=e.response.text[:500],
            )
            raise AppException(
                code="VOC_LLM_UNAVAILABLE",
                message=f"llm-service 返回错误 {e.response.status_code}",
                status_code=503,
            ) from e

    async def embedding(
        self,
        *,
        texts: list[str],
        dimensions: int | None = None,
        api_key: str | None = None,
    ) -> list[list[float]]:
        """调用 slot-based embedding 端点，返回向量列表。"""
        url = f"{self._base_url}/api/llm/slots/embedding/invoke"
        payload: dict = {"input": texts}
        if dimensions is not None:
            payload["dimensions"] = dimensions

        token = api_key or self._default_api_key
        headers = {}
        if token:
            headers["Authorization"] = f"Bearer {token}"

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(url, json=payload, headers=headers)
                resp.raise_for_status()
                body = resp.json()
                return [item["values"] for item in body["data"]["result"]["embeddings"]]
        except httpx.ConnectError as e:
            logger.error("llm-service embedding 连接失败", url=url, error=str(e))
            raise AppException(
                code="VOC_LLM_UNAVAILABLE",
                message=f"llm-service 不可用：{e}",
                status_code=503,
            ) from e
        except httpx.TimeoutException as e:
            logger.error("llm-service embedding 调用超时", url=url, error=str(e))
            raise AppException(
                code="VOC_LLM_TIMEOUT",
                message=f"llm-service 调用超时：{e}",
                status_code=504,
            ) from e
        except httpx.HTTPStatusError as e:
            logger.error(
                "llm-service embedding 返回错误",
                url=url,
                status_code=e.response.status_code,
                body=e.response.text[:500],
            )
            raise AppException(
                code="VOC_LLM_UNAVAILABLE",
                message=f"llm-service 返回错误 {e.response.status_code}",
                status_code=503,
            ) from e

    async def rerank(
        self,
        *,
        query: str,
        documents: list[str],
        top_n: int | None = None,
        api_key: str | None = None,
    ) -> list[dict]:
        """调用 slot-based rerank 端点，返回排序结果。

        Returns:
            [{"index": int, "document": str, "relevance_score": float}, ...]
        """
        url = f"{self._base_url}/api/llm/slots/rerank/invoke"
        payload: dict = {"query": query, "documents": documents}
        if top_n is not None:
            payload["top_n"] = top_n

        token = api_key or self._default_api_key
        headers = {}
        if token:
            headers["Authorization"] = f"Bearer {token}"

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(url, json=payload, headers=headers)
                resp.raise_for_status()
                body = resp.json()
                return body["data"]["result"]["results"]
        except httpx.ConnectError as e:
            logger.error("llm-service rerank 连接失败", url=url, error=str(e))
            raise AppException(
                code="VOC_LLM_UNAVAILABLE",
                message=f"llm-service 不可用：{e}",
                status_code=503,
            ) from e
        except httpx.TimeoutException as e:
            logger.error("llm-service rerank 调用超时", url=url, error=str(e))
            raise AppException(
                code="VOC_LLM_TIMEOUT",
                message=f"llm-service 调用超时：{e}",
                status_code=504,
            ) from e
        except httpx.HTTPStatusError as e:
            logger.error(
                "llm-service rerank 返回错误",
                url=url,
                status_code=e.response.status_code,
                body=e.response.text[:500],
            )
            raise AppException(
                code="VOC_LLM_UNAVAILABLE",
                message=f"llm-service 返回错误 {e.response.status_code}",
                status_code=503,
            ) from e
