/**
 * 多选下拉选择器（Glass 风格）。
 * 用于 IN 操作符等需要选择多个值的场景。
 * 选中项显示为可移除 chips，下拉面板支持 checkbox 指示器、搜索过滤和全选/清空。
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Check, ChevronDown, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ICON_SIZE } from "@/lib/icon-sizes";
import type { ComboboxOption } from "@/components/Combobox";

interface MultiComboboxProps {
  value: string[];
  onChange: (value: string[]) => void;
  options: ComboboxOption[];
  placeholder?: string;
  allowCustom?: boolean;
  className?: string;
  size?: "sm" | "md";
  onSearch?: (query: string) => void;
  searching?: boolean;
  /** 触发区域最多显示几个 chip，超出折叠为 +N */
  maxDisplayChips?: number;
}

export function MultiCombobox({
  value,
  onChange,
  options,
  placeholder = "请选择...",
  allowCustom = false,
  className,
  size = "md",
  onSearch,
  searching = false,
  maxDisplayChips = 3,
}: MultiComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedSet = new Set(value);

  // 过滤逻辑
  const filtered = onSearch
    ? options
    : search
      ? options.filter(
          (o) =>
            o.label.toLowerCase().includes(search.toLowerCase()) ||
            o.value.toLowerCase().includes(search.toLowerCase()),
        )
      : options;

  const showCustomOption =
    allowCustom && search && !filtered.some((o) => o.value === search) && !selectedSet.has(search);

  const totalItems = filtered.length + (showCustomOption ? 1 : 0);

  // 点击外部关闭
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  // 打开时聚焦搜索框
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  // 高亮项滚动到可见区域
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("[data-option]");
      items[highlightIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex]);

  const toggle = useCallback(
    (val: string) => {
      if (selectedSet.has(val)) {
        onChange(value.filter((v) => v !== val));
      } else {
        onChange([...value, val]);
      }
      setSearch("");
      setHighlightIndex(-1);
    },
    [value, onChange, selectedSet],
  );

  const removeChip = useCallback(
    (val: string, e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(value.filter((v) => v !== val));
    },
    [value, onChange],
  );

  const selectAll = useCallback(() => {
    const allValues = options.map((o) => o.value);
    onChange(allValues);
  }, [options, onChange]);

  const clearAll = useCallback(() => {
    onChange([]);
  }, [onChange]);

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
      case " ":
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < filtered.length) {
          const opt = filtered[highlightIndex];
          if (opt) toggle(opt.value);
        } else if (showCustomOption && highlightIndex === filtered.length) {
          toggle(search);
        } else if (allowCustom && search) {
          toggle(search);
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

  const sizeClasses = size === "sm" ? "min-h-[28px] text-xs" : "min-h-[32px] text-sm";

  // chip 相关
  const displayChips = value.slice(0, maxDisplayChips);
  const overflowCount = value.length - maxDisplayChips;

  const getLabel = (val: string) => options.find((o) => o.value === val)?.label ?? val;

  return (
    <div ref={containerRef} className={cn("relative", className)} onKeyDown={handleKeyDown}>
      {/* 触发区域 */}
      <button
        type="button"
        className={cn(
          "glass-input w-full flex items-center gap-1 px-2 flex-wrap",
          sizeClasses,
          value.length === 0 && "text-white/40",
        )}
        onClick={() => {
          setOpen(!open);
          setSearch("");
          setHighlightIndex(-1);
        }}
      >
        {value.length === 0 ? (
          <span className="px-1 truncate">{placeholder}</span>
        ) : (
          <>
            {displayChips.map((val) => (
              <span
                key={val}
                className="inline-flex items-center gap-1 h-5 px-1.5 text-[11px] rounded-md bg-white/8 text-white/70 border border-white/10"
              >
                <span className="truncate max-w-[80px]">{getLabel(val)}</span>
                <X
                  size={10}
                  className="shrink-0 cursor-pointer hover:text-white"
                  onClick={(e) => removeChip(val, e)}
                />
              </span>
            ))}
            {overflowCount > 0 && (
              <span className="inline-flex items-center h-5 px-1.5 text-[11px] rounded-md bg-white/8 text-white/50 border border-white/10">
                +{overflowCount}
              </span>
            )}
          </>
        )}
        <ChevronDown
          size={ICON_SIZE.xs}
          className={cn(
            "shrink-0 text-white/40 transition-transform ml-auto",
            open && "rotate-180",
          )}
        />
      </button>

      {/* 浮层 */}
      {open && (
        <div
          className={cn(
            "absolute left-0 right-0 z-[var(--z-dropdown)] mt-1",
            "w-full min-w-[200px] overflow-hidden p-1",
            "rounded-[var(--radius-lg)] border border-white/12",
            "shadow-[0_8px_32px_-8px_rgba(0,0,0,0.6)]",
          )}
          style={{ background: "rgba(17, 24, 39, 0.95)", backdropFilter: "blur(24px)" }}
        >
          {/* 搜索框 */}
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

          {/* 选项列表 */}
          <div ref={listRef} className="max-h-[200px] overflow-y-auto">
            {searching && (
              <div className="flex items-center justify-center gap-1.5 px-2 py-3 text-xs text-white/40">
                <Loader2 size={ICON_SIZE.sm} className="animate-spin" />
                搜索中...
              </div>
            )}

            {!searching &&
              filtered.map((opt, idx) => {
                const isSelected = selectedSet.has(opt.value);
                return (
                  <div
                    key={opt.value}
                    data-option
                    role="option"
                    aria-selected={isSelected}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 rounded-md text-xs cursor-pointer transition-colors",
                      isSelected ? "text-accent-primary font-medium" : "text-white/80",
                      idx === highlightIndex && "bg-white/10 text-white",
                    )}
                    onClick={() => toggle(opt.value)}
                    onMouseEnter={() => setHighlightIndex(idx)}
                  >
                    {/* Checkbox 指示器 */}
                    <span
                      className={cn(
                        "w-3.5 h-3.5 shrink-0 rounded border flex items-center justify-center transition-colors",
                        isSelected
                          ? "bg-accent-primary border-accent-primary"
                          : "border-white/20 bg-transparent",
                      )}
                    >
                      {isSelected && <Check size={10} className="text-white" />}
                    </span>
                    <span className="truncate">{opt.label}</span>
                  </div>
                );
              })}

            {/* 自定义值选项 */}
            {!searching && showCustomOption && (
              <div
                data-option
                role="option"
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded-md text-xs cursor-pointer transition-colors text-white/50",
                  highlightIndex === filtered.length && "bg-white/10 text-white/90",
                )}
                onClick={() => toggle(search)}
                onMouseEnter={() => setHighlightIndex(filtered.length)}
              >
                <span className="w-3.5 h-3.5 shrink-0" />
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

          {/* 底部操作栏 */}
          {options.length > 0 && (
            <div className="flex items-center justify-between px-2 pt-1.5 mt-1 border-t border-white/8">
              <button
                type="button"
                className="text-[11px] text-white/40 hover:text-white/70 transition-colors"
                onClick={selectAll}
              >
                全选
              </button>
              <button
                type="button"
                className="text-[11px] text-white/40 hover:text-white/70 transition-colors"
                onClick={clearAll}
              >
                清空
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
