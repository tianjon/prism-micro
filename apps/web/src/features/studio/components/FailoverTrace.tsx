/**
 * 故障转移时间线可视化。
 * 每步的 Provider/Model、成功/失败状态。
 */

import { CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ICON_SIZE } from "@/lib/icon-sizes";
import type { FailoverTraceItem } from "@/api/types";

interface FailoverTraceProps {
  trace: FailoverTraceItem[];
}

export function FailoverTrace({ trace }: FailoverTraceProps) {
  if (trace.length === 0) return null;

  return (
    <div className="space-y-1">
      <h4 className="text-xs font-medium text-white/40">故障转移路径</h4>
      <div className="space-y-0">
        {trace.map((item, i) => (
          <div key={i} className="flex items-start gap-3">
            {/* 时间线连接线 */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full",
                  item.success
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-red-500/20 text-red-400",
                )}
              >
                {item.success ? (
                  <CheckCircle size={ICON_SIZE.sm} />
                ) : (
                  <XCircle size={ICON_SIZE.sm} />
                )}
              </div>
              {i < trace.length - 1 && (
                <div className="h-4 w-px bg-white/10" />
              )}
            </div>

            {/* 信息 */}
            <div className="min-w-0 pb-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium text-white/70">
                  {item.provider_name}
                </span>
                <span className="text-white/30">/</span>
                <span className="font-mono text-white/50">
                  {item.model_id}
                </span>
              </div>
              {!item.success && item.error && (
                <p className="mt-0.5 text-[11px] text-red-400/70 truncate max-w-md">
                  {item.error}
                </p>
              )}
              {item.success && item.latency_ms != null && (
                <p className="mt-0.5 text-[11px] text-emerald-400/60">
                  {item.latency_ms}ms
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
