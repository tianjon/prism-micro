/**
 * 登录页。
 * 极简 Liquid Glass 风格，居中卡片。
 */

import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { useAuth } from "../hooks/use-auth";
import { LoginForm } from "../components/LoginForm";
import { ToastContainer } from "@/components/ToastContainer";

export function LoginPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { isLoading, error, login } = useAuth();

  // 已登录直接跳转
  if (accessToken) {
    return <Navigate to="/admin/slots" replace />;
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gray-950">
      {/* 背景装饰 -- 渐变光晕 */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-indigo-600/20 blur-[100px]" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-purple-600/20 blur-[100px]" />
        <div className="absolute left-1/2 top-1/2 h-60 w-60 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/5 blur-[80px]" />
      </div>

      {/* 登录卡片 */}
      <div className="relative z-10 w-full max-w-sm animate-fade-in">
        <div className="glass-card p-8">
          {/* Logo + 标题 */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
              <span className="text-xl font-bold text-white">P</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              欢迎使用 Prism
            </h1>
            <p className="mt-1 text-sm text-white/40">
              VOC 语义分析平台
            </p>
          </div>

          <LoginForm
            onSubmit={login}
            isLoading={isLoading}
            error={error}
          />
        </div>

        {/* 底部文字 */}
        <p className="mt-6 text-center text-xs text-white/20">
          AI 驱动的客户反馈语义分析
        </p>
      </div>

      <ToastContainer />
    </div>
  );
}
