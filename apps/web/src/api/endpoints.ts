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
  PROVIDER: (id: string) => `/api/llm/providers/${id}`,
  PROVIDER_TEST: (id: string) => `/api/llm/providers/${id}/test`,

  // 槽位
  SLOTS: "/api/llm/slots",
  SLOT: (type: string) => `/api/llm/slots/${type}`,
} as const;
