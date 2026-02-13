/**
 * 资源池编辑器组件。
 * 管理备选模型列表：添加/删除/排序。
 * 资源池为应用端提供轮询、故障转移等能力。
 */

import { Plus, X, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ICON_SIZE } from "@/lib/icon-sizes";
import type { Provider } from "@/api/types";
import { ProviderCombobox } from "./ProviderCombobox";
import { ModelCombobox } from "./ModelCombobox";

export interface ResourcePoolEntry {
  provider_id: string;
  model_id: string;
}

interface ResourcePoolEditorProps {
  pool: ResourcePoolEntry[];
  providers: Provider[];
  onChange: (pool: ResourcePoolEntry[]) => void;
}

export function ResourcePoolEditor({
  pool,
  providers,
  onChange,
}: ResourcePoolEditorProps) {
  const addEntry = () => {
    onChange([...pool, { provider_id: "", model_id: "" }]);
  };

  const removeEntry = (index: number) => {
    onChange(pool.filter((_, i) => i !== index));
  };

  const updateEntry = (
    index: number,
    field: keyof ResourcePoolEntry,
    value: string,
  ) => {
    const newPool = pool.map((entry, i) =>
      i === index ? { ...entry, [field]: value } : entry,
    );
    onChange(newPool);
  };

  /** 上移/下移排序 */
  const moveEntry = (index: number, direction: "up" | "down") => {
    const newPool = [...pool];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newPool.length) return;
    const item = newPool[index];
    const target = newPool[targetIndex];
    if (!item || !target) return;
    newPool[index] = target;
    newPool[targetIndex] = item;
    onChange(newPool);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium text-white/60">资源池</label>
          <p className="mt-0.5 text-xs text-white/30">
            备选模型，支持轮询与故障转移
          </p>
        </div>
        <button
          type="button"
          onClick={addEntry}
          aria-label="添加备选模型"
          className="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-indigo-400 transition-colors hover:bg-indigo-500/10"
        >
          <Plus size={ICON_SIZE.sm} />
          添加备选
        </button>
      </div>

      {pool.length === 0 ? (
        <p className="text-xs text-white/30">暂无备选模型</p>
      ) : (
        <div className="space-y-2">
          {pool.map((entry, index) => (
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
                  className="cursor-pointer text-white/20 transition-colors hover:text-white/50 disabled:opacity-30"
                  aria-label={`上移备选 ${index + 1}`}
                >
                  <ChevronUp size={ICON_SIZE.md} />
                </button>
                <button
                  type="button"
                  onClick={() => moveEntry(index, "down")}
                  disabled={index === pool.length - 1}
                  className="cursor-pointer text-white/20 transition-colors hover:text-white/50 disabled:opacity-30"
                  aria-label={`下移备选 ${index + 1}`}
                >
                  <ChevronDown size={ICON_SIZE.md} />
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
              <div className="min-w-0 flex-1">
                <ModelCombobox
                  providerId={entry.provider_id || null}
                  value={entry.model_id}
                  onChange={(val) => updateEntry(index, "model_id", val)}
                  placeholder="选择模型..."
                />
              </div>

              {/* 删除按钮 */}
              <button
                type="button"
                onClick={() => removeEntry(index)}
                aria-label={`删除备选 ${index + 1}`}
                className="shrink-0 cursor-pointer rounded-lg p-1.5 text-white/20 transition-colors hover:bg-red-500/10 hover:text-red-400"
              >
                <X size={ICON_SIZE.md} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
