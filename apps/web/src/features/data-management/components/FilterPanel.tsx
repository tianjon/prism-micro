/**
 * BI 风格筛选面板。
 * 支持多条件组合过滤，字段/操作符/值均用 Combobox 选择。
 * 值输入支持辅助完成：小数据集（<20 个值）展示全部，大数据集用前缀搜索。
 * IN 操作符时值输入切换为多选模式（MultiCombobox）。
 * 多条件时支持 AND/OR 逻辑切换。
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, X } from "lucide-react";
import { Combobox, type ComboboxOption } from "@/components/Combobox";
import { MultiCombobox } from "@/components/MultiCombobox";
import { cn } from "@/lib/utils";
import { ICON_SIZE } from "@/lib/icon-sizes";
import {
  type FieldDef,
  getOperatorsForType,
  isNullaryOperator,
  isMultiValueOperator,
} from "../lib/field-defs";

export interface FilterCondition {
  id: string;
  field: string;
  operator: string;
  value: string | string[];
}

export type FilterLogic = "and" | "or";

export type FetchFieldValuesFn = (
  field: string,
  prefix?: string,
) => Promise<{ values: string[]; has_more: boolean }>;

interface FilterPanelProps {
  fieldDefs: FieldDef[];
  conditions: FilterCondition[];
  onChange: (conditions: FilterCondition[]) => void;
  /** 异步获取字段值（辅助完成），不提供时仅使用 FieldDef.options 静态选项 */
  fetchFieldValues?: FetchFieldValuesFn;
  /** AND/OR 逻辑 */
  logic?: FilterLogic;
  onLogicChange?: (logic: FilterLogic) => void;
}

let nextId = 1;
function genId(): string {
  return `fc_${nextId++}_${Date.now()}`;
}

// ---- 单值输入子组件 ----

interface FilterValueInputProps {
  field: string;
  value: string;
  onChange: (value: string) => void;
  fieldDef: FieldDef | undefined;
  fetchFieldValues?: FetchFieldValuesFn;
}

