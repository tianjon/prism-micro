/**
 * 状态徽章组件。
 * 根据批次/处理状态显示不同颜色。
 */

import { cn } from "@/lib/utils";

/** 状态 → 样式映射 */
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
  // Voice processed_status
  raw: "text-white/50 bg-white/10",
  processed: "text-green-400 bg-green-400/10",
};

/** 状态 → 中文标签映射 */
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

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2 py-0.5 text-[10px] font-medium",
        STATUS_STYLES[status] ?? "text-white/40 bg-white/5",
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
