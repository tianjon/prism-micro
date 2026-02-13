/**
 * 槽位测试页面。
 * 展示 4 个槽位卡片 + 选中槽位的测试面板。
 */

import { useState } from "react";
import { Zap, Brain, Cpu, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { PageHeader } from "@/components/PageHeader";
import { GlassSkeleton } from "@/components/GlassSkeleton";
import { ErrorState } from "@/components/ErrorState";
import { useSlots } from "@/features/admin/hooks/use-slots";
import type { SlotType, SlotConfig } from "@/api/types";
import { SLOT_META } from "@/lib/constants";
import { PageContainer } from "@/components/PageContainer";
import { SlotTestPanel } from "../components/SlotTestPanel";

const SLOT_ICONS: Record<SlotType, React.ReactNode> = {
  fast: <Zap size={ICON_SIZE.xl} />,
  reasoning: <Brain size={ICON_SIZE.xl} />,
  embedding: <Cpu size={ICON_SIZE.xl} />,
  rerank: <ArrowUpDown size={ICON_SIZE.xl} />,
};

function SlotCardMini({
  slot,
  isSelected,
  onSelect,
}: {
  slot: SlotConfig;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const meta = SLOT_META[slot.slot_type];
  const poolSize = slot.fallback_chain.length;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      className={cn(
        "flex cursor-pointer flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-all",
        isSelected
          ? "border-indigo-500/30 bg-indigo-500/5 shadow-sm"
          : "border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]",
      )}
    >
      <div className="flex w-full items-center justify-between">
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", meta.bgColor, meta.color)}>
          {SLOT_ICONS[slot.slot_type]}
        </div>
        <div
          className={cn(
            "h-2 w-2 rounded-full",
            slot.is_enabled && slot.primary_provider
              ? "bg-emerald-400"
              : "bg-white/20",
          )}
        />
      </div>
      <div>
        <p className="text-sm font-medium text-white/80">{meta.label}</p>
        {slot.primary_provider ? (
          <p className="text-xs text-white/30">
            {slot.primary_provider.name} / {slot.primary_model_id}
          </p>
        ) : (
          <p className="text-xs text-white/20">未配置</p>
        )}
        {poolSize > 0 && (
          <p className="mt-0.5 text-[11px] text-white/30">
            资源池: {poolSize} 个备选
          </p>
        )}
      </div>
    </button>
  );
}

export function SlotTestPage() {
  const { slots, loadState, error, reload } = useSlots();
  const [selectedSlot, setSelectedSlot] = useState<SlotType>("fast");

  if (loadState === "loading" || loadState === "idle") {
    return (
      <PageContainer><div className="space-y-6">
        <GlassSkeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <GlassSkeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      </div></PageContainer>
    );
  }

  if (loadState === "error") {
    return (
      <PageContainer>
        <ErrorState message={error ?? "加载失败"} onRetry={reload} />
      </PageContainer>
    );
  }

  const currentSlot = slots.find((s) => s.slot_type === selectedSlot);
  const isConfigured = currentSlot?.primary_provider != null && currentSlot.is_enabled;

  return (
    <PageContainer><div className="flex h-full flex-col">
      <PageHeader title="槽位测试" description="测试槽位配置和故障转移行为" />


      <div className="flex flex-1 flex-col gap-6 px-6 pb-6">
        {/* 槽位卡片 */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {slots.map((slot) => (
            <SlotCardMini
              key={slot.slot_type}
              slot={slot}
              isSelected={selectedSlot === slot.slot_type}
              onSelect={() => setSelectedSlot(slot.slot_type)}
            />
          ))}
        </div>

        {/* 测试面板 */}
        <div className="glass-panel min-h-0 flex-1 overflow-y-auto rounded-2xl p-4">
          {isConfigured ? (
            <SlotTestPanel slotType={selectedSlot} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-white/20">
              该槽位未配置或已禁用，请先在管理页面配置
            </div>
          )}
        </div>
      </div>
    </div></PageContainer>
  );
}
