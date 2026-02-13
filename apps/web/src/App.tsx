/**
 * 根组件 + 路由配置。
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { SlotsPage } from "@/features/admin/pages/SlotsPage";
import { ProvidersPage } from "@/features/admin/pages/ProvidersPage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 公开路由 */}
        <Route path="/login" element={<LoginPage />} />

        {/* 受保护路由 */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/admin/slots" replace />} />
            <Route path="/admin/slots" element={<SlotsPage />} />
            <Route path="/admin/providers" element={<ProvidersPage />} />
          </Route>
        </Route>

        {/* 兜底 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
