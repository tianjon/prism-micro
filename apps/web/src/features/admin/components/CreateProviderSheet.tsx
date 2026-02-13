/**
 * 创建 Provider 侧边 Sheet 抽屉。
 * 分步表单：基本信息 -> 连接配置 -> 确认。
 * 不使用传统 dropdown，provider_type 使用 Segmented Control。
 */

import { useState } from "react";
import { X, Loader2, ArrowRight, ArrowLeft, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProviderCreate } from "@/api/types";

/** 支持的 Provider 类型 */
const PROVIDER_TYPES = [
  { value: "openai", label: "OpenAI 兼容" },
  { value: "anthropic", label: "Anthropic" },
  { value: "custom", label: "自定义" },
] as const;

interface CreateProviderSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ProviderCreate) => Promise<boolean>;
}

type Step = 1 | 2 | 3;

export function CreateProviderSheet({
  isOpen,
  onClose,
  onSubmit,
}: CreateProviderSheetProps) {
  const [step, setStep] = useState<Step>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 表单字段
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [providerType, setProviderType] = useState("openai");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");

  const resetForm = () => {
    setStep(1);
    setName("");
    setSlug("");
    setProviderType("openai");
    setBaseUrl("");
    setApiKey("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const success = await onSubmit({
      name,
      slug,
      provider_type: providerType,
      base_url: baseUrl,
      api_key: apiKey,
    });
    setIsSubmitting(false);
    if (success) {
      handleClose();
    }
  };

  // 自动生成 slug
  const handleNameChange = (value: string) => {
    setName(value);
    if (!slug || slug === slugify(name)) {
      setSlug(slugify(value));
    }
  };

  const isStep1Valid = name.length > 0 && slug.length > 0;
  const isStep2Valid = baseUrl.length > 0 && apiKey.length > 0;

  if (!isOpen) return null;

  return (
    <>
      {/* 遮罩 */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Sheet */}
      <div className="glass-sheet fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col animate-fade-in">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">
              新建 Provider
            </h2>
            <p className="text-xs text-white/40">
              步骤 {step} / 3
            </p>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 text-white/30 transition-colors hover:bg-white/5 hover:text-white/60"
          >
            <X size={18} />
          </button>
        </div>

        {/* 步骤指示器 */}
        <div className="flex gap-1 px-6 pt-4">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                s <= step ? "bg-indigo-500" : "bg-white/10",
              )}
            />
          ))}
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* Step 1: 基本信息 */}
          {step === 1 && (
            <div className="space-y-5 animate-fade-in">
              <h3 className="text-sm font-semibold text-white/80">
                基本信息
              </h3>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-white/60">
                  名称
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="例如 本地 vLLM"
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
                  placeholder="例如 local-vllm"
                  className="glass-input h-10 w-full px-3 text-sm font-mono"
                />
                <p className="text-xs text-white/30">
                  小写字母、数字、连字符
                </p>
              </div>

              {/* Provider 类型 -- Segmented Control */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-white/60">
                  类型
                </label>
                <div className="glass-segmented">
                  {PROVIDER_TYPES.map((type) => (
                    <div
                      key={type.value}
                      data-active={providerType === type.value}
                      onClick={() => setProviderType(type.value)}
                      className="glass-segmented-item"
                    >
                      {type.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: 连接配置 */}
          {step === 2 && (
            <div className="space-y-5 animate-fade-in">
              <h3 className="text-sm font-semibold text-white/80">
                连接配置
              </h3>

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
            </div>
          )}

          {/* Step 3: 确认 */}
          {step === 3 && (
            <div className="space-y-5 animate-fade-in">
              <h3 className="text-sm font-semibold text-white/80">
                确认信息
              </h3>

              <div className="space-y-3 rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <InfoRow label="名称" value={name} />
                <InfoRow label="标识符" value={slug} />
                <InfoRow
                  label="类型"
                  value={
                    PROVIDER_TYPES.find((t) => t.value === providerType)
                      ?.label ?? providerType
                  }
                />
                <InfoRow label="Base URL" value={baseUrl} mono />
                <InfoRow label="API Key" value="••••••••" />
              </div>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-between border-t border-white/5 px-6 py-4">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((step - 1) as Step)}
              className="glass-btn-ghost flex items-center gap-1.5 px-4 py-2 text-sm"
            >
              <ArrowLeft size={14} />
              上一步
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((step + 1) as Step)}
              disabled={step === 1 ? !isStep1Valid : !isStep2Valid}
              className={cn(
                "glass-btn-primary flex items-center gap-1.5 px-5 py-2 text-sm",
                (step === 1 ? !isStep1Valid : !isStep2Valid) &&
                  "opacity-40 cursor-not-allowed",
              )}
            >
              下一步
              <ArrowRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={isSubmitting}
              className="glass-btn-primary flex items-center gap-1.5 px-5 py-2 text-sm"
            >
              {isSubmitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Check size={14} />
              )}
              {isSubmitting ? "创建中..." : "确认创建"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

/** 信息行 */
function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-white/40">{label}</span>
      <span
        className={cn(
          "text-sm text-white/80",
          mono && "font-mono text-xs",
        )}
      >
        {value}
      </span>
    </div>
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
