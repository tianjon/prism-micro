/**
 * 标签对比页 (/voc/tags/compare)。
 * 涌现标签 vs 预设分类的覆盖度对比。
 */

import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  GitCompare,
  ChevronLeft,
  ChevronRight,
  Loader2,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { ApiError } from "@/api/client";
import type { CompareSummary, ComparisonItem } from "@/api/types";
import { compareTags } from "@/api/voc-api";
import { useToast } from "@/hooks/use-toast";
import { PageContainer } from "@/components/PageContainer";
import { PageHeader } from "@/components/PageHeader";

/** verdict 颜色映射 */
const VERDICT_STYLES: Record<string, string> = {
  both: "text-green-400 bg-green-400/10",
  emergent_better: "text-blue-400 bg-blue-400/10",
  preset_better: "text-yellow-400 bg-yellow-400/10",
  neither: "text-white/30 bg-white/5",
};

/** verdict 中文标签 */
const VERDICT_LABELS: Record<string, string> = {
  both: "两者匹配",
  emergent_better: "涌现更优",
  preset_better: "预设更优",
  neither: "均未覆盖",
};

type LoadState = "idle" | "loading" | "success" | "error";

const PAGE_SIZE = 10;

export function TagComparePage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // 输入
  const [presetInput, setPresetInput] = useState("");

  // 对比结果
  const [summary, setSummary] = useState<CompareSummary | null>(null);
  const [items, setItems] = useState<ComparisonItem[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /** 执行对比 */
  const doCompare = useCallback(
    async (targetPage: number) => {
      const trimmed = presetInput.trim();
      if (!trimmed) {
        toast({
          title: "请输入预设分类关键词",
          variant: "warning",
        });
        return;
      }
      setLoadState("loading");
      try {
        const response = await compareTags({
          preset_taxonomy: trimmed,
          page: targetPage,
          page_size: PAGE_SIZE,
        });
        setSummary(response.data.summary);
        setItems(response.data.items);
        setTotal(response.data.total);
        setPage(targetPage);
        setLoadState("success");
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "标签对比失败";
        toast({ title: message, variant: "error" });
        setLoadState("error");
      }
    },
    [presetInput, toast],
  );

  /** 开始对比（从第一页） */
  const handleStartCompare = () => {
    void doCompare(1);
  };

  /** 分页导航 */
  const handlePageChange = (newPage: number) => {
    void doCompare(newPage);
  };

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* 返回按钮 */}
        <button
          onClick={() => navigate("/voc/tags")}
          className="glass-btn-ghost flex items-center gap-1 px-3 py-1.5 text-sm"
        >
          <ArrowLeft size={ICON_SIZE.md} />
          返回标签列表
        </button>

        <PageHeader
          title="标签对比"
          description="对比涌现标签与预设分类的覆盖度差异"
        />

        {/* 输入区域 */}
        <div className="glass-panel p-5">
          <div className="flex flex-col gap-1.5 mb-4">
            <label className="text-sm text-white/50">
              预设分类关键词
            </label>
            <p className="text-xs text-white/30">
              输入逗号分隔的分类关键词，例如：质量问题,售后服务,价格,配送
            </p>
          </div>
          <div className="flex items-stretch gap-3">
            <input
              type="text"
              value={presetInput}
              onChange={(e) => setPresetInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleStartCompare();
              }}
              placeholder="质量问题,售后服务,价格,配送"
              className="glass-input flex-1 h-10 px-3 py-2 text-sm"
            />
            <button
              onClick={handleStartCompare}
              disabled={loadState === "loading" || !presetInput.trim()}
              className={cn(
                "glass-btn-primary flex items-center gap-1.5 px-5 text-sm",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              )}
            >
              {loadState === "loading" ? (
                <Loader2 size={ICON_SIZE.md} className="animate-spin" />
              ) : (
                <GitCompare size={ICON_SIZE.md} />
              )}
              开始对比
            </button>
          </div>
        </div>

        {/* 空状态 */}
        {loadState === "idle" && (
          <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 text-center">
            <div className="rounded-2xl bg-white/5 p-4">
              <BarChart3 size={ICON_SIZE["3xl"]} className="text-white/20" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white/60">
                输入预设分类开始对比
              </h3>
              <p className="mt-1 text-sm text-white/30">
                系统将自动比较涌现标签与预设分类的覆盖度
              </p>
            </div>
          </div>
        )}

        {/* 对比结果 */}
        {summary && (
          <>
            {/* Summary 统计卡片 */}
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
              <div className="glass-card p-4 text-center">
                <div className="text-xl font-bold text-white/90">
                  {summary.total_units}
                </div>
                <div className="text-xs text-white/40 mt-1">总单元数</div>
              </div>
              <div className="glass-card p-4 text-center">
                <div className="text-xl font-bold text-blue-400">
                  {(summary.emergent_coverage * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-white/40 mt-1">涌现覆盖率</div>
              </div>
              <div className="glass-card p-4 text-center">
                <div className="text-xl font-bold text-yellow-400">
                  {(summary.preset_coverage * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-white/40 mt-1">预设覆盖率</div>
              </div>
              <div className="glass-card p-4 text-center">
                <div className="text-xl font-bold text-blue-400">
                  {summary.emergent_only_count}
                </div>
                <div className="text-xs text-white/40 mt-1">仅涌现</div>
              </div>
              <div className="glass-card p-4 text-center">
                <div className="text-xl font-bold text-yellow-400">
                  {summary.preset_only_count}
                </div>
                <div className="text-xs text-white/40 mt-1">仅预设</div>
              </div>
              <div className="glass-card p-4 text-center">
                <div className="text-xl font-bold text-green-400">
                  {summary.both_count}
                </div>
                <div className="text-xs text-white/40 mt-1">两者匹配</div>
              </div>
            </div>

            {/* 对比结果列表 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white/90">
                  对比明细
                </h2>
                <span className="text-sm text-white/40">
                  共 {total} 条
                </span>
              </div>

              {items.length === 0 ? (
                <div className="flex min-h-[150px] flex-col items-center justify-center text-center">
                  <p className="text-sm text-white/30">无对比结果</p>
                </div>
              ) : (
                <>
                  {items.map((item) => (
                    <div
                      key={item.unit_id}
                      className="glass-card p-4 space-y-3"
                    >
                      {/* 文本（截断） */}
                      <p className="text-sm text-white/80 leading-relaxed line-clamp-2">
                        {item.text}
                      </p>

                      {/* 标签对比 */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* 涌现标签 */}
                        <div>
                          <span className="text-xs text-blue-400/60 mb-1 block">
                            涌现标签
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {item.emergent_tags.length > 0 ? (
                              item.emergent_tags.map((t) => (
                                <span
                                  key={t}
                                  className="rounded-md bg-blue-400/10 px-2 py-0.5 text-xs text-blue-400"
                                >
                                  {t}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-white/20">
                                无
                              </span>
                            )}
                          </div>
                        </div>
                        {/* 预设匹配 */}
                        <div>
                          <span className="text-xs text-yellow-400/60 mb-1 block">
                            预设匹配
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {item.preset_matches.length > 0 ? (
                              item.preset_matches.map((t) => (
                                <span
                                  key={t}
                                  className="rounded-md bg-yellow-400/10 px-2 py-0.5 text-xs text-yellow-400"
                                >
                                  {t}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-white/20">
                                无
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* verdict */}
                      <div className="flex items-center justify-end">
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-xs font-medium",
                            VERDICT_STYLES[item.verdict] ??
                              "text-white/30 bg-white/5",
                          )}
                        >
                          {VERDICT_LABELS[item.verdict] ?? item.verdict}
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* 分页 */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-3 pt-2">
                      <button
                        onClick={() =>
                          handlePageChange(Math.max(1, page - 1))
                        }
                        disabled={page <= 1 || loadState === "loading"}
                        className="glass-btn-ghost flex items-center gap-1 px-3 py-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft size={ICON_SIZE.md} />
                        上一页
                      </button>
                      <span className="text-sm text-white/50">
                        {page} / {totalPages}
                      </span>
                      <button
                        onClick={() =>
                          handlePageChange(Math.min(totalPages, page + 1))
                        }
                        disabled={
                          page >= totalPages || loadState === "loading"
                        }
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
          </>
        )}
      </div>
    </PageContainer>
  );
}
