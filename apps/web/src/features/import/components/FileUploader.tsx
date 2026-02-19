/**
 * 拖拽上传组件。
 * 支持 CSV/XLSX 文件拖拽或点击选择。
 */

import { useState, useRef, useCallback } from "react";
import { Upload, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";
import { ICON_SIZE } from "@/lib/icon-sizes";

/** 允许的文件类型 */
const ACCEPTED_TYPES = [
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];

/** 允许的扩展名 */
const ACCEPTED_EXTENSIONS = ".csv,.xlsx,.xls";

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  /** 当前已选文件（由父级管理） */
  selectedFile?: File | null;
}

export function FileUploader({
  onFileSelect,
  selectedFile,
}: FileUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /** 验证文件类型 */
  const isValidFile = useCallback((file: File): boolean => {
    if (ACCEPTED_TYPES.includes(file.type)) return true;
    // 兜底：检查扩展名（部分浏览器 MIME 类型不准确）
    const ext = file.name.split(".").pop()?.toLowerCase();
    return ext === "csv" || ext === "xlsx" || ext === "xls";
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      if (!isValidFile(file)) return;
      onFileSelect(file);
    },
    [isValidFile, onFileSelect],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // 重置 input 以允许重新选择同一文件
      e.target.value = "";
    },
    [handleFile],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "glass-card flex cursor-pointer flex-col items-center justify-center gap-4 px-6 py-12 transition-all",
        isDragOver &&
          "border-[var(--color-accent-primary)] bg-[rgba(99,102,241,0.08)]",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        onChange={handleInputChange}
        className="hidden"
        aria-label="选择文件"
      />

      {selectedFile ? (
        <>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10">
            <FileSpreadsheet
              size={ICON_SIZE["3xl"]}
              className="text-indigo-400"
            />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-white">
              {selectedFile.name}
            </p>
            <p className="mt-1 text-xs text-white/40">
              {(selectedFile.size / 1024).toFixed(1)} KB - 点击或拖拽更换文件
            </p>
          </div>
        </>
      ) : (
        <>
          <div
            className={cn(
              "flex h-14 w-14 items-center justify-center rounded-2xl transition-colors",
              isDragOver ? "bg-indigo-500/20" : "bg-white/5",
            )}
          >
            <Upload
              size={ICON_SIZE["3xl"]}
              className={cn(
                "transition-colors",
                isDragOver ? "text-indigo-400" : "text-white/40",
              )}
            />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-white/80">
              拖拽文件到此处，或点击选择
            </p>
            <p className="mt-1 text-xs text-white/40">支持 CSV、XLSX 格式</p>
          </div>
        </>
      )}
    </div>
  );
}
