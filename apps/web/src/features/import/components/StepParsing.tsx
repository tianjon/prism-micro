/**
 * 步骤 2：文件解析。
 * 展示上传接口同步返回的 file_info + AI 分析中动画。
 */

import { Loader2, FileText, HardDrive, Rows3, FileCode, FileType } from "lucide-react";
import { ICON_SIZE } from "@/lib/icon-sizes";
import type { UploadResponse } from "@/api/types";

/** 格式化文件大小 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface StepParsingProps {
  uploadResult: UploadResponse | null;
}

export function StepParsing({ uploadResult }: StepParsingProps) {
  const fileInfo = uploadResult?.file_info;

  return (
    <div className="animate-fade-in space-y-6">
      {/* 文件信息卡片 */}
      {fileInfo && (
        <div className="glass-card px-6 py-5">
          <h3 className="mb-4 text-sm font-semibold text-white/70">
            文件信息
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5">
                <FileText size={ICON_SIZE.md} className="text-white/40" />
              </div>
              <div>
                <p className="text-xs text-white/40">文件名</p>
                <p className="text-sm font-medium text-white/80">
                  {fileInfo.file_name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5">
                <HardDrive size={ICON_SIZE.md} className="text-white/40" />
              </div>
              <div>
                <p className="text-xs text-white/40">文件大小</p>
                <p className="text-sm font-medium text-white/80">
                  {formatBytes(fileInfo.file_size_bytes)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5">
                <Rows3 size={ICON_SIZE.md} className="text-white/40" />
              </div>
              <div>
                <p className="text-xs text-white/40">总行数</p>
                <p className="text-sm font-medium text-white/80">
                  {fileInfo.total_rows.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5">
                <FileCode size={ICON_SIZE.md} className="text-white/40" />
              </div>
              <div>
                <p className="text-xs text-white/40">检测编码</p>
                <p className="text-sm font-medium text-white/80">
                  {fileInfo.detected_encoding}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5">
                <FileType size={ICON_SIZE.md} className="text-white/40" />
              </div>
              <div>
                <p className="text-xs text-white/40">文件格式</p>
                <p className="text-sm font-medium text-white/80 uppercase">
                  {fileInfo.detected_format}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI 分析中动画 */}
      <div className="glass-panel flex items-center gap-4 px-6 py-5">
        <Loader2
          size={ICON_SIZE.xl}
          className="animate-spin-slow shrink-0 text-indigo-400"
        />
        <div>
          <p className="text-sm font-medium text-white/70">
            AI 正在分析字段映射...
          </p>
          <p className="mt-1 text-xs text-white/40">
            正在采样数据并使用 LLM 识别列映射关系
          </p>
        </div>
      </div>
    </div>
  );
}
