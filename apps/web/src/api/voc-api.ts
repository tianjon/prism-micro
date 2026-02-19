/**
 * VOC 模块 API 封装。
 */

import { apiClient, ApiError } from "@/api/client";
import { ENDPOINTS } from "@/api/endpoints";
import { useAuthStore } from "@/stores/auth-store";
import { API_BASE } from "@/lib/constants";
import type {
  ApiResponse,
  PaginatedResponse,
  BatchStatus,
  BuildPromptRequest,
  MappingPreview,
  UploadResponse,
  ConfirmMappingRequest,
  ConfirmMappingResponse,
  DataPreview,
  GenerateMappingRequest,
  PromptPreview,
  ResultPreview,
  SearchRequest,
  SearchResponse,
  TagListItem,
  TagDetail,
  TagUnitItem,
  FeedbackRequest,
  FeedbackResponse,
  CompareResponse,
  UpdatePromptRequest,
  UnitDetail,
  VoiceDetail,
  DataBatchListItem,
  DataBatchDetail,
  DataMappingListItem,
  DataMappingDetail,
  DataVoiceListItem,
  DataDeleteResponse,
} from "@/api/types";

// ---- 数据导入 ----

/** 上传 CSV/XLSX 文件（XMLHttpRequest 实现，支持实时上传进度） */
export function uploadFile(
  file: File,
  source: string,
  signal?: AbortSignal,
  onProgress?: (percent: number) => void,
): Promise<ApiResponse<UploadResponse>> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);
    formData.append("source", source);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        onProgress?.(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      try {
        // 401 处理：token 过期，退出登录并跳转
        if (xhr.status === 401) {
          useAuthStore.getState().logout();
          window.location.href = "/login";
          reject(new ApiError("UNAUTHORIZED", "认证已过期，请重新登录", 401));
          return;
        }

        const json = JSON.parse(xhr.responseText) as unknown;
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(json as ApiResponse<UploadResponse>);
        } else {
          const err = json as {
            error?: { code?: string; message?: string; details?: Record<string, unknown> };
          };
          reject(
            new ApiError(
              err.error?.code ?? "UNKNOWN_ERROR",
              err.error?.message ?? "未知错误",
              xhr.status,
              err.error?.details,
            ),
          );
        }
      } catch {
        reject(new ApiError("PARSE_ERROR", "响应解析失败", xhr.status));
      }
    });

    xhr.addEventListener("error", () => reject(new ApiError("NETWORK_ERROR", "网络错误", 0)));
    xhr.addEventListener("abort", () => reject(new DOMException("上传已取消", "AbortError")));

    if (signal) {
      signal.addEventListener("abort", () => xhr.abort());
    }

    const url = `${API_BASE}${ENDPOINTS.VOC_UPLOAD}`;
    xhr.open("POST", url);

    const token = useAuthStore.getState().accessToken;
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }

    xhr.send(formData);
  });
}

/** 获取批次状态 */
export async function getBatchStatus(batchId: string): Promise<ApiResponse<BatchStatus>> {
  return apiClient.request<ApiResponse<BatchStatus>>({
    method: "GET",
    path: ENDPOINTS.VOC_BATCH_STATUS(batchId),
  });
}

/** 获取映射预览 */
export async function getMappingPreview(batchId: string): Promise<ApiResponse<MappingPreview>> {
  return apiClient.request<ApiResponse<MappingPreview>>({
    method: "GET",
    path: ENDPOINTS.VOC_MAPPING_PREVIEW(batchId),
  });
}

/** 确认字段映射 */
export async function confirmMapping(
  batchId: string,
  data: ConfirmMappingRequest,
): Promise<ApiResponse<ConfirmMappingResponse>> {
  return apiClient.request<ApiResponse<ConfirmMappingResponse>>({
    method: "POST",
    path: ENDPOINTS.VOC_CONFIRM_MAPPING(batchId),
    body: data,
  });
}

/** 获取数据预览 */
export async function getDataPreview(batchId: string): Promise<ApiResponse<DataPreview>> {
  return apiClient.request<ApiResponse<DataPreview>>({
    method: "GET",
    path: ENDPOINTS.VOC_DATA_PREVIEW(batchId),
  });
}

/** 构建映射提示词（同步返回） */
export async function buildPrompt(
  batchId: string,
  data: BuildPromptRequest,
): Promise<ApiResponse<PromptPreview>> {
  return apiClient.request<ApiResponse<PromptPreview>>({
    method: "POST",
    path: ENDPOINTS.VOC_BUILD_PROMPT(batchId),
    body: data,
  });
}

