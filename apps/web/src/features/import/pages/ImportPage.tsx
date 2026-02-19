/**
 * 数据导入页面 (/voc/import)。
 * 隧道式体验：全屏分栏 + 侧边栏 6 步导航（1:1 对应后端 BatchStatus）。
 */

import { useState, useEffect } from "react";
import { useImport } from "../hooks/use-import";
import { ImportHeader } from "../components/ImportHeader";
import { ImportSidebar } from "../components/ImportSidebar";
import { StepUpload } from "../components/StepUpload";
import { StepPreview } from "../components/StepPreview";
import { StepPrompt } from "../components/StepPrompt";
import { StepMapping } from "../components/StepMapping";
import { StepImporting } from "../components/StepImporting";
import { StepResultPreview } from "../components/StepResultPreview";

export function ImportPage() {
  const {
    currentStep,
    stepStatuses,
    handleStepClick,
    handleReset,
    uploading,
    uploadProgress,
    uploadResult,
    handleUpload,
    dataPreview,
    loadingDataPreview,
    loadDataPreview,
    handleBuildPrompt,
    handleUpdatePrompt,
    handleTriggerMapping,
    promptPreview,
    loadPromptText,
    mappingPreview,
    loadingMapping,
    loadMappingPreview,
    handleConfirmMapping,
    resultPreview,
    loadResultPreview,
    batchStatus,
    processing,
    handleTriggerPipeline,
    stopPolling,
  } = useImport();

  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 组件卸载时停止轮询
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // mapping 步骤的只读模式：已完成但不是当前 active 状态（回跳查看）
  const mappingReadOnly =
    currentStep === "mapping" && batchStatus?.status !== "mapping";

  // prompting 步骤的只读模式：非 prompt_ready 状态（回跳查看 or LLM 进行中）
  const promptingReadOnly =
    currentStep === "prompting" && batchStatus?.status !== "prompt_ready";

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col md:h-screen">
      <ImportHeader
        desktopSidebarCollapsed={desktopSidebarCollapsed}
        onToggleDesktopSidebar={() =>
          setDesktopSidebarCollapsed(!desktopSidebarCollapsed)
        }
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onReset={handleReset}
      />

      <div className="flex min-h-0 flex-1">
        <ImportSidebar
          currentStep={currentStep}
          stepStatuses={stepStatuses}
          onStepClick={handleStepClick}
          collapsed={desktopSidebarCollapsed}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="min-w-0 flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-2xl">
            {currentStep === "upload" && (
              <StepUpload
                uploading={uploading}
                uploadProgress={uploadProgress}
                uploadResult={uploadResult}
                onUpload={handleUpload}
              />
            )}
            {currentStep === "preview" && (
              <StepPreview
                uploadResult={uploadResult}
                dataPreview={dataPreview}
                loading={loadingDataPreview}
                onLoadPreview={loadDataPreview}
                onBuildPrompt={handleBuildPrompt}
              />
            )}
            {currentStep === "prompting" && (
              <StepPrompt
                batchStatus={batchStatus}
                promptPreview={promptPreview}
                processing={processing}
                readOnly={promptingReadOnly}
                onLoadPromptText={loadPromptText}
                onUpdatePrompt={handleUpdatePrompt}
                onTriggerMapping={handleTriggerMapping}
              />
            )}
            {currentStep === "mapping" && (
              <StepMapping
                batchStatus={batchStatus}
                mappingPreview={mappingPreview}
                loadingMapping={loadingMapping}
                readOnly={mappingReadOnly}
                onLoadPreview={loadMappingPreview}
                onConfirm={handleConfirmMapping}
              />
            )}
            {currentStep === "importing" && (
              <StepImporting
                batchStatus={batchStatus}
                processing={processing}
              />
            )}
            {currentStep === "result" && (
              <StepResultPreview
                batchStatus={batchStatus}
                resultPreview={resultPreview}
                processing={processing}
                onLoadResultPreview={loadResultPreview}
                onTriggerPipeline={handleTriggerPipeline}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
