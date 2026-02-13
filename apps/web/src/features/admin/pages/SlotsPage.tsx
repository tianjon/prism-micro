/**
 * 槽位配置页 (/admin/slots)。
 * 4 个水平 Tab 对应 4 种能力槽位（fast / reasoning / embedding / rerank），
 * 下方全宽区域展示选中槽位的完整配置面板。
 */

import { useState, useCallback } from "react";
import { Zap, Brain, Cpu, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { PageHeader } from "@/components/PageHeader";
import { ErrorState } from "@/components/ErrorState";
import { CardSkeleton } from "@/components/GlassSkeleton";
import { SLOT_META } from "@/lib/constants";
import { PageContainer } from "@/components/PageContainer";
import { SlotConfigPanel } from "../components/SlotConfigPanel";
import { useSlots } from "../hooks/use-slots";
import { useProviders } from "../hooks/use-providers";
import type { SlotType, ProviderTestResponse } from "@/api/types";
import { testProvider } from "../api/providers-api";

/** Tab 图标映射 */
const slotIcons: Record<SlotType, React.ReactNode> = {
  fast: <Zap size={ICON_SIZE.xl} />,
  reasoning: <Brain size={ICON_SIZE.xl} />,
  embedding: <Cpu size={ICON_SIZE.xl} />,
  rerank: <ArrowUpDown size={ICON_SIZE.xl} />,
};

const SLOT_TYPES: SlotType[] = ["fast", "reasoning", "embedding", "rerank"];

export function SlotsPage() {
  const { slots, loadState, error, reload, configureSlot } = useSlots();
  const { providers, loadState: providersLoadState } = useProviders();
  const [activeTab, setActiveTab] = useState<SlotType>("fast");

  const handleTest = useCallback(
    async (providerId: string): Promise<ProviderTestResponse | null> => {
      try {
        const response = await testProvider(providerId);
        return response.data;
      } catch {
        return null;
      }
    },
    [],
  );

  // 加载中
  if (loadState === "loading" || providersLoadState === "loading") {
    return (
      <PageContainer>
        <PageHeader
          title="模型槽位配置"
          description="配置 4 个能力槽位：快速、推理、向量、重排序"
        />
        <CardSkeleton />
      </PageContainer>
    );
  }

  // 错误
  if (loadState === "error") {
    return (
      <PageContainer>
        <PageHeader title="模型槽位配置" />
        <ErrorState message={error ?? "加载失败"} onRetry={reload} />
      </PageContainer>
    );
  }

  const activeSlot = slots.find((s) => s.slot_type === activeTab);

  return (
    <PageContainer>
      <PageHeader
        title="模型槽位配置"
        description="配置 4 个能力槽位：快速、推理、向量、重排序"
      />

      {/* Tab 栏 */}
      <div
        className="mb-6 flex flex-wrap gap-1 rounded-xl bg-white/[0.03] p-1"
        role="tablist"
        aria-label="槽位类型"
      >
        {SLOT_TYPES.map((type) => {
          const meta = SLOT_META[type];
          const slot = slots.find((s) => s.slot_type === type);
          const isConfigured = slot?.primary_provider !== null;
          const isActive = activeTab === type;

          return (
            <button
              key={type}
              onClick={() => setActiveTab(type)}
              role="tab"
              id={`slot-tab-${type}`}
              aria-selected={isActive}
              aria-controls={`slot-panel-${type}`}
              tabIndex={isActive ? 0 : -1}
              className={cn(
                "flex min-w-[140px] flex-1 cursor-pointer items-center justify-center gap-2.5 rounded-lg px-4 py-3 text-sm font-medium transition-all",
                isActive
                  ? "bg-white/[0.08] text-white shadow-sm"
                  : "text-white/40 hover:bg-white/[0.03] hover:text-white/60",
              )}
            >
              <span className={cn(isActive ? meta.color : "text-white/30")}>
                {slotIcons[type]}
              </span>
              <span>{meta.label}</span>
              {/* 配置状态 */}
              {isConfigured ? (
                <span className="status-dot status-dot-healthy" />
              ) : (
                <span className="status-dot status-dot-unknown" />
              )}
            </button>
          );
        })}
      </div>

      {/* 内容区域 */}
      {activeSlot && (
        <div
          className="glass-card"
          role="tabpanel"
          id={`slot-panel-${activeTab}`}
          aria-labelledby={`slot-tab-${activeTab}`}
        >
          {/* 槽位描述 */}
          <div className="border-b border-white/5 px-6 py-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl",
                  SLOT_META[activeTab].bgColor,
                  SLOT_META[activeTab].color,
                )}
              >
                {slotIcons[activeTab]}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  {SLOT_META[activeTab].label}
                </h3>
                <p className="mt-0.5 text-xs text-white/40">
                  {activeSlot.primary_provider
                    ? `${activeSlot.primary_provider.name} / ${activeSlot.primary_model_id}`
                    : "尚未配置"}
                </p>
              </div>
              {activeSlot.fallback_chain.length > 0 && (
                <span className="ml-auto rounded-full bg-white/5 px-2.5 py-0.5 text-xs text-white/40">
                  {activeSlot.fallback_chain.length} 个备选
                </span>
              )}
            </div>
          </div>

          {/* 配置面板 */}
          <SlotConfigPanel
            slot={activeSlot}
            providers={providers}
            onSave={configureSlot}
            onTest={handleTest}
          />
        </div>
      )}
    </PageContainer>
  );
}
