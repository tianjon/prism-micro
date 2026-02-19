/**
 * 步骤 2：数据预览。
 * 展示前 50 行数据 + 全量列统计（pandas 生成）+ 去重键配置。
 */

import { useState, useEffect, useCallback } from "react";
import { Eye, Loader2, Rows3, Hash, Type } from "lucide-react";
import { cn } from "@/lib/utils";
import { ICON_SIZE } from "@/lib/icon-sizes";
import type { ColumnStats, DataPreview, UploadResponse } from "@/api/types";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 列概览信息（数值范围 or 高频样本） */
function ColumnOverview({ col }: { col: ColumnStats }) {
  if (col.dtype === "numeric" && col.min_value != null && col.max_value != null) {
    return (
      <div className="space-y-0.5">
        <span className="text-xs text-white/50">
          {col.min_value} ~ {col.max_value}
        </span>
        {col.mean_value != null && (
          <span className="block text-xs text-white/30">
            均值 {col.mean_value}
          </span>
        )}
      </div>
    );
  }

  if (col.sample_values.length === 0) {
    return <span className="text-xs text-white/20">-</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {col.sample_values.slice(0, 3).map((val, i) => (
        <span
          key={i}
          className="inline-block max-w-[120px] truncate rounded bg-white/5 px-1.5 py-0.5 text-xs text-white/40"
          title={val}
        >
          {val}
        </span>
      ))}
    </div>
  );
}

interface StepPreviewProps {
  uploadResult: UploadResponse | null;
  dataPreview: DataPreview | null;
  loading: boolean;
  onLoadPreview: () => Promise<void>;
  onBuildPrompt: (dedupColumns: string[]) => Promise<void>;
}

export function StepPreview({
  uploadResult,
  dataPreview,
  loading,
  onLoadPreview,
  onBuildPrompt,
}: StepPreviewProps) {
  const [selectedDedupCols, setSelectedDedupCols] = useState<string[]>([]);

  // 进入时自动加载预览
  useEffect(() => {
    void onLoadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleDedup = useCallback((colName: string) => {
    setSelectedDedupCols((prev) =>
      prev.includes(colName)
        ? prev.filter((c) => c !== colName)
        : [...prev, colName],
    );
  }, []);

  const handleSubmit = useCallback(async () => {
    await onBuildPrompt(selectedDedupCols);
  }, [selectedDedupCols, onBuildPrompt]);

  if (loading || !dataPreview) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <Loader2
          size={ICON_SIZE["3xl"]}
          className="animate-spin-slow text-indigo-400"
        />
        <p className="text-sm text-white/50">正在加载数据预览...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* 文件信息卡片 */}
      {uploadResult && (
        <div className="glass-panel px-5 py-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <p className="text-xs text-white/40">文件名</p>
              <p className="mt-1 text-sm font-medium text-white/80">
                {uploadResult.file_info.file_name}
              </p>
            </div>
            <div>
              <p className="text-xs text-white/40">文件大小</p>
              <p className="mt-1 text-sm font-medium text-white/80">
                {formatBytes(uploadResult.file_info.file_size_bytes)}
              </p>
            </div>
            <div>
              <p className="text-xs text-white/40">总行数</p>
              <p className="mt-1 text-sm font-medium text-white/80">
                {dataPreview.total_rows.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 数据表格（前 50 行） */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
          <Rows3 size={ICON_SIZE.md} className="text-white/40" />
          <span className="text-sm font-medium text-white/60">
            数据预览（前 {dataPreview.rows.length} 行）
          </span>
        </div>
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[var(--color-surface-1)]">
              <tr className="border-b border-white/5 text-left text-white/40">
                {dataPreview.columns.map((col) => (
                  <th
                    key={col.name}
                    className="whitespace-nowrap px-3 py-2 font-medium"
                  >
                    {col.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataPreview.rows.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-white/[0.03] last:border-b-0"
                >
                  {dataPreview.columns.map((col) => (
                    <td
                      key={col.name}
                      className="max-w-[200px] truncate whitespace-nowrap px-3 py-1.5 font-mono text-white/60"
                      title={String(row[col.name] ?? "")}
                    >
                      {String(row[col.name] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 全量列统计信息 */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
          <Eye size={ICON_SIZE.md} className="text-white/40" />
          <span className="text-sm font-medium text-white/60">
            列统计信息（全量数据）
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-xs text-white/40">
                <th className="px-4 py-2 font-medium">列名</th>
                <th className="px-4 py-2 font-medium">类型</th>
                <th className="px-4 py-2 font-medium">非空</th>
                <th className="px-4 py-2 font-medium">唯一值</th>
                <th className="px-4 py-2 font-medium">空值</th>
                <th className="px-4 py-2 font-medium">概览</th>
              </tr>
            </thead>
            <tbody>
              {dataPreview.columns.map((col) => {
                const totalCount = col.total_count ?? 0;
                const totalRows = col.total_rows ?? dataPreview.total_rows;
                const uniqueCount = col.unique_count ?? 0;
                const nullCount = col.null_count ?? 0;
                const dtype = col.dtype ?? "text";
                const fillRatio = totalRows > 0 ? totalCount / totalRows : 0;
                return (
                  <tr
                    key={col.name}
                    className="border-b border-white/[0.03] last:border-b-0"
                  >
                    <td className="px-4 py-2 font-mono text-xs text-white/80">
                      {col.name}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs",
                          dtype === "numeric"
                            ? "bg-blue-500/10 text-blue-400"
                            : "bg-white/5 text-white/40",
                        )}
                      >
                        {dtype === "numeric" ? (
                          <Hash size={10} />
                        ) : (
                          <Type size={10} />
                        )}
                        {dtype}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white/60">
                          {totalCount.toLocaleString()}
                        </span>
                        <div className="h-1 w-12 overflow-hidden rounded-full bg-white/5">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              fillRatio > 0.95
                                ? "bg-emerald-500/60"
                                : fillRatio > 0.7
                                  ? "bg-yellow-500/60"
                                  : "bg-red-500/60",
                            )}
                            style={{ width: `${fillRatio * 100}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-xs text-white/60">
                      {uniqueCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={cn(
                          "text-xs",
                          nullCount > 0
                            ? "text-yellow-400/70"
                            : "text-white/30",
                        )}
                      >
                        {nullCount.toLocaleString()}
                      </span>
                    </td>
                    <td className="max-w-[300px] px-4 py-2">
                      <ColumnOverview col={col} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 去重键配置 */}
      <div className="glass-panel space-y-3 px-5 py-4">
        <div>
          <p className="text-sm font-medium text-white/70">
            去重键配置（可选）
          </p>
          <p className="mt-1 text-xs text-white/40">
            选择作为去重依据的列，导入时相同去重键的记录将被跳过
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {dataPreview.columns.map((col) => (
            <label
              key={col.name}
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors",
                selectedDedupCols.includes(col.name)
                  ? "bg-indigo-500/15 text-indigo-400"
                  : "bg-white/5 text-white/50 hover:bg-white/8",
              )}
            >
              <input
                type="checkbox"
                checked={selectedDedupCols.includes(col.name)}
                onChange={() => handleToggleDedup(col.name)}
                className="sr-only"
              />
              <span>{col.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* 下一步按钮 */}
      <button
        onClick={() => void handleSubmit()}
        className="glass-btn-primary flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm"
      >
        下一步
      </button>
    </div>
  );
}
