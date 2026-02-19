/**
 * AG Grid Liquid Glass 主题配置。
 * 基于 themeQuartz + colorSchemeDark，对齐 globals.css 设计系统。
 */

import { colorSchemeDark, themeQuartz } from "ag-grid-community";

export const liquidGlassTheme = themeQuartz.withPart(colorSchemeDark).withParams({
  backgroundColor: "transparent",
  headerBackgroundColor: "rgba(255,255,255,0.03)",
  rowHoverColor: "rgba(255,255,255,0.04)",
  selectedRowBackgroundColor: "rgba(99,102,241,0.12)",
  borderColor: "rgba(255,255,255,0.08)",
  foregroundColor: "rgba(255,255,255,0.8)",
  headerTextColor: "rgba(255,255,255,0.5)",
  fontFamily: "inherit",
  fontSize: 13,
  headerFontSize: 11,
  cellHorizontalPadding: 16,
  rowBorder: { style: "solid", width: 1, color: "rgba(255,255,255,0.04)" },
  columnBorder: false,
  wrapperBorderRadius: 0,
  headerColumnResizeHandleColor: "rgba(255,255,255,0.15)",
  oddRowBackgroundColor: "transparent",
  spacing: 8,
  rowVerticalPaddingScale: 1,
});
