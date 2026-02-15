/**
 * 数据导入流程 hook。
 * 管理上传 → 映射预览 → 导入/处理的完整三步骤状态。
 * 上传后通过轮询 batch status 自动驱动 step 切换。
 */

import { useState, useCallback, useRef } from "react";
import type { BatchStatus, MappingPreview, UploadResponse } from "@/api/types";
import { ApiError } from "@/api/client";
import {
  uploadFile,
  getMappingPreview,
  confirmMapping,
  triggerPipeline,
  getBatchStatus,
} from "@/api/voc-api";
import { useToast } from "@/hooks/use-toast";

/** 轮询间隔（毫秒） */
const POLL_INTERVAL = 2000;

/** 上传超时（毫秒） */
const UPLOAD_TIMEOUT = 30_000;

/** 终态集合 */
const TERMINAL_STATUSES = ["completed", "partially_completed", "failed"];

export interface UseImportReturn {
  /** 当前步骤（1=上传, 2=映射, 3=导入/结果） */
  step: number;
  setStep: (step: number) => void;
  // 上传相关
  uploading: boolean;
  uploadResult: UploadResponse | null;
  handleUpload: (file: File, source: string) => Promise<void>;
  // 映射相关
  mappingPreview: MappingPreview | null;
  loadingMapping: boolean;
  loadMappingPreview: () => Promise<void>;
  handleConfirmMapping: (
    mappings: Record<string, string | null>,
  ) => Promise<void>;
  // 批次状态
  batchStatus: BatchStatus | null;
  processing: boolean;
  handleTriggerPipeline: () => Promise<void>;
  pollBatchStatus: () => void;
  stopPolling: () => void;
}

export function useImport(): UseImportReturn {
  const [step, setStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [mappingPreview, setMappingPreview] = useState<MappingPreview | null>(
    null,
  );
  const [loadingMapping, setLoadingMapping] = useState(false);
  const [batchStatus, setBatchStatus] = useState<BatchStatus | null>(null);
  const [processing, setProcessing] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const batchIdRef = useRef<string | null>(null);
  const { toast } = useToast();

  /** 停止轮询 */
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  /** 轮询批次状态（根据 status 自动驱动 step） */
  const pollBatchStatus = useCallback(() => {
    const batchId = batchIdRef.current;
    if (!batchId) return;
    stopPolling();

    const poll = async () => {
      try {
        const response = await getBatchStatus(batchId);
        const status = response.data.status;
        setBatchStatus(response.data);

        // 根据 status 自动切换 step
        if (status === "mapping") {
          setStep(2);
          setProcessing(false);
        } else if (
          status === "importing" ||
          TERMINAL_STATUSES.includes(status)
        ) {
          setStep(3);
          setProcessing(status === "importing");
        }

        // 终态：停止轮询
        if (TERMINAL_STATUSES.includes(status)) {
          stopPolling();
          setProcessing(false);

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
  }, [stopPolling, toast]);

  /** 上传文件 */
  const handleUpload = useCallback(
    async (file: File, source: string) => {
      setUploading(true);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT);
      try {
        const response = await uploadFile(file, source, controller.signal);
        setUploadResult(response.data);
        batchIdRef.current = response.data.batch_id;
        toast({
          title: "文件已提交",
          description: "正在后台分析字段映射...",
          variant: "success",
        });
        // 上传成功后进入 step 2（等待轮询驱动），开始轮询
        setStep(2);
        setProcessing(true);
        pollBatchStatus();
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
    [toast, pollBatchStatus],
  );

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
        // 转为后端期望格式：{col: {target: field}}
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
        setStep(3);
        setProcessing(true);
        pollBatchStatus();
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "确认映射失败";
        toast({ title: message, variant: "error" });
      }
    },
    [toast, pollBatchStatus],
  );

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

  return {
    step,
    setStep,
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
    pollBatchStatus,
    stopPolling,
  };
}
