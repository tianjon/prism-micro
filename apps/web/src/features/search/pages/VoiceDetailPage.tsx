/**
 * Voice 详情页 (/voc/voices/:voiceId)。
 * 展示原始 Voice 数据及其拆解出的所有语义单元。
 */

import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  FileText,
  Tag,
  Star,
  Hash,
  Activity,
  Target,
  Code2,
  CheckCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { PageContainer } from "@/components/PageContainer";
import { ErrorState } from "@/components/ErrorState";
import { CardSkeleton } from "@/components/GlassSkeleton";
import { fetchVoiceDetail } from "@/api/voc-api";
import type { VoiceDetail, VoiceUnitItem } from "@/api/types";

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

/** 处理状态样式 */
function getProcessedStatusStyle(status: string): {
  icon: React.ReactNode;
  label: string;
  className: string;
} {
  switch (status) {
    case "completed":
      return {
        icon: <CheckCircle size={ICON_SIZE.sm} />,
        label: "已完成",
        className: "text-green-400 bg-green-400/10",
      };
    case "processing":
      return {
        icon: <Clock size={ICON_SIZE.sm} />,
        label: "处理中",
        className: "text-yellow-400 bg-yellow-400/10",
      };
    case "failed":
      return {
        icon: <AlertTriangle size={ICON_SIZE.sm} />,
        label: "失败",
        className: "text-red-400 bg-red-400/10",
      };
    default:
      return {
        icon: <Clock size={ICON_SIZE.sm} />,
        label: status,
        className: "text-white/40 bg-white/5",
      };
  }
}

/** 缩略显示 hash */
function truncateHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
}

type LoadState = "loading" | "success" | "error";

/** 语义单元子卡片 */
function UnitCard({
  unit,
  onClick,
}: {
  unit: VoiceUnitItem;
  onClick: () => void;
}) {
  const maxTags = 4;
  const visibleTags = unit.tags.slice(0, maxTags);
  const hiddenCount = unit.tags.length - maxTags;

  return (
    <button
      type="button"
      onClick={onClick}
      className="glass-card w-full cursor-pointer p-5 text-left transition-all hover:bg-white/[0.04]"
    >
      {/* 顶部元信息 */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 text-xs text-white/30">
          <Hash size={ICON_SIZE.xs} />
          #{unit.sequence_index}
        </span>

        <span
          className={cn(
            "rounded-lg px-2 py-0.5 text-xs font-medium",
            getConfidenceTierStyle(unit.confidence_tier),
          )}
        >
          {unit.confidence_tier}
        </span>

        {unit.sentiment && (
          <span
            className={cn(
              "flex items-center gap-1 text-xs",
              getSentimentStyle(unit.sentiment),
            )}
          >
            <Activity size={ICON_SIZE.xs} />
            {unit.sentiment}
          </span>
        )}

        {unit.intent && (
          <span className="flex items-center gap-1 text-xs text-white/40">
            <Target size={ICON_SIZE.xs} />
            {unit.intent}
          </span>
        )}
      </div>

      {/* 文本 */}
      <p className="text-sm leading-relaxed text-white/90 line-clamp-3">
        {unit.text}
      </p>

      {/* 摘要 */}
      {unit.summary && (
        <p className="mt-1.5 text-xs text-white/40 line-clamp-2">
          {unit.summary}
        </p>
      )}

      {/* 标签 */}
      {unit.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Tag size={ICON_SIZE.sm} className="shrink-0 text-white/20" />
          {visibleTags.map((tag) => (
            <span
              key={tag.tag_id}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px]",
                tag.is_primary
                  ? "bg-indigo-500/15 text-indigo-300"
                  : "bg-white/[0.06] text-white/50",
              )}
            >
              {tag.is_primary && <Star size={8} />}
              {tag.tag_name}
            </span>
          ))}
          {hiddenCount > 0 && (
            <span className="text-[11px] text-white/30">
              +{hiddenCount}
            </span>
          )}
        </div>
      )}
    </button>
  );
}

