/**
 * 侧边栏导航组件。
 * Liquid Glass 风格，图标 + 文字。
 * 桌面端支持一键收缩为图标模式（64px）。
 */

import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Server,
  LogOut,
  FlaskConical,
  Layers,
  X,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { useAuthStore } from "@/stores/auth-store";

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: "管理",
    items: [
      {
        to: "/admin/slots",
        label: "模型槽位",
        icon: <LayoutDashboard size={ICON_SIZE["2xl"]} />,
      },
      {
        to: "/admin/providers",
        label: "Provider 管理",
        icon: <Server size={ICON_SIZE["2xl"]} />,
      },
    ],
  },
  {
    title: "Studio",
    items: [
      {
        to: "/studio/playground",
        label: "Playground",
        icon: <FlaskConical size={ICON_SIZE["2xl"]} />,
      },
      {
        to: "/studio/slots",
        label: "槽位测试",
        icon: <Layers size={ICON_SIZE["2xl"]} />,
      },
    ],
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  /** 桌面端收缩状态 */
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ isOpen, onClose, collapsed, onToggleCollapse }: SidebarProps) {
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  return (
    <>
      {/* 移动端遮罩 */}
      {isOpen && (
        <button
          type="button"
          aria-label="关闭导航菜单"
          onClick={onClose}
          className="fixed inset-0 z-[var(--z-topbar)] bg-black/40 backdrop-blur-[2px] md:hidden"
        />
      )}

      <aside
        className={cn(
          "glass-sidebar fixed left-0 top-0 z-[var(--z-sidebar)] flex h-screen flex-col transition-all duration-200",
          /* 移动端：始终 w-60，通过 translate 控制显隐 */
          isOpen ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0",
          /* 桌面端：收缩 w-16 / 展开 w-60 */
          collapsed ? "md:w-16" : "md:w-60",
          /* 移动端始终 w-60 */
          "w-60",
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 px-5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
            <span className="text-sm font-bold text-white">P</span>
          </div>
          <span
            className={cn(
              "text-lg font-semibold tracking-tight transition-opacity duration-200",
              collapsed ? "md:hidden" : "md:opacity-100",
            )}
          >
            Prism
          </span>
          <div className="flex-1" />
          {/* 移动端关闭按钮 */}
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/5 hover:text-white md:hidden"
            aria-label="关闭导航菜单"
          >
            <X size={ICON_SIZE.lg} />
          </button>
        </div>

        {/* 导航 */}
        <nav className="flex-1 space-y-4 px-3 pt-4" aria-label="主导航">
          {navGroups.map((group, gi) => (
            <div key={group.title}>
              {gi > 0 && <div className="mb-3 border-t border-white/5" />}
              <p
                className={cn(
                  "mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/40 transition-opacity duration-200",
                  collapsed && "md:opacity-0 md:h-0 md:mb-0 md:overflow-hidden",
                )}
              >
                {group.title}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                        "duration-[var(--duration-normal)] ease-[var(--ease-glass)]",
                        isActive
                          ? "bg-white/10 text-white shadow-sm"
                          : "text-white/50 hover:bg-white/5 hover:text-white/80",
                        collapsed && "md:justify-center md:px-0",
                      )
                    }
                  >
                    <span className="shrink-0">{item.icon}</span>
                    <span
                      className={cn(
                        "transition-opacity duration-200",
                        collapsed && "md:hidden",
                      )}
                    >
                      {item.label}
                    </span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* 收缩/展开按钮（仅桌面端） */}
        <div className="hidden border-t border-white/5 px-3 py-2 md:block">
          <button
            type="button"
            onClick={onToggleCollapse}
            className={cn(
              "flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm text-white/30 transition-colors hover:bg-white/5 hover:text-white/60",
              collapsed && "justify-center px-0",
            )}
            title={collapsed ? "展开侧边栏" : "收起侧边栏"}
            aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
          >
            {collapsed ? (
              <ChevronsRight size={ICON_SIZE.lg} />
            ) : (
              <>
                <ChevronsLeft size={ICON_SIZE.lg} />
                <span>收起</span>
              </>
            )}
          </button>
        </div>

        {/* 底部用户区 */}
        <div className="border-t border-white/5 p-4">
          <div
            className={cn(
              "flex items-center",
              collapsed ? "md:justify-center" : "justify-between",
            )}
          >
            <div
              className={cn(
                "min-w-0 transition-opacity duration-200",
                collapsed && "md:hidden",
              )}
            >
              <p className="truncate text-sm font-medium text-white/80">
                {user?.username ?? "未知用户"}
              </p>
              <p className="truncate text-xs text-white/40">
                {user?.email ?? ""}
              </p>
            </div>
            <button
              onClick={logout}
              className="cursor-pointer rounded-lg p-2 text-white/30 transition-colors hover:bg-white/5 hover:text-white/60"
              title="退出登录"
              aria-label="退出登录"
            >
              <LogOut size={ICON_SIZE.lg} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
