/**
 * 数据导入流程 hook（v2：6 步状态机）。
 *   upload → preview → prompting → mapping → importing → result
 *
 * v3 变更：
 * - 新增 prompt_ready 状态（preview → prompting 之间可编辑提示词）
 * - buildPrompt / updatePrompt / triggerMapping 方法
 * - 步骤导航：已完成步骤均可点击回跳
 */

import { useState, useCallback, useRef } from "react";
import type {
  BatchStatus,
  DataPreview,
  MappingPreview,
  PromptPreview,
  ResultPreview,
  UploadResponse,
} from "@/api/types";
import { ApiError } from "@/api/client";
import {
  uploadFile,
  getDataPreview,
  buildPrompt,
  updatePromptText,
  generateMapping,
  getPromptText,
  getMappingPreview,
  confirmMapping,
  getResultPreview,
  triggerPipeline,
  getBatchStatus,
} from "@/api/voc-api";
import { useToast } from "@/hooks/use-toast";

// ---- 类型定义 ----

export type ImportStepId =
  | "upload"
  | "preview"
  | "prompting"
  | "mapping"
  | "importing"
  | "result";

export type StepStatus =
  | "pending"
  | "loading"
  | "active"
  | "completed"
  | "skipped";

/** 有序步骤列表 */
const STEP_ORDER: ImportStepId[] = [
  "upload",
  "preview",
  "prompting",
  "mapping",
  "importing",
  "result",
];

/** 初始步骤状态 */
function createInitialStatuses(): Record<ImportStepId, StepStatus> {
  const statuses = {} as Record<ImportStepId, StepStatus>;
  for (const id of STEP_ORDER) {
    statuses[id] = "pending";
  }
  statuses.upload = "active";
  return statuses;
}

// ---- 常量 ----

/** 轮询间隔（毫秒） */
const POLL_INTERVAL = 2000;

/** 动态上传超时：基础 60 秒 + 每 MB 额外 10 秒 */
function getUploadTimeout(fileSize: number): number {
  const BASE_TIMEOUT = 60_000;
  const PER_MB_TIMEOUT = 10_000;
  const fileMB = fileSize / (1024 * 1024);
  return BASE_TIMEOUT + Math.ceil(fileMB) * PER_MB_TIMEOUT;
}

/** 终态集合 */
const TERMINAL_STATUSES = ["completed", "partially_completed", "failed"];

// ---- Hook ----

export interface UseImportReturn {
  /** 当前活跃步骤 */
  currentStep: ImportStepId;
  /** 所有步骤状态 */
  stepStatuses: Record<ImportStepId, StepStatus>;
  /** 切换到已完成步骤（回跳查看） */
  handleStepClick: (step: ImportStepId) => void;
  /** 重置所有状态 */
  handleReset: () => void;
  // 上传相关
  uploading: boolean;
  uploadProgress: number;
  uploadResult: UploadResponse | null;
  handleUpload: (file: File, source: string) => Promise<void>;
  // 数据预览
  dataPreview: DataPreview | null;
  loadingDataPreview: boolean;
  loadDataPreview: () => Promise<void>;
  // 提示词构建
  handleBuildPrompt: (dedupColumns: string[]) => Promise<void>;
  // 提示词编辑
  handleUpdatePrompt: (promptText: string) => Promise<void>;
  // 触发映射
  handleTriggerMapping: () => Promise<void>;
  // 提示词预览
  promptPreview: PromptPreview | null;
  loadPromptText: () => Promise<void>;
  // 映射相关
  mappingPreview: MappingPreview | null;
  loadingMapping: boolean;
  loadMappingPreview: () => Promise<void>;
  handleConfirmMapping: (
    mappings: Record<string, string | null>,
  ) => Promise<void>;
  // 结果预览
  resultPreview: ResultPreview | null;
  loadResultPreview: () => Promise<void>;
  // 批次状态
  batchStatus: BatchStatus | null;
  processing: boolean;
  handleTriggerPipeline: () => Promise<void>;
  pollBatchStatus: () => void;
  stopPolling: () => void;
}

