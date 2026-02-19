/**
 * 列可见性控制面板。
 * AG Grid Community 无 Column Tool Panel，此组件为自建替代。
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Columns3 } from "lucide-react";
import { ICON_SIZE } from "@/lib/icon-sizes";
import type { GridApi, ColDef, ColGroupDef } from "ag-grid-community";

interface ColumnGroup {
  groupName: string;
  columns: { colId: string; headerName: string; visible: boolean }[];
}

interface ColumnVisibilityPanelProps {
  gridApi: GridApi | null;
  columnDefs: (ColDef | ColGroupDef)[];
  storageKey: string;
}

/** 从 columnDefs 提取分组结构 */
function extractGroups(
  columnDefs: (ColDef | ColGroupDef)[],
  gridApi: GridApi | null,
): ColumnGroup[] {
  const groups: ColumnGroup[] = [];

  for (const def of columnDefs) {
    if ("children" in def && def.children) {
      const groupDef = def as ColGroupDef;
      const columns = groupDef.children
        .filter((child): child is ColDef => "field" in child || "colId" in child)
        .filter((child) => child.colId !== "actions" && child.field !== undefined)
        .map((child) => {
          const colId = child.colId ?? child.field ?? "";
          const visible = gridApi
            ? gridApi.getColumn(colId)?.isVisible() ?? true
            : !child.hide;
          return {
            colId,
            headerName: (child.headerName as string) ?? colId,
            visible,
          };
        });
      if (columns.length > 0) {
        groups.push({ groupName: groupDef.headerName ?? "其他", columns });
      }
    }
  }

  return groups;
}

export function ColumnVisibilityPanel({
  gridApi,
  columnDefs,
  storageKey,
}: ColumnVisibilityPanelProps) {
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<ColumnGroup[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  // 同步列可见性状态
  const syncGroups = useCallback(() => {
    setGroups(extractGroups(columnDefs, gridApi));
  }, [columnDefs, gridApi]);

  useEffect(() => {
    syncGroups();
  }, [syncGroups]);

  // 从 localStorage 恢复
  useEffect(() => {
    if (!gridApi) return;
    const key = `prism:columns:${storageKey}`;
    const saved = localStorage.getItem(key);
    if (!saved) return;
    try {
      const visibility = JSON.parse(saved) as Record<string, boolean>;
      for (const [colId, visible] of Object.entries(visibility)) {
        gridApi.setColumnsVisible([colId], visible);
      }
      syncGroups();
    } catch {
      // localStorage 数据损坏，忽略
    }
  }, [gridApi, storageKey, syncGroups]);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggleColumn = (colId: string, visible: boolean) => {
    if (!gridApi) return;
    gridApi.setColumnsVisible([colId], visible);
    persist();
    syncGroups();
  };

  const toggleGroup = (groupIndex: number, visible: boolean) => {
    if (!gridApi || !groups[groupIndex]) return;
    const colIds = groups[groupIndex].columns.map((c) => c.colId);
    gridApi.setColumnsVisible(colIds, visible);
    persist();
    syncGroups();
  };

  const persist = () => {
    if (!gridApi) return;
    const key = `prism:columns:${storageKey}`;
    const visibility: Record<string, boolean> = {};
    const currentGroups = extractGroups(columnDefs, gridApi);
    for (const group of currentGroups) {
      for (const col of group.columns) {
        visibility[col.colId] = col.visible;
      }
    }
    localStorage.setItem(key, JSON.stringify(visibility));
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => {
          if (!open) syncGroups();
          setOpen(!open);
        }}
        className="glass-btn-ghost flex items-center gap-1.5 px-3 py-1.5 text-xs"
        title="列可见性"
      >
        <Columns3 size={ICON_SIZE.md} />
        <span>列</span>
      </button>

      {open && (
        <div className="glass-panel absolute right-0 top-full z-[var(--z-dropdown)] mt-2 w-60 max-h-[60vh] overflow-y-auto p-3">
          {groups.map((group, gi) => {
            const allVisible = group.columns.every((c) => c.visible);
            const someVisible = group.columns.some((c) => c.visible);
            return (
              <div key={group.groupName} className="mb-3 last:mb-0">
                <label className="flex cursor-pointer items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-1.5">
                  <input
                    type="checkbox"
                    checked={allVisible}
                    ref={(el) => {
                      if (el) el.indeterminate = someVisible && !allVisible;
                    }}
                    onChange={(e) => toggleGroup(gi, e.target.checked)}
                    className="accent-[var(--color-accent-primary)]"
                  />
                  {group.groupName}
                </label>
                <div className="ml-4 space-y-1">
                  {group.columns.map((col) => (
                    <label
                      key={col.colId}
                      className="flex cursor-pointer items-center gap-2 text-xs text-white/60 hover:text-white/80"
                    >
                      <input
                        type="checkbox"
                        checked={col.visible}
                        onChange={(e) => toggleColumn(col.colId, e.target.checked)}
                        className="accent-[var(--color-accent-primary)]"
                      />
                      {col.headerName}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
