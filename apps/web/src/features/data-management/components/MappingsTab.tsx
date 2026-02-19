/**
 * 映射模板列表 Tab（卡片布局）。
 */

import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpDown, Eye, Trash2 } from "lucide-react";
import { Combobox } from "@/components/Combobox";
import { Pagination } from "@/components/Pagination";
import { cn, formatDate } from "@/lib/utils";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { fetchFieldValues } from "@/api/voc-api";
import { FilterPanel } from "./FilterPanel";
import { DataCardList } from "./DataCardList";
import { FieldTag } from "./FieldTag";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import { MAPPING_FIELDS } from "../lib/field-defs";
import { useMappings } from "../hooks/use-mappings";
import type { DataMapping } from "@/api/types";

const SORT_OPTIONS = MAPPING_FIELDS.filter((f) => f.sortable).map((f) => ({
  value: f.field,
  label: f.label,
}));

export function MappingsTab() {
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
  } = useMappings();

  const handleFetchFieldValues = useCallback(
    async (field: string, prefix?: string) => {
      const res = await fetchFieldValues("mappings", { field, prefix });
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
    (item: DataMapping) => (
      <div
        className="glass-card p-4 cursor-pointer transition-all hover:border-white/20"
        onClick={() => navigate(`/voc/data/mappings/${item.id}`)}
      >
        {/* 主区域：模板名称 */}
        <span className="text-sm text-white/90 font-medium">{item.name}</span>

        {/* 标签区 */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          <FieldTag label="格式" value={item.source_format.toUpperCase()} onClick={() => addFilterByValue("source_format", item.source_format)} />
          <FieldTag label="创建者" value={item.created_by} onClick={() => addFilterByValue("created_by", item.created_by)} />
          {item.confidence != null && (
            <FieldTag
              label="置信度"
              value={`${Math.round(item.confidence * 100)}%`}
              variant="number"
            />
          )}
          <FieldTag label="使用次数" value={item.usage_count} variant="number" />
          <FieldTag
            label="列哈希"
            value={item.column_hash.slice(0, 12) + "..."}
            variant="muted"
          />
          <FieldTag label="创建" value={formatDate(item.created_at)} />
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-end gap-2 mt-3">
          <button
            className="glass-btn-ghost h-7 px-2.5 text-xs flex items-center gap-1"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/voc/data/mappings/${item.id}`);
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

  const keyExtractor = useMemo(() => (item: DataMapping) => item.id, []);

  return (
    <div className="space-y-4">
      {/* 筛选面板 */}
      <FilterPanel
        fieldDefs={MAPPING_FIELDS}
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
        emptyMessage="暂无映射模板"
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
        title="删除映射模板"
        description="删除后，该映射模板将被永久移除，此操作不可撤销。"
        loading={deleting}
      />
    </div>
  );
}
