/**
 * 导入页面顶部标题栏。
 * 侧边栏开关 + 标题 + 操作按钮。
 */

import {
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Menu,
} from "lucide-react";
import { ICON_SIZE } from "@/lib/icon-sizes";

interface ImportHeaderProps {
  desktopSidebarCollapsed: boolean;
  onToggleDesktopSidebar: () => void;
  onToggleSidebar: () => void;
  onReset: () => void;
}

export function ImportHeader({
  desktopSidebarCollapsed,
  onToggleDesktopSidebar,
  onToggleSidebar,
  onReset,
}: ImportHeaderProps) {
  return (
    <div className="flex items-center gap-3 border-b border-white/5 px-4 py-2.5">
      {/* 桌面端侧边栏收缩/展开 */}
      <button
        type="button"
        onClick={onToggleDesktopSidebar}
        className="hidden cursor-pointer rounded-lg p-1.5 text-white/25 transition-colors hover:bg-white/5 hover:text-white/50 md:flex"
        title={desktopSidebarCollapsed ? "展开步骤面板" : "收起步骤面板"}
        aria-label={desktopSidebarCollapsed ? "展开步骤面板" : "收起步骤面板"}
      >
        {desktopSidebarCollapsed ? (
          <PanelLeftOpen size={ICON_SIZE.lg} />
        ) : (
          <PanelLeftClose size={ICON_SIZE.lg} />
        )}
      </button>

      {/* 标题 */}
      <h1 className="text-sm font-semibold text-white/70">数据导入</h1>

      <div className="flex-1" />

      {/* 重新开始 */}
      <button
        type="button"
        onClick={onReset}
        className="cursor-pointer rounded-lg p-1.5 text-white/25 transition-colors hover:bg-white/5 hover:text-white/50"
        title="重新开始"
        aria-label="重新开始"
      >
        <RotateCcw size={ICON_SIZE.md} />
      </button>

      {/* 移动端侧边栏切换 */}
      <button
        type="button"
        onClick={onToggleSidebar}
        className="cursor-pointer rounded-lg p-1.5 text-white/25 transition-colors hover:bg-white/5 hover:text-white/50 md:hidden"
        aria-label="步骤面板"
      >
        <Menu size={ICON_SIZE.md} />
      </button>
    </div>
  );
}
