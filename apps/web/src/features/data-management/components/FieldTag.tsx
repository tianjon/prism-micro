/**
 * 字段标签组件。
 * 以 "label=value" 格式展示字段，用于卡片布局。
 * 支持可选的点击回调（如点击后将值添加到筛选条件）。
 */

import { cn } from "@/lib/utils";

interface FieldTagProps {
  label: string;
  value: string | number | null | undefined;
  variant?: "default" | "status" | "number" | "muted";
  /** 点击回调。提供时 tag 显示为可交互样式。 */
  onClick?: () => void;
}

/** 状态值 → 样式映射（复用 StatusBadge 的配色） */
const STATUS_COLORS: Record<string, string> = {
  completed: "text-green-400 bg-green-400/10 border-green-400/20",
  failed: "text-red-400 bg-red-400/10 border-red-400/20",
  pending: "text-white/50 bg-white/10 border-white/10",
  uploading: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  importing: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  processing: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  generating_mapping: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  prompt_ready: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  mapping: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  partially_completed: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  raw: "text-white/50 bg-white/10 border-white/10",
  processed: "text-green-400 bg-green-400/10 border-green-400/20",
};

/** 状态值 → 中文标签 */
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

export function FieldTag({ label, value, variant = "default", onClick }: FieldTagProps) {
  if (value === null || value === undefined || value === "") return null;

  const displayValue =
    variant === "status"
      ? STATUS_LABELS[String(value)] ?? String(value)
      : String(value);

  const baseClasses = "inline-flex items-center text-[11px] px-2 py-0.5 rounded-md border";

  const variantClasses = (() => {
    switch (variant) {
      case "status":
        return STATUS_COLORS[String(value)] ?? "text-white/40 bg-white/5 border-white/8";
      case "number":
        return "tabular-nums text-white/70 bg-white/5 border-white/8";
      case "muted":
        return "text-white/30 bg-white/3 border-white/5";
      default:
        return "text-white/60 bg-white/5 border-white/8";
    }
  })();

  const interactiveClasses = onClick
    ? "cursor-pointer hover:border-white/25 hover:bg-white/10 transition-colors"
    : "";

  return (
    <span
      className={cn(baseClasses, variantClasses, interactiveClasses)}
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
      title={onClick ? `点击筛选：${label} = ${String(value)}` : undefined}
    >
      <span className="text-white/30 mr-1">{label}=</span>
      {displayValue}
    </span>
  );
}
