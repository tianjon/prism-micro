/**
 * Provider 创建页内组件。
 * 两段式交互：平台卡片选择 → 配置表单。
 * 取代原 CreateProviderSheet 侧边抽屉设计。
 */

import { useState, useEffect, useCallback } from "react";
import { Check, Loader2, Plus, Settings2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Provider, ProviderCreate, ProviderPreset } from "@/api/types";
import { fetchProviderPresets } from "../api/providers-api";

interface CreateProviderInlineProps {
  providers: Provider[];
  onSubmit: (data: ProviderCreate) => Promise<boolean>;
}

const PROVIDER_TYPES = [
  { value: "openai", label: "OpenAI 兼容" },
  { value: "anthropic", label: "Anthropic" },
  { value: "custom", label: "自定义" },
] as const;

export function CreateProviderInline({
  providers,
  onSubmit,
}: CreateProviderInlineProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [presets, setPresets] = useState<ProviderPreset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  // 表单字段
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [providerType, setProviderType] = useState("openai");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // 加载预设列表
  useEffect(() => {
    void fetchProviderPresets().then((res) => setPresets(res.data));
  }, []);

  // 当前已配置的预设 ID 集合
  const configuredPresetIds = new Set(
    providers
      .map((p) => p.config?.preset_id as string | undefined)
      .filter(Boolean),
  );

  const isCustomMode = selectedPreset === "custom";

  const resetForm = useCallback(() => {
    setSelectedPreset(null);
    setName("");
    setSlug("");
    setProviderType("openai");
    setBaseUrl("");
    setApiKey("");
    setFormError(null);
  }, []);

  const handleToggle = () => {
    if (isOpen) {
      resetForm();
    }
    setIsOpen(!isOpen);
  };

  const handleSelectPreset = (presetId: string) => {
    setFormError(null);
    if (presetId === "custom") {
      setSelectedPreset("custom");
      setName("");
      setSlug("");
      setProviderType("openai");
      setBaseUrl("");
    } else {
      const preset = presets.find((p) => p.preset_id === presetId);
      if (preset) {
        setSelectedPreset(presetId);
        setName(preset.name);
        setSlug(preset.preset_id);
        setProviderType(preset.provider_type);
      }
    }
    setApiKey("");
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slug || slug === slugify(name)) {
      setSlug(slugify(value));
    }
  };

  const isFormValid = isCustomMode
    ? name.length > 0 &&
      slug.length > 0 &&
      baseUrl.length > 0 &&
      apiKey.length > 0
    : name.length > 0 && slug.length > 0 && apiKey.length > 0;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setFormError(null);

    const data: ProviderCreate = {
      name,
      slug,
      api_key: apiKey,
    };

    if (isCustomMode) {
      data.provider_type = providerType;
      data.base_url = baseUrl;
    } else if (selectedPreset) {
      data.preset_id = selectedPreset;
    }

    try {
      const success = await onSubmit(data);
      if (success) {
        resetForm();
        setIsOpen(false);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={handleToggle}
        className="glass-btn-primary flex items-center gap-2 px-4 py-2 text-sm"
      >
        <Plus size={16} />
        新建 Provider
      </button>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-white/80">
          添加 Provider
        </h3>
        <button
          onClick={handleToggle}
          className="rounded-lg p-1.5 text-white/30 transition-colors hover:bg-white/5 hover:text-white/60"
        >
          <X size={16} />
        </button>
      </div>

      {/* 平台选择卡片网格 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {presets.map((preset) => {
          const isConfigured = configuredPresetIds.has(preset.preset_id);
          const isSelected = selectedPreset === preset.preset_id;
          return (
            <PresetCard
              key={preset.preset_id}
              name={preset.name}
              description={preset.description}
              isSelected={isSelected}
              isConfigured={isConfigured}
              onClick={() => handleSelectPreset(preset.preset_id)}
            />
          );
        })}
        {/* 自定义入口 */}
        <PresetCard
          name="自定义"
          description="手动配置 API 端点"
          icon={<Settings2 size={18} className="text-white/40" />}
          isSelected={selectedPreset === "custom"}
          isConfigured={false}
          onClick={() => handleSelectPreset("custom")}
        />
      </div>

      {/* 配置表单 */}
      {selectedPreset && (
        <div className="glass-card space-y-4 p-5 animate-fade-in">
          {/* 名称 + slug */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-white/60">名称</label>
              <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="例如 OpenRouter"
                className="glass-input h-10 w-full px-3 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-white/60">
                标识符 (slug)
              </label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="例如 openrouter"
                className="glass-input h-10 w-full px-3 text-sm font-mono"
              />
            </div>
          </div>

          {/* 自定义模式额外字段 */}
          {isCustomMode && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-white/60">
                  Provider 类型
                </label>
                <div className="glass-segmented" role="radiogroup" aria-label="Provider 类型">
                  {PROVIDER_TYPES.map((type) => (
                    <button
                      type="button"
                      key={type.value}
                      data-active={providerType === type.value}
                      onClick={() => setProviderType(type.value)}
                      role="radio"
                      aria-checked={providerType === type.value}
                      className="glass-segmented-item"
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-white/60">
                  Base URL
                </label>
                <input
                  type="url"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="http://localhost:8000/v1"
                  className="glass-input h-10 w-full px-3 text-sm font-mono"
                />
              </div>
            </>
          )}

          {/* API Key（通用） */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-white/60">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="glass-input h-10 w-full px-3 text-sm font-mono"
            />
            <p className="text-xs text-white/30">
              API Key 将加密存储，创建后不可查看
            </p>
          </div>

          {/* 错误提示 */}
          {formError && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {formError}
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setIsOpen(false);
              }}
              className="glass-btn-ghost px-4 py-2 text-sm"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!isFormValid || isSubmitting}
              className={cn(
                "glass-btn-primary flex items-center gap-1.5 px-5 py-2 text-sm",
                (!isFormValid || isSubmitting) &&
                  "opacity-40 cursor-not-allowed",
              )}
            >
              {isSubmitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Check size={14} />
              )}
              {isSubmitting ? "创建中..." : "创建"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** 预设平台卡片 */
function PresetCard({
  name,
  description,
  icon,
  isSelected,
  isConfigured,
  onClick,
}: {
  name: string;
  description: string;
  icon?: React.ReactNode;
  isSelected: boolean;
  isConfigured: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      className={cn(
        "glass-card relative flex flex-col items-center gap-2 px-3 py-4 text-center transition-all duration-200",
        "hover:border-white/20 hover:bg-white/[0.06]",
        isSelected &&
          "border-indigo-500/50 bg-indigo-500/10 ring-1 ring-indigo-500/30",
      )}
    >
      {/* 已配置标识 */}
      {isConfigured && (
        <div className="absolute right-1.5 top-1.5 rounded-full bg-green-500/20 p-0.5">
          <Check size={10} className="text-green-400" />
        </div>
      )}

      {/* 图标或首字母 */}
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5">
        {icon ?? (
          <span className="text-sm font-bold text-white/50">
            {name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      <div>
        <p className="text-sm font-medium text-white/80">{name}</p>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-tight text-white/30">
          {description}
        </p>
      </div>
    </button>
  );
}

/** 将名称转换为 slug */
function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50);
}
