/**
 * 批次列表状态管理 Hook。
 */

import { useMemo } from "react";
import { fetchBatches, deleteBatch } from "@/api/voc-api";
import { useDataList } from "./use-data-list";

export function useBatches({ pageSize = 20 }: { pageSize?: number } = {}) {
  const fetchFn = useMemo(
    () => (params: Record<string, unknown>) =>
      fetchBatches(params as Parameters<typeof fetchBatches>[0]),
    [],
  );
  const deleteFn = useMemo(() => deleteBatch, []);

  return useDataList({
    fetchFn,
    deleteFn,
    defaultSortBy: "created_at",
    defaultPageSize: pageSize,
  });
}
