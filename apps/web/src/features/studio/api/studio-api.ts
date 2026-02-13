/**
 * Studio API 封装。
 * 调用 llm-service 通用网关 API。
 */

import { apiClient } from "@/api/client";
import { ENDPOINTS } from "@/api/endpoints";
import type {
  ApiResponse,
  CompletionRequest,
  CompletionResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  RerankRequest,
  RerankResponse,
  SlotInvokeRequest,
  SlotInvokeResponse,
  SlotType,
} from "@/api/types";
import { API_BASE } from "@/lib/constants";
import { useAuthStore } from "@/stores/auth-store";

/** 非流式 Chat 补全 */
export async function callCompletion(
  req: CompletionRequest,
): Promise<CompletionResponse> {
  const res = await apiClient.request<ApiResponse<CompletionResponse>>({
    method: "POST",
    path: ENDPOINTS.COMPLETIONS,
    body: { ...req, stream: false },
  });
  return res.data;
}

/** 流式 Chat 补全，返回 ReadableStream 消费 SSE */
export async function callCompletionStream(
  req: Omit<CompletionRequest, "stream">,
  onDelta: (delta: string) => void,
  onDone: (summary: {
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    latency_ms: number;
    model: string;
  }) => void,
  onError: (err: Error) => void,
): Promise<void> {
  const token = useAuthStore.getState().accessToken;
  const url = `${API_BASE}${ENDPOINTS.COMPLETIONS}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ ...req, stream: true }),
  });

  if (!response.ok) {
    const body = (await response.json()) as {
      error?: { message?: string };
    };
    onError(new Error(body.error?.message ?? `HTTP ${response.status}`));
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    onError(new Error("无法获取响应流"));
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const dataStr = line.slice(6).trim();
        if (dataStr === "[DONE]") return;

        try {
          const data = JSON.parse(dataStr) as Record<string, unknown>;

          // 增量内容事件
          if (typeof data["delta"] === "string") {
            onDelta(data["delta"] as string);
          }

          // 最终汇总事件（包含 usage + latency_ms）
          if (data["usage"] && data["latency_ms"]) {
            onDone(
              data as unknown as {
                usage: {
                  prompt_tokens: number;
                  completion_tokens: number;
                  total_tokens: number;
                };
                latency_ms: number;
                model: string;
              },
            );
          }
        } catch {
          // 跳过无法解析的行
        }
      }
    }
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}

/** Embedding */
export async function callEmbedding(
  req: EmbeddingRequest,
): Promise<EmbeddingResponse> {
  const res = await apiClient.request<ApiResponse<EmbeddingResponse>>({
    method: "POST",
    path: ENDPOINTS.EMBEDDINGS,
    body: req,
  });
  return res.data;
}

/** Rerank */
export async function callRerank(
  req: RerankRequest,
): Promise<RerankResponse> {
  const res = await apiClient.request<ApiResponse<RerankResponse>>({
    method: "POST",
    path: ENDPOINTS.RERANK,
    body: req,
  });
  return res.data;
}

/** 槽位调用 */
export async function invokeSlot(
  slotType: SlotType,
  req: SlotInvokeRequest,
): Promise<SlotInvokeResponse> {
  const res = await apiClient.request<ApiResponse<SlotInvokeResponse>>({
    method: "POST",
    path: ENDPOINTS.SLOT_INVOKE(slotType),
    body: req,
  });
  return res.data;
}
