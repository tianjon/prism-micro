/**
 * 降级链编辑器组件。
 * 支持添加/删除/排序降级模型。
 */

import { Plus, X, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Provider } from "@/api/types";
import { ProviderCombobox } from "./ProviderCombobox";

export interface FallbackEntry {
  provider_id: string;
  model_id: string;
}

interface FallbackChainEditorProps {
  chain: FallbackEntry[];
  providers: Provider[];
  onChange: (chain: FallbackEntry[]) => void;
}

export function FallbackChainEditor({
  chain,
  providers,
  onChange,
}: FallbackChainEditorProps) {
  const addEntry = () => {
    onChange([...chain, { provider_id: "", model_id: "" }]);
  };

  const removeEntry = (index: number) => {
    onChange(chain.filter((_, i) => i !== index));
  };

  const updateEntry = (
    index: number,
    field: keyof FallbackEntry,
    value: string,
  ) => {
    const newChain = chain.map((entry, i) =>
      i === index ? { ...entry, [field]: value } : entry,
    );
    onChange(newChain);
  };

  /** 简单上移/下移排序 */
  const moveEntry = (index: number, direction: "up" | "down") => {
    const newChain = [...chain];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newChain.length) return;
    const item = newChain[index];
    const target = newChain[targetIndex];
    if (!item || !target) return;
    newChain[index] = target;
    newChain[targetIndex] = item;
    onChange(newChain);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-white/60">降级链</label>
        <button
          type="button"
          onClick={addEntry}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-indigo-400 transition-colors hover:bg-indigo-500/10"
        >
          <Plus size={12} />
          添加降级
        </button>
      </div>

      {chain.length === 0 ? (
        <p className="text-xs text-white/30">暂无降级模型配置</p>
      ) : (
        <div className="space-y-2">
          {chain.map((entry, index) => (
            <div
              key={index}
              className={cn(
                "flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-3",
              )}
            >
              {/* 排序手柄 */}
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => moveEntry(index, "up")}
                  disabled={index === 0}
                  className="text-white/20 transition-colors hover:text-white/50 disabled:opacity-30"
                >
                  <GripVertical size={14} />
                </button>
              </div>

              {/* 序号 */}
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-white/5 text-[10px] text-white/40">
                {index + 1}
              </span>

              {/* Provider 选择 */}
              <div className="flex-1">
                <ProviderCombobox
                  providers={providers}
                  value={entry.provider_id || null}
                  onChange={(id) => updateEntry(index, "provider_id", id)}
                  placeholder="选择 Provider"
                />
              </div>

              {/* Model ID */}
              <input
                type="text"
                value={entry.model_id}
                onChange={(e) =>
                  updateEntry(index, "model_id", e.target.value)
                }
                placeholder="Model ID"
                className="glass-input h-10 w-40 px-3 text-sm"
              />

              {/* 删除按钮 */}
              <button
                type="button"
                onClick={() => removeEntry(index)}
                className="shrink-0 rounded-lg p-1.5 text-white/20 transition-colors hover:bg-red-500/10 hover:text-red-400"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
