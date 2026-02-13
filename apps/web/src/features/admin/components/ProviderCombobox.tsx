/**
 * Provider 搜索选择组件。
 * 使用 Combobox 模式替代传统 dropdown。
 * 支持搜索过滤，键盘导航。
 */

import { useState, useRef, useEffect, useId } from "react";
import { Search, Check, Server, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Provider } from "@/api/types";

interface ProviderComboboxProps {
  providers: Provider[];
  value: string | null;
  onChange: (providerId: string) => void;
  placeholder?: string;
  /** 紧凑模式：无边框小尺寸，用于嵌入输入卡片工具栏 */
  compact?: boolean;
}

export function ProviderCombobox({
  providers,
  value,
  onChange,
  placeholder = "搜索 Provider...",
  compact = false,
}: ProviderComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  // 仅显示已启用的 Provider
  const enabledProviders = providers.filter((p) => p.is_enabled);

  // 搜索过滤
  const filtered = enabledProviders.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.slug.toLowerCase().includes(search.toLowerCase()),
  );

  // 选中的 Provider
  const selected = providers.find((p) => p.id === value);

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
    const selectedIndex = filtered.findIndex((p) => p.id === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [isOpen, filtered, value]);

  const handleSelect = (providerId: string) => {
    onChange(providerId);
    setIsOpen(false);
    setSearch("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
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

    if (e.key === "Enter" && activeIndex >= 0 && filtered[activeIndex]) {
      e.preventDefault();
      handleSelect(filtered[activeIndex].id);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* 触发器 */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-activedescendant={
          isOpen && activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined
        }
        aria-haspopup="listbox"
        aria-label="选择 Provider"
        className={cn(
          compact
            ? "flex h-7 items-center gap-1.5 rounded-lg bg-white/5 px-2.5 text-xs transition-colors hover:bg-white/8"
            : "glass-input flex h-10 w-full items-center gap-2 px-3 text-sm",
          !selected && "text-white/30",
        )}
      >
        <Server size={compact ? 12 : 14} className="shrink-0 text-white/30" />
        <span className={cn("truncate text-left", !compact && "flex-1")}>
          {selected ? selected.name : placeholder}
        </span>
        {compact && <ChevronDown size={10} className="shrink-0 text-white/20" />}
      </button>

      {/* 下拉面板 */}
      {isOpen && (
        <div
          className="absolute z-[var(--z-dropdown)] mt-1 w-full overflow-hidden rounded-xl border border-white/10 bg-gray-900/95 shadow-xl backdrop-blur-xl animate-fade-in"
          role="listbox"
          id={listId}
        >
          {/* 搜索框 */}
          <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2">
            <Search size={14} className="text-white/30" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索..."
              className="flex-1 bg-transparent text-sm text-white/90 outline-none placeholder:text-white/30"
              autoFocus
              aria-label="搜索 Provider"
              onKeyDown={handleKeyDown}
            />
          </div>

          {/* 选项列表 */}
          <div className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-white/30">
                未找到匹配的 Provider
              </div>
            ) : (
              filtered.map((provider, index) => (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => handleSelect(provider.id)}
                  role="option"
                  id={`${listId}-option-${index}`}
                  aria-selected={provider.id === value}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
                    index === activeIndex && "bg-white/5",
                    provider.id === value
                      ? "bg-indigo-500/10 text-white"
                      : "text-white/70 hover:bg-white/5",
                  )}
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5">
                    <Server size={12} className="text-white/40" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{provider.name}</p>
                    <p className="truncate text-xs text-white/40">
                      {provider.slug} / {provider.provider_type}
                    </p>
                  </div>
                  {provider.id === value && (
                    <Check size={14} className="shrink-0 text-indigo-400" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
