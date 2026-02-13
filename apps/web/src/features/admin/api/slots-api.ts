/**
 * 槽位配置 API 封装。
 */

import { apiClient } from "@/api/client";
import { ENDPOINTS } from "@/api/endpoints";
import type {
  ApiResponse,
  SlotConfig,
  SlotConfigureRequest,
} from "@/api/types";

/** 获取所有槽位配置 */
export async function fetchSlots(): Promise<ApiResponse<SlotConfig[]>> {
  return apiClient.request<ApiResponse<SlotConfig[]>>({
    method: "GET",
    path: ENDPOINTS.SLOTS,
  });
}

/** 获取单个槽位配置 */
export async function fetchSlot(
  slotType: string,
): Promise<ApiResponse<SlotConfig>> {
  return apiClient.request<ApiResponse<SlotConfig>>({
    method: "GET",
    path: ENDPOINTS.SLOT(slotType),
  });
}

/** 配置槽位 */
export async function configureSlot(
  slotType: string,
  data: SlotConfigureRequest,
): Promise<ApiResponse<SlotConfig>> {
  return apiClient.request<ApiResponse<SlotConfig>>({
    method: "PUT",
    path: ENDPOINTS.SLOT(slotType),
    body: data,
  });
}
