/**
 * 数据管理各 Tab 的字段元信息定义。
 * 用于 FilterPanel 和排序 Combobox。
 */

import type { ComboboxOption } from "@/components/Combobox";

export interface FieldDef {
  field: string;
  label: string;
  type: "string" | "number" | "date" | "enum" | "json";
  options?: ComboboxOption[];
  sortable?: boolean;
}

/** 操作符定义 */
export interface OperatorDef {
  value: string;
  label: string;
}

/** 各数据类型支持的操作符（标签格式：PG 操作符 + 中文说明） */
const STRING_OPS: OperatorDef[] = [
  { value: "eq", label: "= 等于" },
  { value: "ne", label: "!= 不等于" },
  { value: "contains", label: "LIKE 包含" },
  { value: "starts_with", label: "LIKE 开头匹配" },
  { value: "in", label: "IN 包含于" },
  { value: "is_null", label: "IS NULL" },
  { value: "is_not_null", label: "IS NOT NULL" },
];

const NUMBER_OPS: OperatorDef[] = [
  { value: "eq", label: "= 等于" },
  { value: "ne", label: "!= 不等于" },
  { value: "gt", label: "> 大于" },
  { value: "gte", label: ">= 大于等于" },
  { value: "lt", label: "< 小于" },
  { value: "lte", label: "<= 小于等于" },
  { value: "is_null", label: "IS NULL" },
  { value: "is_not_null", label: "IS NOT NULL" },
];

const DATE_OPS: OperatorDef[] = [
  { value: "eq", label: "= 等于" },
  { value: "gt", label: "> 晚于" },
  { value: "gte", label: ">= 不早于" },
  { value: "lt", label: "< 早于" },
  { value: "lte", label: "<= 不晚于" },
];

const ENUM_OPS: OperatorDef[] = [
  { value: "eq", label: "= 等于" },
  { value: "ne", label: "!= 不等于" },
  { value: "in", label: "IN 包含于" },
];

const JSON_OPS: OperatorDef[] = [
  { value: "is_null", label: "IS NULL" },
  { value: "is_not_null", label: "IS NOT NULL" },
];

/** 根据字段类型获取可用操作符 */
export function getOperatorsForType(type: FieldDef["type"]): OperatorDef[] {
  switch (type) {
    case "string":
      return STRING_OPS;
    case "number":
      return NUMBER_OPS;
    case "date":
      return DATE_OPS;
    case "enum":
      return ENUM_OPS;
    case "json":
      return JSON_OPS;
  }
}

/** 是否为无需值输入的操作符 */
export function isNullaryOperator(op: string): boolean {
  return op === "is_null" || op === "is_not_null";
}

/** 是否为多值操作符（值为数组） */
export function isMultiValueOperator(op: string): boolean {
  return op === "in";
}

// ---- 批次字段定义 ----

const BATCH_STATUS_OPTIONS: ComboboxOption[] = [
  { value: "pending", label: "待处理" },
  { value: "prompt_ready", label: "提示词就绪" },
  { value: "mapping", label: "映射中" },
  { value: "generating_mapping", label: "映射生成中" },
  { value: "importing", label: "导入中" },
  { value: "processing", label: "处理中" },
  { value: "completed", label: "已完成" },
  { value: "partially_completed", label: "部分完成" },
  { value: "failed", label: "失败" },
];

export const BATCH_FIELDS: FieldDef[] = [
  { field: "source", label: "数据来源", type: "string", sortable: true },
  { field: "file_name", label: "文件名", type: "string" },
  { field: "status", label: "状态", type: "enum", options: BATCH_STATUS_OPTIONS, sortable: true },
  { field: "total_count", label: "总数", type: "number", sortable: true },
  { field: "new_count", label: "新增数", type: "number" },
  { field: "duplicate_count", label: "重复数", type: "number" },
  { field: "failed_count", label: "失败数", type: "number" },
  { field: "file_size_bytes", label: "文件大小", type: "number" },
  { field: "mapping_name", label: "映射模板", type: "string" },
  { field: "error_message", label: "错误信息", type: "string" },
  { field: "created_at", label: "创建时间", type: "date", sortable: true },
  { field: "completed_at", label: "完成时间", type: "date" },
  { field: "updated_at", label: "更新时间", type: "date", sortable: true },
];

// ---- 映射字段定义 ----

const FORMAT_OPTIONS: ComboboxOption[] = [
  { value: "csv", label: "CSV" },
  { value: "excel", label: "Excel" },
  { value: "json", label: "JSON" },
];

const CREATED_BY_OPTIONS: ComboboxOption[] = [
  { value: "llm", label: "LLM 生成" },
  { value: "user", label: "用户创建" },
  { value: "llm_user_confirmed", label: "LLM+用户确认" },
];

export const MAPPING_FIELDS: FieldDef[] = [
  { field: "name", label: "模板名称", type: "string" },
  { field: "source_format", label: "文件格式", type: "enum", options: FORMAT_OPTIONS, sortable: true },
  { field: "created_by", label: "创建方式", type: "enum", options: CREATED_BY_OPTIONS },
  { field: "confidence", label: "置信度", type: "number", sortable: true },
  { field: "usage_count", label: "使用次数", type: "number", sortable: true },
  { field: "column_hash", label: "列哈希", type: "string" },
  { field: "created_at", label: "创建时间", type: "date", sortable: true },
  { field: "updated_at", label: "更新时间", type: "date", sortable: true },
];

// ---- Voice 字段定义 ----

const PROCESSED_STATUS_OPTIONS: ComboboxOption[] = [
  { value: "pending", label: "待处理" },
  { value: "processing", label: "处理中" },
  { value: "completed", label: "已完成" },
  { value: "failed", label: "失败" },
];

/** Voice 基础字段（不含动态元数据） */
export const VOICE_BASE_FIELDS: FieldDef[] = [
  { field: "raw_text", label: "原始文本", type: "string" },
  { field: "source", label: "数据来源", type: "string", sortable: true },
  { field: "processed_status", label: "处理状态", type: "enum", options: PROCESSED_STATUS_OPTIONS, sortable: true },
  { field: "content_hash", label: "内容哈希", type: "string" },
  { field: "source_key", label: "来源标识", type: "string" },
  { field: "batch_id", label: "批次 ID", type: "string" },
  { field: "processing_error", label: "处理错误", type: "string" },
  { field: "created_at", label: "创建时间", type: "date", sortable: true },
  { field: "updated_at", label: "更新时间", type: "date", sortable: true },
];

/** 静态导出（向后兼容，无元数据键时使用） */
export const VOICE_FIELDS: FieldDef[] = VOICE_BASE_FIELDS;

/** 将元数据键展开为可筛选字段 */
export function buildVoiceFields(metadataKeys: string[]): FieldDef[] {
  const metaFields: FieldDef[] = metadataKeys.map((key) => ({
    field: `metadata.${key}`,
    label: `metadata.${key}`,
    type: "string" as const,
  }));
  return [...VOICE_BASE_FIELDS, ...metaFields];
}
