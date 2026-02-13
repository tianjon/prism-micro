/**
 * Playground 顶部标题栏。
 * 模式标签页 + 操作按钮。
 */

import {
  MessageSquare,
  Binary,
  ArrowUpDown,
  RotateCcw,

  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ICON_SIZE } from "@/lib/icon-sizes";
import type { PlaygroundMode } from "../types";

const MODES = [
  { key: "chat" as const, label: "Chat", icon: <MessageSquare size={ICON_SIZE.md} /> },
  { key: "embedding" as const, label: "Embedding", icon: <Binary size={ICON_SIZE.md} /> },
  { key: "rerank" as const, label: "Rerank", icon: <ArrowUpDown size={ICON_SIZE.md} /> },
];

interface PlaygroundHeaderProps {
  mode: PlaygroundMode;
  onModeChange: (mode: PlaygroundMode) => void;
  onClear: () => void;
  onToggleSidebar: () => void;
  onToggleDesktopSidebar: () => void;
  hasMessages: boolean;
  desktopSidebarCollapsed: boolean;
}

export function PlaygroundHeader({
  mode,
  onModeChange,
  onClear,
  onToggleSidebar,
  onToggleDesktopSidebar,
  hasMessages,
  desktopSidebarCollapsed,
}: PlaygroundHeaderProps) {
  return (
    <div className="flex items-center gap-3 border-b border-white/5 px-4 py-2.5">
      {/* 桌面端侧边栏收缩/展开 */}
      <button
        type="button"
        onClick={onToggleDesktopSidebar}
        className="hidden cursor-pointer rounded-lg p-1.5 text-white/25 transition-colors hover:bg-white/5 hover:text-white/50 md:flex"
        title={desktopSidebarCollapsed ? "展开配置面板" : "收起配置面板"}
        aria-label={desktopSidebarCollapsed ? "展开配置面板" : "收起配置面板"}
      >
        {desktopSidebarCollapsed ? (
          <PanelLeftOpen size={ICON_SIZE.lg} />
        ) : (
          <PanelLeftClose size={ICON_SIZE.lg} />
        )}
      </button>

      {/* 标题 */}
      <h1 className="text-sm font-semibold text-white/70">Playground</h1>

      {/* 模式切换 */}
      <div className="glass-segmented">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => onModeChange(m.key)}
            className={cn(
              "glass-segmented-item flex items-center gap-1.5",
              mode === m.key && 'bg-white/8 text-white shadow-sm [&]:bg-[var(--color-accent-primary)] [&]:text-white [&]:shadow-[0_2px_8px_-2px_rgba(99,102,241,0.4)]',
            )}
            data-active={mode === m.key}
          >
            {m.icon}
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex-1" />

      {/* 清空按钮（仅 Chat 模式有消息时显示） */}
      {mode === "chat" && hasMessages && (
        <button
          type="button"
          onClick={onClear}
          className="cursor-pointer rounded-lg p-1.5 text-white/25 transition-colors hover:bg-white/5 hover:text-white/50"
          title="清空对话"
          aria-label="清空对话"
        >
          <RotateCcw size={ICON_SIZE.md} />
        </button>
      )}

      {/* 移动端侧边栏切换 */}
      <button
        type="button"
        onClick={onToggleSidebar}
        className="cursor-pointer rounded-lg p-1.5 text-white/25 transition-colors hover:bg-white/5 hover:text-white/50 md:hidden"
        aria-label="配置面板"
      >
        <Settings size={ICON_SIZE.md} />
      </button>
    </div>
  );
}
