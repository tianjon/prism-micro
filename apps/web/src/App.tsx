/**
 * 根组件 + 路由配置。
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { SlotsPage } from "@/features/admin/pages/SlotsPage";
import { ProvidersPage } from "@/features/admin/pages/ProvidersPage";
import { LogsPage } from "@/features/admin/pages/LogsPage";
import { PlaygroundPage } from "@/features/studio/pages/PlaygroundPage";
import { SlotTestPage } from "@/features/studio/pages/SlotTestPage";
import { ImportPage } from "@/features/import/pages/ImportPage";
import { SearchPage } from "@/features/search/pages/SearchPage";
import { UnitDetailPage } from "@/features/search/pages/UnitDetailPage";
import { VoiceDetailPage } from "@/features/search/pages/VoiceDetailPage";
import { TagsPage } from "@/features/tags/pages/TagsPage";
import { TagDetailPage } from "@/features/tags/pages/TagDetailPage";
import { TagComparePage } from "@/features/tags/pages/TagComparePage";
import { DataManagementPage } from "@/features/data-management/pages/DataManagementPage";
import { BatchDetailPage } from "@/features/data-management/pages/BatchDetailPage";
import { MappingDetailPage } from "@/features/data-management/pages/MappingDetailPage";
import { ImportArchPage } from "@/features/docs/pages/ImportArchPage";

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
            <Route path="/voc/import" element={<ImportPage />} />
            <Route path="/voc/search" element={<SearchPage />} />
            <Route path="/voc/units/:unitId" element={<UnitDetailPage />} />
            <Route path="/voc/voices/:voiceId" element={<VoiceDetailPage />} />
            <Route path="/voc/tags" element={<TagsPage />} />
            <Route path="/voc/tags/compare" element={<TagComparePage />} />
            <Route path="/voc/tags/:tagId" element={<TagDetailPage />} />
            <Route path="/voc/data" element={<DataManagementPage />} />
            <Route path="/voc/data/batches/:batchId" element={<BatchDetailPage />} />
            <Route path="/voc/data/mappings/:mappingId" element={<MappingDetailPage />} />
            <Route path="/admin/slots" element={<SlotsPage />} />
            <Route path="/admin/providers" element={<ProvidersPage />} />
            <Route path="/admin/logs" element={<LogsPage />} />
            <Route path="/studio/playground" element={<PlaygroundPage />} />
            <Route path="/studio/slots" element={<SlotTestPage />} />
            <Route path="/docs/import-arch" element={<ImportArchPage />} />
          </Route>
        </Route>

        {/* 兜底 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
