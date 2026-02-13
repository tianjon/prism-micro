/**
 * HTTP 请求封装。
 * 统一处理 Token 注入、401 刷新、错误格式化。
 */

import { useAuthStore } from "@/stores/auth-store";
import { API_BASE } from "@/lib/constants";

// ---- 请求配置 ----

interface RequestConfig {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  body?: unknown;
  params?: Record<string, string | number>;
  headers?: Record<string, string>;
  /** 是否跳过 Token 注入（用于登录/刷新等公开接口） */
  skipAuth?: boolean;
}

// ---- API 错误 ----

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ---- API 客户端 ----

class ApiClient {
  /** 防止并发刷新 */
  private refreshPromise: Promise<boolean> | null = null;

  /**
   * 统一 HTTP 请求方法。
   * 自动注入 Authorization header + 处理 401 刷新 + 统一错误格式。
   */
  async request<T>(config: RequestConfig): Promise<T> {
    const { method, path, body, params, headers, skipAuth } = config;

    const url = new URL(`${API_BASE}${path}`, window.location.origin);
    if (params) {
      Object.entries(params).forEach(([k, v]) =>
        url.searchParams.set(k, String(v)),
      );
    }

    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...headers,
    };

    if (!skipAuth) {
      const token = useAuthStore.getState().accessToken;
      if (token) {
        requestHeaders["Authorization"] = `Bearer ${token}`;
      }
    }

    const response = await fetch(url.toString(), {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    // 401 处理：尝试刷新 Token
    if (response.status === 401 && !skipAuth) {
      const refreshed = await this.tryRefreshToken();
      if (refreshed) {
        return this.request(config);
      }
      useAuthStore.getState().logout();
      window.location.href = "/login";
      throw new ApiError("UNAUTHORIZED", "认证已过期，请重新登录", 401);
    }

    const json: unknown = await response.json();

    if (!response.ok) {
      const err = json as {
        error?: { code?: string; message?: string; details?: Record<string, unknown> };
      };
      throw new ApiError(
        err.error?.code ?? "UNKNOWN_ERROR",
        err.error?.message ?? "未知错误",
        response.status,
        err.error?.details,
      );
    }

    return json as T;
  }

  /** 尝试刷新 Token，防止并发刷新 */
  private async tryRefreshToken(): Promise<boolean> {
    // 复用正在进行的刷新请求
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.doRefresh();
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async doRefresh(): Promise<boolean> {
    const refreshToken = useAuthStore.getState().refreshToken;
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (response.ok) {
        const json = (await response.json()) as {
          data: { access_token: string; refresh_token: string };
        };
        useAuthStore
          .getState()
          .setTokens(json.data.access_token, json.data.refresh_token);
        return true;
      }
    } catch {
      // 刷新失败，静默处理
    }
    return false;
  }
}

export const apiClient = new ApiClient();
