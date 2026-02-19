/**
 * 标签详情页 (/voc/tags/:tagId)。
 * 展示标签完整信息、反馈操作和关联语义单元列表。
 */

import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  Tag,
  ChevronLeft,
  ChevronRight,
  GitCompare,
  Star,
  Loader2,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { ApiError } from "@/api/client";
import type { TagDetail, TagUnitItem, FeedbackRequest } from "@/api/types";
import {
  fetchTagDetail,
  fetchTagUnits,
  submitTagFeedback,
} from "@/api/voc-api";
import { useToast } from "@/hooks/use-toast";
import { PageContainer } from "@/components/PageContainer";
import { ErrorState } from "@/components/ErrorState";
import { GlassSkeleton } from "@/components/GlassSkeleton";

/** confidence_tier 颜色映射 */
const TIER_STYLES: Record<string, string> = {
  high: "text-green-400 bg-green-400/10",
  medium: "text-yellow-400 bg-yellow-400/10",
  low: "text-red-400 bg-red-400/10",
};

/** status 颜色与标签映射 */
const STATUS_STYLES: Record<string, string> = {
  active: "text-green-400 bg-green-400/10",
  merged: "text-blue-400 bg-blue-400/10",
  deprecated: "text-white/30 bg-white/5",
};

const STATUS_LABELS: Record<string, string> = {
  active: "活跃",
  merged: "已合并",
  deprecated: "已废弃",
};

type LoadState = "idle" | "loading" | "success" | "error";

/** 单元列表分页大小 */
const UNITS_PAGE_SIZE = 10;

