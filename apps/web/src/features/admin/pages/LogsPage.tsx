/**
 * 系统日志查看器页面 (/admin/logs)。
 * 支持按服务/模块/级别筛选、自动刷新、分页。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { PageContainer } from "@/components/PageContainer";
import { PageHeader } from "@/components/PageHeader";
import { fetchLogs, fetchLogFilters } from "@/api/platform-api";
import type {
  LogEntry,
  LogQueryParams,
  LogFiltersResponse,
  PaginationMeta,
} from "@/api/types";

// ---- 级别颜色映射 ----

function levelColorClass(level: string): string {
  switch (level.toLowerCase()) {
    case "error":
    case "critical":
      return "text-red-400";
    case "warning":
    case "warn":
      return "text-amber-400";
    case "debug":
    case "trace":
      return "text-white/50";
    default:
      return "text-white/80";
  }
}

// ---- 时间格式化 ----

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

// ---- 常量 ----

const AUTO_REFRESH_INTERVAL = 5000;
const DEFAULT_PAGE_SIZE = 50;

export function LogsPage() {
  // 筛选器选项
  const [filters, setFilters] = useState<LogFiltersResponse>({
    services: [],
    modules: [],
    levels: [],
  });

  // 当前筛选值
  const [service, setService] = useState("");
  const [module, setModule] = useState("");
  const [level, setLevel] = useState("");

  // 数据
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    page_size: DEFAULT_PAGE_SIZE,
    total: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 自动刷新
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 当前页
  const [page, setPage] = useState(1);

  // 加载筛选器选项
  useEffect(() => {
    let cancelled = false;
    fetchLogFilters()
      .then((res) => {
        if (!cancelled) {
          setFilters(res.data);
        }
      })
      .catch(() => {
        // 筛选器加载失败不阻塞页面
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 加载日志数据
  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: LogQueryParams = {
        page,
        page_size: DEFAULT_PAGE_SIZE,
      };
      if (service) params.service = service;
      if (module) params.module = module;
      if (level) params.level = level;

      const res = await fetchLogs(params);
      setLogs(res.data);
      setPagination(res.pagination);
    } catch (err) {
      const message = err instanceof Error ? err.message : "加载日志失败";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [page, service, module, level]);

  // 筛选变更时重置到第一页
  useEffect(() => {
    setPage(1);
  }, [service, module, level]);

  // 初次加载 + 筛选/分页变更时重新加载
  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  // 自动刷新定时器
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        void loadLogs();
      }, AUTO_REFRESH_INTERVAL);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoRefresh, loadLogs]);

  // 分页计算
  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.page_size));

  return (
    <PageContainer>
      <div className="space-y-6">
        <PageHeader
          title="系统日志"
          description="查看平台各服务的运行日志"
          actions={
            <div className="flex items-center gap-2">
              {/* 自动刷新状态指示 */}
              {autoRefresh && (
                <span className="text-xs text-white/50">5s 自动刷新</span>
              )}

              {/* 暂停/恢复按钮 */}
              <button
                type="button"
                onClick={() => setAutoRefresh((v) => !v)}
                className={cn(
                  "glass-btn-ghost flex items-center gap-1.5 px-3 py-1.5 text-xs",
                  autoRefresh ? "text-white/60" : "text-amber-400",
                )}
                title={autoRefresh ? "暂停自动刷新" : "恢复自动刷新"}
              >
                {autoRefresh ? (
                  <Pause size={ICON_SIZE.sm} />
                ) : (
                  <Play size={ICON_SIZE.sm} />
                )}
                {autoRefresh ? "暂停" : "恢复"}
              </button>

              {/* 手动刷新按钮 */}
              <button
                type="button"
                onClick={() => void loadLogs()}
                className="glass-btn-ghost flex items-center gap-1.5 px-3 py-1.5 text-xs"
                title="手动刷新"
              >
                <RefreshCw
                  size={ICON_SIZE.sm}
                  className={cn(loading && "animate-spin")}
                />
                刷新
              </button>
            </div>
          }
        />

        {/* 筛选栏 */}
        <div className="flex flex-wrap items-center gap-3">
          {/* 服务 */}
          <select
            value={service}
            onChange={(e) => setService(e.target.value)}
            className="glass-input h-8 px-3 text-xs"
          >
            <option value="">全部服务</option>
            {filters.services.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {/* 模块 */}
          <select
            value={module}
            onChange={(e) => setModule(e.target.value)}
            className="glass-input h-8 px-3 text-xs"
          >
            <option value="">全部模块</option>
            {filters.modules.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          {/* 级别 */}
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="glass-input h-8 px-3 text-xs"
          >
            <option value="">全部级别</option>
            {filters.levels.map((l) => (
              <option key={l} value={l}>
                {l.toUpperCase()}
              </option>
            ))}
          </select>

          {/* 结果统计 */}
          <span className="ml-auto text-xs text-white/50">
            共 {pagination.total} 条
          </span>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="glass-card px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* 日志表格 */}
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/5 text-xs font-medium uppercase tracking-wider text-white/40">
                  <th className="whitespace-nowrap px-4 py-3">时间</th>
                  <th className="whitespace-nowrap px-4 py-3">级别</th>
                  <th className="whitespace-nowrap px-4 py-3">服务</th>
                  <th className="whitespace-nowrap px-4 py-3">模块</th>
                  <th className="px-4 py-3">消息</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && !loading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-12 text-center text-sm text-white/50"
                    >
                      暂无日志数据
                    </td>
                  </tr>
                ) : (
                  logs.map((entry, idx) => (
                    <tr
                      key={`${entry.timestamp}-${idx}`}
                      className="border-b border-white/5 transition-colors hover:bg-white/[0.02]"
                    >
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-white/50">
                        {formatTimestamp(entry.timestamp)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        <span
                          className={cn(
                            "text-xs font-semibold uppercase",
                            levelColorClass(entry.level),
                          )}
                        >
                          {entry.level}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-white/60">
                        {entry.service}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-white/40">
                        {entry.module}
                      </td>
                      <td className="max-w-md truncate px-4 py-2.5 text-xs text-white/80">
                        {entry.event}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 分页控件 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/50">
              第 {page} / {totalPages} 页
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                aria-label="上一页"
                className="glass-btn-ghost flex items-center gap-1 px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft size={ICON_SIZE.sm} />
                上一页
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                aria-label="下一页"
                className="glass-btn-ghost flex items-center gap-1 px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
              >
                下一页
                <ChevronRight size={ICON_SIZE.sm} />
              </button>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
