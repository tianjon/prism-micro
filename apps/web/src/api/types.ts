/**
 * API 类型定义。
 * 兼容层：当前手写类型逐步迁移到 openapi-typescript 生成类型。
 */

import type { paths as GeneratedPaths } from "./generated";

export type OpenAPIPaths = GeneratedPaths;

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

// ========== VOC 导入 ==========

export interface FileInfo {
  file_name: string;
  file_size_bytes: number;
  total_rows: number;
  detected_encoding: string;
  detected_format: string;
}

export interface UploadResponse {
  batch_id: string;
  status: string;
  message: string;
  file_info: FileInfo;
  file_hash: string | null;
  duplicate_batch_id: string | null;
  mapping_preview_url: string | null;
  matched_mapping: Record<string, unknown> | null;
}

export interface ColumnMapping {
  source_column: string;
  target_field: string;
  confidence: number;
  sample_values: string[];
  needs_confirmation: boolean;
}

export interface MappingPreview {
  batch_id: string;
  source_format: string;
  overall_confidence: number;
  column_mappings: ColumnMapping[];
  unmapped_columns: string[];
  sample_rows: Record<string, unknown>[];
}

export interface ConfirmMappingRequest {
  confirmed_mappings: Record<string, Record<string, string | null>>;
  save_as_template?: boolean;
  template_name?: string | null;
}

export interface ConfirmMappingResponse {
  batch_id: string;
  status: string;
  message: string;
  mapping_id: string;
  template_saved: boolean;
}

