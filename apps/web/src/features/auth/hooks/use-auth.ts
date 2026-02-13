/**
 * 认证 hook。
 */

import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { login as loginApi } from "../api/auth-api";
import { ApiError } from "@/api/client";
import { useToast } from "@/hooks/use-toast";

interface UseAuthReturn {
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { setTokens, setUser } = useAuthStore();
  const { toast } = useToast();

  const login = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await loginApi({ email, password });
        const { user, tokens } = response.data;

        // 存储 token 和用户信息
        setTokens(tokens.access_token, tokens.refresh_token);
        setUser(user);

        toast({ title: `欢迎回来，${user.username}`, variant: "success" });

        // 跳转到默认页面
        navigate("/admin/slots", { replace: true });
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.status === 401) {
            setError("邮箱或密码错误");
          } else {
            setError(err.message);
          }
        } else {
          setError("网络连接失败，请检查网络");
        }
      } finally {
        setIsLoading(false);
      }
    },
    [navigate, setTokens, setUser, toast],
  );

  return { isLoading, error, login };
}
