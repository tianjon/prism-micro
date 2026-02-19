/**
 * 映射模板列表状态管理 Hook。
 */

import { useMemo } from "react";
import { fetchMappings, deleteMapping } from "@/api/voc-api";
import { useDataList } from "./use-data-list";

export function useMappings({ pageSize = 20 }: { pageSize?: number } = {}) {
  const fetchFn = useMemo(
    () => (params: Record<string, unknown>) =>
      fetchMappings(params as Parameters<typeof fetchMappings>[0]),
    [],
  );
  const deleteFn = useMemo(() => deleteMapping, []);

  return useDataList({
    fetchFn,
    deleteFn,
    defaultSortBy: "created_at",
    defaultPageSize: pageSize,
  });
}
