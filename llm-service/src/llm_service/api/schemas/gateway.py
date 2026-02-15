"""推理代理网关请求/响应模型。"""

from pydantic import BaseModel, Field

from llm_service.models.slot import SlotType

# ===========================
# 通用
# ===========================


class UsageInfo(BaseModel):
    """Token 用量统计。"""

    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


class MessageItem(BaseModel):
    """OpenAI 格式消息条目。"""

    role: str = Field(description="消息角色：system/user/assistant")
    content: str = Field(description="消息内容")


# ===========================
# Chat 补全
# ===========================


class CompletionRequest(BaseModel):
    """Chat 补全请求。"""

    provider_id: str = Field(description="Provider UUID")
    model_id: str = Field(description="模型 ID")
    messages: list[MessageItem] = Field(min_length=1, description="消息数组")
    stream: bool = Field(default=False, description="是否流式输出")
    max_tokens: int | None = Field(default=None, description="最大生成 token 数")
    temperature: float | None = Field(default=None, ge=0, le=2, description="采样温度")
    top_p: float | None = Field(default=None, ge=0, le=1, description="核采样")


class CompletionResponse(BaseModel):
    """Chat 补全响应（非流式）。"""

    content: str
    usage: UsageInfo
    latency_ms: int
    model: str


# ===========================
# Embedding
# ===========================


class EmbeddingRequest(BaseModel):
    """Embedding 请求。"""

    provider_id: str = Field(description="Provider UUID")
    model_id: str = Field(description="模型 ID")
    input: str | list[str] = Field(description="待向量化的文本（单个或数组）")
    dimensions: int | None = Field(default=None, description="输出向量维度（模型须支持 Matryoshka）")


class EmbeddingItem(BaseModel):
    """单条 Embedding 结果。"""

    index: int
    values: list[float]
    dimensions: int


class EmbeddingResponse(BaseModel):
    """Embedding 响应。"""

    embeddings: list[EmbeddingItem]
    usage: UsageInfo
    latency_ms: int
    model: str


# ===========================
# Rerank
# ===========================


class RerankRequest(BaseModel):
    """Rerank 请求。"""

    provider_id: str = Field(description="Provider UUID")
    model_id: str = Field(description="模型 ID")
    query: str = Field(description="查询文本")
    documents: list[str] = Field(min_length=1, description="候选文档数组")


class RerankResultItem(BaseModel):
    """单条 Rerank 结果。"""

    index: int
    document: str
    relevance_score: float


class RerankResponse(BaseModel):
    """Rerank 响应。"""

    results: list[RerankResultItem]
    latency_ms: int
    model: str


# ===========================
# 槽位调用
# ===========================


class SlotInvokeRequest(BaseModel):
    """槽位调用请求。"""

    messages: list[MessageItem] = Field(min_length=1, description="消息数组")
    max_tokens: int | None = Field(default=None, description="最大生成 token 数")
    temperature: float | None = Field(default=None, ge=0, le=2, description="采样温度")


class FailoverTraceItem(BaseModel):
    """故障转移追踪条目。"""

    provider_name: str
    model_id: str
    success: bool
    error: str | None = None
    latency_ms: int | None = None


class RoutingInfo(BaseModel):
    """路由决策信息。"""

    provider_name: str
    model_id: str
    slot_type: SlotType
    used_resource_pool: bool = False
    failover_trace: list[FailoverTraceItem] = Field(default_factory=list)


class SlotInvokeResponse(BaseModel):
    """槽位调用响应。"""

    result: CompletionResponse
    routing: RoutingInfo


# ===========================
# 槽位级 Embedding / Rerank 调用
# ===========================


class SlotEmbeddingRequest(BaseModel):
    """基于槽位的 Embedding 请求（无需指定 provider/model）。"""

    input: str | list[str] = Field(description="待向量化文本（单个或数组）")
    dimensions: int | None = Field(default=None, description="输出向量维度")


class SlotRerankRequest(BaseModel):
    """基于槽位的 Rerank 请求（无需指定 provider/model）。"""

    query: str = Field(description="查询文本")
    documents: list[str] = Field(min_length=1, description="候选文档数组")
    top_n: int | None = Field(default=None, ge=1, description="返回前 N 个结果")


class SlotEmbeddingResponse(BaseModel):
    """槽位 Embedding 调用响应。"""

    result: EmbeddingResponse
    routing: RoutingInfo


class SlotRerankResponse(BaseModel):
    """槽位 Rerank 调用响应。"""

    result: RerankResponse
    routing: RoutingInfo
