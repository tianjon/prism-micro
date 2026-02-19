/**
 * 搜索结果卡片组件。
 * 展示语义单元的摘要信息、相似度、置信度、标签等。
 */

import { Tag, FileText, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { ICON_SIZE } from "@/lib/icon-sizes";
import type { SearchResultItem } from "@/api/types";

/** 最多显示的标签数量 */
const MAX_VISIBLE_TAGS = 5;

interface SearchResultCardProps {
  result: SearchResultItem;
  onClick: () => void;
}

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

/** 格式化分数为百分比 */
function formatPercent(score: number): string {
  return `${(score * 100).toFixed(1)}%`;
}

export function SearchResultCard({ result, onClick }: SearchResultCardProps) {
  const visibleTags = result.tags.slice(0, MAX_VISIBLE_TAGS);
  const hiddenCount = result.tags.length - MAX_VISIBLE_TAGS;

  return (
    <button
      type="button"
      onClick={onClick}
      className="glass-card w-full cursor-pointer p-5 text-left transition-all hover:bg-white/[0.04]"
    >
      {/* 顶部：相似度 + 置信度 + 情感 */}
      <div className="mb-3 flex items-center gap-2 flex-wrap">
        {/* 相似度分数 */}
        <span className="rounded-lg bg-indigo-400/10 px-2 py-0.5 text-xs font-medium text-indigo-400">
          相似度 {formatPercent(result.similarity_score)}
        </span>

        {/* Rerank 分数（如有） */}
        {result.rerank_score !== null && (
          <span className="rounded-lg bg-purple-400/10 px-2 py-0.5 text-xs font-medium text-purple-400">
            Rerank {formatPercent(result.rerank_score)}
          </span>
        )}

        {/* 置信度等级 */}
        <span
          className={cn(
            "rounded-lg px-2 py-0.5 text-xs font-medium",
            getConfidenceTierStyle(result.confidence_tier),
          )}
        >
          {result.confidence_tier}
        </span>

        {/* 情感 */}
        {result.sentiment && (
          <span
            className={cn(
              "text-xs",
              getSentimentStyle(result.sentiment),
            )}
          >
            {result.sentiment}
          </span>
        )}
      </div>

      {/* 主文本 */}
      <p className="text-sm leading-relaxed text-white/90 line-clamp-3">
        {result.text}
      </p>

      {/* 摘要 */}
      {result.summary && (
        <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-white/40">
          <MessageSquare
            size={ICON_SIZE.sm}
            className="mt-0.5 shrink-0 text-white/20"
          />
          <span className="line-clamp-2">{result.summary}</span>
        </p>
      )}

      {/* 标签列表 */}
      {result.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Tag size={ICON_SIZE.sm} className="shrink-0 text-white/20" />
          {visibleTags.map((tag) => (
            <span
              key={tag.id}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px]",
                tag.is_primary
                  ? "bg-indigo-500/15 text-indigo-300"
                  : "bg-white/[0.06] text-white/50",
              )}
            >
              {tag.name}
            </span>
          ))}
          {hiddenCount > 0 && (
            <span className="text-[11px] text-white/30">
              +{hiddenCount}
            </span>
          )}
        </div>
      )}

      {/* 底部：来源信息 */}
      <div className="mt-3 flex items-center gap-1.5 text-xs text-white/30">
        <FileText size={ICON_SIZE.xs} className="shrink-0" />
        <span className="truncate">{result.voice.source}</span>
      </div>
    </button>
  );
}
