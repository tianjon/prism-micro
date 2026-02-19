/**
 * Voice 列表 AG Grid 列定义。
 */

import type { ColDef, ColGroupDef } from "ag-grid-community";
import {
  StatusCellRenderer,
  DateCellRenderer,
  TruncatedTextCellRenderer,
  JsonPreviewCellRenderer,
  ActionCellRenderer,
} from "../components/cell-renderers";

export const voiceColumnDefs: (ColDef | ColGroupDef)[] = [
  {
    headerName: "基本信息",
    children: [
      {
        field: "raw_text",
        headerName: "文本摘要",
        minWidth: 250,
        flex: 1,
        cellRenderer: TruncatedTextCellRenderer,
      },
      { field: "source", headerName: "来源", width: 120, sortable: true },
    ],
  },
  {
    headerName: "处理信息",
    children: [
      {
        field: "processed_status",
        headerName: "处理状态",
        width: 110,
        sortable: true,
        cellRenderer: StatusCellRenderer,
      },
      { field: "content_hash", headerName: "内容哈希", width: 120, hide: true },
      { field: "source_key", headerName: "来源键", width: 120, hide: true },
    ],
  },
  {
    headerName: "关联",
    children: [
      { field: "batch_id", headerName: "批次 ID", width: 120, hide: true },
    ],
  },
  {
    headerName: "元数据",
    children: [
      {
        field: "metadata",
        headerName: "元数据",
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
