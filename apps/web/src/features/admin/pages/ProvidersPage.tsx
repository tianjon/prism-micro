/**
 * Provider 管理页 (/admin/providers)。
 * Provider 列表 + 页内创建组件。
 * 渐进披露：列表只显示名称/类型/状态，点击展开详情。
 */

import { Plus } from "lucide-react";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { PageHeader } from "@/components/PageHeader";
import { PageContainer } from "@/components/PageContainer";
import { ErrorState } from "@/components/ErrorState";
import { CardSkeleton } from "@/components/GlassSkeleton";
import { ProviderCard } from "../components/ProviderCard";
import { CreateProviderInline } from "../components/CreateProviderInline";
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

  // 加载中
  if (loadState === "loading") {
    return (
      <PageContainer>
        <PageHeader title="Provider 管理" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </PageContainer>
    );
  }

  // 错误
  if (loadState === "error") {
    return (
      <PageContainer>
        <PageHeader title="Provider 管理" />
        <ErrorState message={error ?? "加载失败"} onRetry={reload} />
      </PageContainer>
    );
  }

  return (
    <PageContainer><div className="space-y-6">
      <PageHeader
        title="Provider 管理"
        description="管理 LLM Provider 配置（API 端点、密钥、连通性）"
      />

      {/* 页内创建组件 */}
      <CreateProviderInline
        providers={providers}
        onSubmit={createProvider}
      />

      {/* Provider 列表 */}
      {providers.length === 0 ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 text-center">
          <div className="rounded-2xl bg-white/5 p-4">
            <Plus size={ICON_SIZE["3xl"]} className="text-white/20" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white/60">
              暂无 Provider
            </h3>
            <p className="mt-1 text-sm text-white/30">
              点击上方"新建 Provider"按钮，选择平台开始配置
            </p>
          </div>
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
    </div></PageContainer>
  );
}