function FilterValueInput({
  field,
  value,
  onChange,
  fieldDef,
  fetchFieldValues,
}: FilterValueInputProps) {
  const staticOptions = fieldDef?.options;

  const [dynamicOptions, setDynamicOptions] = useState<ComboboxOption[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // 字段变化时获取初始值
  useEffect(() => {
    if (staticOptions?.length || !fetchFieldValues || !field) {
      setDynamicOptions([]);
      setHasMore(false);
      return;
    }

    let cancelled = false;
    fetchFieldValues(field)
      .then(({ values, has_more }) => {
        if (!cancelled) {
          setDynamicOptions(values.map((v) => ({ value: v, label: v })));
          setHasMore(has_more);
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [field, staticOptions, fetchFieldValues]);

  // 异步搜索（大数据集，debounce 300ms）
  const handleSearch = useCallback(
    (query: string) => {
      if (!fetchFieldValues || !field) return;

      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (!query) {
        fetchFieldValues(field)
          .then(({ values, has_more }) => {
            setDynamicOptions(values.map((v) => ({ value: v, label: v })));
            setHasMore(has_more);
          })
          .catch(() => {});
        return;
      }

      setSearching(true);
      debounceRef.current = setTimeout(() => {
        fetchFieldValues(field, query)
          .then(({ values }) => {
            setDynamicOptions(values.map((v) => ({ value: v, label: v })));
          })
          .catch(() => {})
          .finally(() => setSearching(false));
      }, 300);
    },
    [fetchFieldValues, field],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const options = staticOptions?.length ? staticOptions : dynamicOptions;

  return (
    <Combobox
      value={value}
      onChange={onChange}
      options={options}
      placeholder="值"
      allowCustom
      size="sm"
      className="w-[160px]"
      onSearch={hasMore ? handleSearch : undefined}
      searching={searching}
    />
  );
}

// ---- 多值输入子组件（IN 操作符） ----

interface MultiFilterValueInputProps {
  field: string;
  value: string[];
  onChange: (value: string[]) => void;
  fieldDef: FieldDef | undefined;
  fetchFieldValues?: FetchFieldValuesFn;
}

function MultiFilterValueInput({
  field,
  value,
  onChange,
  fieldDef,
  fetchFieldValues,
}: MultiFilterValueInputProps) {
  const staticOptions = fieldDef?.options;

  const [dynamicOptions, setDynamicOptions] = useState<ComboboxOption[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (staticOptions?.length || !fetchFieldValues || !field) {
      setDynamicOptions([]);
      setHasMore(false);
      return;
    }

    let cancelled = false;
    fetchFieldValues(field)
      .then(({ values, has_more }) => {
        if (!cancelled) {
          setDynamicOptions(values.map((v) => ({ value: v, label: v })));
          setHasMore(has_more);
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [field, staticOptions, fetchFieldValues]);

  const handleSearch = useCallback(
    (query: string) => {
      if (!fetchFieldValues || !field) return;

      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (!query) {
        fetchFieldValues(field)
          .then(({ values, has_more }) => {
            setDynamicOptions(values.map((v) => ({ value: v, label: v })));
            setHasMore(has_more);
          })
          .catch(() => {});
        return;
      }

      setSearching(true);
      debounceRef.current = setTimeout(() => {
        fetchFieldValues(field, query)
          .then(({ values }) => {
            setDynamicOptions(values.map((v) => ({ value: v, label: v })));
          })
          .catch(() => {})
          .finally(() => setSearching(false));
      }, 300);
    },
    [fetchFieldValues, field],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const options = staticOptions?.length ? staticOptions : dynamicOptions;

  return (
    <MultiCombobox
      value={value}
      onChange={onChange}
      options={options}
      placeholder="选择多个值"
      allowCustom
      size="sm"
      className="w-[200px]"
      onSearch={hasMore ? handleSearch : undefined}
      searching={searching}
    />
  );
}

// ---- AND/OR 切换 ----

function LogicToggle({
  logic,
  onChange,
}: {
  logic: FilterLogic;
  onChange: (logic: FilterLogic) => void;
}) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <span className="text-xs text-white/40">条件关系：</span>
      <div className="glass-segmented text-xs">
        <span
          className="glass-segmented-item !px-2.5 !py-1 !text-xs"
          data-active={logic === "and" ? "true" : "false"}
          onClick={() => onChange("and")}
        >
          满足全部
        </span>
        <span
          className="glass-segmented-item !px-2.5 !py-1 !text-xs"
          data-active={logic === "or" ? "true" : "false"}
          onClick={() => onChange("or")}
        >
          满足任一
        </span>
      </div>
    </div>
  );
}

// ---- 主面板 ----

export function FilterPanel({
  fieldDefs,
  conditions,
  onChange,
  fetchFieldValues,
  logic = "and",
  onLogicChange,
}: FilterPanelProps) {
  const fieldOptions = fieldDefs.map((f) => ({ value: f.field, label: f.label }));

  const getFieldDef = useCallback(
    (field: string) => fieldDefs.find((f) => f.field === field),
    [fieldDefs],
  );

  const addCondition = useCallback(() => {
    onChange([...conditions, { id: genId(), field: "", operator: "", value: "" }]);
  }, [conditions, onChange]);

  const removeCondition = useCallback(
    (id: string) => {
      onChange(conditions.filter((c) => c.id !== id));
    },
    [conditions, onChange],
  );

  const updateCondition = useCallback(
    (id: string, patch: Partial<FilterCondition>) => {
      onChange(
        conditions.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      );
    },
    [conditions, onChange],
  );

  const clearAll = useCallback(() => {
    onChange([]);
  }, [onChange]);

  /** 操作符切换时处理值类型转换 */
  const handleOperatorChange = useCallback(
    (condId: string, currentValue: string | string[], newOp: string) => {
      const patch: Partial<FilterCondition> = { operator: newOp };

      if (isNullaryOperator(newOp)) {
        patch.value = "";
      } else if (isMultiValueOperator(newOp)) {
        // 单值 → 多值
        if (typeof currentValue === "string") {
          patch.value = currentValue ? [currentValue] : [];
        }
      } else {
        // 多值 → 单值
        if (Array.isArray(currentValue)) {
          patch.value = currentValue[0] ?? "";
        }
      }

      updateCondition(condId, patch);
    },
    [updateCondition],
  );

  // 无条件时：只显示添加按钮
  if (conditions.length === 0) {
    return (
      <button
        type="button"
        className="glass-btn-ghost h-8 px-3 text-xs flex items-center gap-1.5"
        onClick={addCondition}
      >
        <Plus size={ICON_SIZE.sm} />
        添加筛选条件
      </button>
    );
  }

  return (
    <div className="glass-panel p-3 space-y-2 relative z-[var(--z-dropdown)]">
      {/* AND/OR 切换：条件 >= 2 时显示 */}
      {conditions.length >= 2 && onLogicChange && (
        <LogicToggle logic={logic} onChange={onLogicChange} />
      )}

      {conditions.map((cond) => {
        const def = getFieldDef(cond.field);
        const operators = def ? getOperatorsForType(def.type) : [];
        const operatorOptions = operators.map((op) => ({ value: op.value, label: op.label }));
        const isNullary = isNullaryOperator(cond.operator);
        const isMulti = isMultiValueOperator(cond.operator);

        return (
          <div key={cond.id} className="flex items-center gap-2">
            {/* 字段选择 */}
            <Combobox
              value={cond.field}
              onChange={(val) => {
                updateCondition(cond.id, { field: val, operator: "", value: "" });
              }}
              options={fieldOptions}
              placeholder="字段"
              size="sm"
              className="w-[140px]"
            />

            {/* 操作符选择 */}
            <Combobox
              value={cond.operator}
              onChange={(val) => handleOperatorChange(cond.id, cond.value, val)}
              options={operatorOptions}
              placeholder="操作符"
              searchable={false}
              size="sm"
              className="w-[150px]"
            />

            {/* 值输入 */}
            {!isNullary && isMulti && (
              <MultiFilterValueInput
                field={cond.field}
                value={Array.isArray(cond.value) ? cond.value : []}
                onChange={(val) => updateCondition(cond.id, { value: val })}
                fieldDef={def}
                fetchFieldValues={fetchFieldValues}
              />
            )}
            {!isNullary && !isMulti && (
              <FilterValueInput
                field={cond.field}
                value={typeof cond.value === "string" ? cond.value : (cond.value[0] ?? "")}
                onChange={(val) => updateCondition(cond.id, { value: val })}
                fieldDef={def}
                fetchFieldValues={fetchFieldValues}
              />
            )}

            {/* 删除按钮 */}
            <button
              type="button"
              className={cn(
                "shrink-0 p-1 rounded-md text-white/30 transition-colors",
                "hover:text-white/60 hover:bg-white/5",
              )}
              onClick={() => removeCondition(cond.id)}
            >
              <X size={ICON_SIZE.sm} />
            </button>
          </div>
        );
      })}

      {/* 底部操作栏 */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          className="text-xs text-white/40 hover:text-white/70 flex items-center gap-1 transition-colors"
          onClick={addCondition}
        >
          <Plus size={ICON_SIZE.xs} />
          添加条件
        </button>
        <button
          type="button"
          className="text-xs text-white/30 hover:text-white/60 transition-colors"
          onClick={clearAll}
        >
          清空所有
        </button>
      </div>
    </div>
  );
}
