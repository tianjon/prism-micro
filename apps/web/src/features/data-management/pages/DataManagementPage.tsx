/**
 * 数据管理页面 (/voc/data)。
 * Tab 切换展示批次、映射模板和 Voice 数据。
 */

import { useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { PageContainer } from "@/components/PageContainer";
import { PageHeader } from "@/components/PageHeader";
import { BatchesTab } from "../components/BatchesTab";
import { MappingsTab } from "../components/MappingsTab";
import { VoicesTab } from "../components/VoicesTab";

const TABS = [
  { key: "batches", label: "导入批次" },
  { key: "mappings", label: "映射模板" },
  { key: "voices", label: "Voice 数据" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function DataManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as TabKey) || "batches";

  const handleTabChange = (tab: TabKey) => {
    setSearchParams({ tab });
  };

  return (
    <PageContainer>
      <div className="space-y-6">
        <PageHeader
          title="数据管理"
          description="管理导入批次、映射模板和 Voice 数据"
        />

        {/* Tab 切换 */}
        <div className="glass-panel inline-flex rounded-lg p-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={cn(
                "rounded-md px-4 py-2 text-sm font-medium transition-colors",
                activeTab === tab.key
                  ? "bg-white/10 text-white"
                  : "text-white/50 hover:text-white/70",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 内容 */}
        {activeTab === "batches" && <BatchesTab />}
        {activeTab === "mappings" && <MappingsTab />}
        {activeTab === "voices" && <VoicesTab />}
      </div>
    </PageContainer>
  );
}
