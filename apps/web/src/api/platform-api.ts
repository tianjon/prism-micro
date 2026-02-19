/**
 * 平台模块 API 封装。
 */

import { apiClient } from "@/api/client";
import { ENDPOINTS } from "@/api/endpoints";
import type {
  ApiResponse,
  PaginatedResponse,
  LogEntry,
  LogQueryParams,
  LogFiltersResponse,
} from "@/api/types";

/** 查询日志列表 */
export async function fetchLogs(params: LogQueryParams): Promise<PaginatedResponse<LogEntry>> {
  return apiClient.request<PaginatedResponse<LogEntry>>({
    method: "GET",
    path: ENDPOINTS.PLATFORM_LOGS,
    params: params as Record<string, string | number>,
  });
}

/** 获取日志筛选器选项 */
export async function fetchLogFilters(): Promise<ApiResponse<LogFiltersResponse>> {
  return apiClient.request<ApiResponse<LogFiltersResponse>>({
    method: "GET",
    path: ENDPOINTS.PLATFORM_LOG_FILTERS,
  });
}
