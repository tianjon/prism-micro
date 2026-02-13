/**
 * Provider 管理 API 封装。
 */

import { apiClient } from "@/api/client";
import { ENDPOINTS } from "@/api/endpoints";
import type {
  ApiResponse,
  PaginatedResponse,
  Provider,
  ProviderCreate,
  ProviderUpdate,
  ProviderTestRequest,
  ProviderTestResponse,
} from "@/api/types";

/** 获取 Provider 列表 */
export async function fetchProviders(
  page = 1,
  pageSize = 50,
): Promise<PaginatedResponse<Provider>> {
  return apiClient.request<PaginatedResponse<Provider>>({
    method: "GET",
    path: ENDPOINTS.PROVIDERS,
    params: { page, page_size: pageSize },
  });
}

/** 获取单个 Provider */
export async function fetchProvider(
  id: string,
): Promise<ApiResponse<Provider>> {
  return apiClient.request<ApiResponse<Provider>>({
    method: "GET",
    path: ENDPOINTS.PROVIDER(id),
  });
}

/** 创建 Provider */
export async function createProvider(
  data: ProviderCreate,
): Promise<ApiResponse<Provider>> {
  return apiClient.request<ApiResponse<Provider>>({
    method: "POST",
    path: ENDPOINTS.PROVIDERS,
    body: data,
  });
}

/** 更新 Provider */
export async function updateProvider(
  id: string,
  data: ProviderUpdate,
): Promise<ApiResponse<Provider>> {
  return apiClient.request<ApiResponse<Provider>>({
    method: "PUT",
    path: ENDPOINTS.PROVIDER(id),
    body: data,
  });
}

/** 删除 Provider */
export async function deleteProvider(
  id: string,
): Promise<ApiResponse<{ message: string }>> {
  return apiClient.request<ApiResponse<{ message: string }>>({
    method: "DELETE",
    path: ENDPOINTS.PROVIDER(id),
  });
}

/** 测试 Provider 连通性 */
export async function testProvider(
  id: string,
  data?: ProviderTestRequest,
): Promise<ApiResponse<ProviderTestResponse>> {
  return apiClient.request<ApiResponse<ProviderTestResponse>>({
    method: "POST",
    path: ENDPOINTS.PROVIDER_TEST(id),
    body: data,
  });
}
