/**
 * 批次列表 AG Grid 列定义。
 */

import type { ColDef, ColGroupDef } from "ag-grid-community";
import {
  StatusCellRenderer,
  DateCellRenderer,
  FileSizeCellRenderer,
  TruncatedTextCellRenderer,
  JsonPreviewCellRenderer,
  ActionCellRenderer,
} from "../components/cell-renderers";

export const batchColumnDefs: (ColDef | ColGroupDef)[] = [
  {
    headerName: "基本信息",
    children: [
      {
        field: "file_name",
        headerName: "文件名",
        minWidth: 180,
        flex: 1,
        sortable: true,
        cellClass: "text-white/90 font-medium",
      },
      { field: "source", headerName: "来源", width: 120, sortable: true },
      {
        field: "status",
        headerName: "状态",
        width: 120,
        sortable: true,
        cellRenderer: StatusCellRenderer,
      },
    ],
  },
  {
    headerName: "统计数据",
    children: [
      {
        field: "total_count",
        headerName: "总数",
        width: 90,
        sortable: true,
        cellClass: "tabular-nums",
      },
      {
        field: "new_count",
        headerName: "新增",
        width: 80,
        cellClass: "tabular-nums text-green-400/80",
      },
      {
        field: "duplicate_count",
        headerName: "重复",
        width: 80,
        cellClass: "tabular-nums text-amber-400/80",
      },
      {
        field: "failed_count",
        headerName: "失败",
        width: 80,
        cellClass: "tabular-nums text-red-400/80",
      },
    ],
  },
  {
    headerName: "文件",
    children: [
      {
        field: "file_size_bytes",
        headerName: "大小",
        width: 100,
        cellRenderer: FileSizeCellRenderer,
      },
      { field: "file_hash", headerName: "哈希", width: 120, hide: true },
      {
        field: "dedup_columns",
        headerName: "去重列",
        width: 140,
        hide: true,
        cellRenderer: JsonPreviewCellRenderer,
      },
    ],
  },
  {
    headerName: "映射",
    children: [
      { field: "mapping_name", headerName: "映射模板", width: 140 },
      { field: "mapping_id", headerName: "映射 ID", width: 120, hide: true },
    ],
  },
  {
    headerName: "提示词",
    children: [
      {
        field: "prompt_text",
        headerName: "提示词",
        width: 200,
        hide: true,
        cellRenderer: TruncatedTextCellRenderer,
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
        field: "completed_at",
        headerName: "完成时间",
        width: 150,
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
    headerName: "错误",
    children: [
      {
        field: "error_message",
        headerName: "错误信息",
        width: 200,
        hide: true,
        cellRenderer: TruncatedTextCellRenderer,
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
