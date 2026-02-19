/**
 * Voice 列表状态管理 Hook。
 * 支持可选的 batchId 参数用于按批次筛选。
 * 自动获取元数据键并构建动态可筛选字段。
 */

import { useState, useEffect, useMemo } from "react";
import { fetchVoices, fetchVoiceMetadataKeys, deleteVoice } from "@/api/voc-api";
import { buildVoiceFields, VOICE_BASE_FIELDS } from "../lib/field-defs";
import { useDataList } from "./use-data-list";
import type { FieldDef } from "../lib/field-defs";

interface UseVoicesOptions {
  pageSize?: number;
  batchId?: string;
}

export function useVoices({ pageSize = 20, batchId }: UseVoicesOptions = {}) {
  const [metadataKeys, setMetadataKeys] = useState<string[]>([]);

  // 获取元数据键
  useEffect(() => {
    let cancelled = false;
    fetchVoiceMetadataKeys()
      .then((res) => {
        if (!cancelled) setMetadataKeys(res.data.keys);
      })
      .catch(() => {
        // 静默失败，回退到无元数据键
      });
    return () => { cancelled = true; };
  }, []);

  // 动态字段定义
  const voiceFields: FieldDef[] = useMemo(
    () => (metadataKeys.length > 0 ? buildVoiceFields(metadataKeys) : VOICE_BASE_FIELDS),
    [metadataKeys],
  );

  const fetchFn = useMemo(
    () => (params: Record<string, unknown>) =>
      fetchVoices(params as Parameters<typeof fetchVoices>[0]),
    [],
  );
  const deleteFn = useMemo(() => deleteVoice, []);

  const extraParams = useMemo(
    () => ({ batch_id: batchId }),
    [batchId],
  );

  const dataList = useDataList({
    fetchFn,
    deleteFn,
    defaultSortBy: "created_at",
    defaultPageSize: pageSize,
    extraParams,
  });

  return { ...dataList, voiceFields };
}