/** 保存编辑后的提示词 */
export async function updatePromptText(
  batchId: string,
  data: UpdatePromptRequest,
): Promise<ApiResponse<PromptPreview>> {
  return apiClient.request<ApiResponse<PromptPreview>>({
    method: "PUT",
    path: ENDPOINTS.VOC_UPDATE_PROMPT(batchId),
    body: data,
  });
}

/** 触发 LLM 映射生成 */
export async function generateMapping(
  batchId: string,
  data: GenerateMappingRequest,
): Promise<ApiResponse<UploadResponse>> {
  return apiClient.request<ApiResponse<UploadResponse>>({
    method: "POST",
    path: ENDPOINTS.VOC_GENERATE_MAPPING(batchId),
    body: data,
  });
}

/** 获取提示词预览 */
export async function getPromptText(batchId: string): Promise<ApiResponse<PromptPreview>> {
  return apiClient.request<ApiResponse<PromptPreview>>({
    method: "GET",
    path: ENDPOINTS.VOC_PROMPT_TEXT(batchId),
  });
}

/** 获取结果预览 */
export async function getResultPreview(batchId: string): Promise<ApiResponse<ResultPreview>> {
  return apiClient.request<ApiResponse<ResultPreview>>({
    method: "GET",
    path: ENDPOINTS.VOC_RESULT_PREVIEW(batchId),
  });
}

/** 触发 AI 管线处理 */
export async function triggerPipeline(batchId: string): Promise<ApiResponse<{ message: string }>> {
  return apiClient.request<ApiResponse<{ message: string }>>({
    method: "POST",
    path: ENDPOINTS.VOC_PIPELINE_PROCESS,
    body: { batch_id: batchId },
  });
}

// ---- 语义搜索 ----

/** 语义搜索 */
export async function searchUnits(data: SearchRequest): Promise<ApiResponse<SearchResponse>> {
  return apiClient.request<ApiResponse<SearchResponse>>({
    method: "POST",
    path: ENDPOINTS.VOC_SEARCH,
    body: data,
  });
}

// ---- 标签管理 ----

/** 标签列表 */
export async function fetchTags(params: {
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_order?: string;
  status?: string;
  min_usage?: number;
  confidence_tier?: string;
}): Promise<PaginatedResponse<TagListItem>> {
  return apiClient.request<PaginatedResponse<TagListItem>>({
    method: "GET",
    path: ENDPOINTS.VOC_TAGS,
    params: params as Record<string, string | number>,
  });
}

/** 标签详情 */
export async function fetchTagDetail(tagId: string): Promise<ApiResponse<TagDetail>> {
  return apiClient.request<ApiResponse<TagDetail>>({
    method: "GET",
    path: ENDPOINTS.VOC_TAG_DETAIL(tagId),
  });
}

/** 标签关联单元列表 */
export async function fetchTagUnits(
  tagId: string,
  params?: { page?: number; page_size?: number; min_relevance?: number },
): Promise<PaginatedResponse<TagUnitItem>> {
  return apiClient.request<PaginatedResponse<TagUnitItem>>({
    method: "GET",
    path: ENDPOINTS.VOC_TAG_UNITS(tagId),
    params: params as Record<string, string | number>,
  });
}

/** 提交标签反馈 */
export async function submitTagFeedback(
  tagId: string,
  data: FeedbackRequest,
): Promise<ApiResponse<FeedbackResponse>> {
  return apiClient.request<ApiResponse<FeedbackResponse>>({
    method: "POST",
    path: ENDPOINTS.VOC_TAG_FEEDBACK(tagId),
    body: data,
  });
}

/** 标签对比 */
export async function compareTags(params: {
  preset_taxonomy: string;
  page?: number;
  page_size?: number;
}): Promise<ApiResponse<CompareResponse>> {
  return apiClient.request<ApiResponse<CompareResponse>>({
    method: "GET",
    path: ENDPOINTS.VOC_TAGS_COMPARE,
    params: params as Record<string, string | number>,
  });
}

// ---- 详情 ----

/** 语义单元详情 */
export async function fetchUnitDetail(unitId: string): Promise<ApiResponse<UnitDetail>> {
  return apiClient.request<ApiResponse<UnitDetail>>({
    method: "GET",
    path: ENDPOINTS.VOC_UNIT_DETAIL(unitId),
  });
}