export function useImport(): UseImportReturn {
  const [currentStep, setCurrentStep] = useState<ImportStepId>("upload");
  const [stepStatuses, setStepStatuses] = useState<
    Record<ImportStepId, StepStatus>
  >(createInitialStatuses);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [dataPreview, setDataPreview] = useState<DataPreview | null>(null);
  const [loadingDataPreview, setLoadingDataPreview] = useState(false);
  const [promptPreview, setPromptPreview] = useState<PromptPreview | null>(
    null,
  );
  const [mappingPreview, setMappingPreview] = useState<MappingPreview | null>(
    null,
  );
  const [loadingMapping, setLoadingMapping] = useState(false);
  const [resultPreview, setResultPreview] = useState<ResultPreview | null>(
    null,
  );
  const [batchStatus, setBatchStatus] = useState<BatchStatus | null>(null);
  const [processing, setProcessing] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const batchIdRef = useRef<string | null>(null);
  const { toast } = useToast();

  /** 更新步骤状态（合并更新） */
  const updateStatuses = useCallback(
    (updates: Partial<Record<ImportStepId, StepStatus>>) => {
      setStepStatuses((prev) => ({ ...prev, ...updates }));
    },
    [],
  );

  /** 停止轮询 */
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  /** 根据 batch status 同步步骤状态 */
  const syncStepStatuses = useCallback(
    (status: string) => {
      switch (status) {
        case "pending":
          updateStatuses({
            upload: "completed",
            preview: "active",
            prompting: "pending",
            mapping: "pending",
            importing: "pending",
            result: "pending",
          });
          setCurrentStep("preview");
          break;

        case "prompt_ready":
          updateStatuses({
            upload: "completed",
            preview: "completed",
            prompting: "active",
            mapping: "pending",
            importing: "pending",
            result: "pending",
          });
          setCurrentStep("prompting");
          setProcessing(false);
          break;

        case "generating_mapping":
          updateStatuses({
            upload: "completed",
            preview: "completed",
            prompting: "loading",
            mapping: "pending",
            importing: "pending",
            result: "pending",
          });
          setCurrentStep("prompting");
          break;

        case "mapping":
          updateStatuses({
            upload: "completed",
            preview: "completed",
            prompting: "completed",
            mapping: "active",
            importing: "pending",
            result: "pending",
          });
          setCurrentStep("mapping");
          setProcessing(false);
          break;

        case "importing":
          updateStatuses({
            upload: "completed",
            preview: "completed",
            prompting: "completed",
            mapping: "completed",
            importing: "loading",
            result: "pending",
          });
          setCurrentStep("importing");
          setProcessing(true);
          break;

        case "completed":
        case "partially_completed":
        case "failed":
          updateStatuses({
            upload: "completed",
            preview: "completed",
            prompting: "completed",
            mapping: "completed",
            importing: "completed",
            result: "completed",
          });
          setCurrentStep("result");
          setProcessing(false);
          break;
      }
    },
    [updateStatuses],
  );

  /** 轮询批次状态 */
  const pollBatchStatus = useCallback(() => {
    const batchId = batchIdRef.current;
    if (!batchId) return;
    stopPolling();

    const poll = async () => {
      try {
        const response = await getBatchStatus(batchId);
        const status = response.data.status;
        setBatchStatus(response.data);
        syncStepStatuses(status);

        // 终态：停止轮询
        if (TERMINAL_STATUSES.includes(status)) {
          stopPolling();

          if (status === "completed") {
            const p = response.data.progress;
            toast({
              title: "导入完成",
              description: `新增 ${p.new_count} 条，重复 ${p.duplicate_count} 条`,
              variant: "success",
            });
          } else if (status === "partially_completed") {
            const p = response.data.progress;
            toast({
              title: "导入部分完成",
              description: `新增 ${p.new_count} 条，失败 ${p.failed_count} 条`,
              variant: "warning",
            });
          } else if (status === "failed") {
            toast({
              title: "导入失败",
              description: response.data.error_message ?? "未知错误",
              variant: "error",
            });
          }
        }

        // mapping / prompt_ready 状态也停止轮询（等待用户操作）
        if (status === "mapping" || status === "prompt_ready") {
          stopPolling();
        }
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "获取批次状态失败";
        toast({ title: message, variant: "error" });
        stopPolling();
        setProcessing(false);
      }
    };

    // 立即执行一次
    void poll();
    pollingRef.current = setInterval(() => void poll(), POLL_INTERVAL);
  }, [stopPolling, syncStepStatuses, toast]);

  /** 上传文件 */
  const handleUpload = useCallback(
    async (file: File, source: string) => {
      setUploading(true);
      setUploadProgress(0);
      const controller = new AbortController();
      const timeout = getUploadTimeout(file.size);
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      try {
        const response = await uploadFile(file, source, controller.signal, (percent) => {
          setUploadProgress(percent);
        });
        clearTimeout(timeoutId);
        setUploadResult(response.data);
        batchIdRef.current = response.data.batch_id;
        setUploadProgress(100);

        // 检查重复文件
        if (response.data.duplicate_batch_id) {
          toast({
            title: "文件重复提示",
            description: `此文件已在批次 ${response.data.duplicate_batch_id.slice(0, 8)}... 导入过`,
            variant: "warning",
          });
        }

        toast({
          title: "文件已上传",
          description: "请预览数据后生成映射",
          variant: "success",
        });

        // 等待 600ms 让用户看到"上传成功"状态
        await new Promise((r) => setTimeout(r, 600));

        // 上传成功 → 进入 preview
        updateStatuses({
          upload: "completed",
          preview: "active",
        });
        setCurrentStep("preview");
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          toast({ title: "上传超时，请重试", variant: "error" });
        } else {
          const message =
            err instanceof ApiError ? err.message : "文件上传失败，请重试";
          toast({ title: message, variant: "error" });
        }
      } finally {
        clearTimeout(timeoutId);
        setUploading(false);
      }
    },
    [toast, updateStatuses],
  );

  /** 加载数据预览 */
  const loadDataPreview = useCallback(async () => {
    const batchId = batchIdRef.current;
    if (!batchId) return;
    setLoadingDataPreview(true);
    try {
      const response = await getDataPreview(batchId);
      setDataPreview(response.data);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "加载数据预览失败";
      toast({ title: message, variant: "error" });
    } finally {
      setLoadingDataPreview(false);
    }
  }, [toast]);

  /** 构建提示词（preview → prompting 转场） */
  const handleBuildPrompt = useCallback(
    async (dedupColumns: string[]) => {
      const batchId = batchIdRef.current;
      if (!batchId) return;
      try {
        const response = await buildPrompt(batchId, { dedup_columns: dedupColumns });
        setPromptPreview(response.data);
        // 同步 batchStatus
        const statusResponse = await getBatchStatus(batchId);
        setBatchStatus(statusResponse.data);

        if (response.data.cache_hit) {
          // 精确缓存命中 → 跳过提示词编辑，直接进入映射确认
          updateStatuses({
            preview: "completed",
            prompting: "completed",
            mapping: "active",
          });
          setCurrentStep("mapping");
        } else {
          // 正常流程 → 进入提示词编辑
          updateStatuses({
            preview: "completed",
            prompting: "active",
          });
          setCurrentStep("prompting");
        }
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "构建提示词失败";
        toast({ title: message, variant: "error" });
      }
    },
    [toast, updateStatuses],
  );

  /** 保存编辑后的提示词 */
  const handleUpdatePrompt = useCallback(
    async (promptText: string) => {
      const batchId = batchIdRef.current;
      if (!batchId) return;
      try {
        const response = await updatePromptText(batchId, { prompt_text: promptText });
        setPromptPreview(response.data);
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "保存提示词失败";
        toast({ title: message, variant: "error" });
      }
    },
    [toast],
  );

  /** 触发 LLM 映射（prompting → mapping 转场） */
  const handleTriggerMapping = useCallback(async () => {
    const batchId = batchIdRef.current;
    if (!batchId) return;
    try {
      await generateMapping(batchId, { dedup_columns: [] });
      toast({
        title: "映射生成已启动",
        description: "AI 正在分析字段映射...",
        variant: "success",
      });
      updateStatuses({
        prompting: "loading",
      });
      setProcessing(true);
      pollBatchStatus();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "触发映射失败";
      toast({ title: message, variant: "error" });
    }
  }, [toast, pollBatchStatus, updateStatuses]);

  /** 加载提示词预览 */
  const loadPromptText = useCallback(async () => {
    const batchId = batchIdRef.current;
    if (!batchId) return;
    try {
      const response = await getPromptText(batchId);
      setPromptPreview(response.data);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "加载提示词预览失败";
      toast({ title: message, variant: "error" });
    }
  }, [toast]);

  /** 加载映射预览 */
  const loadMappingPreview = useCallback(async () => {
    const batchId = batchIdRef.current;
    if (!batchId) return;
    setLoadingMapping(true);
    try {
      const response = await getMappingPreview(batchId);
      setMappingPreview(response.data);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "加载映射预览失败";
      toast({ title: message, variant: "error" });
    } finally {
      setLoadingMapping(false);
    }
  }, [toast]);

  /** 确认字段映射 */
  const handleConfirmMapping = useCallback(
    async (mappings: Record<string, string | null>) => {
      const batchId = batchIdRef.current;
      if (!batchId) return;
      try {
        const confirmed: Record<string, Record<string, string | null>> = {};
        for (const [col, target] of Object.entries(mappings)) {
          confirmed[col] = { target };
        }
        await confirmMapping(batchId, { confirmed_mappings: confirmed });
        toast({
          title: "映射已确认",
          description: "正在后台导入数据...",
          variant: "success",
        });
        updateStatuses({
          mapping: "completed",
          importing: "loading",
        });
        setCurrentStep("importing");
        setProcessing(true);
        pollBatchStatus();
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "确认映射失败";
        toast({ title: message, variant: "error" });
      }
    },
    [toast, pollBatchStatus, updateStatuses],
  );

  /** 加载结果预览 */
  const loadResultPreview = useCallback(async () => {
    const batchId = batchIdRef.current;
    if (!batchId) return;
    try {
      const response = await getResultPreview(batchId);
      setResultPreview(response.data);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "加载结果预览失败";
      toast({ title: message, variant: "error" });
    }
  }, [toast]);

  /** 触发 AI 管线 */
  const handleTriggerPipeline = useCallback(async () => {
    const batchId = batchIdRef.current;
    if (!batchId) return;
    setProcessing(true);
    try {
      await triggerPipeline(batchId);
      toast({
        title: "管线已启动",
        description: "正在处理中，请等待...",
        variant: "success",
      });
      pollBatchStatus();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "触发管线失败";
      toast({ title: message, variant: "error" });
      setProcessing(false);
    }
  }, [toast, pollBatchStatus]);

  /** 点击步骤导航（允许回跳到之前的步骤） */
  const handleStepClick = useCallback(
    (step: ImportStepId) => {
      const targetIdx = STEP_ORDER.indexOf(step);
      const currentIdx = STEP_ORDER.indexOf(currentStep);

      // 允许回跳到当前步骤之前的已完成/已跳过步骤
      if (targetIdx < currentIdx) {
        setCurrentStep(step);
        return;
      }

      // 允许跳到当前步骤之前的已完成步骤（从更后面的步骤回跳时）
      if (
        stepStatuses[step] === "completed" ||
        stepStatuses[step] === "skipped"
      ) {
        setCurrentStep(step);
      }
    },
    [stepStatuses, currentStep],
  );

  /** 重置所有状态 */
  const handleReset = useCallback(() => {
    stopPolling();
    setCurrentStep("upload");
    setStepStatuses(createInitialStatuses());
    setUploading(false);
    setUploadProgress(0);
    setUploadResult(null);
    setDataPreview(null);
    setLoadingDataPreview(false);
    setPromptPreview(null);
    setMappingPreview(null);
    setLoadingMapping(false);
    setResultPreview(null);
    setBatchStatus(null);
    setProcessing(false);
    batchIdRef.current = null;
  }, [stopPolling]);

  return {
    currentStep,
    stepStatuses,
    handleStepClick,
    handleReset,
    uploading,
    uploadProgress,
    uploadResult,
    handleUpload,
    dataPreview,
    loadingDataPreview,
    loadDataPreview,
    handleBuildPrompt,
    handleUpdatePrompt,
    handleTriggerMapping,
    promptPreview,
    loadPromptText,
    mappingPreview,
    loadingMapping,
    loadMappingPreview,
    handleConfirmMapping,
    resultPreview,
    loadResultPreview,
    batchStatus,
    processing,
    handleTriggerPipeline,
    pollBatchStatus,
    stopPolling,
  };
}
