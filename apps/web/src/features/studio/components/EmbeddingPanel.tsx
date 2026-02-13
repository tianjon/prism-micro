/**
 * Embedding 面板。
 * 多文本输入、向量维度/前 8 维预览、余弦相似度矩阵展示。
 */

import { useState } from "react";
import { Plus, Trash2, Play, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ICON_SIZE } from "@/lib/icon-sizes";
import type { EmbeddingItem } from "@/api/types";
import { callEmbedding } from "../api/studio-api";

interface EmbeddingPanelProps {
  providerId: string | null;
  modelId: string;
}

interface EmbeddingResult {
  embeddings: EmbeddingItem[];
  latency_ms: number;
  model: string;
}

function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dotProduct += (a[i] ?? 0) * (b[i] ?? 0);
    normA += (a[i] ?? 0) ** 2;
    normB += (b[i] ?? 0) ** 2;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dotProduct / denom;
}

export function EmbeddingPanel({ providerId, modelId }: EmbeddingPanelProps) {
  const [texts, setTexts] = useState<string[]>([""]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EmbeddingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = providerId && modelId && texts.some((t) => t.trim()) && !loading;

  const handleAddText = () => {
    setTexts([...texts, ""]);
  };

  const handleRemoveText = (index: number) => {
    if (texts.length <= 1) return;
    setTexts(texts.filter((_, i) => i !== index));
  };

  const handleTextChange = (index: number, value: string) => {
    const updated = [...texts];
    updated[index] = value;
    setTexts(updated);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const validTexts = texts.filter((t) => t.trim());
    try {
      const res = await callEmbedding({
        provider_id: providerId,
        model_id: modelId,
        input: validTexts.length === 1 ? validTexts[0]! : validTexts,
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
        {/* 文本输入区 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-white/60">输入文本</h3>
            <button
              type="button"
              onClick={handleAddText}
              aria-label="添加文本"
              className="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs text-white/40 transition-colors hover:bg-white/5 hover:text-white/60"
            >
              <Plus size={ICON_SIZE.sm} />
              添加文本
            </button>
          </div>

          {texts.map((text, i) => (
            <div key={i} className="flex gap-2">
              <span className="mt-2.5 text-xs text-white/20">{i + 1}.</span>
              <textarea
                value={text}
                onChange={(e) => handleTextChange(i, e.target.value)}
                placeholder="输入待向量化的文本..."
                rows={2}
                aria-label={`文本 ${i + 1}`}
                className="glass-input flex-1 resize-none px-3 py-2 text-sm"
              />
              {texts.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveText(i)}
                  aria-label={`删除文本 ${i + 1}`}
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
              aria-label="生成向量"
              className="glass-btn-primary flex items-center gap-2 rounded-xl px-4 py-2 text-sm disabled:opacity-30"
            >
              {loading ? <Loader2 size={ICON_SIZE.md} className="animate-spin" /> : <Play size={ICON_SIZE.md} />}
              生成向量
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
            <p className="text-sm text-white/20">输入文本并点击"生成向量"查看结果</p>
          </div>
        )}

        {/* 结果展示 */}
        {result && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-4 text-xs text-white/30">
              <span>模型: {result.model}</span>
              <span>延迟: {result.latency_ms}ms</span>
            </div>

            {/* 向量预览 */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-white/60">向量预览</h3>
              {result.embeddings.map((emb) => (
                <div
                  key={emb.index}
                  className="rounded-xl border border-white/5 bg-white/[0.02] p-3"
                >
                  <div className="mb-2 flex items-center gap-2 text-xs">
                    <span className="text-white/40">
                      文本 {emb.index + 1}
                    </span>
                    <span className="text-white/20">
                      {emb.dimensions} 维
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {emb.values.slice(0, 8).map((v, j) => (
                      <span
                        key={j}
                        className="rounded bg-white/5 px-2 py-0.5 font-mono text-[10px] text-white/50"
                      >
                        {v.toFixed(6)}
                      </span>
                    ))}
                    {emb.dimensions > 8 && (
                      <span className="px-1 text-[10px] text-white/20">
                        ...+{emb.dimensions - 8}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* 余弦相似度矩阵 */}
            {result.embeddings.length > 1 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-white/60">
                  余弦相似度矩阵
                </h3>
                <div className="overflow-x-auto rounded-lg">
                  <table className="text-xs" aria-label="文本间余弦相似度矩阵">
                    <caption className="sr-only">各文本之间的余弦相似度得分</caption>
                    <thead>
                      <tr>
                        <th scope="col" className="px-3 py-2 text-white/30" />
                        {result.embeddings.map((_, i) => (
                          <th scope="col" key={i} className="px-3 py-2 text-center text-white/40">
                            文本 {i + 1}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.embeddings.map((a, i) => (
                        <tr key={i}>
                          <th scope="row" className="px-3 py-2 text-left text-white/40">
                            文本 {i + 1}
                          </th>
                          {result.embeddings.map((b, j) => {
                            const sim = cosineSimilarity(a.values, b.values);
                            return (
                              <td
                                key={j}
                                className={cn(
                                  "px-3 py-2 text-center font-mono",
                                  i === j
                                    ? "text-white/20"
                                    : sim > 0.8
                                      ? "text-emerald-400"
                                      : sim > 0.5
                                        ? "text-amber-400"
                                        : "text-white/40",
                                )}
                              >
                                {sim.toFixed(4)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
