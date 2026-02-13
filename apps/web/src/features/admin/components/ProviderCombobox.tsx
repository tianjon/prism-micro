/**
 * Provider 搜索选择组件。
 * 使用 Combobox 模式替代传统 dropdown。
 * 支持搜索过滤，键盘导航。
 */

import { useState, useRef, useEffect } from "react";
import { Search, Check, Server } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Provider } from "@/api/types";

interface ProviderComboboxProps {
  providers: Provider[];
  value: string | null;
  onChange: (providerId: string) => void;
  placeholder?: string;
}

export function ProviderCombobox({
  providers,
  value,
  onChange,
  placeholder = "搜索 Provider...",
}: ProviderComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

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

  return (
    <div ref={containerRef} className="relative">
      {/* 触发器 */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "glass-input flex h-10 w-full items-center gap-2 px-3 text-sm",
          !selected && "text-white/30",
        )}
      >
        <Server size={14} className="shrink-0 text-white/30" />
        <span className="flex-1 truncate text-left">
          {selected ? selected.name : placeholder}
        </span>
      </button>

      {/* 下拉面板 */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-white/10 bg-gray-900/95 shadow-xl backdrop-blur-xl animate-fade-in">
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
            />
          </div>

          {/* 选项列表 */}
          <div className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-white/30">
                未找到匹配的 Provider
              </div>
            ) : (
              filtered.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => {
                    onChange(provider.id);
                    setIsOpen(false);
                    setSearch("");
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
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
