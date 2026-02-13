/**
 * 侧边栏导航组件。
 * Liquid Glass 风格，图标 + 文字。
 */

import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Server,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    to: "/admin/slots",
    label: "模型槽位",
    icon: <LayoutDashboard size={20} />,
  },
  {
    to: "/admin/providers",
    label: "Provider 管理",
    icon: <Server size={20} />,
  },
];

export function Sidebar() {
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  return (
    <aside className="glass-sidebar fixed left-0 top-0 z-40 flex h-screen w-60 flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
          <span className="text-sm font-bold text-white">P</span>
        </div>
        <span className="text-lg font-semibold tracking-tight">Prism</span>
      </div>

      {/* 导航 */}
      <nav className="flex-1 space-y-1 px-3 pt-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                "duration-[var(--duration-normal)] ease-[var(--ease-glass)]",
                isActive
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-white/50 hover:bg-white/5 hover:text-white/80",
              )
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* 底部用户区 */}
      <div className="border-t border-white/5 p-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white/80">
              {user?.username ?? "未知用户"}
            </p>
            <p className="truncate text-xs text-white/40">
              {user?.email ?? ""}
            </p>
          </div>
          <button
            onClick={logout}
            className="rounded-lg p-2 text-white/30 transition-colors hover:bg-white/5 hover:text-white/60"
            title="退出登录"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
