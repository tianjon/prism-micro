/**
 * Playground 左侧配置面板。
 * 桌面端固定 280px，移动端 glass-sheet 覆盖层。
 */

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ICON_SIZE } from "@/lib/icon-sizes";
import type { Provider } from "@/api/types";
import { ProviderCombobox } from "@/features/admin/components/ProviderCombobox";
import { ModelCombobox } from "@/features/admin/components/ModelCombobox";
import type { PlaygroundMode, ChatParams } from "../types";

interface PlaygroundSidebarProps {
  providerId: string | null;
  onProviderChange: (id: string) => void;
  modelId: string;
  onModelChange: (id: string) => void;
  providers: Provider[];
  mode: PlaygroundMode;
  chatParams: ChatParams;
  onChatParamsChange: (params: ChatParams) => void;
  /** 桌面端收缩状态 */
  collapsed?: boolean;
  /** 移动端打开状态 */
  isOpen?: boolean;
  /** 移动端关闭回调 */
  onClose?: () => void;
}

export function PlaygroundSidebar({
  providerId,
  onProviderChange,
  modelId,
  onModelChange,
  providers,
  mode,
  chatParams,
  onChatParamsChange,
  collapsed = false,
  isOpen = false,
  onClose,
}: PlaygroundSidebarProps) {
  const content = (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      {/* 移动端关闭按钮 */}
      {onClose && (
        <div className="mb-3 flex items-center justify-between md:hidden">
          <span className="text-sm font-semibold text-white/60">配置</span>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-white/30 transition-colors hover:bg-white/5 hover:text-white/60"
            aria-label="关闭配置面板"
          >
            <X size={ICON_SIZE.lg} />
          </button>
        </div>
      )}

      {/* 通用配置 */}
      <div className="space-y-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-white/30">
          模型配置
        </h3>
        <div className="space-y-2">
          <label className="text-xs text-white/50">Provider</label>
          <ProviderCombobox
            providers={providers}
            value={providerId}
            onChange={onProviderChange}
            placeholder="选择 Provider..."
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs text-white/50">模型</label>
          <ModelCombobox
            providerId={providerId}
            value={modelId}
            onChange={onModelChange}
            placeholder="选择或输入模型..."
          />
        </div>
      </div>

      {/* Chat 参数（仅 Chat 模式） */}
      {mode === "chat" && (
        <div className="mt-6 space-y-4">
          <h3 className="text-xs font-medium uppercase tracking-wider text-white/30">
            生成参数
          </h3>

          {/* Temperature */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs text-white/50">Temperature</label>
              <span className="font-mono text-xs text-white/40">
                {chatParams.temperature.toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={chatParams.temperature}
              onChange={(e) =>
                onChatParamsChange({
                  ...chatParams,
                  temperature: parseFloat(e.target.value),
                })
              }
              className="slider-glass w-full"
              aria-label="Temperature"
            />
            <div className="flex justify-between text-[10px] text-white/20">
              <span>精确</span>
              <span>创意</span>
            </div>
          </div>

          {/* Max Tokens */}
          <div className="space-y-1.5">
            <label className="text-xs text-white/50">Max Tokens</label>
            <input
              type="number"
              min={1}
              max={32768}
              value={chatParams.maxTokens}
              onChange={(e) =>
                onChatParamsChange({
                  ...chatParams,
                  maxTokens: Math.max(1, Math.min(32768, parseInt(e.target.value) || 1)),
                })
              }
              className="glass-input w-full px-3 py-1.5 text-sm"
              aria-label="Max Tokens"
            />
          </div>

          {/* Top P */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs text-white/50">Top P</label>
              <span className="font-mono text-xs text-white/40">
                {chatParams.topP.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={chatParams.topP}
              onChange={(e) =>
                onChatParamsChange({
                  ...chatParams,
                  topP: parseFloat(e.target.value),
                })
              }
              className="slider-glass w-full"
              aria-label="Top P"
            />
          </div>

          {/* System Prompt */}
          <div className="space-y-1.5">
            <label className="text-xs text-white/50">System Prompt</label>
            <textarea
              value={chatParams.systemPrompt}
              onChange={(e) =>
                onChatParamsChange({
                  ...chatParams,
                  systemPrompt: e.target.value,
                })
              }
              placeholder="输入系统提示词..."
              rows={4}
              className="glass-input w-full resize-none px-3 py-2 text-sm"
              aria-label="System Prompt"
            />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* 桌面端：固定侧边栏（支持收缩） */}
      <div
        className={cn(
          "hidden shrink-0 border-r border-white/5 transition-[width] duration-200 md:block",
          collapsed ? "w-0 overflow-hidden border-r-0" : "w-70",
        )}
      >
        {content}
      </div>

      {/* 移动端：glass-sheet 覆盖层 */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-[var(--z-sidebar)] bg-black/50 md:hidden"
            onClick={onClose}
            aria-hidden="true"
          />
          <div className="glass-sheet fixed inset-y-0 right-0 z-[var(--z-sidebar)] w-80 md:hidden">
            {content}
          </div>
        </>
      )}
    </>
  );
}
