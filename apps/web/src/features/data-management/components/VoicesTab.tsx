/**
 * Voice 列表 Tab（卡片布局）。
 * 支持 batchId 参数用于批次详情页内嵌。
 */

import { useState, useCallback, useMemo } from "react";
import { ArrowUpDown, ChevronDown, ChevronUp, Loader2, Trash2 } from "lucide-react";
import { Combobox } from "@/components/Combobox";
import { Pagination } from "@/components/Pagination";
import { cn, formatDate } from "@/lib/utils";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { fetchFieldValues, fetchVoiceDetail } from "@/api/voc-api";
import { FilterPanel } from "./FilterPanel";
import { DataCardList } from "./DataCardList";
import { FieldTag } from "./FieldTag";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import { useVoices } from "../hooks/use-voices";
import type { DataVoiceListItem } from "@/api/types";

interface VoicesTabProps {
  batchId?: string;
}

// ---- Voice 卡片（支持全文展开） ----

interface VoiceCardProps {
  item: DataVoiceListItem;
  onDelete: (id: string) => void;
  onFilterByValue: (field: string, value: string) => void;
}

function VoiceCard({ item, onDelete, onFilterByValue }: VoiceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [fullText, setFullText] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState(false);

  // 是否被后端截断（以 "..." 结尾且长度 >= 203）
  const isTruncated = item.raw_text.endsWith("...") && item.raw_text.length >= 203;

  const handleToggleExpand = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }

    // 未截断的直接展开 CSS line-clamp
    if (!isTruncated) {
      setExpanded(true);
      return;
    }

    // 截断的：首次请求完整文本
    if (fullText === null) {
      setLoadingText(true);
      try {
        const res = await fetchVoiceDetail(item.id);
        setFullText(res.data.raw_text);
      } catch {
        // 失败时直接展开已有文本
      } finally {
        setLoadingText(false);
      }
    }
    setExpanded(true);
  };

  const displayText = expanded && fullText ? fullText : item.raw_text;

  return (
    <div className="glass-card p-4">
      {/* 主区域：原始文本 */}
      <p
        className={cn(
          "text-sm text-white/90 leading-relaxed whitespace-pre-wrap",
          !expanded && "line-clamp-3",
          isTruncated && !expanded && "cursor-pointer",
        )}
        onClick={isTruncated || !expanded ? handleToggleExpand : undefined}
      >
        {displayText}
      </p>

      {/* 展开/收起 */}
      {(isTruncated || expanded) && (
        <button
          type="button"
          className="flex items-center gap-0.5 mt-1 text-[11px] text-white/40 hover:text-white/70 transition-colors"
          onClick={handleToggleExpand}
          disabled={loadingText}
        >
          {loadingText ? (
            <>
              <Loader2 size={10} className="animate-spin" />
              加载中...
            </>
          ) : expanded ? (
            <>
              <ChevronUp size={10} />
              收起
            </>
          ) : (
            <>
              <ChevronDown size={10} />
              展开全文
            </>
          )}
        </button>
      )}

      {/* 标签区 */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        <FieldTag label="来源" value={item.source} onClick={() => onFilterByValue("source", item.source)} />
        <FieldTag label="状态" value={item.processed_status} variant="status" onClick={() => onFilterByValue("processed_status", item.processed_status)} />
        <FieldTag label="创建" value={formatDate(item.created_at)} />
      </div>

      {/* metadata 展开 */}
      {item.metadata && Object.keys(item.metadata).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {Object.entries(item.metadata).map(([key, val]) => (
            <FieldTag
              key={key}
              label={`metadata.${key}`}
              value={val != null ? String(val) : null}
              variant="muted"
              onClick={val != null ? () => onFilterByValue(`metadata.${key}`, String(val)) : undefined}
            />
          ))}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex justify-end mt-3">
        <button
          className={cn(
            "glass-btn-ghost h-7 px-2.5 text-xs flex items-center gap-1",
            "text-red-400/70 hover:text-red-400 hover:border-red-400/30",
          )}
          onClick={() => onDelete(item.id)}
        >
          <Trash2 size={ICON_SIZE.sm} />
          删除
        </button>
      </div>
    </div>
  );
}

// ---- 主组件 ----

export function VoicesTab({ batchId }: VoicesTabProps) {
  const {
    items,
    total,
    page,
    setPage,
    totalPages,
    loading,
    sortBy,
    sortOrder,
    setSortBy,
    setSortOrder,
    filterConditions,
    setFilterConditions,
    filterLogic,
    setFilterLogic,
    addFilterByValue,
    handleDelete,
    voiceFields,
  } = useVoices({ batchId });

  const handleFetchFieldValues = useCallback(
    async (field: string, prefix?: string) => {
      const res = await fetchFieldValues("voices", { field, prefix });
      return res.data;
    },
    [],
  );

  const sortOptions = useMemo(
    () => voiceFields.filter((f) => f.sortable).map((f) => ({ value: f.field, label: f.label })),
    [voiceFields],
  );

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const onConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await handleDelete(deleteTarget);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const toggleSortOrder = useCallback(() => {
    setSortOrder(sortOrder === "asc" ? "desc" : "asc");
  }, [sortOrder, setSortOrder]);

  const renderCard = useCallback(
    (item: DataVoiceListItem) => (
      <VoiceCard
        item={item}
        onDelete={setDeleteTarget}
        onFilterByValue={addFilterByValue}
      />
    ),
    [addFilterByValue],
  );

  const keyExtractor = useMemo(() => (item: DataVoiceListItem) => item.id, []);

  return (
    <div className="space-y-4">
      {/* 筛选面板 */}
      <FilterPanel
        fieldDefs={voiceFields}
        conditions={filterConditions}
        onChange={setFilterConditions}
        fetchFieldValues={handleFetchFieldValues}
        logic={filterLogic}
        onLogicChange={setFilterLogic}
      />

      {/* 排序栏 + 总数 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40">排序：</span>
          <Combobox
            value={sortBy}
            onChange={setSortBy}
            options={sortOptions}
            searchable={false}
            size="sm"
            className="w-[120px]"
          />
          <button
            type="button"
            className="glass-btn-ghost h-7 w-7 flex items-center justify-center"
            onClick={toggleSortOrder}
            title={sortOrder === "asc" ? "升序" : "降序"}
          >
            <ArrowUpDown
              size={ICON_SIZE.sm}
              className={cn(sortOrder === "asc" && "rotate-180")}
            />
          </button>
        </div>
        <span className="text-xs text-white/40">共 {total} 条</span>
      </div>

      {/* 卡片列表 */}
      <DataCardList
        items={items}
        loading={loading}
        emptyMessage="暂无 Voice 数据"
        renderCard={renderCard}
        keyExtractor={keyExtractor}
      />

      {/* 分页 */}
      <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />

      {/* 删除确认 */}
      <DeleteConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={onConfirmDelete}
        title="删除 Voice"
        description="删除后，该 Voice 及其关联的语义单元将被永久移除，此操作不可撤销。"
        loading={deleting}
      />
    </div>
  );
}
