"""语义搜索服务。"""

from uuid import UUID

import structlog
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from voc_service.core.config import VocServiceSettings
from voc_service.core.llm_client import LLMClient

logger = structlog.get_logger(__name__)


def confidence_tier(confidence: float | None, settings: VocServiceSettings) -> str:
    """根据语义单元的 AI 拆解置信度计算质量档位。"""
    if confidence is None:
        return "low"
    if confidence >= settings.confidence_high_threshold:
        return "high"
    if confidence >= settings.confidence_medium_threshold:
        return "medium"
    return "low"


async def vector_search(
    db: AsyncSession,
    llm_client: LLMClient,
    settings: VocServiceSettings,
    *,
    query: str,
    top_k: int = 20,
    min_confidence: float = 0.0,
    rerank: bool = False,
) -> dict:
    """语义向量搜索。

    流程：
    1. query → embedding（调用 llm_client.embedding）
    2. pgvector ANN（cosine 距离）+ confidence 过滤
    3. 可选 rerank 重排序
    4. 补充标签信息
    5. confidence_tier 三档计算（基于语义单元拆解置信度）
    """
    # 1. 查询向量化
    vectors = await llm_client.embedding(texts=[query])
    query_vector = vectors[0]

    # 2. pgvector ANN 搜索
    # rerank 时取更多候选，确保重排序后仍有足够结果
    candidate_limit = top_k * settings.search_candidate_multiplier if rerank else top_k

    # cosine 距离：1 - cosine_similarity，越小越相似
    vector_str = "[" + ",".join(str(v) for v in query_vector) + "]"
    search_sql = text("""
        SELECT
            su.id AS unit_id,
            su.text,
            su.summary,
            su.intent,
            su.sentiment,
            su.confidence,
            su.voice_id,
            v.source AS voice_source,
            v.created_at AS voice_created_at,
            1 - (su.embedding <=> :vector::vector) AS similarity_score
        FROM voc.semantic_units su
        JOIN voc.voices v ON v.id = su.voice_id
        WHERE su.embedding IS NOT NULL
          AND su.confidence >= :min_confidence
        ORDER BY su.embedding <=> :vector::vector
        LIMIT :limit
    """)

    result = await db.execute(
        search_sql,
        {"vector": vector_str, "limit": candidate_limit, "min_confidence": min_confidence},
    )
    rows = result.mappings().all()

    if not rows:
        return {"query": query, "total": 0, "results": []}

    # 3. 可选 rerank
    rerank_scores: list[float] = []
    if rerank and len(rows) > 1:
        documents = [row["text"] for row in rows]
        try:
            rerank_results = await llm_client.rerank(
                query=query,
                documents=documents,
                top_n=top_k,
            )
            # 按 rerank 返回顺序重排，并保持分数与结果位置对齐
            reranked_rows = []
            reranked_scores = []
            for item in rerank_results:
                index = item.get("index")
                if not isinstance(index, int) or index < 0 or index >= len(rows):
                    continue
                reranked_rows.append(rows[index])
                reranked_scores.append(float(item.get("relevance_score", 0.0)))

            if reranked_rows:
                rows = reranked_rows
                rerank_scores = reranked_scores
        except Exception:
            logger.warning("Rerank 调用失败，回退到向量搜索结果", exc_info=True)

    # 截断到 top_k
    rows = rows[:top_k]

    # 4. 补充标签信息
    unit_ids = [row["unit_id"] for row in rows]
    tags_by_unit = await _fetch_tags_for_units(db, unit_ids)

    # 5. 组装结果
    results = []
    for idx, row in enumerate(rows):
        similarity = float(row["similarity_score"])
        uid = row["unit_id"]
        results.append(
            {
                "unit_id": uid,
                "text": row["text"],
                "summary": row["summary"],
                "intent": row["intent"],
                "sentiment": row["sentiment"],
                "confidence": row["confidence"],
                "confidence_tier": confidence_tier(row["confidence"], settings),
                "similarity_score": round(similarity, 6),
                "rerank_score": (round(rerank_scores[idx], 6) if idx < len(rerank_scores) else None),
                "tags": tags_by_unit.get(uid, []),
                "voice": {
                    "id": row["voice_id"],
                    "source": row["voice_source"],
                    "created_at": row["voice_created_at"],
                },
            }
        )

    return {"query": query, "total": len(results), "results": results}


async def _fetch_tags_for_units(
    db: AsyncSession,
    unit_ids: list[UUID],
) -> dict[UUID, list[dict]]:
    """批量获取语义单元关联的标签信息。"""
    if not unit_ids:
        return {}

    tag_sql = text("""
        SELECT
            uta.unit_id,
            et.id AS tag_id,
            et.name,
            uta.relevance,
            uta.is_primary
        FROM voc.unit_tag_associations uta
        JOIN voc.emergent_tags et ON et.id = uta.tag_id
        WHERE uta.unit_id = ANY(:unit_ids)
          AND et.status = 'active'
        ORDER BY uta.is_primary DESC, uta.relevance DESC
    """)

    result = await db.execute(tag_sql, {"unit_ids": unit_ids})
    tag_rows = result.mappings().all()

    tags_by_unit: dict[UUID, list[dict]] = {}
    for row in tag_rows:
        uid = row["unit_id"]
        if uid not in tags_by_unit:
            tags_by_unit[uid] = []
        tags_by_unit[uid].append(
            {
                "id": row["tag_id"],
                "name": row["name"],
                "relevance": float(row["relevance"]),
                "is_primary": row["is_primary"],
            }
        )

    return tags_by_unit
