/**
 * Rerank 面板。
 * query + 候选文档输入、按分数排序的结果列表展示。
 */

import { useState } from "react";
import { Plus, Trash2, Loader2, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ICON_SIZE } from "@/lib/icon-sizes";
import type { RerankResultItem } from "@/api/types";
import { callRerank } from "../api/studio-api";

interface RerankPanelProps {
  providerId: string | null;
  modelId: string;
}

interface RerankResult {
  results: RerankResultItem[];
  latency_ms: number;
  model: string;
}

export function RerankPanel({ providerId, modelId }: RerankPanelProps) {
  const [query, setQuery] = useState("");
  const [documents, setDocuments] = useState<string[]>(["", ""]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RerankResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = providerId && modelId && query.trim() && documents.some((d) => d.trim()) && !loading;

  const handleAddDoc = () => {
    setDocuments([...documents, ""]);
  };

  const handleRemoveDoc = (index: number) => {
    if (documents.length <= 2) return;
    setDocuments(documents.filter((_, i) => i !== index));
  };

  const handleDocChange = (index: number, value: string) => {
    const updated = [...documents];
    updated[index] = value;
    setDocuments(updated);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const validDocs = documents.filter((d) => d.trim());
    try {
      const res = await callRerank({
        provider_id: providerId,
        model_id: modelId,
        query: query.trim(),
        documents: validDocs,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "请求失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4">
        {/* 查询输入 */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-white/60">查询文本</h3>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="输入查询文本..."
            rows={2}
            aria-label="查询文本"
            className="glass-input w-full resize-none px-3 py-2 text-sm"
          />
        </div>

        {/* 候选文档输入 */}
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-white/60">候选文档</h3>
            <button
              type="button"
              onClick={handleAddDoc}
              aria-label="添加文档"
              className="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs text-white/40 transition-colors hover:bg-white/5 hover:text-white/60"
            >
              <Plus size={ICON_SIZE.sm} />
              添加文档
            </button>
          </div>

          {documents.map((doc, i) => (
            <div key={i} className="flex gap-2">
              <span className="mt-2.5 text-xs text-white/20">{i + 1}.</span>
              <textarea
                value={doc}
                onChange={(e) => handleDocChange(i, e.target.value)}
                placeholder="输入候选文档..."
                rows={2}
                aria-label={`候选文档 ${i + 1}`}
                className="glass-input flex-1 resize-none px-3 py-2 text-sm"
              />
              {documents.length > 2 && (
                <button
                  type="button"
                  onClick={() => handleRemoveDoc(i)}
                  aria-label={`删除文档 ${i + 1}`}
                  className="mt-1 shrink-0 cursor-pointer rounded-lg p-2 text-white/20 transition-colors hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 size={ICON_SIZE.md} />
                </button>
              )}
            </div>
          ))}

          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!canSubmit}
              aria-label="重排序"
              className="glass-btn-primary flex items-center gap-2 rounded-xl px-4 py-2 text-sm disabled:opacity-30"
            >
              {loading ? <Loader2 size={ICON_SIZE.md} className="animate-spin" /> : <ArrowUpDown size={ICON_SIZE.md} />}
              重排序
            </button>
          </div>
        </div>

        {/* 错误信息 */}
        {error && (
          <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* 空状态 */}
        {!result && !error && !loading && (
          <div className="mt-8 flex flex-col items-center gap-2 py-8 text-center">
            <p className="text-sm text-white/20">输入查询和文档后点击"重排序"查看结果</p>
          </div>
        )}

        {/* 结果展示 */}
        {result && (
          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-4 text-xs text-white/30">
              <span>模型: {result.model}</span>
              <span>延迟: {result.latency_ms}ms</span>
            </div>

            <h3 className="text-sm font-medium text-white/60">排序结果</h3>
            <div className="space-y-2">
              {result.results.map((item, rank) => (
                <div
                  key={item.index}
                  className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3"
                >
                  <div
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                      rank === 0
                        ? "bg-emerald-500/20 text-emerald-400"
                        : rank === 1
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-white/5 text-white/30",
                    )}
                  >
                    {rank + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white/70">{item.document}</p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-white/30">
                      <span>原始序号: {item.index + 1}</span>
                      <span
                        className={cn(
                          "font-mono font-medium",
                          item.relevance_score > 0.7
                            ? "text-emerald-400"
                            : item.relevance_score > 0.3
                              ? "text-amber-400"
                              : "text-white/40",
                        )}
                      >
                        得分: {item.relevance_score.toFixed(4)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