/** Voice 详情 */
export async function fetchVoiceDetail(voiceId: string): Promise<ApiResponse<VoiceDetail>> {
  return apiClient.request<ApiResponse<VoiceDetail>>({
    method: "GET",
    path: ENDPOINTS.VOC_VOICE_DETAIL(voiceId),
  });
}

// ---- 数据管理 ----

/** 批次列表 */
export async function fetchBatches(params: {
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_order?: string;
  status?: string;
  source?: string;
  filters?: string;
}): Promise<PaginatedResponse<DataBatchListItem>> {
  return apiClient.request<PaginatedResponse<DataBatchListItem>>({
    method: "GET",
    path: ENDPOINTS.VOC_DATA_BATCHES,
    params: params as Record<string, string | number>,
  });
}

/** 批次详情 */
export async function fetchBatchDetail(batchId: string): Promise<ApiResponse<DataBatchDetail>> {
  return apiClient.request<ApiResponse<DataBatchDetail>>({
    method: "GET",
    path: ENDPOINTS.VOC_DATA_BATCH(batchId),
  });
}

/** 删除批次 */
export async function deleteBatch(batchId: string): Promise<ApiResponse<DataDeleteResponse>> {
  return apiClient.request<ApiResponse<DataDeleteResponse>>({
    method: "DELETE",
    path: ENDPOINTS.VOC_DATA_BATCH(batchId),
  });
}

/** 映射模板列表 */
export async function fetchMappings(params: {
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_order?: string;
  source_format?: string;
  created_by?: string;
  filters?: string;
}): Promise<PaginatedResponse<DataMappingListItem>> {
  return apiClient.request<PaginatedResponse<DataMappingListItem>>({
    method: "GET",
    path: ENDPOINTS.VOC_DATA_MAPPINGS,
    params: params as Record<string, string | number>,
  });
}

/** 映射模板详情 */
export async function fetchMappingDetail(mappingId: string): Promise<ApiResponse<DataMappingDetail>> {
  return apiClient.request<ApiResponse<DataMappingDetail>>({
    method: "GET",
    path: ENDPOINTS.VOC_DATA_MAPPING(mappingId),
  });
}

/** 删除映射模板 */
export async function deleteMapping(mappingId: string): Promise<ApiResponse<DataDeleteResponse>> {
  return apiClient.request<ApiResponse<DataDeleteResponse>>({
    method: "DELETE",
    path: ENDPOINTS.VOC_DATA_MAPPING(mappingId),
  });
}

/** Voice 列表 */
export async function fetchVoices(params: {
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_order?: string;
  processed_status?: string;
  source?: string;
  batch_id?: string;
  filters?: string;
}): Promise<PaginatedResponse<DataVoiceListItem>> {
  return apiClient.request<PaginatedResponse<DataVoiceListItem>>({
    method: "GET",
    path: ENDPOINTS.VOC_DATA_VOICES,
    params: params as Record<string, string | number>,
  });
}

/** 获取字段不重复取值（辅助完成） */
export async function fetchFieldValues(
  entity: "batches" | "mappings" | "voices",
  params: { field: string; prefix?: string },
): Promise<ApiResponse<{ values: string[]; has_more: boolean }>> {
  const pathMap = {
    batches: ENDPOINTS.VOC_DATA_BATCH_FIELD_VALUES,
    mappings: ENDPOINTS.VOC_DATA_MAPPING_FIELD_VALUES,
    voices: ENDPOINTS.VOC_DATA_VOICE_FIELD_VALUES,
  };
  return apiClient.request<ApiResponse<{ values: string[]; has_more: boolean }>>({
    method: "GET",
    path: pathMap[entity],
    params: params as Record<string, string>,
  });
}

/** 获取 Voice 元数据键列表 */
export async function fetchVoiceMetadataKeys(): Promise<ApiResponse<{ keys: string[] }>> {
  return apiClient.request<ApiResponse<{ keys: string[] }>>({
    method: "GET",
    path: ENDPOINTS.VOC_DATA_VOICE_METADATA_KEYS,
  });
}

/** 删除 Voice */
export async function deleteVoice(voiceId: string): Promise<ApiResponse<DataDeleteResponse>> {
  return apiClient.request<ApiResponse<DataDeleteResponse>>({
    method: "DELETE",
    path: ENDPOINTS.VOC_DATA_VOICE(voiceId),
  });
}
