"""llm-service HTTP 客户端。"""

import httpx
import structlog

from prism_shared.exceptions import AppException

logger = structlog.get_logger()


class LLMClient:
    """封装对 llm-service 的 HTTP 调用。"""

    def __init__(self, base_url: str, timeout: int = 60) -> None:
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout

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
        payload = {
            "messages": messages,
            "max_tokens": max_tokens,
        }
        headers = {}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

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
