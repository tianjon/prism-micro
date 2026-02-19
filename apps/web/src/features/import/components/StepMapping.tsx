/**
 * 步骤 4：映射结果。
 * v2：全覆盖映射，移除"跳过此列"，增加 ext_ 前缀和产品字段。
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { ICON_SIZE } from "@/lib/icon-sizes";
import type { BatchStatus, MappingPreview } from "@/api/types";

/** 预定义映射目标 */
const PREDEFINED_TARGETS: { value: string; label: string }[] = [
  { value: "raw_text", label: "raw_text（原始文本）" },
  { value: "source_key", label: "source_key（业务标识）" },
  { value: "metadata.title", label: "metadata.title（标题）" },
  { value: "metadata.author", label: "metadata.author（作者）" },
  { value: "metadata.platform", label: "metadata.platform（平台）" },
  { value: "metadata.rating", label: "metadata.rating（评分）" },
  { value: "metadata.category", label: "metadata.category（分类）" },
  { value: "metadata.product_name", label: "metadata.product_name（产品名称）" },
  { value: "metadata.sku", label: "metadata.sku（SKU 编码）" },
  { value: "metadata.url", label: "metadata.url（链接）" },
  { value: "metadata.published_at", label: "metadata.published_at（发布时间）" },
  { value: "metadata.collected_at", label: "metadata.collected_at（采集时间）" },
  { value: "metadata.location", label: "metadata.location（位置）" },
  { value: "metadata.reply_count", label: "metadata.reply_count（回复数）" },
  { value: "metadata.like_count", label: "metadata.like_count（点赞数）" },
];

interface StepMappingProps {
  batchStatus: BatchStatus | null;
  mappingPreview: MappingPreview | null;
  loadingMapping: boolean;
  readOnly: boolean;
  onLoadPreview: () => Promise<void>;
  onConfirm: (mappings: Record<string, string | null>) => Promise<void>;
}

export function StepMapping({
  batchStatus,
  mappingPreview,
  loadingMapping,
  readOnly,
  onLoadPreview,
  onConfirm,
}: StepMappingProps) {
  const [editedMappings, setEditedMappings] = useState<
    Record<string, string>
  >({});
  const status = batchStatus?.status;

  // status 为 mapping 时加载映射预览；回跳查看时也加载
  useEffect(() => {
    if (status === "mapping" || readOnly) {
      void onLoadPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, readOnly]);

  // 初始化编辑映射
  useEffect(() => {
    if (!mappingPreview) return;
    const initial: Record<string, string> = {};
    for (const col of mappingPreview.column_mappings) {
      initial[col.source_column] = col.target_field || `metadata.ext_${col.source_column}`;
    }
    setEditedMappings(initial);
  }, [mappingPreview]);

  // 动态构建选项列表（包含当前列的 ext_ 选项）
  const getOptionsForColumn = useCallback(
    (sourceColumn: string) => {
      const extValue = `metadata.ext_${sourceColumn}`;
      const extOption = {
        value: extValue,
        label: `metadata.ext_${sourceColumn}（扩展字段）`,
      };
      // 如果已有选中的非预定义值，也加入选项
      const currentValue = editedMappings[sourceColumn];
      const allOptions = [...PREDEFINED_TARGETS, extOption];
      if (
        currentValue &&
        !allOptions.some((opt) => opt.value === currentValue)
      ) {
        allOptions.push({ value: currentValue, label: currentValue });
      }
      return allOptions;
    },
    [editedMappings],
  );

  const handleFieldChange = useCallback(
    (sourceColumn: string, value: string) => {
      setEditedMappings((prev) => ({
        ...prev,
        [sourceColumn]: value,
      }));
    },
    [],
  );

  // 所有列都必须有映射
  const allMapped = useMemo(() => {
    if (!mappingPreview) return false;
    return mappingPreview.column_mappings.every(
      (col) => editedMappings[col.source_column],
    );
  }, [mappingPreview, editedMappings]);

  const handleConfirm = useCallback(async () => {
    if (!allMapped) return;
    await onConfirm(editedMappings);
  }, [editedMappings, allMapped, onConfirm]);

  // 加载状态
  if (loadingMapping || !mappingPreview) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <Loader2
          size={ICON_SIZE["3xl"]}
          className="animate-spin-slow text-indigo-400"
        />
        <p className="text-sm text-white/50">正在加载映射预览...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* 只读模式提示 */}
      {readOnly && (
        <div className="glass-panel flex items-center gap-3 px-5 py-3">
          <Sparkles size={ICON_SIZE.md} className="shrink-0 text-indigo-400" />
          <p className="text-sm text-white/60">
            此映射已确认 — 仅供查看
          </p>
        </div>
      )}

      {/* 总体置信度 */}
      <div className="glass-panel flex items-center justify-between px-5 py-3">
        <span className="text-sm text-white/60">LLM 映射置信度</span>
        <span
          className={cn(
            "text-sm font-semibold",
            mappingPreview.overall_confidence >= 0.8
              ? "text-green-400"
              : mappingPreview.overall_confidence >= 0.5
                ? "text-amber-400"
                : "text-red-400",
          )}
        >
          {(mappingPreview.overall_confidence * 100).toFixed(0)}%
        </span>
      </div>

      {/* 映射表格 */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-xs text-white/40">
                <th className="px-4 py-3 font-medium">源列名</th>
                <th className="px-4 py-3 font-medium">映射目标</th>
                <th className="px-4 py-3 font-medium">置信度</th>
                <th className="px-4 py-3 font-medium">样本值</th>
              </tr>
            </thead>
            <tbody>
              {mappingPreview.column_mappings.map((col) => {
                const options = getOptionsForColumn(col.source_column);
                return (
                  <tr
                    key={col.source_column}
                    className="border-b border-white/5 last:border-b-0"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-white/80">
                      {col.source_column}
                    </td>
                    <td className="px-4 py-3">
                      {readOnly ? (
                        <span className="text-xs text-white/60">
                          {editedMappings[col.source_column] ?? col.target_field}
                        </span>
                      ) : (
                        <select
                          value={editedMappings[col.source_column] ?? ""}
                          onChange={(e) =>
                            handleFieldChange(col.source_column, e.target.value)
                          }
                          className="glass-input h-8 cursor-pointer px-3 text-xs"
                        >
                          {options.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                          col.confidence >= 0.8
                            ? "bg-green-500/10 text-green-400"
                            : col.confidence >= 0.5
                              ? "bg-amber-500/10 text-amber-400"
                              : "bg-red-500/10 text-red-400",
                        )}
                      >
                        {(col.confidence * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="max-w-[200px] px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {col.sample_values.slice(0, 3).map((val, i) => (
                          <span
                            key={i}
                            className="inline-block max-w-[150px] truncate rounded bg-white/5 px-1.5 py-0.5 text-xs text-white/50"
                            title={val}
                          >
                            {val}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 确认按钮 */}
      {!readOnly && (
        <button
          onClick={() => void handleConfirm()}
          disabled={!allMapped}
          className="glass-btn-primary flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Check size={ICON_SIZE.md} />
          确认映射
        </button>
      )}
    </div>
  );
}
