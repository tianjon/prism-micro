/**
 * 映射模板详情页 (/voc/data/mappings/:mappingId)。
 */

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, FileCode, Clock } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { PageContainer } from "@/components/PageContainer";
import { fetchMappingDetail } from "@/api/voc-api";
import type { DataMappingDetail } from "@/api/types";

export function MappingDetailPage() {
  const { mappingId } = useParams<{ mappingId: string }>();
  const navigate = useNavigate();
  const [mapping, setMapping] = useState<DataMappingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mappingId) return;
    setLoading(true);
    fetchMappingDetail(mappingId)
      .then((res) => setMapping(res.data))
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false));
  }, [mappingId]);

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

  if (error || !mapping) {
    return (
      <PageContainer>
        <button
          onClick={() => navigate("/voc/data?tab=mappings")}
          className="glass-btn-ghost mb-4 flex items-center gap-1 px-3 py-1.5 text-sm"
        >
          <ArrowLeft size={ICON_SIZE.md} />
          返回数据管理
        </button>
        <div className="glass-card flex min-h-[200px] items-center justify-center">
          <p className="text-sm text-red-400">{error ?? "映射模板不存在"}</p>
        </div>
      </PageContainer>
    );
  }

  const mappingEntries = Object.entries(mapping.column_mappings ?? {});

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* 返回按钮 + 标题 */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/voc/data?tab=mappings")}
            className="glass-btn-ghost flex items-center gap-1 px-3 py-1.5 text-sm"
          >
            <ArrowLeft size={ICON_SIZE.md} />
            返回
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">{mapping.name}</h1>
            <p className="text-sm text-white/40">映射模板 ID: {mapping.id}</p>
          </div>
        </div>

        {/* 信息卡片 */}
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <div className="glass-card p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-white/60">
              <FileCode size={ICON_SIZE.md} />
              基本信息
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-white/40">格式</dt>
                <dd className="text-white/80 uppercase">{mapping.source_format}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-white/40">创建者</dt>
                <dd className="text-white/80">{mapping.created_by}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-white/40">置信度</dt>
                <dd className="text-white/80 tabular-nums">
                  {mapping.confidence !== null
                    ? `${(mapping.confidence * 100).toFixed(0)}%`
                    : "-"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-white/40">使用次数</dt>
                <dd className="text-white/80 tabular-nums">{mapping.usage_count}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-white/40">列哈希</dt>
                <dd className="text-white/50 font-mono text-xs truncate max-w-[200px]">
                  {mapping.column_hash}
                </dd>
              </div>
            </dl>
          </div>

          <div className="glass-card p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-white/60">
              <Clock size={ICON_SIZE.md} />
              时间信息
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-white/40">创建时间</dt>
                <dd className="text-white/80">{formatDate(mapping.created_at)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-white/40">更新时间</dt>
                <dd className="text-white/80">{formatDate(mapping.updated_at)}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* 列映射表格 */}
        {mappingEntries.length > 0 && (
          <div className="glass-card overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10">
              <h3 className="text-sm font-medium text-white/60">列映射关系</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-5 py-3 text-left text-xs font-medium text-white/50">
                      源列名
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-white/50">
                      映射配置
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {mappingEntries.map(([key, value]) => (
                    <tr key={key} className="border-b border-white/5">
                      <td className="px-5 py-3 font-mono text-xs text-white/80">
                        {key}
                      </td>
                      <td className="px-5 py-3 text-xs text-white/60">
                        {typeof value === "string"
                          ? value
                          : JSON.stringify(value, null, 2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
