/**
 * 语义搜索页面 (/voc/search)。
 * 通过自然语言查询语义单元，支持 Rerank 和结果数量控制。
 */

import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Loader2, SearchX, ToggleLeft, ToggleRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { PageContainer } from "@/components/PageContainer";
import { PageHeader } from "@/components/PageHeader";
import { ErrorState } from "@/components/ErrorState";
import { searchUnits } from "@/api/voc-api";
import type { SearchResultItem } from "@/api/types";
import { useToast } from "@/hooks/use-toast";
import { SearchResultCard } from "../components/SearchResultCard";

/** top_k 可选值 */
const TOP_K_OPTIONS = [10, 20, 50, 100] as const;

type LoadState = "idle" | "loading" | "success" | "error";

export function SearchPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // 搜索表单状态
  const [query, setQuery] = useState("");
  const [rerank, setRerank] = useState(true);
  const [topK, setTopK] = useState<number>(20);

  // 结果状态
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [total, setTotal] = useState(0);
  const [searchedQuery, setSearchedQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) {
      toast({ title: "请输入搜索内容", variant: "warning" });
      return;
    }

    setLoadState("loading");
    setErrorMessage("");

    try {
      const res = await searchUnits({
        query: trimmed,
        top_k: topK,
        rerank,
      });
      setResults(res.data.results);
      setTotal(res.data.total);
      setSearchedQuery(res.data.query);
      setLoadState("success");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "搜索失败，请稍后重试";
      setErrorMessage(msg);
      setLoadState("error");
      toast({ title: "搜索失败", description: msg, variant: "error" });
    }
  }, [query, topK, rerank, toast]);

  /** 按回车搜索 */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      void handleSearch();
    }
  };

  return (
    <PageContainer>
      <div className="space-y-6">
        <PageHeader
          title="语义搜索"
          description="通过自然语言查询，从客户反馈中检索语义相关的内容"
        />

        {/* 搜索栏 */}
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search
                size={ICON_SIZE.md}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入自然语言查询，例如「车辆异响问题」「电池续航不满意」..."
                aria-label="语义搜索查询"
                className="glass-input h-10 w-full pl-9 pr-3 text-sm"
                disabled={loadState === "loading"}
              />
            </div>
            <button
              type="button"
              onClick={() => void handleSearch()}
              disabled={loadState === "loading" || !query.trim()}
              className="glass-btn-primary flex shrink-0 items-center gap-2 px-5 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadState === "loading" ? (
                <Loader2 size={ICON_SIZE.md} className="animate-spin" />
              ) : (
                <Search size={ICON_SIZE.md} />
              )}
              搜索
            </button>
          </div>

          {/* 搜索选项 */}
          <div className="flex flex-wrap items-center gap-4 text-sm">
            {/* Rerank 开关 */}
            <button
              type="button"
              onClick={() => setRerank(!rerank)}
              className="flex cursor-pointer items-center gap-2 text-white/50 transition-colors hover:text-white/80"
            >
              {rerank ? (
                <ToggleRight
                  size={ICON_SIZE.xl}
                  className="text-indigo-400"
                />
              ) : (
                <ToggleLeft size={ICON_SIZE.xl} className="text-white/30" />
              )}
              <span className={cn(rerank ? "text-white/70" : "text-white/40")}>
                Rerank 重排序
              </span>
            </button>

            {/* top_k 选择 */}
            <div className="flex items-center gap-2">
              <span className="text-white/40 text-xs">返回数量</span>
              <select
                value={topK}
                onChange={(e) => setTopK(Number(e.target.value))}
                className="glass-input h-8 cursor-pointer px-3 text-xs"
              >
                {TOP_K_OPTIONS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 搜索结果区域 */}
        {loadState === "idle" && (
          <div className="flex min-h-[300px] flex-col items-center justify-center gap-4 text-center">
            <div className="rounded-2xl bg-white/5 p-4">
              <Search size={ICON_SIZE["3xl"]} className="text-white/20" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white/60">
                开始搜索
              </h3>
              <p className="mt-1 text-sm text-white/30">
                输入自然语言查询，语义搜索将为你找到最相关的客户反馈
              </p>
            </div>
          </div>
        )}

        {loadState === "loading" && (
          <div className="flex min-h-[300px] flex-col items-center justify-center gap-4">
            <Loader2
              size={ICON_SIZE["3xl"]}
              className="animate-spin text-indigo-400"
            />
            <p className="text-sm text-white/50">正在搜索...</p>
          </div>
        )}

        {loadState === "error" && (
          <ErrorState
            message={errorMessage}
            onRetry={() => void handleSearch()}
          />
        )}

        {loadState === "success" && (
          <div className="space-y-4">
            {/* 结果统计 */}
            <div className="flex items-center gap-2 text-sm text-white/50">
              <span>
                找到 <strong className="text-white/80">{total}</strong> 条结果
              </span>
              <span className="text-white/20">|</span>
              <span className="text-white/30">
                查询：&quot;{searchedQuery}&quot;
              </span>
            </div>

            {/* 结果列表 / 空状态 */}
            {results.length === 0 ? (
              <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 text-center">
                <div className="rounded-2xl bg-white/5 p-4">
                  <SearchX
                    size={ICON_SIZE["3xl"]}
                    className="text-white/20"
                  />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white/60">
                    没有找到相关结果
                  </h3>
                  <p className="mt-1 text-sm text-white/30">
                    尝试使用不同的关键词或调整搜索选项
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid gap-3">
                {results.map((item) => (
                  <SearchResultCard
                    key={item.unit_id}
                    result={item}
                    onClick={() => navigate(`/voc/units/${item.unit_id}`)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
