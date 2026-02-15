/**
 * 数据导入页面 (/voc/import)。
 * 三步骤导入向导：上传 → 映射预览 → 导入/结果。
 * Step 2/3 由 batch status 轮询自动驱动。
 */

import { useState, useEffect, useCallback } from "react";
import {
  Upload,
  TableProperties,
  Play,
  Check,
  ChevronRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { PageContainer } from "@/components/PageContainer";
import { PageHeader } from "@/components/PageHeader";
import { FileUploader } from "../components/FileUploader";
import { useImport } from "../hooks/use-import";

// ---- 目标字段选项 ----

const TARGET_FIELD_OPTIONS: { value: string | null; label: string }[] = [
  { value: "raw_text", label: "raw_text（原始文本）" },
  { value: "source", label: "source（数据来源）" },
  { value: "source_key", label: "source_key（来源标识）" },
  { value: "metadata", label: "metadata（元数据）" },
  { value: null, label: "跳过此列" },
];

// ---- 步骤配置 ----

interface StepInfo {
  label: string;
  icon: React.ReactNode;
}

const STEPS: StepInfo[] = [
  { label: "上传文件", icon: <Upload size={ICON_SIZE.md} /> },
  { label: "映射预览", icon: <TableProperties size={ICON_SIZE.md} /> },
  { label: "导入结果", icon: <Play size={ICON_SIZE.md} /> },
];

// ---- 步骤指示器 ----

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="mb-8 flex items-center justify-center gap-2">
      {STEPS.map((s, idx) => {
        const stepNum = idx + 1;
        const isActive = stepNum === currentStep;
        const isCompleted = stepNum < currentStep;

        return (
          <div key={s.label} className="flex items-center gap-2">
            <div
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all",
                isActive && "bg-indigo-500/20 text-indigo-400",
                isCompleted && "bg-green-500/10 text-green-400",
                !isActive && !isCompleted && "bg-white/5 text-white/30",
              )}
            >
              {isCompleted ? (
                <Check size={ICON_SIZE.md} />
              ) : (
                <span>{s.icon}</span>
              )}
              <span className="hidden sm:inline">{s.label}</span>
              <span className="sm:hidden">{stepNum}</span>
            </div>
            {idx < STEPS.length - 1 && (
              <ChevronRight size={ICON_SIZE.md} className="text-white/20" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---- 步骤 1：上传 ----

function StepUpload({
  uploading,
  onUpload,
}: {
  uploading: boolean;
  onUpload: (file: File, source: string) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState("");

  const handleSubmit = useCallback(async () => {
    if (!file || !source.trim()) return;
    await onUpload(file, source.trim());
  }, [file, source, onUpload]);

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
        className="glass-btn-primary flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {uploading ? (
          <>
            <Loader2 size={ICON_SIZE.md} className="animate-spin-slow" />
            上传中...
          </>
        ) : (
          <>
            <Upload size={ICON_SIZE.md} />
            上传文件
          </>
        )}
      </button>
    </div>
  );
}

// ---- 步骤 2：映射预览（状态驱动） ----

function StepMapping({
  batchStatus,
  mappingPreview,
  loadingMapping,
  onLoadPreview,
  onConfirm,
}: {
  batchStatus: ReturnType<typeof useImport>["batchStatus"];
  mappingPreview: ReturnType<typeof useImport>["mappingPreview"];
  loadingMapping: boolean;
  onLoadPreview: () => Promise<void>;
  onConfirm: (mappings: Record<string, string | null>) => Promise<void>;
}) {
  const [editedMappings, setEditedMappings] = useState<
    Record<string, string | null>
  >({});
  const status = batchStatus?.status;

  // status 为 mapping 时加载映射预览
  useEffect(() => {
    if (status === "mapping") {
      void onLoadPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // 初始化编辑映射
  useEffect(() => {
    if (!mappingPreview) return;
    const initial: Record<string, string | null> = {};
    for (const col of mappingPreview.column_mappings) {
      initial[col.source_column] = col.target_field;
    }
    setEditedMappings(initial);
  }, [mappingPreview]);

  const handleFieldChange = useCallback(
    (sourceColumn: string, value: string) => {
      setEditedMappings((prev) => ({
        ...prev,
        [sourceColumn]: value === "__null__" ? null : value,
      }));
    },
    [],
  );

  const handleConfirm = useCallback(async () => {
    await onConfirm(editedMappings);
  }, [editedMappings, onConfirm]);

  // pending / parsing 阶段：加载动画
  if (!status || status === "pending" || status === "parsing") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <Loader2
          size={ICON_SIZE["3xl"]}
          className="animate-spin-slow text-indigo-400"
        />
        <p className="text-sm text-white/50">AI 正在分析字段映射...</p>
      </div>
    );
  }

  // mapping 状态但预览还在加载
  if (loadingMapping || !mappingPreview) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <Loader2
          size={ICON_SIZE["3xl"]}
          className="animate-spin-slow text-indigo-400"
        />
        <p className="text-sm text-white/50">正在加载映射预览...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* 总体置信度 */}
      <div className="glass-panel flex items-center justify-between px-5 py-3">
        <span className="text-sm text-white/60">LLM 映射置信度</span>
        <span
          className={cn(
            "text-sm font-semibold",
            mappingPreview.overall_confidence >= 0.8
              ? "text-green-400"
              : mappingPreview.overall_confidence >= 0.5
                ? "text-amber-400"
                : "text-red-400",
          )}
        >
          {(mappingPreview.overall_confidence * 100).toFixed(0)}%
        </span>
      </div>

      {/* 映射表格 */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-xs text-white/40">
                <th className="px-4 py-3 font-medium">源列名</th>
                <th className="px-4 py-3 font-medium">映射目标</th>
                <th className="px-4 py-3 font-medium">置信度</th>
                <th className="px-4 py-3 font-medium">样本值</th>
              </tr>
            </thead>
            <tbody>
              {mappingPreview.column_mappings.map((col) => (
                <tr
                  key={col.source_column}
                  className="border-b border-white/5 last:border-b-0"
                >
                  <td className="px-4 py-3 font-mono text-xs text-white/80">
                    {col.source_column}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={
                        editedMappings[col.source_column] === null
                          ? "__null__"
                          : (editedMappings[col.source_column] ?? "__null__")
                      }
                      onChange={(e) =>
                        handleFieldChange(col.source_column, e.target.value)
                      }
                      className="glass-input h-8 cursor-pointer px-3 text-xs"
                    >
                      {TARGET_FIELD_OPTIONS.map((opt) => (
                        <option
                          key={opt.value ?? "__null__"}
                          value={opt.value ?? "__null__"}
                        >
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                        col.confidence >= 0.8
                          ? "bg-green-500/10 text-green-400"
                          : col.confidence >= 0.5
                            ? "bg-amber-500/10 text-amber-400"
                            : "bg-red-500/10 text-red-400",
                      )}
                    >
                      {(col.confidence * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="max-w-[200px] px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {col.sample_values.slice(0, 3).map((val, i) => (
                        <span
                          key={i}
                          className="inline-block max-w-[150px] truncate rounded bg-white/5 px-1.5 py-0.5 text-xs text-white/50"
                          title={val}
                        >
                          {val}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 未映射列提示 */}
      {mappingPreview.unmapped_columns.length > 0 && (
        <div className="glass-panel flex items-start gap-3 px-5 py-3">
          <AlertCircle
            size={ICON_SIZE.lg}
            className="mt-0.5 shrink-0 text-amber-400"
          />
          <div>
            <p className="text-sm font-medium text-amber-400">
              以下列未被映射，将被跳过
            </p>
            <p className="mt-1 text-xs text-white/40">
              {mappingPreview.unmapped_columns.join("、")}
            </p>
          </div>
        </div>
      )}

      <button
        onClick={() => void handleConfirm()}
        className="glass-btn-primary flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm"
      >
        <Check size={ICON_SIZE.md} />
        确认映射
      </button>
    </div>
  );
}

// ---- 步骤 3：导入结果（状态驱动） ----

function StepResult({
  uploadResult,
  batchStatus,
  processing,
  onTriggerPipeline,
}: {
  uploadResult: ReturnType<typeof useImport>["uploadResult"];
  batchStatus: ReturnType<typeof useImport>["batchStatus"];
  processing: boolean;
  onTriggerPipeline: () => Promise<void>;
}) {
  const progress = batchStatus?.progress;
  const status = batchStatus?.status;

  const processedCount = progress
    ? progress.new_count + progress.duplicate_count
    : 0;
  const totalCount = progress?.total_count ?? 0;
  const progressPercent =
    totalCount > 0 ? Math.round((processedCount / totalCount) * 100) : 0;

  const isCompleted = status === "completed";
  const isPartial = status === "partially_completed";
  const isFailed = status === "failed";

  return (
    <div className="animate-fade-in space-y-6">
      {/* 批次信息 */}
      {uploadResult && (
        <div className="glass-panel px-5 py-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-white/40">文件名</p>
              <p className="mt-1 text-sm font-medium text-white/80">
                {uploadResult.file_info.file_name}
              </p>
            </div>
            <div>
              <p className="text-xs text-white/40">总行数</p>
              <p className="mt-1 text-sm font-medium text-white/80">
                {uploadResult.file_info.total_rows}
              </p>
            </div>
            <div>
              <p className="text-xs text-white/40">批次 ID</p>
              <p className="mt-1 font-mono text-xs text-white/50">
                {uploadResult.batch_id}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 导入中 */}
      {status === "importing" && (
        <div className="glass-card space-y-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <Loader2
              size={ICON_SIZE.xl}
              className="animate-spin-slow text-indigo-400"
            />
            <span className="text-sm font-medium text-white/80">
              正在导入数据...
            </span>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between text-xs text-white/40">
              <span>
                已处理 {processedCount} / {totalCount}
              </span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 处理中但尚未获取到状态 */}
      {processing && !batchStatus && (
        <div className="glass-card flex items-center justify-center gap-3 px-6 py-8">
          <Loader2
            size={ICON_SIZE.xl}
            className="animate-spin-slow text-indigo-400"
          />
          <span className="text-sm text-white/60">正在启动...</span>
        </div>
      )}

      {/* 完成 */}
      {isCompleted && progress && (
        <div className="glass-card space-y-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10">
              <CheckCircle2
                size={ICON_SIZE["2xl"]}
                className="text-green-400"
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-green-400">导入完成</p>
              <p className="text-xs text-white/40">全部数据已成功导入</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-white/[0.03] px-4 py-3">
              <p className="text-xs text-white/40">总行数</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {progress.total_count}
              </p>
            </div>
            <div className="rounded-xl bg-green-500/[0.05] px-4 py-3">
              <p className="text-xs text-green-400/60">新增</p>
              <p className="mt-1 text-lg font-semibold text-green-400">
                {progress.new_count}
              </p>
            </div>
            <div className="rounded-xl bg-white/[0.03] px-4 py-3">
              <p className="text-xs text-white/40">重复跳过</p>
              <p className="mt-1 text-lg font-semibold text-white/60">
                {progress.duplicate_count}
              </p>
            </div>
          </div>

          <button
            onClick={() => void onTriggerPipeline()}
            className="glass-btn-primary flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm"
          >
            <Play size={ICON_SIZE.md} />
            触发 AI 管线
          </button>
        </div>
      )}

      {/* 部分完成 */}
      {isPartial && progress && (
        <div className="glass-card space-y-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
              <AlertTriangle
                size={ICON_SIZE["2xl"]}
                className="text-amber-400"
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-400">
                导入部分完成
              </p>
              <p className="text-xs text-white/40">
                部分记录写入失败（空文本）
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-white/[0.03] px-4 py-3">
              <p className="text-xs text-white/40">总行数</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {progress.total_count}
              </p>
            </div>
            <div className="rounded-xl bg-green-500/[0.05] px-4 py-3">
              <p className="text-xs text-green-400/60">新增</p>
              <p className="mt-1 text-lg font-semibold text-green-400">
                {progress.new_count}
              </p>
            </div>
            <div className="rounded-xl bg-white/[0.03] px-4 py-3">
              <p className="text-xs text-white/40">重复跳过</p>
              <p className="mt-1 text-lg font-semibold text-white/60">
                {progress.duplicate_count}
              </p>
            </div>
            <div className="rounded-xl bg-red-500/[0.05] px-4 py-3">
              <p className="text-xs text-red-400/60">失败</p>
              <p className="mt-1 text-lg font-semibold text-red-400">
                {progress.failed_count}
              </p>
            </div>
          </div>

          <button
            onClick={() => void onTriggerPipeline()}
            className="glass-btn-primary flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm"
          >
            <Play size={ICON_SIZE.md} />
            触发 AI 管线
          </button>
        </div>
      )}

      {/* 失败 */}
      {isFailed && batchStatus && (
        <div className="glass-card space-y-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
              <XCircle size={ICON_SIZE["2xl"]} className="text-red-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-red-400">导入失败</p>
              <p className="text-xs text-white/40">
                {batchStatus.error_message ?? "未知错误，请查看后端日志"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- 页面主体 ----

export function ImportPage() {
  const {
    step,
    uploading,
    uploadResult,
    handleUpload,
    mappingPreview,
    loadingMapping,
    loadMappingPreview,
    handleConfirmMapping,
    batchStatus,
    processing,
    handleTriggerPipeline,
    stopPolling,
  } = useImport();

  // 组件卸载时停止轮询
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  return (
    <PageContainer>
      <PageHeader
        title="数据导入"
        description="上传 CSV/XLSX 文件，通过 AI 自动映射字段并导入数据"
      />

      <StepIndicator currentStep={step} />

      <div className="mx-auto max-w-2xl">
        {step === 1 && (
          <StepUpload uploading={uploading} onUpload={handleUpload} />
        )}

        {step === 2 && uploadResult && (
          <StepMapping
            batchStatus={batchStatus}
            mappingPreview={mappingPreview}
            loadingMapping={loadingMapping}
            onLoadPreview={loadMappingPreview}
            onConfirm={handleConfirmMapping}
          />
        )}

        {step === 3 && (
          <StepResult
            uploadResult={uploadResult}
            batchStatus={batchStatus}
            processing={processing}
            onTriggerPipeline={handleTriggerPipeline}
          />
        )}
      </div>
    </PageContainer>
  );
}
