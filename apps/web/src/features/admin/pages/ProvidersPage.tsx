/**
 * Provider 管理页 (/admin/providers)。
 * Provider 列表 + 新建 Provider Sheet。
 * 渐进披露：列表只显示名称/类型/状态，点击展开详情。
 */

import { useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { ErrorState } from "@/components/ErrorState";
import { CardSkeleton } from "@/components/GlassSkeleton";
import { ProviderCard } from "../components/ProviderCard";
import { CreateProviderSheet } from "../components/CreateProviderSheet";
import { useProviders } from "../hooks/use-providers";

export function ProvidersPage() {
  const {
    providers,
    loadState,
    error,
    reload,
    createProvider,
    removeProvider,
    testProvider,
  } = useProviders();

  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // 加载中
  if (loadState === "loading") {
    return (
      <div>
        <PageHeader title="Provider 管理" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  // 错误
  if (loadState === "error") {
    return (
      <div>
        <PageHeader title="Provider 管理" />
        <ErrorState message={error ?? "加载失败"} onRetry={reload} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Provider 管理"
        description="管理 LLM Provider 配置（API 端点、密钥、连通性）"
        actions={
          <button
            onClick={() => setIsSheetOpen(true)}
            className="glass-btn-primary flex items-center gap-2 px-4 py-2 text-sm"
          >
            <Plus size={16} />
            新建 Provider
          </button>
        }
      />

      {/* Provider 列表 */}
      {providers.length === 0 ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-4 text-center">
          <div className="rounded-2xl bg-white/5 p-4">
            <Plus size={24} className="text-white/20" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white/60">
              暂无 Provider
            </h3>
            <p className="mt-1 text-sm text-white/30">
              创建你的第一个 Provider 以开始使用 LLM 服务
            </p>
          </div>
          <button
            onClick={() => setIsSheetOpen(true)}
            className="glass-btn-primary px-5 py-2 text-sm"
          >
            新建 Provider
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              onDelete={removeProvider}
              onTest={testProvider}
            />
          ))}
        </div>
      )}

      {/* 新建 Provider Sheet */}
      <CreateProviderSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        onSubmit={createProvider}
      />
    </div>
  );
}
