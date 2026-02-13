/**
 * 主布局组件。
 * 侧边栏 + 内容区。
 */

import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { ToastContainer } from "./ToastContainer";

export function Layout() {
  return (
    <div className="min-h-screen bg-gray-950">
      <Sidebar />
      {/* 内容区域：左侧留出侧边栏宽度 */}
      <main className="ml-60 min-h-screen">
        <div className="mx-auto max-w-6xl px-8 py-8">
          <Outlet />
        </div>
      </main>
      <ToastContainer />
    </div>
  );
}
