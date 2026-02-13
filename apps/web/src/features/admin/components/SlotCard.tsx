/**
 * 槽位卡片组件。
 * Liquid Glass 风格，图标+颜色区分类型。
 * 渐进披露：默认只显示槽位名称和当前模型，点击展开配置。
 */

import { Zap, Brain, Cpu, ArrowUpDown, ChevronDown, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { SLOT_META } from "@/lib/constants";
import type { SlotConfig, SlotType } from "@/api/types";

/** 槽位图标映射 */
const slotIcons: Record<SlotType, React.ReactNode> = {
  fast: <Zap size={20} />,
  reasoning: <Brain size={20} />,
  embedding: <Cpu size={20} />,
  rerank: <ArrowUpDown size={20} />,
};

interface SlotCardProps {
  slot: SlotConfig;
  isExpanded: boolean;
  onToggle: () => void;
}

export function SlotCard({ slot, isExpanded, onToggle }: SlotCardProps) {
  const meta = SLOT_META[slot.slot_type];
  const isConfigured = slot.primary_provider !== null;

  return (
    <div
      className={cn(
        "glass-card overflow-hidden transition-all",
        isExpanded && "ring-1 ring-indigo-500/30",
      )}
    >
      {/* 卡片头部 -- 点击展开/收起 */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-4 p-5 text-left transition-colors hover:bg-white/[0.02]"
      >
        {/* 图标 */}
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl",
            meta.bgColor,
            meta.color,
          )}
        >
          {slotIcons[slot.slot_type]}
        </div>

        {/* 信息 */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white">{meta.label}</h3>
            {/* 状态指示 */}
            {isConfigured ? (
              <span className="status-dot status-dot-healthy" title="已配置" />
            ) : (
              <span className="status-dot status-dot-unknown" title="未配置" />
            )}
          </div>
          <p className="mt-0.5 text-xs text-white/40">
            {isConfigured
              ? `${slot.primary_provider?.name} / ${slot.primary_model_id}`
              : "尚未配置"}
          </p>
        </div>

        {/* 降级链数量 */}
        {slot.fallback_chain.length > 0 && (
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-white/40">
            {slot.fallback_chain.length} 个降级
          </span>
        )}

        {/* 展开箭头 */}
        <ChevronDown
          size={16}
          className={cn(
            "text-white/30 transition-transform duration-300",
            isExpanded && "rotate-180",
          )}
        />
      </button>

      {/* 卡片底部快捷操作（未展开时显示） */}
      {!isExpanded && !isConfigured && (
        <div className="border-t border-white/5 px-5 py-3">
          <button
            onClick={onToggle}
            className="flex items-center gap-1.5 text-xs font-medium text-indigo-400 transition-colors hover:text-indigo-300"
          >
            <Settings size={12} />
            配置此槽位
          </button>
        </div>
      )}
    </div>
  );
}
