/**
 * API 类型定义。
 * Phase 1 手动定义，后续使用 openapi-typescript 自动生成。
 */

// ========== 通用响应 ==========

export interface ApiMeta {
  request_id: string;
  timestamp: string;
}

export interface ApiResponse<T> {
  data: T;
  meta: ApiMeta;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta: ApiMeta;
}

export interface PaginationMeta {
  page: number;
  page_size: number;
  total: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
  meta: ApiMeta;
}

// ========== 认证 ==========

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UserInfo {
  id: string;
  email: string;
  username: string;
  is_active: boolean;
  role: string;
  created_at: string;
}

export interface TokensInfo {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface LoginResponse {
  user: UserInfo;
  tokens: TokensInfo;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface RefreshResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

// ========== Provider ==========

export interface ProviderPreset {
  preset_id: string;
  name: string;
  provider_type: string;
  description: string;
}

export interface Provider {
  id: string;
  name: string;
  slug: string;
  provider_type: string;
  base_url: string | null;
  is_enabled: boolean;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ProviderCreate {
  name: string;
  slug: string;
  provider_type?: string;
  base_url?: string;
  api_key: string;
  preset_id?: string;
  config?: Record<string, unknown>;
}

export interface ProviderUpdate {
  name?: string;
  slug?: string;
  provider_type?: string;
  base_url?: string;
  api_key?: string;
  is_enabled?: boolean;
  config?: Record<string, unknown>;
}

export interface ProviderModel {
  id: string;
  owned_by: string;
}

export interface ProviderTestRequest {
  test_type?: "chat" | "embedding" | "rerank" | "models";
  test_model_id?: string;
}

export interface ProviderTestResponse {
  provider_id: string;
  status: "ok" | "error";
  latency_ms: number | null;
  test_type: string;
  test_model_id: string | null;
  message: string;
  error_detail: string | null;
}

// ========== 槽位 ==========

export type SlotType = "fast" | "reasoning" | "embedding" | "rerank";

export interface ProviderBrief {
  id: string;
  name: string;
  slug: string;
}

export interface FallbackItemResponse {
  provider: ProviderBrief;
  model_id: string;
}

export interface SlotConfig {
  slot_type: SlotType;
  is_enabled: boolean;
  primary_provider: ProviderBrief | null;
  primary_model_id: string | null;
  fallback_chain: FallbackItemResponse[];
  config: Record<string, unknown>;
  updated_at: string | null;
}

export interface FallbackItem {
  provider_id: string;
  model_id: string;
}

export interface SlotConfigureRequest {
  primary_provider_id: string;
  primary_model_id: string;
  fallback_chain: FallbackItem[];
  is_enabled: boolean;
  config: Record<string, unknown>;
}

// ========== 推理代理网关 ==========

export interface MessageItem {
  role: string;
  content: string;
}

export interface UsageInfo {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface CompletionRequest {
  provider_id: string;
  model_id: string;
  messages: MessageItem[];
  stream?: boolean;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
}

export interface CompletionResponse {
  content: string;
  usage: UsageInfo;
  latency_ms: number;
  model: string;
}

export interface EmbeddingRequest {
  provider_id: string;
  model_id: string;
  input: string | string[];
}

export interface EmbeddingItem {
  index: number;
  values: number[];
  dimensions: number;
}

export interface EmbeddingResponse {
  embeddings: EmbeddingItem[];
  usage: UsageInfo;
  latency_ms: number;
  model: string;
}

export interface RerankRequest {
  provider_id: string;
  model_id: string;
  query: string;
  documents: string[];
}

export interface RerankResultItem {
  index: number;
  document: string;
  relevance_score: number;
}

export interface RerankResponse {
  results: RerankResultItem[];
  latency_ms: number;
  model: string;
}

export interface SlotInvokeRequest {
  messages: MessageItem[];
  max_tokens?: number;
}

export interface FailoverTraceItem {
  provider_name: string;
  model_id: string;
  success: boolean;
  error: string | null;
  latency_ms: number | null;
}

export interface RoutingInfo {
  provider_name: string;
  model_id: string;
  slot_type: SlotType;
  used_resource_pool: boolean;
  failover_trace: FailoverTraceItem[];
}

export interface SlotInvokeResponse {
  result: CompletionResponse;
  routing: RoutingInfo;
}
