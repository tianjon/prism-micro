/**
 * 槽位测试面板。
 * 消息输入 + 调用 slot-invoke + 展示结果。
 */

import { useState } from "react";
import { Play, Loader2 } from "lucide-react";
import { ICON_SIZE } from "@/lib/icon-sizes";
import type { SlotType, SlotInvokeResponse } from "@/api/types";
import { invokeSlot } from "../api/studio-api";
import { FailoverTrace } from "./FailoverTrace";

interface SlotTestPanelProps {
  slotType: SlotType;
}

export function SlotTestPanel({ slotType }: SlotTestPanelProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SlotInvokeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = input.trim() && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await invokeSlot(slotType, {
        messages: [{ role: "user", content: input.trim() }],
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "调用失败");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  return (
    <div className="space-y-4">
      {/* 输入区域 */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-white/60">测试消息</label>
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入测试消息... (Enter 发送)"
            rows={2}
            aria-label="测试消息"
            className="glass-input flex-1 resize-none px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            aria-label="发送测试"
            className="glass-btn-primary self-end shrink-0 rounded-xl px-4 py-2.5 text-sm disabled:opacity-30"
          >
            {loading ? (
              <Loader2 size={ICON_SIZE.md} className="animate-spin" />
            ) : (
              <Play size={ICON_SIZE.md} />
            )}
          </button>
        </div>
      </div>

      {/* 错误信息 */}
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* 结果展示 */}
      {result && (
        <div className="space-y-4 rounded-xl border border-white/5 bg-white/[0.02] p-4">
          {/* 模型回复 */}
          <div className="space-y-1">
            <h4 className="text-xs font-medium text-white/40">模型回复</h4>
            <p className="whitespace-pre-wrap text-sm text-white/80">
              {result.result.content}
            </p>
          </div>

          {/* 路由信息 */}
          <div className="space-y-1">
            <h4 className="text-xs font-medium text-white/40">路由决策</h4>
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="rounded bg-white/5 px-2 py-1 text-white/50">
                Provider: {result.routing.provider_name}
              </span>
              <span className="rounded bg-white/5 px-2 py-1 font-mono text-white/50">
                Model: {result.routing.model_id}
              </span>
              <span className="rounded bg-white/5 px-2 py-1 text-white/50">
                槽位: {result.routing.slot_type}
              </span>
              {result.routing.used_resource_pool && (
                <span className="rounded bg-amber-500/10 px-2 py-1 text-amber-400">
                  使用了资源池
                </span>
              )}
            </div>
          </div>

          {/* 延迟和 Token */}
          <div className="flex gap-4 text-xs text-white/30">
            <span>延迟: {result.result.latency_ms}ms</span>
            <span>
              Token: {result.result.usage.prompt_tokens} + {result.result.usage.completion_tokens} = {result.result.usage.total_tokens}
            </span>
          </div>

          {/* 故障转移追踪 */}
          {result.routing.failover_trace.length > 1 && (
            <FailoverTrace trace={result.routing.failover_trace} />
          )}
        </div>
      )}
    </div>
  );
}
