/**
 * 模型选择组件。
 * 从 Provider 的 /models 端点加载可用模型列表，
 * 支持搜索过滤 + 手动输入自定义模型 ID。
 */

import { useState, useRef, useEffect, useCallback, useId } from "react";
import { Search, Check, Cpu, Loader2, AlertCircle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProviderModel } from "@/api/types";
import { fetchProviderModels } from "../api/providers-api";

interface ModelComboboxProps {
  providerId: string | null;
  value: string;
  onChange: (modelId: string) => void;
  placeholder?: string;
  /** 紧凑模式：无边框小尺寸，用于嵌入输入卡片工具栏 */
  compact?: boolean;
}

type LoadState = "idle" | "loading" | "loaded" | "error";

export function ModelCombobox({
  providerId,
  value,
  onChange,
  placeholder = "选择或输入模型 ID...",
  compact = false,
}: ModelComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [models, setModels] = useState<ProviderModel[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  // 加载模型列表
  const loadModels = useCallback(async (pid: string) => {
    setLoadState("loading");
    try {
      const res = await fetchProviderModels(pid);
      setModels(res.data);
      setLoadState("loaded");
    } catch {
      setModels([]);
      setLoadState("error");
    }
  }, []);

  // Provider 变化时重新加载
  useEffect(() => {
    if (providerId) {
      void loadModels(providerId);
    } else {
      setModels([]);
      setLoadState("idle");
    }
  }, [providerId, loadModels]);

  // 搜索过滤
  const filtered = models.filter(
    (m) =>
      m.id.toLowerCase().includes(search.toLowerCase()) ||
      m.owned_by.toLowerCase().includes(search.toLowerCase()),
  );

  // 输入值是否匹配已有模型
  const isExactMatch = models.some((m) => m.id === value);

  // 点击外部关闭
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    if (filtered.length === 0) {
      setActiveIndex(-1);
      return;
    }
    const selectedIndex = filtered.findIndex((m) => m.id === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [isOpen, filtered, value]);

  const handleInputChange = (val: string) => {
    setSearch(val);
    onChange(val);
    if (!isOpen && val.length > 0) {
      setIsOpen(true);
    }
  };

  const handleSelect = (modelId: string) => {
    onChange(modelId);
    setSearch("");
    setIsOpen(false);
  };

  const handleFocus = () => {
    setIsOpen(true);
    setSearch("");
  };

  const handleKeyDown = (e: React.KeyboardEvent, allowCustom = false) => {
    if (
      !isOpen &&
      (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")
    ) {
      e.preventDefault();
      setIsOpen(true);
      return;
    }

    if (!isOpen) return;

    if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) =>
        filtered.length === 0 ? -1 : Math.min(prev + 1, filtered.length - 1),
      );
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) =>
        filtered.length === 0 ? -1 : Math.max(prev - 1, 0),
      );
      return;
    }

    if (e.key === "Enter") {
      if (activeIndex >= 0 && filtered[activeIndex]) {
        e.preventDefault();
        handleSelect(filtered[activeIndex].id);
        return;
      }
      if (allowCustom && search) {
        e.preventDefault();
        handleSelect(search);
      }
    }
  };

  const hasModels = models.length > 0;

  return (
    <div ref={containerRef} className="relative">
      {/* 输入框 / 紧凑触发器 */}
      {compact ? (
        <button
          type="button"
          onClick={handleFocus}
          onKeyDown={(e) => handleKeyDown(e, true)}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listId}
          aria-activedescendant={
            isOpen && activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined
          }
          aria-haspopup="listbox"
          aria-label="选择模型"
          className={cn(
            "flex h-7 items-center gap-1.5 rounded-lg bg-white/5 px-2.5 text-xs transition-colors hover:bg-white/8",
            !value && "text-white/30",
          )}
        >
          <Cpu size={12} className="shrink-0 text-white/30" />
          <span className="max-w-[160px] truncate">{value || placeholder}</span>
          {loadState === "loading" ? (
            <Loader2 size={10} className="shrink-0 animate-spin text-white/30" />
          ) : (
            <ChevronDown size={10} className="shrink-0 text-white/20" />
          )}
        </button>
      ) : (
        <div className="relative">
          <Cpu
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
          />
          <input
            ref={inputRef}
            type="text"
            value={isOpen ? search || value : value}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={handleFocus}
            onKeyDown={(e) => handleKeyDown(e, true)}
            placeholder={placeholder}
            role="combobox"
            aria-expanded={isOpen}
            aria-controls={listId}
            aria-activedescendant={
              isOpen && activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined
            }
            aria-haspopup="listbox"
            aria-autocomplete="list"
            aria-label="选择或输入模型 ID"
            className="glass-input h-10 w-full pl-9 pr-8 text-sm"
          />
          {/* 右侧状态指示 */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {loadState === "loading" && (
              <Loader2 size={14} className="animate-spin text-white/30" />
            )}
            {loadState === "loaded" && isExactMatch && (
              <Check size={14} className="text-green-400/70" />
            )}
            {loadState === "error" && (
              <AlertCircle size={14} className="text-amber-400/70" />
            )}
          </div>
        </div>
      )}

      {/* 下拉面板 */}
      {isOpen && (hasModels || compact) && (
        <div
          className={cn(
            "absolute z-[var(--z-dropdown)] mt-1 overflow-hidden rounded-xl border border-white/10 bg-gray-900/95 shadow-xl backdrop-blur-xl animate-fade-in",
            compact ? "min-w-[280px] right-0" : "w-full",
          )}
          role="listbox"
          id={listId}
        >
          {/* 搜索区域 */}
          <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2">
            <Search size={14} className="text-white/30" />
            {compact ? (
              <input
                type="text"
                value={search}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, true)}
                placeholder="搜索或输入模型 ID..."
                className="flex-1 bg-transparent text-sm text-white/90 outline-none placeholder:text-white/30"
                autoFocus
                aria-label="搜索模型"
              />
            ) : (
              <span className="text-xs text-white/30">
                {filtered.length} / {models.length} 个模型
              </span>
            )}
          </div>

          {/* 模型列表 */}
          <div className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-white/30">
                {search ? "未找到匹配的模型，按 Enter 使用自定义 ID" : "无可用模型"}
              </div>
            ) : (
              filtered.map((model, index) => (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => handleSelect(model.id)}
                  role="option"
                  id={`${listId}-option-${index}`}
                  aria-selected={model.id === value}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
                    index === activeIndex && "bg-white/5",
                    model.id === value
                      ? "bg-indigo-500/10 text-white"
                      : "text-white/70 hover:bg-white/5",
                  )}
                >
                  <Cpu size={12} className="shrink-0 text-white/30" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs font-medium">
                      {model.id}
                    </p>
                    {model.owned_by && (
                      <p className="truncate text-[11px] text-white/30">
                        {model.owned_by}
                      </p>
                    )}
                  </div>
                  {model.id === value && (
                    <Check size={14} className="shrink-0 text-indigo-400" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* 模型列表加载失败提示 */}
      {isOpen && loadState === "error" && (
        <div className={cn(
          "absolute z-[var(--z-dropdown)] mt-1 rounded-xl border border-white/10 bg-gray-900/95 px-3 py-3 shadow-xl backdrop-blur-xl",
          compact ? "min-w-[280px] right-0" : "w-full",
        )}>
          <p className="text-xs text-amber-400/70">
            无法获取模型列表{compact ? "" : "，请直接输入模型 ID"}
          </p>
        </div>
      )}
    </div>
  );
}
