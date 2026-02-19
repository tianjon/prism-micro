/**
 * 标签列表页 (/voc/tags)。
 * 展示涌现标签列表，支持筛选、排序和分页。
 */

import { useNavigate } from "react-router-dom";
import {
  Tags,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  SlidersHorizontal,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { PageContainer } from "@/components/PageContainer";
import { PageHeader } from "@/components/PageHeader";
import { ErrorState } from "@/components/ErrorState";
import { CardSkeleton } from "@/components/GlassSkeleton";
import { useTags } from "../hooks/use-tags";

/** confidence_tier 颜色映射 */
const TIER_STYLES: Record<string, string> = {
  high: "text-green-400 bg-green-400/10",
  medium: "text-yellow-400 bg-yellow-400/10",
  low: "text-red-400 bg-red-400/10",
};

/** status 颜色映射 */
const STATUS_STYLES: Record<string, string> = {
  active: "text-green-400 bg-green-400/10",
  merged: "text-blue-400 bg-blue-400/10",
  deprecated: "text-white/30 bg-white/5",
};

/** status 中文映射 */
const STATUS_LABELS: Record<string, string> = {
  active: "活跃",
  merged: "已合并",
  deprecated: "已废弃",
};

/** 排序字段选项 */
const SORT_OPTIONS = [
  { value: "usage_count", label: "使用次数" },
  { value: "confidence", label: "置信度" },
  { value: "created_at", label: "创建时间" },
] as const;

/** 状态筛选选项 */
const STATUS_OPTIONS = [
  { value: undefined, label: "全部状态" },
  { value: "active", label: "活跃" },
  { value: "merged", label: "已合并" },
  { value: "deprecated", label: "已废弃" },
] as const;

/** confidence_tier 筛选选项 */
const TIER_OPTIONS = [
  { value: undefined, label: "全部置信度" },
  { value: "high", label: "高" },
  { value: "medium", label: "中" },
  { value: "low", label: "低" },
] as const;

export function TagsPage() {
  const navigate = useNavigate();
  const {
    tags,
    loadState,
    error,
    total,
    page,
    setPage,
    filters,
    setFilters,
    reload,
  } = useTags();

  const totalPages = Math.max(1, Math.ceil(total / filters.page_size));

  // 加载中骨架屏
  if (loadState === "loading" && tags.length === 0) {
    return (
      <PageContainer>
        <PageHeader title="涌现标签" />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </PageContainer>
    );
  }

  // 错误状态
  if (loadState === "error") {
    return (
      <PageContainer>
        <PageHeader title="涌现标签" />
        <ErrorState message={error ?? "加载失败"} onRetry={reload} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        <PageHeader
          title="涌现标签"
          description="AI 管线自动涌现的语义标签，按使用频率和置信度排序"
        />

        {/* 筛选和排序区域 */}
        <div className="glass-panel p-4">
          <div className="flex items-center gap-2 mb-3 text-sm text-white/50">
            <SlidersHorizontal size={ICON_SIZE.md} />
            <span>筛选与排序</span>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            {/* 状态筛选 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-white/40">状态</label>
              <select
                value={filters.status ?? ""}
                onChange={(e) =>
                  setFilters({
                    status: e.target.value || undefined,
                  })
                }
                className="glass-input h-8 px-3 text-xs min-w-[120px] cursor-pointer"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.label} value={opt.value ?? ""}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 置信度筛选 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-white/40">置信度</label>
              <select
                value={filters.confidence_tier ?? ""}
                onChange={(e) =>
                  setFilters({
                    confidence_tier: e.target.value || undefined,
                  })
                }
                className="glass-input h-8 px-3 text-xs min-w-[120px] cursor-pointer"
              >
                {TIER_OPTIONS.map((opt) => (
                  <option key={opt.label} value={opt.value ?? ""}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 最低使用次数 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-white/40">最低使用次数</label>
              <input
                type="number"
                min={0}
                value={filters.min_usage}
                onChange={(e) =>
                  setFilters({
                    min_usage: Math.max(0, parseInt(e.target.value) || 0),
                  })
                }
                className="glass-input h-8 px-3 text-xs w-[100px]"
                placeholder="0"
              />
            </div>

            {/* 排序字段 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-white/40">排序</label>
              <div className="flex items-center gap-1">
                <select
                  value={filters.sort_by}
                  onChange={(e) => setFilters({ sort_by: e.target.value })}
                  className="glass-input h-8 px-3 text-xs min-w-[110px] cursor-pointer"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() =>
                    setFilters({
                      sort_order:
                        filters.sort_order === "desc" ? "asc" : "desc",
                    })
                  }
                  className={cn(
                    "glass-btn-ghost flex items-center justify-center h-8 w-8",
                    "transition-transform",
                    filters.sort_order === "asc" && "rotate-180",
                  )}
                  title={filters.sort_order === "desc" ? "降序" : "升序"}
                >
                  <ArrowUpDown size={ICON_SIZE.md} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 标签卡片网格 */}
        {tags.length === 0 ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center gap-4 text-center">
            <div className="rounded-2xl bg-white/5 p-4">
              <Tags size={ICON_SIZE["3xl"]} className="text-white/20" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white/60">
                暂无标签
              </h3>
              <p className="mt-1 text-sm text-white/30">
                请先导入数据并运行 AI 管线，标签将自动涌现
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* 结果统计 */}
            <div className="flex items-center justify-between text-sm text-white/40">
              <span>共 {total} 个标签</span>
              {loadState === "loading" && (
                <span className="text-white/30">加载中...</span>
              )}
            </div>

            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => navigate(`/voc/tags/${tag.id}`)}
                  className={cn(
                    "glass-card p-5 text-left transition-colors",
                    "hover:bg-white/[0.06] cursor-pointer",
                  )}
                >
                  {/* 标签名 + 状态 */}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-semibold text-white/90 leading-tight line-clamp-2">
                      {tag.name}
                    </h3>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                        STATUS_STYLES[tag.status] ?? "text-white/30 bg-white/5",
                      )}
                    >
                      {STATUS_LABELS[tag.status] ?? tag.status}
                    </span>
                  </div>

                  {/* 使用次数 + 置信度 */}
                  <div className="mt-3 flex items-center gap-2">
                    <span className="rounded-md bg-white/5 px-2 py-0.5 text-xs text-white/60">
                      使用 {tag.usage_count} 次
                    </span>
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 text-xs font-medium",
                        TIER_STYLES[tag.confidence_tier] ??
                          "text-white/40 bg-white/5",
                      )}
                    >
                      {tag.confidence_tier === "high"
                        ? "高置信"
                        : tag.confidence_tier === "medium"
                          ? "中置信"
                          : "低置信"}
                      {tag.confidence !== null &&
                        ` ${(tag.confidence * 100).toFixed(0)}%`}
                    </span>
                  </div>

                  {/* 反馈统计 */}
                  <div className="mt-3 flex items-center gap-3 text-xs text-white/40">
                    <span className="flex items-center gap-1">
                      <ThumbsUp size={ICON_SIZE.xs} className="text-green-400/60" />
                      {tag.feedback_summary.useful}
                    </span>
                    <span className="flex items-center gap-1">
                      <ThumbsDown size={ICON_SIZE.xs} className="text-red-400/60" />
                      {tag.feedback_summary.useless}
                    </span>
                    <span className="flex items-center gap-1">
                      <AlertTriangle size={ICON_SIZE.xs} className="text-yellow-400/60" />
                      {tag.feedback_summary.error}
                    </span>
                    <span className="ml-auto text-white/20">
                      {formatDate(tag.created_at)}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* 分页控件 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
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
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                  className="glass-btn-ghost flex items-center gap-1 px-3 py-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  下一页
                  <ChevronRight size={ICON_SIZE.md} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </PageContainer>
  );
}
