/**
 * 槽位配置面板。
 * 展开后显示：Provider 选择 + Model ID + 降级链 + 测试 + 保存。
 */

import { useState, useEffect } from "react";
import { Loader2, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { SLOT_META } from "@/lib/constants";
import type {
  SlotConfig,
  SlotConfigureRequest,
  Provider,
  ProviderTestResponse,
} from "@/api/types";
import { ProviderCombobox } from "./ProviderCombobox";
import {
  FallbackChainEditor,
  type FallbackEntry,
} from "./FallbackChainEditor";
import { ConnectivityTestButton } from "./ConnectivityTestButton";

interface SlotConfigPanelProps {
  slot: SlotConfig;
  providers: Provider[];
  onSave: (slotType: string, data: SlotConfigureRequest) => Promise<boolean>;
  onTest: (providerId: string) => Promise<ProviderTestResponse | null>;
  onCancel: () => void;
}

export function SlotConfigPanel({
  slot,
  providers,
  onSave,
  onTest,
  onCancel,
}: SlotConfigPanelProps) {
  const meta = SLOT_META[slot.slot_type];
  const [isSaving, setIsSaving] = useState(false);

  // 表单状态
  const [providerId, setProviderId] = useState<string>(
    slot.primary_provider?.id ?? "",
  );
  const [modelId, setModelId] = useState(slot.primary_model_id ?? "");
  const [isEnabled, setIsEnabled] = useState(slot.is_enabled);
  const [fallbackChain, setFallbackChain] = useState<FallbackEntry[]>(
    slot.fallback_chain.map((f) => ({
      provider_id: f.provider.id,
      model_id: f.model_id,
    })),
  );

  // 当 slot 变化时重置表单
  useEffect(() => {
    setProviderId(slot.primary_provider?.id ?? "");
    setModelId(slot.primary_model_id ?? "");
    setIsEnabled(slot.is_enabled);
    setFallbackChain(
      slot.fallback_chain.map((f) => ({
        provider_id: f.provider.id,
        model_id: f.model_id,
      })),
    );
  }, [slot]);

  const isValid = providerId.length > 0 && modelId.length > 0;

  const handleSave = async () => {
    if (!isValid) return;
    setIsSaving(true);
    const success = await onSave(slot.slot_type, {
      primary_provider_id: providerId,
      primary_model_id: modelId,
      fallback_chain: fallbackChain.filter(
        (f) => f.provider_id && f.model_id,
      ),
      is_enabled: isEnabled,
      config: {},
    });
    setIsSaving(false);
    if (success) {
      onCancel();
    }
  };

  const handleTest = async (): Promise<ProviderTestResponse | null> => {
    if (!providerId) return null;
    return onTest(providerId);
  };

  return (
    <div className="animate-expand border-t border-white/5 p-5">
      {/* 面板标题 */}
      <div className="mb-5">
        <h4 className="text-sm font-semibold text-white">
          配置{meta.label}
        </h4>
        <p className="mt-0.5 text-xs text-white/40">{meta.description}</p>
      </div>

      <div className="space-y-5">
        {/* 启用/禁用开关 */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-white/60">启用</label>
          <button
            type="button"
            onClick={() => setIsEnabled(!isEnabled)}
            className={cn(
              "relative h-6 w-11 rounded-full transition-colors duration-200",
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

        {/* 主 Provider */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-white/60">
            Provider
          </label>
          <ProviderCombobox
            providers={providers}
            value={providerId || null}
            onChange={setProviderId}
          />
        </div>

        {/* Model ID */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-white/60">
            Model ID
          </label>
          <input
            type="text"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            placeholder="例如 qwen2.5-7b-instruct"
            className="glass-input h-10 w-full px-3 text-sm"
          />
        </div>

        {/* 降级链 */}
        <FallbackChainEditor
          chain={fallbackChain}
          providers={providers}
          onChange={setFallbackChain}
        />

        {/* 测试连通性 */}
        <ConnectivityTestButton onTest={handleTest} />

        {/* 操作按钮 */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="glass-btn-ghost px-4 py-2 text-sm"
          >
            取消
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
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            {isSaving ? "保存中..." : "保存配置"}
          </button>
        </div>
      </div>
    </div>
  );
}
