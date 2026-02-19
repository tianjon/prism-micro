/**
 * 语义单元详情页 (/voc/units/:unitId)。
 * 展示语义单元的完整信息，包括关联标签和来源 Voice。
 */

import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Tag,
  FileText,
  Star,
  Brain,
  MessageSquare,
  Target,
  Activity,
  Hash,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { PageContainer } from "@/components/PageContainer";
import { ErrorState } from "@/components/ErrorState";
import { CardSkeleton } from "@/components/GlassSkeleton";
import { fetchUnitDetail } from "@/api/voc-api";
import type { UnitDetail } from "@/api/types";

/** 置信度等级颜色映射 */
function getConfidenceTierStyle(tier: string): string {
  switch (tier) {
    case "high":
      return "text-green-400 bg-green-400/10";
    case "medium":
      return "text-yellow-400 bg-yellow-400/10";
    case "low":
      return "text-red-400 bg-red-400/10";
    default:
      return "text-white/40 bg-white/5";
  }
}

/** 情感颜色映射 */
function getSentimentStyle(sentiment: string | null): string {
  switch (sentiment) {
    case "positive":
      return "text-green-400";
    case "negative":
      return "text-red-400";
    case "neutral":
      return "text-white/50";
    case "mixed":
      return "text-yellow-400";
    default:
      return "text-white/30";
  }
}

/** 情感中文标签 */
function getSentimentLabel(sentiment: string | null): string {
  switch (sentiment) {
    case "positive":
      return "正面";
    case "negative":
      return "负面";
    case "neutral":
      return "中性";
    case "mixed":
      return "混合";
    default:
      return "未知";
  }
}

type LoadState = "loading" | "success" | "error";

export function UnitDetailPage() {
  const { unitId } = useParams<{ unitId: string }>();
  const navigate = useNavigate();

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [unit, setUnit] = useState<UnitDetail | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const loadDetail = useCallback(async () => {
    if (!unitId) return;
    setLoadState("loading");
    try {
      const res = await fetchUnitDetail(unitId);
      setUnit(res.data);
      setLoadState("success");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "加载详情失败";
      setErrorMessage(msg);
      setLoadState("error");
    }
  }, [unitId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* 返回按钮 */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex cursor-pointer items-center gap-1.5 text-sm text-white/40 transition-colors hover:text-white/70"
        >
          <ArrowLeft size={ICON_SIZE.md} />
          返回
        </button>

        {/* 加载状态 */}
        {loadState === "loading" && (
          <div className="space-y-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        )}

        {/* 错误状态 */}
        {loadState === "error" && (
          <ErrorState message={errorMessage} onRetry={() => void loadDetail()} />
        )}

        {/* 详情内容 */}
        {loadState === "success" && unit && (
          <div className="space-y-6">
            {/* 页面标题 */}
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                语义单元详情
              </h1>
              <p className="mt-1 text-xs text-white/30 font-mono">
                ID: {unit.id}
              </p>
            </div>

            {/* 主内容卡片 */}
            <div className="glass-card p-6 space-y-5">
              {/* 元信息 badges */}
              <div className="flex flex-wrap items-center gap-2">
                {/* 置信度 */}
                <span
                  className={cn(
                    "rounded-lg px-2 py-0.5 text-xs font-medium",
                    getConfidenceTierStyle(unit.confidence_tier),
                  )}
                >
                  {unit.confidence_tier}
                  {unit.confidence !== null &&
                    ` (${(unit.confidence * 100).toFixed(0)}%)`}
                </span>

                {/* 情感 */}
                {unit.sentiment && (
                  <span
                    className={cn(
                      "flex items-center gap-1 rounded-lg bg-white/5 px-2 py-0.5 text-xs font-medium",
                      getSentimentStyle(unit.sentiment),
                    )}
                  >
                    <Activity size={ICON_SIZE.xs} />
                    {getSentimentLabel(unit.sentiment)}
                  </span>
                )}

                {/* 意图 */}
                {unit.intent && (
                  <span className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-0.5 text-xs font-medium text-white/50">
                    <Target size={ICON_SIZE.xs} />
                    {unit.intent}
                  </span>
                )}

                {/* 序列索引 */}
                <span className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-0.5 text-xs text-white/30">
                  <Hash size={ICON_SIZE.xs} />
                  序列 #{unit.sequence_index}
                </span>
              </div>

              {/* 主文本 */}
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-white/40">
                  <Brain size={ICON_SIZE.sm} />
                  语义文本
                </label>
                <p className="text-sm leading-relaxed text-white/90">
                  {unit.text}
                </p>
              </div>

              {/* 摘要 */}
              {unit.summary && (
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-white/40">
                    <MessageSquare size={ICON_SIZE.sm} />
                    摘要
                  </label>
                  <p className="text-sm leading-relaxed text-white/60">
                    {unit.summary}
                  </p>
                </div>
              )}

              {/* 创建时间 */}
              <p className="text-xs text-white/30">
                创建于 {formatDate(unit.created_at)}
              </p>
            </div>

            {/* 关联标签 */}
            <div className="glass-card p-6">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white/80">
                <Tag size={ICON_SIZE.md} className="text-indigo-400" />
                关联标签
                <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/40">
                  {unit.tags.length}
                </span>
              </h2>

              {unit.tags.length === 0 ? (
                <p className="text-sm text-white/30">暂无关联标签</p>
              ) : (
                <div className="space-y-2">
                  {unit.tags.map((tag) => (
                    <button
                      key={tag.tag_id}
                      type="button"
                      onClick={() => navigate(`/voc/tags/${tag.tag_id}`)}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
                    >
                      <Tag
                        size={ICON_SIZE.sm}
                        className={cn(
                          tag.is_primary
                            ? "text-indigo-400"
                            : "text-white/30",
                        )}
                      />
                      <span className="flex-1 text-sm text-white/80">
                        {tag.tag_name}
                      </span>
                      {tag.is_primary && (
                        <span className="flex items-center gap-1 rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] text-indigo-300">
                          <Star size={ICON_SIZE.xs} />
                          主标签
                        </span>
                      )}
                      <span className="text-xs text-white/40">
                        相关度 {(tag.relevance * 100).toFixed(0)}%
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 来源 Voice 卡片 */}
            <div className="glass-card p-6">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white/80">
                <FileText size={ICON_SIZE.md} className="text-blue-400" />
                来源 Voice
              </h2>

              <button
                type="button"
                onClick={() => navigate(`/voc/voices/${unit.voice.id}`)}
                className="w-full cursor-pointer rounded-xl p-4 text-left transition-colors hover:bg-white/[0.04]"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-sm font-medium text-white/70">
                    {unit.voice.source}
                  </span>
                  <span className="text-xs text-white/30">
                    {formatDate(unit.voice.created_at)}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-white/40 line-clamp-3">
                  {unit.voice.raw_text}
                </p>
              </button>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
