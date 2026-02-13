/**
 * Provider 卡片组件。
 * Liquid Glass 风格。
 * 渐进披露：列表视图只显示名称、类型、状态；点击展开详细配置。
 */

import { useState, useEffect, useCallback, useId } from "react";
import {
  Server,
  ChevronDown,
  Trash2,
  Loader2,
  CheckCircle,
  XCircle,
  ExternalLink,
  Cpu,
  RefreshCw,
} from "lucide-react";
import { cn, formatDate, formatLatency } from "@/lib/utils";
import type { Provider, ProviderModel, ProviderTestResponse } from "@/api/types";
import { fetchProviderModels } from "../api/providers-api";

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
  const [models, setModels] = useState<ProviderModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const contentId = useId();

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

  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    try {
      const res = await fetchProviderModels(provider.id);
      setModels(res.data);
      setModelsLoaded(true);
    } catch {
      setModels([]);
      setModelsLoaded(true);
    } finally {
      setModelsLoading(false);
    }
  }, [provider.id]);

  // 展开时自动加载模型列表
  useEffect(() => {
    if (isExpanded && !modelsLoaded && !modelsLoading) {
      void loadModels();
    }
  }, [isExpanded, modelsLoaded, modelsLoading, loadModels]);

  const filteredModels = models.filter((m) =>
    m.id.toLowerCase().includes(modelSearch.toLowerCase()),
  );

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
        aria-expanded={isExpanded}
        aria-controls={contentId}
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
        <div
          id={contentId}
          className="animate-expand border-t border-white/5 p-5"
        >
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
                  href={provider.base_url ?? undefined}
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

            {/* 可用模型 */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-medium text-white/40">
                  <Cpu size={12} />
                  可用模型
                  {modelsLoaded && (
                    <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px]">
                      {models.length}
                    </span>
                  )}
                </label>
                <button
                  type="button"
                  onClick={() => void loadModels()}
                  disabled={modelsLoading}
                  className="text-white/20 transition-colors hover:text-white/50"
                >
                  <RefreshCw
                    size={12}
                    className={modelsLoading ? "animate-spin" : ""}
                  />
                </button>
              </div>
              {modelsLoading && !modelsLoaded ? (
                <div className="flex items-center gap-2 py-2 text-xs text-white/30">
                  <Loader2 size={12} className="animate-spin" />
                  加载模型列表...
                </div>
              ) : models.length > 0 ? (
                <div>
                  {models.length > 8 && (
                    <input
                      type="text"
                      value={modelSearch}
                      onChange={(e) => setModelSearch(e.target.value)}
                      placeholder="搜索模型..."
                      className="glass-input mb-2 h-8 w-full px-3 text-xs"
                    />
                  )}
                  <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                    {filteredModels.map((m) => (
                      <span
                        key={m.id}
                        className="inline-block rounded-lg bg-white/[0.04] px-2 py-1 font-mono text-[11px] text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white/70"
                        title={m.owned_by ? `by ${m.owned_by}` : undefined}
                      >
                        {m.id}
                      </span>
                    ))}
                  </div>
                </div>
              ) : modelsLoaded ? (
                <p className="text-xs text-white/20">
                  无法获取模型列表（Provider 可能不支持 /models 端点）
                </p>
              ) : null}
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
