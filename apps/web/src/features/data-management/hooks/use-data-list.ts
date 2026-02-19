/**
 * 通用数据列表 Hook。
 * 封装分页、排序、BI 筛选、删除等共性逻辑。
 */

import { useState, useCallback, useEffect } from "react";
import type { PaginatedResponse } from "@/api/types";
import type { FilterCondition, FilterLogic } from "../components/FilterPanel";

export interface UseDataListConfig<T> {
  fetchFn: (params: Record<string, unknown>) => Promise<PaginatedResponse<T>>;
  deleteFn: (id: string) => Promise<unknown>;
  defaultSortBy?: string;
  defaultPageSize?: number;
  extraParams?: Record<string, string | undefined>;
}

export function useDataList<T>({
  fetchFn,
  deleteFn,
  defaultSortBy = "created_at",
  defaultPageSize = 20,
  extraParams,
}: UseDataListConfig<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState(defaultSortBy);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [filterConditions, setFilterConditions] = useState<FilterCondition[]>([]);
  const [filterLogic, setFilterLogic] = useState<FilterLogic>("and");
  const [loading, setLoading] = useState(false);

  // 序列化筛选条件为 JSON（新格式：{ logic, conditions }）
  const serializeFilters = useCallback(
    (conditions: FilterCondition[], logic: FilterLogic): string | undefined => {
      const valid = conditions.filter((c) => c.field && c.operator);
      if (valid.length === 0) return undefined;
      return JSON.stringify({
        logic,
        conditions: valid.map((c) => ({
          field: c.field,
          op: c.operator,
          value: c.value,
        })),
      });
    },
    [],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        page,
        page_size: defaultPageSize,
        sort_by: sortBy,
        sort_order: sortOrder,
        ...extraParams,
      };

      // 添加序列化后的筛选条件
      const filtersJson = serializeFilters(filterConditions, filterLogic);
      if (filtersJson) {
        params.filters = filtersJson;
      }

      // 移除 undefined 值
      for (const key of Object.keys(params)) {
        if (params[key] === undefined || params[key] === "") {
          delete params[key];
        }
      }
      const res = await fetchFn(params);
      setItems(res.data);
      setTotal(res.pagination.total);
    } catch {
      // 错误由全局 toast 处理
    } finally {
      setLoading(false);
    }
  }, [page, defaultPageSize, sortBy, sortOrder, filterConditions, filterLogic, extraParams, fetchFn, serializeFilters]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const updateFilterConditions = useCallback((conditions: FilterCondition[]) => {
    setFilterConditions(conditions);
    setPage(1);
  }, []);

  const updateFilterLogic = useCallback((logic: FilterLogic) => {
    setFilterLogic(logic);
    setPage(1);
  }, []);

  /** 从 Tag 点击快速添加一条 eq 筛选条件 */
  const addFilterByValue = useCallback(
    (field: string, value: string) => {
      const id = `fc_tag_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setFilterConditions((prev) => [...prev, { id, field, operator: "eq", value }]);
      setPage(1);
    },
    [],
  );

  /** 从日期 Tag 点击添加范围筛选（gte + lt 两条条件） */
  const addDateFilter = useCallback(
    (field: string, isoValue: string, granularity: "date" | "time") => {
      const d = new Date(isoValue);
      let start: Date;
      let end: Date;

      if (granularity === "date") {
        start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        end = new Date(start);
        end.setDate(end.getDate() + 1);
      } else {
        start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes());
        end = new Date(start);
        end.setMinutes(end.getMinutes() + 1);
      }

      const ts = Date.now();
      const r = Math.random().toString(36).slice(2, 6);
      setFilterConditions((prev) => [
        ...prev,
        { id: `fc_dt_${ts}_${r}_gte`, field, operator: "gte", value: start.toISOString() },
        { id: `fc_dt_${ts}_${r}_lt`, field, operator: "lt", value: end.toISOString() },
      ]);
      setPage(1);
    },
    [],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteFn(id);
      await fetchData();
    },
    [deleteFn, fetchData],
  );

  const totalPages = Math.max(1, Math.ceil(total / defaultPageSize));

  return {
    items,
    total,
    loading,
    page,
    setPage,
    totalPages,
    sortBy,
    sortOrder,
    setSortBy,
    setSortOrder,
    filterConditions,
    setFilterConditions: updateFilterConditions,
    filterLogic,
    setFilterLogic: updateFilterLogic,
    addFilterByValue,
    handleDelete,
    reload: fetchData,
  };
}
