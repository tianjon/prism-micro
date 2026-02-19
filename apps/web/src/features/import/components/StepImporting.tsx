/**
 * 步骤 5：导入进度。
 * 展示实时导入进度条和计数器。
 */

import { Loader2 } from "lucide-react";
import { ICON_SIZE } from "@/lib/icon-sizes";
import type { BatchStatus } from "@/api/types";

interface StepImportingProps {
  batchStatus: BatchStatus | null;
  processing: boolean;
}

export function StepImporting({ batchStatus, processing }: StepImportingProps) {
  const progress = batchStatus?.progress;
  const status = batchStatus?.status;

  const processedCount = progress
    ? progress.new_count + progress.duplicate_count + progress.failed_count
    : 0;
  const totalCount = progress?.total_count ?? 0;
  const progressPercent =
    totalCount > 0 ? Math.round((processedCount / totalCount) * 100) : 0;

  return (
    <div className="animate-fade-in space-y-6">
      {/* 导入中 */}
      {status === "importing" && (
        <div className="glass-card space-y-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <Loader2
              size={ICON_SIZE.xl}
              className="animate-spin-slow text-indigo-400"
            />
            <span className="text-sm font-medium text-white/80">
              正在导入数据...
            </span>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between text-xs text-white/40">
              <span>
                已处理 {processedCount.toLocaleString()} / {totalCount.toLocaleString()}
              </span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* 实时计数器 */}
          {progress && (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-green-500/[0.05] px-3 py-2">
                <p className="text-xs text-green-400/60">新增</p>
                <p className="text-sm font-semibold text-green-400">
                  {progress.new_count.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl bg-white/[0.03] px-3 py-2">
                <p className="text-xs text-white/40">重复</p>
                <p className="text-sm font-semibold text-white/60">
                  {progress.duplicate_count.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl bg-red-500/[0.05] px-3 py-2">
                <p className="text-xs text-red-400/60">失败</p>
                <p className="text-sm font-semibold text-red-400">
                  {progress.failed_count}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 尚未获取到状态 */}
      {processing && !batchStatus && (
        <div className="glass-card flex items-center justify-center gap-3 px-6 py-8">
          <Loader2
            size={ICON_SIZE.xl}
            className="animate-spin-slow text-indigo-400"
          />
          <span className="text-sm text-white/60">正在启动导入...</span>
        </div>
      )}
    </div>
  );
}
