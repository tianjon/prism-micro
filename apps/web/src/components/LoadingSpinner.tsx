/**
 * 加载动画组件。
 */

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  className?: string;
  size?: number;
  /** 全页加载时居中 */
  fullPage?: boolean;
}

export function LoadingSpinner({
  className,
  size = 24,
  fullPage = false,
}: LoadingSpinnerProps) {
  if (fullPage) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2
          size={size}
          className={cn("animate-spin-slow text-indigo-400", className)}
        />
      </div>
    );
  }

  return (
    <Loader2
      size={size}
      className={cn("animate-spin-slow text-indigo-400", className)}
    />
  );
}
