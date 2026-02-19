/**
 * 批次详情页 (/voc/data/batches/:batchId)。
 */

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, FileText, Clock, Hash } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { PageContainer } from "@/components/PageContainer";
import { fetchBatchDetail } from "@/api/voc-api";
import type { DataBatchDetail } from "@/api/types";
import { StatusBadge } from "../components/StatusBadge";
import { VoicesTab } from "../components/VoicesTab";

export function BatchDetailPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const [batch, setBatch] = useState<DataBatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!batchId) return;
    setLoading(true);
    fetchBatchDetail(batchId)
      .then((res) => setBatch(res.data))
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false));
  }, [batchId]);

  if (loading) {
    return (
      <PageContainer>
        <div className="space-y-4">
          <div className="h-8 w-48 animate-pulse rounded bg-white/10" />
          <div className="glass-card p-6">
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-5 w-3/4 animate-pulse rounded bg-white/10" />
              ))}
            </div>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (error || !batch) {
    return (
      <PageContainer>
        <button
          onClick={() => navigate("/voc/data")}
          className="glass-btn-ghost mb-4 flex items-center gap-1 px-3 py-1.5 text-sm"
        >
          <ArrowLeft size={ICON_SIZE.md} />
          返回数据管理
        </button>
        <div className="glass-card flex min-h-[200px] items-center justify-center">
          <p className="text-sm text-red-400">{error ?? "批次不存在"}</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* 返回按钮 + 标题 */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/voc/data")}
            className="glass-btn-ghost flex items-center gap-1 px-3 py-1.5 text-sm"
          >
            <ArrowLeft size={ICON_SIZE.md} />
            返回
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">
              {batch.file_name ?? "未命名批次"}
            </h1>
            <p className="text-sm text-white/40">批次 ID: {batch.id}</p>
          </div>
        </div>

        {/* 信息卡片 */}
        <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
          {/* 基本信息 */}
          <div className="glass-card p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-white/60">
              <FileText size={ICON_SIZE.md} />
              基本信息
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-white/40">状态</dt>
                <dd><StatusBadge status={batch.status} /></dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-white/40">来源</dt>
                <dd className="text-white/80">{batch.source}</dd>
              </div>
              {batch.mapping_name && (
                <div className="flex justify-between">
                  <dt className="text-white/40">映射模板</dt>
                  <dd className="text-white/80">{batch.mapping_name}</dd>
                </div>
              )}
              {batch.error_message && (
                <div className="mt-2 rounded-md bg-red-500/10 p-2 text-xs text-red-400">
                  {batch.error_message}
                </div>
              )}
            </dl>
          </div>

          {/* 统计数据 */}
          <div className="glass-card p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-white/60">
              <Hash size={ICON_SIZE.md} />
              统计数据
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-white/40">总记录</dt>
                <dd className="text-white/80 tabular-nums">{batch.total_count}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-white/40">新增</dt>
                <dd className="text-green-400 tabular-nums">{batch.new_count}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-white/40">重复</dt>
                <dd className="text-yellow-400 tabular-nums">{batch.duplicate_count}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-white/40">失败</dt>
                <dd className="text-red-400 tabular-nums">{batch.failed_count}</dd>
              </div>
            </dl>
          </div>

          {/* 时间信息 */}
          <div className="glass-card p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-white/60">
              <Clock size={ICON_SIZE.md} />
              时间信息
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-white/40">创建时间</dt>
                <dd className="text-white/80">{formatDate(batch.created_at)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-white/40">完成时间</dt>
                <dd className="text-white/80">{formatDate(batch.completed_at)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-white/40">更新时间</dt>
                <dd className="text-white/80">{formatDate(batch.updated_at)}</dd>
              </div>
              {batch.file_size_bytes !== null && (
                <div className="flex justify-between">
                  <dt className="text-white/40">文件大小</dt>
                  <dd className="text-white/80 tabular-nums">
                    {(batch.file_size_bytes / 1024).toFixed(1)} KB
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* Prompt 文本 */}
        {batch.prompt_text && (
          <div className="glass-card p-5">
            <h3 className="mb-3 text-sm font-medium text-white/60">提示词文本</h3>
            <pre className="max-h-[300px] overflow-auto rounded-lg bg-black/30 p-4 text-xs text-white/70 whitespace-pre-wrap">
              {batch.prompt_text}
            </pre>
          </div>
        )}

        {/* 关联 Voice 列表 */}
        <div>
          <h3 className="mb-4 text-lg font-semibold text-white">关联 Voice 数据</h3>
          <VoicesTab batchId={batchId} />
        </div>
      </div>
    </PageContainer>
  );
}
