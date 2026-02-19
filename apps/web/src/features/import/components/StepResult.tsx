/**
 * 步骤 7：导入结果。
 * 展示导入进度和最终结果（新增/去重/失败计数）。
 */

import {
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { ICON_SIZE } from "@/lib/icon-sizes";
import type { BatchStatus, UploadResponse } from "@/api/types";

interface StepResultProps {
  uploadResult: UploadResponse | null;
  batchStatus: BatchStatus | null;
  processing: boolean;
  onTriggerPipeline: () => Promise<void>;
}

export function StepResult({
  uploadResult,
  batchStatus,
  processing,
  onTriggerPipeline,
}: StepResultProps) {
  const progress = batchStatus?.progress;
  const status = batchStatus?.status;

  const processedCount = progress
    ? progress.new_count + progress.duplicate_count
    : 0;
  const totalCount = progress?.total_count ?? 0;
  const progressPercent =
    totalCount > 0 ? Math.round((processedCount / totalCount) * 100) : 0;

  const isCompleted = status === "completed";
  const isPartial = status === "partially_completed";
  const isFailed = status === "failed";

  return (
    <div className="animate-fade-in space-y-6">
      {/* 批次信息 */}
      {uploadResult && (
        <div className="glass-panel px-5 py-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-white/40">文件名</p>
              <p className="mt-1 text-sm font-medium text-white/80">
                {uploadResult.file_info.file_name}
              </p>
            </div>
            <div>
              <p className="text-xs text-white/40">总行数</p>
              <p className="mt-1 text-sm font-medium text-white/80">
                {uploadResult.file_info.total_rows}
              </p>
            </div>
            <div>
              <p className="text-xs text-white/40">批次 ID</p>
              <p className="mt-1 font-mono text-xs text-white/50">
                {uploadResult.batch_id}
              </p>
            </div>
          </div>
        </div>
      )}

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
                已处理 {processedCount} / {totalCount}
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
        </div>
      )}

      {/* 处理中但尚未获取到状态 */}
      {processing && !batchStatus && (
        <div className="glass-card flex items-center justify-center gap-3 px-6 py-8">
          <Loader2
            size={ICON_SIZE.xl}
            className="animate-spin-slow text-indigo-400"
          />
          <span className="text-sm text-white/60">正在启动...</span>
        </div>
      )}

      {/* 完成 */}
      {isCompleted && progress && (
        <div className="glass-card space-y-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10">
              <CheckCircle2
                size={ICON_SIZE["2xl"]}
                className="text-green-400"
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-green-400">导入完成</p>
              <p className="text-xs text-white/40">全部数据已成功导入</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-white/[0.03] px-4 py-3">
              <p className="text-xs text-white/40">总行数</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {progress.total_count}
              </p>
            </div>
            <div className="rounded-xl bg-green-500/[0.05] px-4 py-3">
              <p className="text-xs text-green-400/60">新增</p>
              <p className="mt-1 text-lg font-semibold text-green-400">
                {progress.new_count}
              </p>
            </div>
            <div className="rounded-xl bg-white/[0.03] px-4 py-3">
              <p className="text-xs text-white/40">重复跳过</p>
              <p className="mt-1 text-lg font-semibold text-white/60">
                {progress.duplicate_count}
              </p>
            </div>
          </div>

          <button
            onClick={() => void onTriggerPipeline()}
            className="glass-btn-primary flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm"
          >
            <Play size={ICON_SIZE.md} />
            触发 AI 管线
          </button>
        </div>
      )}

      {/* 部分完成 */}
      {isPartial && progress && (
        <div className="glass-card space-y-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
              <AlertTriangle
                size={ICON_SIZE["2xl"]}
                className="text-amber-400"
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-400">
                导入部分完成
              </p>
              <p className="text-xs text-white/40">
                部分记录写入失败（空文本）
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-white/[0.03] px-4 py-3">
              <p className="text-xs text-white/40">总行数</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {progress.total_count}
              </p>
            </div>
            <div className="rounded-xl bg-green-500/[0.05] px-4 py-3">
              <p className="text-xs text-green-400/60">新增</p>
              <p className="mt-1 text-lg font-semibold text-green-400">
                {progress.new_count}
              </p>
            </div>
            <div className="rounded-xl bg-white/[0.03] px-4 py-3">
              <p className="text-xs text-white/40">重复跳过</p>
              <p className="mt-1 text-lg font-semibold text-white/60">
                {progress.duplicate_count}
              </p>
            </div>
            <div className="rounded-xl bg-red-500/[0.05] px-4 py-3">
              <p className="text-xs text-red-400/60">失败</p>
              <p className="mt-1 text-lg font-semibold text-red-400">
                {progress.failed_count}
              </p>
            </div>
          </div>

          <button
            onClick={() => void onTriggerPipeline()}
            className="glass-btn-primary flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm"
          >
            <Play size={ICON_SIZE.md} />
            触发 AI 管线
          </button>
        </div>
      )}

      {/* 失败 */}
      {isFailed && batchStatus && (
        <div className="glass-card space-y-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
              <XCircle size={ICON_SIZE["2xl"]} className="text-red-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-red-400">导入失败</p>
              <p className="text-xs text-white/40">
                {batchStatus.error_message ?? "未知错误，请查看后端日志"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
