/**
 * 步骤 3：提示词编辑。
 * prompt_ready 状态下可编辑提示词 + 触发映射；其他状态只读。
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Loader2,
  FileText,
  Sparkles,
  CheckCircle2,
  Send,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ICON_SIZE } from "@/lib/icon-sizes";
import type { BatchStatus, PromptPreview } from "@/api/types";

interface StepPromptProps {
  batchStatus: BatchStatus | null;
  promptPreview: PromptPreview | null;
  processing: boolean;
  readOnly: boolean;
  onLoadPromptText: () => Promise<void>;
  onUpdatePrompt: (text: string) => Promise<void>;
  onTriggerMapping: () => Promise<void>;
}

/** debounce 延时（毫秒） */
const SAVE_DEBOUNCE = 1000;

export function StepPrompt({
  batchStatus,
  promptPreview,
  processing,
  readOnly,
  onLoadPromptText,
  onUpdatePrompt,
  onTriggerMapping,
}: StepPromptProps) {
  const status = batchStatus?.status;
  const isPromptReady = status === "prompt_ready";
  const isGenerating = status === "generating_mapping";
  const isDone =
    status === "mapping" ||
    status === "importing" ||
    status === "completed" ||
    status === "partially_completed";

  const canEdit = isPromptReady && !readOnly;
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 加载提示词
  useEffect(() => {
    void onLoadPromptText();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // 同步 promptPreview 到本地编辑状态
  useEffect(() => {
    if (promptPreview?.prompt_text) {
      setEditText(promptPreview.prompt_text);
    }
  }, [promptPreview?.prompt_text]);

  // debounce 自动保存
  const handleTextChange = useCallback(
    (text: string) => {
      setEditText(text);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(async () => {
        setSaving(true);
        try {
          await onUpdatePrompt(text);
        } finally {
          setSaving(false);
        }
      }, SAVE_DEBOUNCE);
    },
    [onUpdatePrompt],
  );

  // 清理 debounce
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // 触发映射
  const handleTrigger = useCallback(async () => {
    // 先保存未保存的编辑
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
      await onUpdatePrompt(editText);
    }
    setTriggering(true);
    try {
      await onTriggerMapping();
    } finally {
      setTriggering(false);
    }
  }, [editText, onUpdatePrompt, onTriggerMapping]);

  return (
    <div className="animate-fade-in space-y-6">
      {/* 映射来源标签 */}
      {promptPreview && (
        <div className="glass-panel flex items-center gap-3 px-5 py-3">
          {promptPreview.source === "template_reused" ? (
            <>
              <Sparkles
                size={ICON_SIZE.md}
                className="shrink-0 text-amber-400"
              />
              <p className="text-sm text-white/60">
                复用模板：
                <span className="font-medium text-amber-400">
                  {promptPreview.template_name}
                </span>
              </p>
            </>
          ) : (
            <>
              <FileText
                size={ICON_SIZE.md}
                className="shrink-0 text-indigo-400"
              />
              <p className="text-sm text-white/60">
                {canEdit
                  ? "提示词已就绪，可编辑后触发映射"
                  : "LLM 生成映射"}
              </p>
            </>
          )}
          {saving && (
            <span className="ml-auto flex items-center gap-1 text-xs text-white/30">
              <Save size={12} className="animate-pulse" />
              保存中...
            </span>
          )}
        </div>
      )}

      {/* 提示词内容 */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
          <FileText size={ICON_SIZE.md} className="text-white/40" />
          <span className="text-sm font-medium text-white/60">
            {canEdit ? "提示词（可编辑）" : "提示词全文"}
          </span>
        </div>

        {canEdit ? (
          <textarea
            value={editText}
            onChange={(e) => handleTextChange(e.target.value)}
            className="glass-input w-full resize-none border-0 px-4 py-3 font-mono text-xs leading-relaxed text-white/70 focus:ring-0"
            style={{ minHeight: "400px" }}
            spellCheck={false}
          />
        ) : (
          <div className="max-h-96 overflow-auto px-4 py-3">
            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-white/60">
              {promptPreview?.prompt_text ?? editText}
            </pre>
          </div>
        )}
      </div>

      {/* 状态指示 + 操作按钮 */}
      <div
        className={cn(
          "glass-panel flex items-center gap-4 px-6 py-5",
          isDone && "border-green-500/10",
        )}
      >
        {isGenerating || (processing && !isDone) ? (
          <>
            <Loader2
              size={ICON_SIZE.xl}
              className="animate-spin-slow shrink-0 text-indigo-400"
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-white/70">
                AI 正在分析字段映射...
              </p>
              <p className="mt-1 text-xs text-white/40">
                正在使用提示词调用 LLM 识别列映射关系
              </p>
            </div>
          </>
        ) : isDone ? (
          <>
            <CheckCircle2
              size={ICON_SIZE.xl}
              className="shrink-0 text-green-400"
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-400">映射已生成</p>
              <p className="mt-1 text-xs text-white/40">
                请查看下一步的映射结果
              </p>
            </div>
          </>
        ) : canEdit ? (
          <>
            <FileText
              size={ICON_SIZE.xl}
              className="shrink-0 text-indigo-400"
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-white/70">
                提示词已就绪
              </p>
              <p className="mt-1 text-xs text-white/40">
                可直接触发映射，或编辑提示词后再触发
              </p>
            </div>
            <button
              onClick={() => void handleTrigger()}
              disabled={triggering || !editText.trim()}
              className="glass-btn-primary flex shrink-0 items-center gap-2 px-4 py-2 text-sm"
            >
              {triggering ? (
                <Loader2 size={ICON_SIZE.sm} className="animate-spin" />
              ) : (
                <Send size={ICON_SIZE.sm} />
              )}
              触发映射
            </button>
          </>
        ) : (
          <>
            <Loader2
              size={ICON_SIZE.xl}
              className="animate-spin-slow shrink-0 text-indigo-400"
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-white/70">等待处理...</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