export interface BatchStatus {
  batch_id: string;
  status: string;
  source: string;
  file_name: string | null;
  progress: {
    total_count: number;
    new_count: number;
    duplicate_count: number;
    failed_count: number;
  };
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

// ========== VOC 导入 v2 新增 ==========

export interface ColumnStats {
  name: string;
  dtype: string;
  total_count: number;
  total_rows: number;
  unique_count: number;
  null_count: number;
  sample_values: string[];
  min_value: string | null;
  max_value: string | null;
  mean_value: string | null;
}

export interface DataPreview {
  batch_id: string;
  rows: Record<string, unknown>[];
  columns: ColumnStats[];
  total_rows: number;
}

export interface PromptPreview {
  batch_id: string;
  prompt_text: string | null;
  source: "llm_generated" | "template_reused" | "cache_hit";
  template_name: string | null;
  cache_hit: boolean;
  cached_mapping_id: string | null;
}

export interface ResultPreview {
  batch_id: string;
  sample_rows: Record<string, unknown>[];
  statistics: {
    total_count: number;
    new_count: number;
    duplicate_count: number;
    failed_count: number;
  };
}

export interface GenerateMappingRequest {
  dedup_columns: string[];
}

export interface BuildPromptRequest {
  dedup_columns: string[];
}

export interface UpdatePromptRequest {
  prompt_text: string;
}

// ========== VOC 搜索 ==========

export interface SearchRequest {
  query: string;
  top_k?: number;
  rerank?: boolean;
  min_confidence?: number;
}

export interface SearchTagBrief {
  id: string;
  name: string;
  relevance: number;
  is_primary: boolean;
}

export interface SearchVoiceBrief {
  id: string;
  source: string;
  created_at: string;
}

export interface SearchResultItem {
  unit_id: string;
  text: string;
  summary: string | null;
  intent: string | null;
  sentiment: string | null;
  confidence: number | null;
  confidence_tier: string;
  similarity_score: number;
  rerank_score: number | null;
  tags: SearchTagBrief[];
  voice: SearchVoiceBrief;
}

export interface SearchResponse {
  query: string;
  total: number;
  results: SearchResultItem[];
}

// ========== VOC 标签 ==========

export interface FeedbackSummary {
  useful: number;
  useless: number;
  error: number;
}

export interface TagListItem {
  id: string;
  name: string;
  usage_count: number;
  confidence: number | null;
  confidence_tier: string;
  status: string;
  feedback_summary: FeedbackSummary;
  created_at: string;
}

export interface TagDetail extends TagListItem {
  raw_name: string;
  parent_tag_id: string | null;
  unit_count: number;
  updated_at: string;
}

export interface TagUnitItem {
  unit_id: string;
  text: string;
  summary: string | null;
  intent: string | null;
  sentiment: string | null;
  relevance: number;
  is_primary: boolean;
  created_at: string;
}

export interface FeedbackRequest {
  feedback_type: "useful" | "useless" | "error";
}

export interface FeedbackResponse {
  tag_id: string;
  feedback_type: string;
  previous_feedback_type: string | null;
  is_update: boolean;
}

export interface CompareSummary {
  total_units: number;
  emergent_coverage: number;
  preset_coverage: number;
  emergent_only_count: number;
  preset_only_count: number;
  both_count: number;
}

export interface ComparisonItem {
  unit_id: string;
  text: string;
  emergent_tags: string[];
  preset_matches: string[];
  verdict: string;
}

export interface CompareResponse {
  summary: CompareSummary;
  items: ComparisonItem[];
  page: number;
  page_size: number;
  total: number;
}

// ========== VOC 详情 ==========

export interface UnitTagInfo {
  tag_id: string;
  tag_name: string;
  relevance: number;
  is_primary: boolean;
}

export interface VoiceBrief {
  id: string;
  source: string;
  raw_text: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface UnitDetail {
  id: string;
  voice_id: string;
  text: string;
  summary: string | null;
  intent: string | null;
  sentiment: string | null;
  confidence: number | null;
  confidence_tier: string;
  sequence_index: number;
  tags: UnitTagInfo[];
  voice: VoiceBrief;
  created_at: string;
}

export interface VoiceUnitItem {
  id: string;
  text: string;
  summary: string | null;
  intent: string | null;
  sentiment: string | null;
  confidence: number | null;
  confidence_tier: string;
  sequence_index: number;
  tags: UnitTagInfo[];
}

export interface VoiceDetail {
  id: string;
  source: string;
  raw_text: string;
  content_hash: string;
  batch_id: string | null;
  processed_status: string;
  metadata: Record<string, unknown> | null;
  units: VoiceUnitItem[];
  created_at: string;
}

// ========== VOC 数据管理 ==========

export interface DataBatch {
  id: string;
  source: string;
  file_name: string | null;
  file_size_bytes: number | null;
  status: string;
  total_count: number;
  new_count: number;
  duplicate_count: number;
  failed_count: number;
  mapping_id: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  file_hash: string | null;
  file_statistics: Record<string, unknown> | null;
  dedup_columns: string[] | null;
  prompt_text: string | null;
  mapping_name: string | null;
  updated_at: string;
}

/** @deprecated 使用 DataBatch */
export type DataBatchListItem = DataBatch;
/** @deprecated 使用 DataBatch */
export type DataBatchDetail = DataBatch;

export interface DataMapping {
  id: string;
  name: string;
  source_format: string;
  created_by: string;
  confidence: number | null;
  column_hash: string;
  usage_count: number;
  created_at: string;
  column_mappings: Record<string, unknown> | null;
  sample_data: Record<string, unknown> | null;
  updated_at: string | null;
}

/** @deprecated 使用 DataMapping */
export type DataMappingListItem = DataMapping;
/** @deprecated 使用 DataMapping */
export type DataMappingDetail = DataMapping;

export interface DataVoiceListItem {
  id: string;
  source: string;
  raw_text: string;
  content_hash: string;
  source_key: string | null;
  batch_id: string | null;
  processed_status: string;
  processing_error: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DataDeleteResponse {
  id: string;
  deleted: boolean;
  message: string;
}

// ========== 平台日志 ==========

export interface LogEntry {
  timestamp: string;
  level: string;
  service: string;
  module: string;
  event: string;
  extra: Record<string, unknown> | null;
}

export interface LogQueryParams {
  service?: string;
  module?: string;
  level?: string;
  since?: string;
  until?: string;
  page?: number;
  page_size?: number;
}

export interface LogFiltersResponse {
  services: string[];
  modules: string[];
  levels: string[];
}
