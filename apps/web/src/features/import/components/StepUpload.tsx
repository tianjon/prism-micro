/**
 * 步骤 1：文件上传。
 *
 * 三种状态：
 * - 空闲：文件选择 + 来源输入 + 上传按钮
 * - 上传中：文件摘要 + 实时进度条 + 状态文字
 * - 上传完成：成功指示 + 短暂停留后自动进入下一步
 */

import { useState, useCallback } from "react";
import { Upload, Loader2, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { FileUploader } from "./FileUploader";
import type { UploadResponse } from "@/api/types";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface StepUploadProps {
  uploading: boolean;
  uploadProgress: number;
  uploadResult: UploadResponse | null;
  onUpload: (file: File, source: string) => Promise<void>;
}

export function StepUpload({
  uploading,
  uploadProgress,
  uploadResult,
  onUpload,
}: StepUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState("");

  const handleSubmit = useCallback(async () => {
    if (!file || !source.trim()) return;
    await onUpload(file, source.trim());
  }, [file, source, onUpload]);

  // 上传中 / 上传完成：聚焦的进度视图
  if (uploading && file) {
    const isComplete = uploadResult !== null;
    const isProcessing = !isComplete && uploadProgress >= 100;
    const progress = Math.min(uploadProgress, 100);

    return (
      <div className="animate-fade-in space-y-6">
        {/* 文件信息卡片 */}
        <div className="glass-card flex items-center gap-4 px-6 py-5">
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors",
              isComplete ? "bg-emerald-500/10" : "bg-indigo-500/10",
            )}
          >
            {isComplete ? (
              <CheckCircle2
                size={ICON_SIZE["2xl"]}
                className="text-emerald-400"
              />
            ) : (
              <FileSpreadsheet
                size={ICON_SIZE["2xl"]}
                className="text-indigo-400"
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">
              {file.name}
            </p>
            <p className="text-xs text-white/40">{formatBytes(file.size)}</p>
          </div>
        </div>

        {/* 进度条 */}
        <div>
          <div className="mb-2 flex items-center justify-between text-xs">
            <span
              className={cn(
                "flex items-center gap-1.5",
                isComplete ? "text-emerald-400" : "text-white/50",
              )}
            >
              {isComplete ? (
                <>
                  <CheckCircle2 size={ICON_SIZE.sm} />
                  上传成功
                </>
              ) : isProcessing ? (
                <>
                  <Loader2
                    size={ICON_SIZE.sm}
                    className="animate-spin-slow"
                  />
                  服务端处理中...
                </>
              ) : (
                <>
                  <Loader2
                    size={ICON_SIZE.sm}
                    className="animate-spin-slow"
                  />
                  上传中...
                </>
              )}
            </span>
            <span className="text-white/40">{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/5">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                isComplete
                  ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                  : "bg-gradient-to-r from-indigo-500 to-purple-500",
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          {isComplete && (
            <p className="mt-3 text-center text-xs text-white/30">
              即将进入数据预览...
            </p>
          )}
        </div>
      </div>
    );
  }

  // 空闲状态：文件选择 + 来源输入 + 上传按钮
  return (
    <div className="animate-fade-in space-y-6">
      <FileUploader onFileSelect={setFile} selectedFile={file} />

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-white/60">
          数据来源标识
        </label>
        <input
          type="text"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="例如：dongchedi、weibo..."
          className="glass-input h-10 px-3 py-2 text-sm"
        />
        <p className="text-xs text-white/30">
          用于标识导入数据的来源渠道，将作为 Voice 记录的 source 字段
        </p>
      </div>

      <button
        onClick={() => void handleSubmit()}
        disabled={!file || !source.trim() || uploading}
        className="glass-btn-primary flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Upload size={ICON_SIZE.md} />
        上传文件
      </button>
    </div>
  );
}
