/**
 * AG Grid 自定义 Cell Renderer 集合。
 */

import type { ICellRendererParams } from "ag-grid-community";
import { Eye, Trash2 } from "lucide-react";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { formatDate } from "@/lib/utils";

/** 状态 → 样式映射（复用 StatusBadge 逻辑） */
const STATUS_STYLES: Record<string, string> = {
  completed: "text-green-400 bg-green-400/10",
  failed: "text-red-400 bg-red-400/10",
  pending: "text-white/50 bg-white/10",
  uploading: "text-amber-400 bg-amber-400/10 animate-pulse",
  importing: "text-amber-400 bg-amber-400/10 animate-pulse",
  processing: "text-amber-400 bg-amber-400/10 animate-pulse",
  generating_mapping: "text-amber-400 bg-amber-400/10 animate-pulse",
  prompt_ready: "text-blue-400 bg-blue-400/10",
  mapping: "text-blue-400 bg-blue-400/10",
  partially_completed: "text-orange-400 bg-orange-400/10",
  raw: "text-white/50 bg-white/10",
  processed: "text-green-400 bg-green-400/10",
};

const STATUS_LABELS: Record<string, string> = {
  completed: "已完成",
  failed: "失败",
  pending: "待处理",
  uploading: "上传中",
  importing: "导入中",
  processing: "处理中",
  generating_mapping: "映射生成中",
  prompt_ready: "提示词就绪",
  mapping: "映射中",
  partially_completed: "部分完成",
  raw: "未处理",
  processed: "已处理",
};

export function StatusCellRenderer(params: ICellRendererParams) {
  const status = params.value as string;
  if (!status) return null;
  const style = STATUS_STYLES[status] ?? "text-white/40 bg-white/5";
  const label = STATUS_LABELS[status] ?? status;
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${style}`}>
      {label}
    </span>
  );
}

export function DateCellRenderer(params: ICellRendererParams) {
  return <span className="text-white/40 text-xs">{formatDate(params.value as string)}</span>;
}

export function FileSizeCellRenderer(params: ICellRendererParams) {
  const bytes = params.value as number | null;
  if (bytes == null) return <span className="text-white/30">-</span>;
  if (bytes < 1024) return <span className="text-white/60 tabular-nums">{bytes} B</span>;
  if (bytes < 1024 * 1024)
    return <span className="text-white/60 tabular-nums">{(bytes / 1024).toFixed(1)} KB</span>;
  return (
    <span className="text-white/60 tabular-nums">{(bytes / (1024 * 1024)).toFixed(1)} MB</span>
  );
}

export function TruncatedTextCellRenderer(params: ICellRendererParams) {
  const text = params.value as string | null;
  if (!text) return <span className="text-white/30">-</span>;
  const truncated = text.length > 80 ? text.slice(0, 80) + "..." : text;
  return (
    <span className="text-white/60 text-xs" title={text}>
      {truncated}
    </span>
  );
}

export function ConfidenceCellRenderer(params: ICellRendererParams) {
  const value = params.value as number | null;
  if (value == null) return <span className="text-white/30">-</span>;
  return <span className="text-white/60 tabular-nums">{(value * 100).toFixed(0)}%</span>;
}

export function JsonPreviewCellRenderer(params: ICellRendererParams) {
  const data = params.value as unknown;
  if (data == null) return <span className="text-white/30">-</span>;
  const text = JSON.stringify(data);
  const truncated = text.length > 60 ? text.slice(0, 60) + "..." : text;
  return (
    <span className="text-white/40 font-mono text-[11px]" title={text}>
      {truncated}
    </span>
  );
}

export interface ActionContext {
  onView?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function ActionCellRenderer(params: ICellRendererParams) {
  const ctx = params.context as ActionContext;
  const id = params.data?.id as string;
  if (!id) return null;
  return (
    <div className="flex items-center gap-1">
      {ctx.onView && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            ctx.onView!(id);
          }}
          className="rounded-lg p-1.5 text-white/20 transition-colors hover:bg-white/5 hover:text-white/60"
          title="查看详情"
        >
          <Eye size={ICON_SIZE.md} />
        </button>
      )}
      {ctx.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            ctx.onDelete!(id);
          }}
          className="rounded-lg p-1.5 text-white/20 transition-colors hover:bg-red-500/10 hover:text-red-400"
          title="删除"
        >
          <Trash2 size={ICON_SIZE.md} />
        </button>
      )}
    </div>
  );
}
