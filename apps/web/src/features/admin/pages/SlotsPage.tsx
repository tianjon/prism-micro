/**
 * 槽位配置页 (/admin/slots)。
 * 4 槽位卡片：fast / reasoning / embedding / rerank。
 * 渐进披露：卡片默认只显示名称和当前模型，点击展开配置面板。
 */

import { useState, useCallback } from "react";
import { PageHeader } from "@/components/PageHeader";
import { ErrorState } from "@/components/ErrorState";
import { CardSkeleton } from "@/components/GlassSkeleton";
import { SlotCard } from "../components/SlotCard";
import { SlotConfigPanel } from "../components/SlotConfigPanel";
import { useSlots } from "../hooks/use-slots";
import { useProviders } from "../hooks/use-providers";
import type { SlotType, ProviderTestResponse } from "@/api/types";
import { testProvider } from "../api/providers-api";

export function SlotsPage() {
  const { slots, loadState, error, reload, configureSlot } = useSlots();
  const { providers, loadState: providersLoadState } = useProviders();
  const [expandedSlot, setExpandedSlot] = useState<SlotType | null>(null);

  const handleToggle = useCallback(
    (slotType: SlotType) => {
      setExpandedSlot(expandedSlot === slotType ? null : slotType);
    },
    [expandedSlot],
  );

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

  // 加载中状态
  if (loadState === "loading" || providersLoadState === "loading") {
    return (
      <div>
        <PageHeader
          title="模型槽位配置"
          description="配置 4 个能力槽位：快速、推理、向量、重排序"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  // 错误状态
  if (loadState === "error") {
    return (
      <div>
        <PageHeader title="模型槽位配置" />
        <ErrorState message={error ?? "加载失败"} onRetry={reload} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="模型槽位配置"
        description="配置 4 个能力槽位：快速、推理、向量、重排序"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {slots.map((slot) => (
          <div key={slot.slot_type} className="flex flex-col">
            <SlotCard
              slot={slot}
              isExpanded={expandedSlot === slot.slot_type}
              onToggle={() => handleToggle(slot.slot_type)}
            />

            {/* 展开配置面板 */}
            {expandedSlot === slot.slot_type && (
              <div className="glass-card -mt-px rounded-t-none border-t-0">
                <SlotConfigPanel
                  slot={slot}
                  providers={providers}
                  onSave={configureSlot}
                  onTest={handleTest}
                  onCancel={() => setExpandedSlot(null)}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
