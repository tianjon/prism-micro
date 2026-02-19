/**
 * 可搜索下拉选择器（Glass 风格）。
 * 替代原生 <select>，支持搜索过滤、自定义值输入和异步搜索。
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ICON_SIZE } from "@/lib/icon-sizes";

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchable?: boolean;
  allowCustom?: boolean;
  className?: string;
  size?: "sm" | "md";
  /** 异步搜索回调。提供时跳过本地过滤，由父组件控制 options。 */
  onSearch?: (query: string) => void;
  /** 异步搜索加载状态 */
  searching?: boolean;
}

export function Combobox({
  value,
  onChange,
  options,
  placeholder = "请选择...",
  searchable = true,
  allowCustom = false,
  className,
  size = "md",
  onSearch,
  searching = false,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? value;

  // 异步模式：options 已由父组件过滤，直接使用；本地模式：客户端过滤
  const filtered = onSearch
    ? options
    : search
      ? options.filter(
          (o) =>
            o.label.toLowerCase().includes(search.toLowerCase()) ||
            o.value.toLowerCase().includes(search.toLowerCase()),
        )
      : options;

  // allowCustom 模式：搜索词不在已有选项中时，显示"使用 xxx"
  const showCustomOption =
    allowCustom && search && !filtered.some((o) => o.value === search);

  const totalItems = filtered.length + (showCustomOption ? 1 : 0);

  // 点击外部关闭
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  // 打开时聚焦搜索框
  useEffect(() => {
    if (open && searchable && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open, searchable]);

  // 高亮项变化时滚动到可见区域
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("[data-option]");
      items[highlightIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex]);

  const select = useCallback(
    (val: string) => {
      onChange(val);
      setOpen(false);
      setSearch("");
      setHighlightIndex(-1);
    },
    [onChange],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter" || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((prev) => (prev + 1) % totalItems);
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((prev) => (prev - 1 + totalItems) % totalItems);
        break;
      case "Enter":
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < filtered.length) {
          const opt = filtered[highlightIndex];
          if (opt) select(opt.value);
        } else if (showCustomOption && highlightIndex === filtered.length) {
          select(search);
        } else if (allowCustom && search) {
          select(search);
        }
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        setSearch("");
        setHighlightIndex(-1);
        break;
    }
  };

  const sizeClasses = size === "sm" ? "h-7 text-xs" : "h-8 text-sm";

  return (
    <div ref={containerRef} className={cn("relative", className)} onKeyDown={handleKeyDown}>
      {/* 触发按钮 */}
      <button
        type="button"
        className={cn(
          "glass-input w-full flex items-center justify-between gap-1 px-3",
          sizeClasses,
          !value && "text-white/40",
        )}
        onClick={() => {
          setOpen(!open);
          setSearch("");
          setHighlightIndex(-1);
        }}
      >
        <span className="truncate">{value ? selectedLabel : placeholder}</span>
        <ChevronDown
          size={ICON_SIZE.xs}
          className={cn("shrink-0 text-white/40 transition-transform", open && "rotate-180")}
        />
      </button>

      {/* 浮层 */}
      {open && (
        <div
          className={cn(
            "absolute left-0 right-0 z-[var(--z-dropdown)] mt-1",
            "w-full min-w-[180px] overflow-hidden p-1",
            "rounded-[var(--radius-lg)] border border-white/12",
            "shadow-[0_8px_32px_-8px_rgba(0,0,0,0.6)]",
          )}
          style={{ background: "rgba(17, 24, 39, 0.95)", backdropFilter: "blur(24px)" }}
        >
          {/* 搜索框 */}
          {searchable && (
            <input
              ref={inputRef}
              type="text"
              className={cn(
                "w-full h-7 px-3 text-xs mb-1 rounded-[var(--radius-sm)]",
                "bg-white/8 border border-white/10 text-white/90 placeholder:text-white/30",
                "focus:outline-none focus:border-accent-primary",
              )}
              placeholder="搜索..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setHighlightIndex(-1);
                onSearch?.(e.target.value);
              }}
            />
          )}

          {/* 选项列表 */}
          <div ref={listRef} className="max-h-[200px] overflow-y-auto">
            {searching && (
              <div className="flex items-center justify-center gap-1.5 px-2 py-3 text-xs text-white/40">
                <Loader2 size={ICON_SIZE.sm} className="animate-spin" />
                搜索中...
              </div>
            )}

            {!searching && filtered.map((opt, idx) => (
              <div
                key={opt.value}
                data-option
                role="option"
                aria-selected={opt.value === value}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded-md text-xs cursor-pointer transition-colors",
                  opt.value === value ? "text-accent-primary font-medium" : "text-white/80",
                  idx === highlightIndex && "bg-white/10 text-white",
                )}
                onClick={() => select(opt.value)}
                onMouseEnter={() => setHighlightIndex(idx)}
              >
                <span className="w-3 shrink-0">
                  {opt.value === value && <Check size={ICON_SIZE.sm} />}
                </span>
                <span className="truncate">{opt.label}</span>
              </div>
            ))}

            {/* 自定义值选项 */}
            {!searching && showCustomOption && (
              <div
                data-option
                role="option"
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded-md text-xs cursor-pointer transition-colors text-white/50",
                  highlightIndex === filtered.length && "bg-white/10 text-white/90",
                )}
                onClick={() => select(search)}
                onMouseEnter={() => setHighlightIndex(filtered.length)}
              >
                <span className="w-3 shrink-0" />
                <span className="truncate">
                  使用 &ldquo;{search}&rdquo;
                </span>
              </div>
            )}

            {!searching && filtered.length === 0 && !showCustomOption && (
              <div className="px-2 py-3 text-center text-xs text-white/30">
                无匹配项
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
