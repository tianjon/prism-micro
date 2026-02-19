/**
 * 批次列表 Tab（卡片布局）。
 */

import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpDown, Eye, Trash2 } from "lucide-react";
import { Combobox } from "@/components/Combobox";
import { Pagination } from "@/components/Pagination";
import { cn, formatDate, formatFileSize } from "@/lib/utils";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { fetchFieldValues } from "@/api/voc-api";
import { FilterPanel } from "./FilterPanel";
import { DataCardList } from "./DataCardList";
import { FieldTag } from "./FieldTag";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import { BATCH_FIELDS } from "../lib/field-defs";
import { useBatches } from "../hooks/use-batches";
import type { DataBatch } from "@/api/types";

const SORT_OPTIONS = BATCH_FIELDS.filter((f) => f.sortable).map((f) => ({
  value: f.field,
  label: f.label,
}));

export function BatchesTab() {
  const navigate = useNavigate();
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
  } = useBatches();

  const handleFetchFieldValues = useCallback(
    async (field: string, prefix?: string) => {
      const res = await fetchFieldValues("batches", { field, prefix });
      return res.data;
    },
    [],
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
    (item: DataBatch) => (
      <div
        className="glass-card p-4 cursor-pointer transition-all hover:border-white/20"
        onClick={() => navigate(`/voc/data/batches/${item.id}`)}
      >
        {/* 主区域：文件名 + 文件大小 */}
        <div className="flex items-start justify-between gap-3">
          <span className="text-sm text-white/90 font-medium truncate">
            {item.file_name ?? "未命名文件"}
          </span>
          <span className="shrink-0 text-xs text-white/40 tabular-nums">
            {formatFileSize(item.file_size_bytes)}
          </span>
        </div>

        {/* 标签区 */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          <FieldTag label="来源" value={item.source} onClick={() => addFilterByValue("source", item.source)} />
          <FieldTag label="状态" value={item.status} variant="status" onClick={() => addFilterByValue("status", item.status)} />
          {item.mapping_name && <FieldTag label="映射" value={item.mapping_name} onClick={() => addFilterByValue("mapping_name", item.mapping_name!)} />}
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          <FieldTag label="总数" value={item.total_count} variant="number" />
          {item.new_count > 0 && (
            <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-md border text-green-400 bg-green-400/10 border-green-400/20">
              <span className="text-white/30 mr-1">新增=</span>
              {item.new_count}
            </span>
          )}
          {item.duplicate_count > 0 && (
            <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-md border text-orange-400 bg-orange-400/10 border-orange-400/20">
              <span className="text-white/30 mr-1">重复=</span>
              {item.duplicate_count}
            </span>
          )}
          {item.failed_count > 0 && (
            <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-md border text-red-400 bg-red-400/10 border-red-400/20">
              <span className="text-white/30 mr-1">失败=</span>
              {item.failed_count}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          <FieldTag label="创建" value={formatDate(item.created_at)} />
          {item.completed_at && <FieldTag label="完成" value={formatDate(item.completed_at)} />}
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-end gap-2 mt-3">
          <button
            className="glass-btn-ghost h-7 px-2.5 text-xs flex items-center gap-1"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/voc/data/batches/${item.id}`);
            }}
          >
            <Eye size={ICON_SIZE.sm} />
            查看
          </button>
          <button
            className={cn(
              "glass-btn-ghost h-7 px-2.5 text-xs flex items-center gap-1",
              "text-red-400/70 hover:text-red-400 hover:border-red-400/30",
            )}
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(item.id);
            }}
          >
            <Trash2 size={ICON_SIZE.sm} />
            删除
          </button>
        </div>
      </div>
    ),
    [navigate, addFilterByValue],
  );

  const keyExtractor = useMemo(() => (item: DataBatch) => item.id, []);

  return (
    <div className="space-y-4">
      {/* 筛选面板 */}
      <FilterPanel
        fieldDefs={BATCH_FIELDS}
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
            options={SORT_OPTIONS}
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
        emptyMessage="暂无导入批次"
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
        title="删除批次"
        description="删除后，该批次及其关联的 Voice 数据将被永久移除，此操作不可撤销。"
        loading={deleting}
      />
    </div>
  );
}
