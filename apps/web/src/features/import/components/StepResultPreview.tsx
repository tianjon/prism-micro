/**
 * 步骤 6：导入结果预览。
 * 展示导入统计 + 抽样数据表格 + AI 管线按钮。
 */

import { useEffect } from "react";
import {
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Rows3,
} from "lucide-react";
import { ICON_SIZE } from "@/lib/icon-sizes";
import type { BatchStatus, ResultPreview } from "@/api/types";

interface StepResultPreviewProps {
  batchStatus: BatchStatus | null;
  resultPreview: ResultPreview | null;
  processing: boolean;
  onLoadResultPreview: () => Promise<void>;
  onTriggerPipeline: () => Promise<void>;
}

export function StepResultPreview({
  batchStatus,
  resultPreview,
  processing,
  onLoadResultPreview,
  onTriggerPipeline,
}: StepResultPreviewProps) {
  const status = batchStatus?.status;
  const isCompleted = status === "completed";
  const isPartial = status === "partially_completed";
  const isFailed = status === "failed";
  const stats = resultPreview?.statistics ?? batchStatus?.progress;

  // 加载结果预览
  useEffect(() => {
    if (isCompleted || isPartial) {
      void onLoadResultPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <div className="animate-fade-in space-y-6">
      {/* 状态图标 + 标题 */}
      {isCompleted && (
        <div className="glass-card flex items-center gap-3 px-6 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10">
            <CheckCircle2 size={ICON_SIZE["2xl"]} className="text-green-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-green-400">导入完成</p>
            <p className="text-xs text-white/40">全部数据已成功导入</p>
          </div>
        </div>
      )}

      {isPartial && (
        <div className="glass-card flex items-center gap-3 px-6 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
            <AlertTriangle size={ICON_SIZE["2xl"]} className="text-amber-400" />
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
      )}

      {isFailed && (
        <div className="glass-card flex items-center gap-3 px-6 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
            <XCircle size={ICON_SIZE["2xl"]} className="text-red-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-red-400">导入失败</p>
            <p className="text-xs text-white/40">
              {batchStatus?.error_message ?? "未知错误，请查看后端日志"}
            </p>
          </div>
        </div>
      )}

      {/* 导入统计 */}
      {stats && (isCompleted || isPartial) && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="glass-panel px-4 py-3">
            <p className="text-xs text-white/40">总行数</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {stats.total_count.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl bg-green-500/[0.05] px-4 py-3">
            <p className="text-xs text-green-400/60">新增</p>
            <p className="mt-1 text-lg font-semibold text-green-400">
              {stats.new_count.toLocaleString()}
            </p>
          </div>
          <div className="glass-panel px-4 py-3">
            <p className="text-xs text-white/40">重复跳过</p>
            <p className="mt-1 text-lg font-semibold text-white/60">
              {stats.duplicate_count.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl bg-red-500/[0.05] px-4 py-3">
            <p className="text-xs text-red-400/60">失败</p>
            <p className="mt-1 text-lg font-semibold text-red-400">
              {stats.failed_count}
            </p>
          </div>
        </div>
      )}

      {/* 抽样数据表格 */}
      {resultPreview && resultPreview.sample_rows.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
            <Rows3 size={ICON_SIZE.md} className="text-white/40" />
            <span className="text-sm font-medium text-white/60">
              抽样数据（{resultPreview.sample_rows.length} 行）
            </span>
          </div>
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[var(--color-surface-1)]">
                <tr className="border-b border-white/5 text-left text-white/40">
                  <th className="whitespace-nowrap px-3 py-2 font-medium">
                    source_key
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">
                    raw_text
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">
                    metadata
                  </th>
                </tr>
              </thead>
              <tbody>
                {resultPreview.sample_rows.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-white/[0.03] last:border-b-0"
                  >
                    <td className="whitespace-nowrap px-3 py-1.5 font-mono text-white/50">
                      {String(row.source_key ?? "-")}
                    </td>
                    <td
                      className="max-w-[300px] truncate px-3 py-1.5 text-white/60"
                      title={String(row.raw_text ?? "")}
                    >
                      {String(row.raw_text ?? "")}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-1.5 font-mono text-white/40">
                      {row.metadata
                        ? JSON.stringify(row.metadata).slice(0, 80)
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 加载中 */}
      {(isCompleted || isPartial) && !resultPreview && (
        <div className="flex items-center justify-center gap-3 py-8">
          <Loader2
            size={ICON_SIZE.xl}
            className="animate-spin-slow text-indigo-400"
          />
          <span className="text-sm text-white/50">正在加载结果预览...</span>
        </div>
      )}

      {/* AI 管线按钮 */}
      {(isCompleted || isPartial) && (
        <button
          onClick={() => void onTriggerPipeline()}
          disabled={processing}
          className="glass-btn-primary flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {processing ? (
            <>
              <Loader2 size={ICON_SIZE.md} className="animate-spin-slow" />
              管线处理中...
            </>
          ) : (
            <>
              <Play size={ICON_SIZE.md} />
              触发 AI 管线
            </>
          )}
        </button>
      )}
    </div>
  );
}
