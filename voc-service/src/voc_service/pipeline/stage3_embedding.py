"""Stage 3: 语义单元向量化。

将 SemanticUnit.text 通过 embedding 槽位转换为 1024 维向量，
写入 SemanticUnit.embedding 字段。按 batch_size 分批调用，
单批失败跳过不阻塞后续批次。
"""

import structlog

from voc_service.core.config import VocServiceSettings
from voc_service.core.llm_client import LLMClient
from voc_service.models.semantic_unit import SemanticUnit

logger = structlog.get_logger(__name__)


class EmbeddingProcessor:
    """Stage 3: SemanticUnit.text → embedding vector (1024 维)。"""

    def __init__(self, llm_client: LLMClient, settings: VocServiceSettings) -> None:
        self._llm = llm_client
        self._batch_size = settings.embedding_batch_size

    async def embed(self, units: list[SemanticUnit]) -> int:
        """批量向量化语义单元。

        Args:
            units: 待向量化的语义单元列表

        Returns:
            成功向量化的数量
        """
        if not units:
            return 0

        embedded_count = 0

        for i in range(0, len(units), self._batch_size):
            batch = units[i : i + self._batch_size]
            texts = [u.text for u in batch]

            try:
                vectors = await self._llm.embedding(texts=texts)

                for unit, vector in zip(batch, vectors, strict=True):
                    unit.embedding = vector
                    embedded_count += 1

                logger.info(
                    "批次向量化完成",
                    batch_index=i // self._batch_size,
                    batch_size=len(batch),
                )
            except Exception:
                logger.error(
                    "批次向量化失败，跳过该批次",
                    batch_index=i // self._batch_size,
                    batch_size=len(batch),
                    exc_info=True,
                )

        return embedded_count
