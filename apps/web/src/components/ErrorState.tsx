/**
 * 错误状态组件。
 */

import { AlertCircle, RefreshCw } from "lucide-react";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "出错了",
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10">
        <AlertCircle size={24} className="text-red-400" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-white/90">{title}</h3>
        <p className="mt-1 text-sm text-white/50">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="glass-btn-ghost flex items-center gap-2 px-4 py-2 text-sm"
        >
          <RefreshCw size={14} />
          重试
        </button>
      )}
    </div>
  );
}
