/**
 * Toast 通知容器。
 * Liquid Glass 风格，右上角展示。
 */

import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { useToastStore, type ToastVariant } from "@/hooks/use-toast";

const variantConfig: Record<
  ToastVariant,
  { icon: React.ReactNode; borderColor: string }
> = {
  default: {
    icon: <Info size={ICON_SIZE.lg} className="text-blue-400" />,
    borderColor: "border-l-blue-400",
  },
  success: {
    icon: <CheckCircle size={ICON_SIZE.lg} className="text-green-400" />,
    borderColor: "border-l-green-400",
  },
  error: {
    icon: <AlertCircle size={ICON_SIZE.lg} className="text-red-400" />,
    borderColor: "border-l-red-400",
  },
  warning: {
    icon: <AlertTriangle size={ICON_SIZE.lg} className="text-yellow-400" />,
    borderColor: "border-l-yellow-400",
  },
};

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-4 top-4 z-[var(--z-toast)] flex flex-col gap-3">
      {toasts.map((toast) => {
        const config = variantConfig[toast.variant];
        return (
          <div
            key={toast.id}
            className={cn(
              "glass-toast flex w-80 items-start gap-3 border-l-2 p-4 animate-fade-in",
              config.borderColor,
            )}
          >
            <div className="mt-0.5 shrink-0">{config.icon}</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white/90">{toast.title}</p>
              {toast.description && (
                <p className="mt-1 text-xs text-white/50">{toast.description}</p>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 cursor-pointer rounded p-0.5 text-white/30 transition-colors hover:text-white/60"
              aria-label="关闭通知"
            >
              <X size={ICON_SIZE.md} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
