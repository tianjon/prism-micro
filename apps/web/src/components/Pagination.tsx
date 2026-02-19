/**
 * 分页组件。
 * 左侧总数 + 右侧上一页/下一页 + 页码。
 */

import { ChevronLeft, ChevronRight } from "lucide-react";
import { ICON_SIZE } from "@/lib/icon-sizes";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, total, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between pt-2">
      <span className="text-sm text-white/40">共 {total} 条</span>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="glass-btn-ghost flex items-center gap-1 px-3 py-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={ICON_SIZE.md} />
          上一页
        </button>
        <span className="text-sm text-white/50">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="glass-btn-ghost flex items-center gap-1 px-3 py-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          下一页
          <ChevronRight size={ICON_SIZE.md} />
        </button>
      </div>
    </div>
  );
}