export function TagDetailPage() {
  const { tagId } = useParams<{ tagId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  // 标签详情
  const [tag, setTag] = useState<TagDetail | null>(null);
  const [tagLoadState, setTagLoadState] = useState<LoadState>("idle");
  const [tagError, setTagError] = useState<string | null>(null);

  // 关联单元
  const [units, setUnits] = useState<TagUnitItem[]>([]);
  const [unitsLoadState, setUnitsLoadState] = useState<LoadState>("idle");
  const [unitsTotal, setUnitsTotal] = useState(0);
  const [unitsPage, setUnitsPage] = useState(1);

  // 反馈提交
  const [feedbackLoading, setFeedbackLoading] = useState<string | null>(null);

  /** 加载标签详情 */
  const loadTag = useCallback(async () => {
    if (!tagId) return;
    setTagLoadState("loading");
    setTagError(null);
    try {
      const response = await fetchTagDetail(tagId);
      setTag(response.data);
      setTagLoadState("success");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "加载标签详情失败";
      setTagError(message);
      setTagLoadState("error");
    }
  }, [tagId]);

  /** 加载关联单元 */
  const loadUnits = useCallback(async () => {
    if (!tagId) return;
    setUnitsLoadState("loading");
    try {
      const response = await fetchTagUnits(tagId, {
        page: unitsPage,
        page_size: UNITS_PAGE_SIZE,
      });
      setUnits(response.data);
      setUnitsTotal(response.pagination.total);
      setUnitsLoadState("success");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "加载关联单元失败";
      toast({ title: message, variant: "error" });
      setUnitsLoadState("error");
    }
  }, [tagId, unitsPage, toast]);

  useEffect(() => {
    void loadTag();
  }, [loadTag]);

  useEffect(() => {
    void loadUnits();
  }, [loadUnits]);

  /** 提交反馈 */
  const handleFeedback = async (feedbackType: FeedbackRequest["feedback_type"]) => {
    if (!tagId) return;
    setFeedbackLoading(feedbackType);
    try {
      const response = await submitTagFeedback(tagId, {
        feedback_type: feedbackType,
      });
      const labels: Record<string, string> = {
        useful: "有用",
        useless: "无用",
        error: "标注错误",
      };
      toast({
        title: response.data.is_update
          ? `反馈已更新为"${labels[feedbackType]}"`
          : `已标记为"${labels[feedbackType]}"`,
        variant: "success",
      });
      // 刷新标签详情以更新反馈计数
      void loadTag();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "提交反馈失败";
      toast({ title: message, variant: "error" });
    } finally {
      setFeedbackLoading(null);
    }
  };

  const unitsTotalPages = Math.max(
    1,
    Math.ceil(unitsTotal / UNITS_PAGE_SIZE),
  );

  // 加载中
  if (tagLoadState === "loading" || tagLoadState === "idle") {
    return (
      <PageContainer>
        <div className="space-y-6">
          <GlassSkeleton className="h-6 w-24" />
          <GlassSkeleton className="h-10 w-64" />
          <div className="glass-card p-6">
            <div className="space-y-3">
              <GlassSkeleton className="h-4 w-48" />
              <GlassSkeleton className="h-4 w-full" />
              <GlassSkeleton className="h-4 w-3/4" />
            </div>
          </div>
        </div>
      </PageContainer>
    );
  }

  // 错误状态
  if (tagLoadState === "error" || !tag) {
    return (
      <PageContainer>
        <button
          onClick={() => navigate("/voc/tags")}
          className="glass-btn-ghost flex items-center gap-1 px-3 py-1.5 text-sm mb-4"
        >
          <ArrowLeft size={ICON_SIZE.md} />
          返回标签列表
        </button>
        <ErrorState message={tagError ?? "标签不存在"} onRetry={loadTag} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* 操作栏 */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/voc/tags")}
            className="glass-btn-ghost flex items-center gap-1 px-3 py-1.5 text-sm"
          >
            <ArrowLeft size={ICON_SIZE.md} />
            返回标签列表
          </button>
          <button
            onClick={() => navigate("/voc/tags/compare")}
            className="glass-btn-ghost flex items-center gap-1 px-3 py-1.5 text-sm"
          >
            <GitCompare size={ICON_SIZE.md} />
            标签对比
          </button>
        </div>

        {/* 头部信息 */}
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-white/5 p-2.5">
              <Tag size={ICON_SIZE["2xl"]} className="text-white/40" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                {tag.name}
              </h1>
              {tag.raw_name !== tag.name && (
                <p className="mt-0.5 text-sm text-white/40">
                  原始名称：{tag.raw_name}
                </p>
              )}
            </div>
          </div>

          {/* 属性标签行 */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                STATUS_STYLES[tag.status] ?? "text-white/30 bg-white/5",
              )}
            >
              {STATUS_LABELS[tag.status] ?? tag.status}
            </span>
            <span
              className={cn(
                "rounded-md px-2.5 py-0.5 text-xs font-medium",
                TIER_STYLES[tag.confidence_tier] ?? "text-white/40 bg-white/5",
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
            <span className="rounded-md bg-white/5 px-2.5 py-0.5 text-xs text-white/50">
              使用 {tag.usage_count} 次
            </span>
            <span className="rounded-md bg-white/5 px-2.5 py-0.5 text-xs text-white/50">
              关联 {tag.unit_count} 个单元
            </span>
          </div>

          {/* 父标签 */}
          {tag.parent_tag_id && (
            <p className="text-sm text-white/40">
              父标签：
              <button
                onClick={() => navigate(`/voc/tags/${tag.parent_tag_id}`)}
                className="text-blue-400 hover:text-blue-300 transition-colors cursor-pointer underline underline-offset-2"
              >
                {tag.parent_tag_id}
              </button>
            </p>
          )}

          {/* 时间信息 */}
          <div className="flex items-center gap-4 text-xs text-white/30">
            <span>创建于 {formatDate(tag.created_at)}</span>
            <span>更新于 {formatDate(tag.updated_at)}</span>
          </div>
        </div>

        {/* 反馈统计与操作卡片 */}
        <div className="glass-card p-5">
          <h2 className="text-sm font-medium text-white/60 mb-4">
            用户反馈
          </h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">
                {tag.feedback_summary.useful}
              </div>
              <div className="text-xs text-white/40 mt-1">有用</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-400">
                {tag.feedback_summary.useless}
              </div>
              <div className="text-xs text-white/40 mt-1">无用</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">
                {tag.feedback_summary.error}
              </div>
              <div className="text-xs text-white/40 mt-1">标注错误</div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 pt-3 border-t border-white/5">
            <button
              onClick={() => void handleFeedback("useful")}
              disabled={feedbackLoading !== null}
              className={cn(
                "glass-btn-ghost flex items-center gap-1.5 px-4 py-2 text-sm",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "hover:text-green-400",
              )}
            >
              {feedbackLoading === "useful" ? (
                <Loader2 size={ICON_SIZE.md} className="animate-spin" />
              ) : (
                <ThumbsUp size={ICON_SIZE.md} />
              )}
              有用
            </button>
            <button
              onClick={() => void handleFeedback("useless")}
              disabled={feedbackLoading !== null}
              className={cn(
                "glass-btn-ghost flex items-center gap-1.5 px-4 py-2 text-sm",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "hover:text-red-400",
              )}
            >
              {feedbackLoading === "useless" ? (
                <Loader2 size={ICON_SIZE.md} className="animate-spin" />
              ) : (
                <ThumbsDown size={ICON_SIZE.md} />
              )}
              无用
            </button>
            <button
              onClick={() => void handleFeedback("error")}
              disabled={feedbackLoading !== null}
              className={cn(
                "glass-btn-ghost flex items-center gap-1.5 px-4 py-2 text-sm",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "hover:text-yellow-400",
              )}
            >
              {feedbackLoading === "error" ? (
                <Loader2 size={ICON_SIZE.md} className="animate-spin" />
              ) : (
                <AlertTriangle size={ICON_SIZE.md} />
              )}
              标注错误
            </button>
          </div>
        </div>

        {/* 关联语义单元列表 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white/90">
              关联语义单元
            </h2>
            <span className="text-sm text-white/40">
              共 {unitsTotal} 个单元
            </span>
          </div>

          {unitsLoadState === "loading" && units.length === 0 ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="glass-card p-4">
                  <GlassSkeleton className="h-4 w-full" />
                  <GlassSkeleton className="mt-2 h-3 w-3/4" />
                </div>
              ))}
            </div>
          ) : units.length === 0 ? (
            <div className="flex min-h-[150px] flex-col items-center justify-center text-center">
              <p className="text-sm text-white/30">暂无关联单元</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {units.map((unit) => (
                  <button
                    key={unit.unit_id}
                    onClick={() => navigate(`/voc/units/${unit.unit_id}`)}
                    className={cn(
                      "glass-card w-full p-4 text-left transition-colors",
                      "hover:bg-white/[0.06] cursor-pointer",
                    )}
                  >
                    {/* 文本内容 */}
                    <p className="text-sm text-white/80 leading-relaxed line-clamp-3">
                      {unit.text}
                    </p>

                    {/* 摘要 */}
                    {unit.summary && (
                      <p className="mt-2 text-xs text-white/40 line-clamp-1">
                        摘要：{unit.summary}
                      </p>
                    )}

                    {/* 元数据行 */}
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/40">
                      {/* 相关度 */}
                      <span className="rounded-md bg-white/5 px-2 py-0.5">
                        相关度 {(unit.relevance * 100).toFixed(0)}%
                      </span>
                      {/* 主标签标记 */}
                      {unit.is_primary && (
                        <span className="flex items-center gap-0.5 rounded-md bg-yellow-400/10 px-2 py-0.5 text-yellow-400">
                          <Star size={ICON_SIZE.xs} />
                          主标签
                        </span>
                      )}
                      {/* 意图 */}
                      {unit.intent && (
                        <span className="rounded-md bg-white/5 px-2 py-0.5">
                          {unit.intent}
                        </span>
                      )}
                      {/* 情感 */}
                      {unit.sentiment && (
                        <span className="rounded-md bg-white/5 px-2 py-0.5">
                          {unit.sentiment}
                        </span>
                      )}
                      <span className="ml-auto text-white/20">
                        {formatDate(unit.created_at)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {/* 单元分页 */}
              {unitsTotalPages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() =>
                      setUnitsPage(Math.max(1, unitsPage - 1))
                    }
                    disabled={unitsPage <= 1}
                    className="glass-btn-ghost flex items-center gap-1 px-3 py-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={ICON_SIZE.md} />
                    上一页
                  </button>
                  <span className="text-sm text-white/50">
                    {unitsPage} / {unitsTotalPages}
                  </span>
                  <button
                    onClick={() =>
                      setUnitsPage(Math.min(unitsTotalPages, unitsPage + 1))
                    }
                    disabled={unitsPage >= unitsTotalPages}
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
      </div>
    </PageContainer>
  );
}
