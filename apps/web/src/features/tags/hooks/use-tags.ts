/**
 * 标签列表 hook。
 * 管理标签筛选、排序、分页状态与数据加载。
 */

import { useState, useEffect, useCallback } from "react";
import type { TagListItem } from "@/api/types";
import { ApiError } from "@/api/client";
import { fetchTags } from "@/api/voc-api";

type LoadState = "idle" | "loading" | "success" | "error";

export interface TagFilters {
  sort_by: string;
  sort_order: string;
  status: string | undefined;
  min_usage: number;
  confidence_tier: string | undefined;
  page_size: number;
}

const DEFAULT_FILTERS: TagFilters = {
  sort_by: "usage_count",
  sort_order: "desc",
  status: undefined,
  min_usage: 0,
  confidence_tier: undefined,
  page_size: 12,
};

export interface UseTagsReturn {
  tags: TagListItem[];
  loadState: LoadState;
  error: string | null;
  total: number;
  page: number;
  setPage: (page: number) => void;
  filters: TagFilters;
  setFilters: (filters: Partial<TagFilters>) => void;
  reload: () => void;
}

export function useTags(): UseTagsReturn {
  const [tags, setTags] = useState<TagListItem[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFiltersState] = useState<TagFilters>(DEFAULT_FILTERS);

  const load = useCallback(async () => {
    setLoadState("loading");
    setError(null);
    try {
      const response = await fetchTags({
        page,
        page_size: filters.page_size,
        sort_by: filters.sort_by,
        sort_order: filters.sort_order,
        status: filters.status,
        min_usage: filters.min_usage > 0 ? filters.min_usage : undefined,
        confidence_tier: filters.confidence_tier,
      });
      setTags(response.data);
      setTotal(response.pagination.total);
      setLoadState("success");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "加载标签列表失败";
      setError(message);
      setLoadState("error");
    }
  }, [page, filters]);

  useEffect(() => {
    void load();
  }, [load]);

  /** 合并更新过滤条件，同时重置到第一页 */
  const setFilters = useCallback((partial: Partial<TagFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...partial }));
    setPage(1);
  }, []);

  return {
    tags,
    loadState,
    error,
    total,
    page,
    setPage,
    filters,
    setFilters,
    reload: load,
  };
}
