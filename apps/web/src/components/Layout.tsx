/**
 * 主布局组件。
 * 侧边栏 + 内容区。
 */

import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { Sidebar } from "./Sidebar";
import { ToastContainer } from "./ToastContainer";

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-gray-950">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      {/* 内容区域：左侧留出侧边栏宽度，跟随收缩动画 */}
      <main
        className={cn(
          "min-h-screen transition-[margin-left] duration-200",
          sidebarCollapsed ? "md:ml-16" : "md:ml-60",
        )}
      >
        {/* 移动端顶栏 */}
        <div className="glass-topbar sticky top-0 z-[var(--z-topbar)] md:hidden">
          <div className="flex h-14 items-center gap-3 px-4">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="cursor-pointer rounded-lg p-2 text-white/60 transition-colors hover:bg-white/5 hover:text-white"
              aria-label="打开导航菜单"
            >
              <Menu size={ICON_SIZE.xl} />
            </button>
            <div className="text-sm font-semibold text-white/80">
              Prism
            </div>
          </div>
        </div>

        <Outlet />
      </main>
      <ToastContainer />
    </div>
  );
}
