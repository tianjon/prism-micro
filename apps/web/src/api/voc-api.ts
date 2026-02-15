/**
 * VOC 模块 API 封装。
 */

import { apiClient } from "@/api/client";
import { ENDPOINTS } from "@/api/endpoints";
import type {
  ApiResponse,
  PaginatedResponse,
  BatchStatus,
  MappingPreview,
  UploadResponse,
  ConfirmMappingRequest,
  ConfirmMappingResponse,
  SearchRequest,
  SearchResponse,
  TagListItem,
  TagDetail,
  TagUnitItem,
  FeedbackRequest,
  FeedbackResponse,
  CompareResponse,
  UnitDetail,
  VoiceDetail,
} from "@/api/types";

// ---- 数据导入 ----

/** 上传 CSV/XLSX 文件 */
export async function uploadFile(
  file: File,
  source: string,
  signal?: AbortSignal,
): Promise<ApiResponse<UploadResponse>> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("source", source);
  return apiClient.request<ApiResponse<UploadResponse>>({
    method: "POST",
    path: ENDPOINTS.VOC_UPLOAD,
    formData,
    signal,
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
