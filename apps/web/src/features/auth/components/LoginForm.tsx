/**
 * 登录表单组件。
 * Liquid Glass 风格输入框 + 登录按钮。
 */

import { useState, type FormEvent } from "react";
import { Mail, Lock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoginFormProps {
  onSubmit: (email: string, password: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function LoginForm({ onSubmit, isLoading, error }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void onSubmit(email, password);
  };

  const isValid = email.length > 0 && password.length >= 8;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* 邮箱输入 */}
      <div className="space-y-1.5">
        <label htmlFor="login-email" className="block text-sm font-medium text-white/60">
          邮箱地址
        </label>
        <div className="relative">
          <Mail
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30"
          />
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="glass-input h-11 w-full pl-10 pr-4 text-sm"
            autoComplete="email"
            disabled={isLoading}
          />
        </div>
      </div>

      {/* 密码输入 */}
      <div className="space-y-1.5">
        <label htmlFor="login-password" className="block text-sm font-medium text-white/60">
          密码
        </label>
        <div className="relative">
          <Lock
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30"
          />
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="至少 8 位"
            className="glass-input h-11 w-full pl-10 pr-4 text-sm"
            autoComplete="current-password"
            disabled={isLoading}
          />
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* 登录按钮 */}
      <button
        type="submit"
        disabled={!isValid || isLoading}
        className={cn(
          "glass-btn-primary flex h-11 w-full items-center justify-center gap-2 text-sm",
          !isValid && "opacity-40 cursor-not-allowed",
        )}
      >
        {isLoading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            登录中...
          </>
        ) : (
          "登录"
        )}
      </button>
    </form>
  );
}
