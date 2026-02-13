/**
 * 槽位配置面板。
 * 展示：Provider 选择 + Model ID + 资源池 + 测试 + 保存。
 */

import { useState, useEffect, useCallback } from "react";
import { Loader2, Save, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ICON_SIZE } from "@/lib/icon-sizes";
import type {
  SlotConfig,
  SlotConfigureRequest,
  Provider,
  ProviderTestResponse,
} from "@/api/types";
import { ProviderCombobox } from "./ProviderCombobox";
import { ModelCombobox } from "./ModelCombobox";
import {
  ResourcePoolEditor,
  type ResourcePoolEntry,
} from "./ResourcePoolEditor";
import { ConnectivityTestButton } from "./ConnectivityTestButton";

interface SlotConfigPanelProps {
  slot: SlotConfig;
  providers: Provider[];
  onSave: (slotType: string, data: SlotConfigureRequest) => Promise<boolean>;
  onTest: (providerId: string) => Promise<ProviderTestResponse | null>;
}

export function SlotConfigPanel({
  slot,
  providers,
  onSave,
  onTest,
}: SlotConfigPanelProps) {
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // 表单状态
  const [providerId, setProviderId] = useState<string>(
    slot.primary_provider?.id ?? "",
  );
  const [modelId, setModelId] = useState(slot.primary_model_id ?? "");
  const [isEnabled, setIsEnabled] = useState(slot.is_enabled);
  const [resourcePool, setResourcePool] = useState<ResourcePoolEntry[]>(
    slot.fallback_chain.map((f) => ({
      provider_id: f.provider.id,
      model_id: f.model_id,
    })),
  );

  // 当 slot 变化时重置表单
  const resetForm = useCallback(() => {
    setProviderId(slot.primary_provider?.id ?? "");
    setModelId(slot.primary_model_id ?? "");
    setIsEnabled(slot.is_enabled);
    setResourcePool(
      slot.fallback_chain.map((f) => ({
        provider_id: f.provider.id,
        model_id: f.model_id,
      })),
    );
  }, [slot]);

  useEffect(() => {
    resetForm();
  }, [resetForm]);

  const isValid = providerId.length > 0 && modelId.length > 0;

  const handleSave = async () => {
    if (!isValid) return;
    setIsSaving(true);
    try {
      const success = await onSave(slot.slot_type, {
        primary_provider_id: providerId,
        primary_model_id: modelId,
        fallback_chain: resourcePool.filter(
          (f) => f.provider_id && f.model_id,
        ),
        is_enabled: isEnabled,
        config: {},
      });
      if (success) {
        toast({ title: "配置已保存", variant: "success" });
      }
    } catch (err) {
      toast({
        title: "保存失败",
        description: err instanceof Error ? err.message : "未知错误",
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async (): Promise<ProviderTestResponse | null> => {
    if (!providerId) return null;
    return onTest(providerId);
  };

  return (
    <div className="p-6">
      <div className="space-y-6">
        {/* 启用/禁用开关 */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-white/60">启用</label>
          <button
            type="button"
            onClick={() => setIsEnabled(!isEnabled)}
            role="switch"
            aria-checked={isEnabled}
            aria-label="启用槽位"
            className={cn(
              "relative h-6 w-11 cursor-pointer rounded-full transition-colors duration-200",
              isEnabled ? "bg-indigo-500" : "bg-white/10",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200",
                isEnabled ? "left-[22px]" : "left-0.5",
              )}
            />
          </button>
        </div>

        {/* 主 Provider + Model 并排 */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-white/60">
              主 Provider
            </label>
            <ProviderCombobox
              providers={providers}
              value={providerId || null}
              onChange={setProviderId}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-white/60">
              主模型
            </label>
            <ModelCombobox
              providerId={providerId || null}
              value={modelId}
              onChange={setModelId}
              placeholder="选择或输入模型 ID..."
            />
          </div>
        </div>

        {/* 资源池 */}
        <ResourcePoolEditor
          pool={resourcePool}
          providers={providers}
          onChange={setResourcePool}
        />

        {/* 测试连通性 */}
        <ConnectivityTestButton onTest={handleTest} />

        {/* 操作按钮 */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={resetForm}
            className="glass-btn-ghost flex items-center gap-1.5 px-4 py-2 text-sm"
          >
            <RotateCcw size={ICON_SIZE.md} />
            重置
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!isValid || isSaving}
            className={cn(
              "glass-btn-primary flex items-center gap-2 px-5 py-2 text-sm",
              (!isValid || isSaving) && "opacity-40 cursor-not-allowed",
            )}
          >
            {isSaving ? (
              <Loader2 size={ICON_SIZE.md} className="animate-spin" />
            ) : (
              <Save size={ICON_SIZE.md} />
            )}
            {isSaving ? "保存中..." : "保存配置"}
          </button>
        </div>
      </div>
    </div>
  );
}
