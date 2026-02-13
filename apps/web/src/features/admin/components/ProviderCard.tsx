/**
 * Provider 卡片组件。
 * Liquid Glass 风格。
 * 渐进披露：列表视图只显示名称、类型、状态；点击展开详细配置。
 */

import { useState } from "react";
import {
  Server,
  ChevronDown,
  Trash2,
  Loader2,
  CheckCircle,
  XCircle,
  ExternalLink,
} from "lucide-react";
import { cn, formatDate, formatLatency } from "@/lib/utils";
import type { Provider, ProviderTestResponse } from "@/api/types";

interface ProviderCardProps {
  provider: Provider;
  onDelete: (id: string) => Promise<boolean>;
  onTest: (id: string) => Promise<ProviderTestResponse | null>;
}

export function ProviderCard({
  provider,
  onDelete,
  onTest,
}: ProviderCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<ProviderTestResponse | null>(
    null,
  );

  const handleDelete = async () => {
    if (!confirm(`确定删除 Provider "${provider.name}" 吗？此操作不可撤销。`)) {
      return;
    }
    setIsDeleting(true);
    await onDelete(provider.id);
    setIsDeleting(false);
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    const result = await onTest(provider.id);
    setTestResult(result);
    setIsTesting(false);
  };

  return (
    <div
      className={cn(
        "glass-card overflow-hidden",
        !provider.is_enabled && "opacity-60",
      )}
    >
      {/* 头部 -- 点击展开 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-4 p-5 text-left transition-colors hover:bg-white/[0.02]"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
          <Server size={18} className="text-blue-400" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white">
              {provider.name}
            </h3>
            {provider.is_enabled ? (
              <span className="status-dot status-dot-healthy" />
            ) : (
              <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/30">
                已禁用
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-white/40">
            {provider.provider_type} / {provider.slug}
          </p>
        </div>

        <ChevronDown
          size={16}
          className={cn(
            "text-white/30 transition-transform duration-300",
            isExpanded && "rotate-180",
          )}
        />
      </button>

      {/* 展开详情 */}
      {isExpanded && (
        <div className="animate-expand border-t border-white/5 p-5">
          <div className="space-y-4">
            {/* Base URL */}
            <div>
              <label className="text-xs font-medium text-white/40">
                Base URL
              </label>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 truncate rounded-lg bg-white/[0.03] px-3 py-1.5 text-xs text-white/70">
                  {provider.base_url}
                </code>
                <a
                  href={provider.base_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-white/20 transition-colors hover:text-white/50"
                >
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>

            {/* 时间信息 */}
            <div className="flex gap-6 text-xs text-white/30">
              <span>创建于 {formatDate(provider.created_at)}</span>
              <span>更新于 {formatDate(provider.updated_at)}</span>
            </div>

            {/* 连通性测试结果 */}
            {testResult && (
              <div
                className={cn(
                  "rounded-xl p-3 text-sm",
                  testResult.status === "ok"
                    ? "bg-green-500/10 text-green-400"
                    : "bg-red-500/10 text-red-400",
                )}
              >
                <div className="flex items-center gap-2">
                  {testResult.status === "ok" ? (
                    <CheckCircle size={14} />
                  ) : (
                    <XCircle size={14} />
                  )}
                  <span>
                    {testResult.status === "ok"
                      ? `连通成功${testResult.latency_ms !== null ? ` (${formatLatency(testResult.latency_ms)})` : ""}`
                      : testResult.message}
                  </span>
                </div>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => void handleTest()}
                disabled={isTesting}
                className="glass-btn-ghost flex items-center gap-1.5 px-3 py-1.5 text-xs"
              >
                {isTesting ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <CheckCircle size={12} />
                )}
                {isTesting ? "测试中..." : "测试连通性"}
              </button>

              <div className="flex-1" />

              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={isDeleting}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-red-400/60 transition-colors hover:bg-red-500/10 hover:text-red-400"
              >
                {isDeleting ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Trash2 size={12} />
                )}
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
