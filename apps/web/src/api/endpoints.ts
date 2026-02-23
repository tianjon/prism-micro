/**
 * API 端点常量。
 */

export const ENDPOINTS = {
  // 认证
  AUTH_LOGIN: "/api/auth/login",
  AUTH_REFRESH: "/api/auth/refresh",
  AUTH_ME: "/api/auth/me",

  // Provider
  PROVIDERS: "/api/llm/providers",
  PROVIDER_PRESETS: "/api/llm/providers/presets",
  PROVIDER: (id: string) => `/api/llm/providers/${id}`,
  PROVIDER_MODELS: (id: string) => `/api/llm/providers/${id}/models`,
  PROVIDER_TEST: (id: string) => `/api/llm/providers/${id}/test`,

  // 槽位
  SLOTS: "/api/llm/slots",
  SLOT: (type: string) => `/api/llm/slots/${type}`,
  SLOT_INVOKE: (type: string) => `/api/llm/slots/${type}/invoke`,
  ADMIN_SLOTS: "/api/llm/admin/slots",
  ADMIN_SLOT: (type: string) => `/api/llm/admin/slots/${type}`,
  ADMIN_SLOT_TEST: (type: string) => `/api/llm/admin/slots/${type}/test`,
  CHAT_SLOT: "/api/llm/chat",
  EMBEDDING_SLOT: "/api/llm/embedding",
  RERANK_SLOT: "/api/llm/rerank/slot",

  // 推理代理网关
  COMPLETIONS: "/api/llm/completions",
  EMBEDDINGS: "/api/llm/embeddings",
  RERANK: "/api/llm/rerank",

  // VOC 数据导入
  VOC_UPLOAD: "/api/voc/import",
  VOC_BATCH_STATUS: (id: string) => `/api/voc/import/${id}/status`,
  VOC_DATA_PREVIEW: (id: string) => `/api/voc/import/${id}/data-preview`,
  VOC_BUILD_PROMPT: (id: string) => `/api/voc/import/${id}/build-prompt`,
  VOC_UPDATE_PROMPT: (id: string) => `/api/voc/import/${id}/prompt-text`,
  VOC_GENERATE_MAPPING: (id: string) => `/api/voc/import/${id}/generate-mapping`,
  VOC_PROMPT_TEXT: (id: string) => `/api/voc/import/${id}/prompt-text`,
  VOC_MAPPING_PREVIEW: (id: string) => `/api/voc/import/${id}/mapping-preview`,
  VOC_CONFIRM_MAPPING: (id: string) => `/api/voc/import/${id}/confirm-mapping`,
  VOC_RESULT_PREVIEW: (id: string) => `/api/voc/import/${id}/result-preview`,

  // VOC 搜索
  VOC_SEARCH: "/api/voc/search",

  // VOC 标签
  VOC_TAGS: "/api/voc/tags",
  VOC_TAG_DETAIL: (id: string) => `/api/voc/tags/${id}`,
  VOC_TAG_FEEDBACK: (id: string) => `/api/voc/tags/${id}/feedback`,
  VOC_TAG_UNITS: (id: string) => `/api/voc/tags/${id}/units`,
  VOC_TAGS_COMPARE: "/api/voc/tags/compare",

  // VOC 详情
  VOC_UNIT_DETAIL: (id: string) => `/api/voc/units/${id}`,
  VOC_VOICE_DETAIL: (id: string) => `/api/voc/voices/${id}`,

  // VOC 数据管理
  VOC_DATA_BATCHES: "/api/voc/data/batches",
  VOC_DATA_BATCH: (id: string) => `/api/voc/data/batches/${id}`,
  VOC_DATA_MAPPINGS: "/api/voc/data/mappings",
  VOC_DATA_MAPPING: (id: string) => `/api/voc/data/mappings/${id}`,
  VOC_DATA_VOICES: "/api/voc/data/voices",
  VOC_DATA_VOICE: (id: string) => `/api/voc/data/voices/${id}`,
  VOC_DATA_VOICE_METADATA_KEYS: "/api/voc/data/voices/metadata-keys",
  VOC_DATA_BATCH_FIELD_VALUES: "/api/voc/data/batches/field-values",
  VOC_DATA_MAPPING_FIELD_VALUES: "/api/voc/data/mappings/field-values",
  VOC_DATA_VOICE_FIELD_VALUES: "/api/voc/data/voices/field-values",

  // VOC 管线
  VOC_PIPELINE_PROCESS: "/api/voc/pipeline/process",

  // 平台
  PLATFORM_LOGS: "/api/platform/logs",
  PLATFORM_LOG_FILTERS: "/api/platform/logs/filters",
} as const;
