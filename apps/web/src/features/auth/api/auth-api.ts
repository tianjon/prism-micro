/**
 * 认证 API 封装。
 */

import { apiClient } from "@/api/client";
import { ENDPOINTS } from "@/api/endpoints";
import type {
  ApiResponse,
  LoginRequest,
  LoginResponse,
} from "@/api/types";

/** 用户登录 */
export async function login(
  data: LoginRequest,
): Promise<ApiResponse<LoginResponse>> {
  return apiClient.request<ApiResponse<LoginResponse>>({
    method: "POST",
    path: ENDPOINTS.AUTH_LOGIN,
    body: data,
    skipAuth: true,
  });
}