export function VoiceDetailPage() {
  const { voiceId } = useParams<{ voiceId: string }>();
  const navigate = useNavigate();

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [voice, setVoice] = useState<VoiceDetail | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [showFullMetadata, setShowFullMetadata] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!voiceId) return;
    setLoadState("loading");
    try {
      const res = await fetchVoiceDetail(voiceId);
      setVoice(res.data);
      setLoadState("success");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "加载详情失败";
      setErrorMessage(msg);
      setLoadState("error");
    }
  }, [voiceId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  // 按 sequence_index 排序语义单元
  const sortedUnits = voice
    ? [...voice.units].sort((a, b) => a.sequence_index - b.sequence_index)
    : [];

  const statusInfo = voice
    ? getProcessedStatusStyle(voice.processed_status)
    : null;

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
            <CardSkeleton />
          </div>
        )}

        {/* 错误状态 */}
        {loadState === "error" && (
          <ErrorState message={errorMessage} onRetry={() => void loadDetail()} />
        )}

        {/* 详情内容 */}
        {loadState === "success" && voice && statusInfo && (
          <div className="space-y-6">
            {/* 页面标题 */}
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Voice 详情
              </h1>
              <p className="mt-1 text-xs text-white/30 font-mono">
                ID: {voice.id}
              </p>
            </div>

            {/* 基础信息卡片 */}
            <div className="glass-card p-6 space-y-5">
              {/* 元信息 */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <FileText size={ICON_SIZE.md} className="text-blue-400" />
                  <span className="text-sm font-medium text-white/80">
                    {voice.source}
                  </span>
                </div>

                {/* 处理状态 */}
                <span
                  className={cn(
                    "flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-medium",
                    statusInfo.className,
                  )}
                >
                  {statusInfo.icon}
                  {statusInfo.label}
                </span>

                <span className="text-xs text-white/30">
                  {formatDate(voice.created_at)}
                </span>
              </div>

              {/* Content Hash */}
              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-white/40">
                  <Code2 size={ICON_SIZE.sm} />
                  Content Hash
                </label>
                <code
                  className="block rounded-lg bg-white/[0.03] px-3 py-1.5 font-mono text-xs text-white/50"
                  title={voice.content_hash}
                >
                  {truncateHash(voice.content_hash)}
                </code>
              </div>

              {/* Batch ID */}
              {voice.batch_id && (
                <div>
                  <label className="mb-1 text-xs font-medium text-white/40">
                    Batch ID
                  </label>
                  <code className="block rounded-lg bg-white/[0.03] px-3 py-1.5 font-mono text-xs text-white/50">
                    {voice.batch_id}
                  </code>
                </div>
              )}

              {/* 原始文本 */}
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-white/40">
                  <FileText size={ICON_SIZE.sm} />
                  原始文本
                </label>
                <div className="rounded-xl bg-white/[0.02] p-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/80">
                    {voice.raw_text}
                  </p>
                </div>
              </div>

              {/* Metadata */}
              {voice.metadata &&
                Object.keys(voice.metadata).length > 0 && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowFullMetadata(!showFullMetadata)}
                      className="mb-1.5 flex cursor-pointer items-center gap-1.5 text-xs font-medium text-white/40 transition-colors hover:text-white/60"
                    >
                      <Code2 size={ICON_SIZE.sm} />
                      Metadata
                      <span className="rounded bg-white/5 px-1 py-0.5 text-[10px]">
                        {Object.keys(voice.metadata).length} 字段
                      </span>
                    </button>
                    {showFullMetadata && (
                      <pre className="animate-expand max-h-64 overflow-auto rounded-xl bg-white/[0.02] p-4 font-mono text-xs text-white/50">
                        {JSON.stringify(voice.metadata, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
            </div>

            {/* 语义单元列表 */}
            <div className="space-y-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-white/80">
                语义单元
                <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/40">
                  {sortedUnits.length}
                </span>
              </h2>

              {sortedUnits.length === 0 ? (
                <div className="flex min-h-[150px] flex-col items-center justify-center gap-3 text-center">
                  <p className="text-sm text-white/30">暂无拆解出的语义单元</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {sortedUnits.map((unit) => (
                    <UnitCard
                      key={unit.id}
                      unit={unit}
                      onClick={() => navigate(`/voc/units/${unit.id}`)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
