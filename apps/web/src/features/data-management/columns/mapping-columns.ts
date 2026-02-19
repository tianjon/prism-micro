/**
 * 映射模板列表 AG Grid 列定义。
 */

import type { ColDef, ColGroupDef } from "ag-grid-community";
import {
  ConfidenceCellRenderer,
  DateCellRenderer,
  JsonPreviewCellRenderer,
  ActionCellRenderer,
} from "../components/cell-renderers";

export const mappingColumnDefs: (ColDef | ColGroupDef)[] = [
  {
    headerName: "基本信息",
    children: [
      {
        field: "name",
        headerName: "名称",
        minWidth: 160,
        flex: 1,
        sortable: true,
        cellClass: "text-white/90 font-medium",
      },
      {
        field: "source_format",
        headerName: "格式",
        width: 90,
        sortable: true,
        cellClass: "uppercase text-white/60 text-xs",
      },
      { field: "created_by", headerName: "创建者", width: 120 },
    ],
  },
  {
    headerName: "质量指标",
    children: [
      {
        field: "confidence",
        headerName: "置信度",
        width: 100,
        sortable: true,
        cellRenderer: ConfidenceCellRenderer,
      },
      {
        field: "usage_count",
        headerName: "使用次数",
        width: 100,
        sortable: true,
        cellClass: "tabular-nums",
      },
    ],
  },
  {
    headerName: "数据",
    children: [
      { field: "column_hash", headerName: "列哈希", width: 120 },
      {
        field: "column_mappings",
        headerName: "列映射",
        width: 200,
        hide: true,
        cellRenderer: JsonPreviewCellRenderer,
      },
      {
        field: "sample_data",
        headerName: "样本数据",
        width: 200,
        hide: true,
        cellRenderer: JsonPreviewCellRenderer,
      },
    ],
  },
  {
    headerName: "时间",
    children: [
      {
        field: "created_at",
        headerName: "创建时间",
        width: 150,
        sortable: true,
        cellRenderer: DateCellRenderer,
      },
      {
        field: "updated_at",
        headerName: "更新时间",
        width: 150,
        hide: true,
        cellRenderer: DateCellRenderer,
      },
    ],
  },
  {
    colId: "actions",
    headerName: "",
    width: 80,
    pinned: "right",
    sortable: false,
    cellRenderer: ActionCellRenderer,
    suppressHeaderMenuButton: true,
  },
];
