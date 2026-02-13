/**
 * 认证全局状态。
 * 使用 Zustand + persist 中间件持久化到 localStorage。
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserInfo } from "@/api/types";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserInfo | null;

  setTokens: (access: string, refresh: string) => void;
  setUser: (user: UserInfo) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,

      setTokens: (access, refresh) =>
        set({ accessToken: access, refreshToken: refresh }),

      setUser: (user) => set({ user }),

      logout: () =>
        set({ accessToken: null, refreshToken: null, user: null }),

      isAuthenticated: () => get().accessToken !== null,
    }),
    {
      name: "prism-auth",
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    },
  ),
);
