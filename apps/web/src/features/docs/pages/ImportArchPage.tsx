/**
 * VOC 数据导入模块架构文档页面。
 * 包含 SVG 架构图和分章节的架构说明。
 */

import { PageContainer } from "@/components/PageContainer";
import { PageHeader } from "@/components/PageHeader";
import { ImportFlowDiagram } from "../components/ImportFlowDiagram";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-card rounded-2xl p-6">
      <h2 className="mb-4 text-lg font-semibold text-white">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-white/70">
        {children}
      </div>
    </div>
  );
}

function CodeRef({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-indigo-300">
      {children}
    </code>
  );
}

export function ImportArchPage() {
  return (
    <PageContainer>
      <PageHeader
        title="数据导入架构"
        description="VOC 数据导入模块的四层架构、6 步工作流和关键设计决策"
      />

      {/* 架构图 */}
      <div className="glass-card mb-8 rounded-2xl p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">
          架构总览
        </h2>
        <ImportFlowDiagram />
      </div>

      {/* 文档章节 */}
      <div className="space-y-6">
        {/* 1. 六步导入流程 */}
        <Section title="1. 六步导入流程">
          <p>
            导入流程由前端状态机 <CodeRef>use-import.ts</CodeRef> 驱动，
            每一步对应一个前端组件和后端端点，并映射到数据库中的{" "}
            <CodeRef>BatchStatus</CodeRef> 枚举值。
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-white/50">
                  <th className="py-2 pr-4">步骤</th>
                  <th className="py-2 pr-4">前端组件</th>
                  <th className="py-2 pr-4">后端端点</th>
                  <th className="py-2 pr-4">BatchStatus</th>
                  <th className="py-2">说明</th>
                </tr>
              </thead>
              <tbody className="text-white/60">
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4 text-indigo-300">1. 上传</td>
                  <td className="py-2 pr-4">
                    <CodeRef>StepUpload</CodeRef>
                  </td>
                  <td className="py-2 pr-4">
                    POST <CodeRef>/upload</CodeRef>
                  </td>
                  <td className="py-2 pr-4">uploaded</td>
                  <td className="py-2">
                    用户选择 CSV/Excel 文件 + 填写数据来源标识，上传到服务端暂存目录
                  </td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4 text-indigo-300">2. 预览</td>
                  <td className="py-2 pr-4">
                    <CodeRef>StepPreview</CodeRef>
                  </td>
                  <td className="py-2 pr-4">
                    GET <CodeRef>/data-preview</CodeRef>
                  </td>
                  <td className="py-2 pr-4">uploaded</td>
                  <td className="py-2">
                    展示前 N 行数据预览 + 列统计信息，用户确认数据正确后触发 Prompt 构建
                  </td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4 text-purple-300">3. Prompt</td>
                  <td className="py-2 pr-4">
                    <CodeRef>StepPrompt</CodeRef>
                  </td>
                  <td className="py-2 pr-4">
                    POST <CodeRef>/build-prompt</CodeRef>
                  </td>
                  <td className="py-2 pr-4">prompt_ready</td>
                  <td className="py-2">
                    后端构建 V3 Prompt（含数据统计 + 目标 Schema + 历史参考），用户可编辑后确认
                  </td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4 text-purple-300">4. 映射</td>
                  <td className="py-2 pr-4">
                    <CodeRef>StepMapping</CodeRef>
                  </td>
                  <td className="py-2 pr-4">
                    POST <CodeRef>/generate-mapping</CodeRef>
                  </td>
                  <td className="py-2 pr-4">mapping_generated</td>
                  <td className="py-2">
                    LLM 生成字段映射方案（后台异步任务），前端轮询状态直到完成
                  </td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4 text-emerald-300">5. 导入</td>
                  <td className="py-2 pr-4">
                    <CodeRef>StepImporting</CodeRef>
                  </td>
                  <td className="py-2 pr-4">
                    POST <CodeRef>/confirm-mapping</CodeRef> +{" "}
                    <CodeRef>/start-import</CodeRef>
                  </td>
                  <td className="py-2 pr-4">importing</td>
                  <td className="py-2">
                    用户确认映射 → 后台批量写入 Voice 记录，按 chunk 更新进度
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 text-emerald-300">6. 结果</td>
                  <td className="py-2 pr-4">
                    <CodeRef>StepResult</CodeRef>
                  </td>
                  <td className="py-2 pr-4">
                    GET <CodeRef>/status</CodeRef>
                  </td>
                  <td className="py-2 pr-4">completed / failed</td>
                  <td className="py-2">
                    展示导入统计（总数、成功、去重、失败），支持下载错误报告
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        {/* 2. 缓存策略 */}
        <Section title="2. 缓存策略">
          <p>
            <CodeRef>schema_mapping_service.py</CodeRef> 实现了两级缓存匹配，
            避免重复的 LLM 调用：
          </p>
          <div className="space-y-2 pl-4">
            <p>
              <span className="font-medium text-emerald-300">
                精确匹配（column_hash）
              </span>
              ：对上传文件的列名集合计算 SHA-256 哈希。如果
              <CodeRef>schema_mappings</CodeRef> 表中存在相同哈希的记录，
              直接复用历史映射方案，跳过 LLM 调用。
            </p>
            <p>
              <span className="font-medium text-amber-300">
                模糊匹配（Jaccard 相似度）
              </span>
              ：当精确匹配失败时，计算当前列名集合与历史映射的 Jaccard
              相似度。超过阈值（默认 0.6）的历史映射作为"参考映射"注入
              Prompt，帮助 LLM 生成更一致的结果。
            </p>
          </div>
          <p className="mt-2 text-white/50">
            缓存命中时，前端跳过 Prompt 编辑和 LLM 等待，直接进入映射确认步骤。
          </p>
        </Section>

        {/* 3. LLM 映射管线 */}
        <Section title="3. LLM 映射管线">
          <p>
            当缓存未命中时，进入 LLM 映射流程。整个流程由后台异步任务驱动：
          </p>
          <div className="space-y-2 pl-4">
            <p>
              <span className="font-medium text-purple-300">Prompt 构建</span>
              ：<CodeRef>prompt_builder.py</CodeRef> 组装 V3 Prompt，包含三部分：
            </p>
            <ul className="list-inside list-disc space-y-1 pl-4 text-white/60">
              <li>
                <strong>数据概况</strong> — 文件名、行数、列名列表、pandas
                统计摘要（数值分布、缺失率等）
              </li>
              <li>
                <strong>目标 Schema</strong> — Voice 模型的标准字段和 ext_
                扩展字段定义
              </li>
              <li>
                <strong>历史参考</strong> — Jaccard 匹配到的相似映射方案（如有）
              </li>
            </ul>
            <p className="mt-2">
              <span className="font-medium text-purple-300">LLM 调用</span>
              ：通过 <CodeRef>llm_client.py</CodeRef> 调用{" "}
              <CodeRef>reasoning</CodeRef> 槽位，使用 JSON Mode 确保输出可解析。
              温度设为 0 以保证确定性。
            </p>
            <p>
              <span className="font-medium text-purple-300">后台任务</span>
              ：<CodeRef>import_background.py</CodeRef> 中的{" "}
              <CodeRef>run_generate_mapping</CodeRef> 函数在独立 DB session
              中执行，遵循三层异常捕获模式。
            </p>
          </div>
        </Section>

        {/* 4. 数据模型 */}
        <Section title="4. 数据模型">
          <p>核心 ORM 模型及其关系：</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-white/50">
                  <th className="py-2 pr-4">模型</th>
                  <th className="py-2 pr-4">表名</th>
                  <th className="py-2 pr-4">关键字段</th>
                  <th className="py-2">说明</th>
                </tr>
              </thead>
              <tbody className="text-white/60">
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4 font-medium text-cyan-300">
                    IngestionBatch
                  </td>
                  <td className="py-2 pr-4">
                    <CodeRef>voc.ingestion_batches</CodeRef>
                  </td>
                  <td className="py-2 pr-4">
                    status, source, file_path, column_hash, prompt_text,
                    dedup_columns
                  </td>
                  <td className="py-2">
                    一次导入任务的元数据，跟踪全流程状态
                  </td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4 font-medium text-cyan-300">
                    SchemaMapping
                  </td>
                  <td className="py-2 pr-4">
                    <CodeRef>voc.schema_mappings</CodeRef>
                  </td>
                  <td className="py-2 pr-4">
                    column_hash, mapping_rules, source_columns
                  </td>
                  <td className="py-2">
                    可复用的字段映射模板，支持精确/模糊匹配
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-cyan-300">
                    Voice
                  </td>
                  <td className="py-2 pr-4">
                    <CodeRef>voc.voices</CodeRef>
                  </td>
                  <td className="py-2 pr-4">
                    content, source, channel, batch_id, metadata (JSONB)
                  </td>
                  <td className="py-2">
                    单条客户反馈记录，metadata 存放 ext_ 扩展字段
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-white/50">
            IngestionBatch 1:N Voice（通过 batch_id 关联）；SchemaMapping
            通过 column_hash 与 IngestionBatch 逻辑关联。
          </p>
        </Section>

        {/* 5. 关键代码路径 */}
        <Section title="5. 关键代码路径">
          <p>从前端按钮点击到数据库写入的完整调用链：</p>
          <div className="space-y-4">
            <div>
              <h3 className="mb-2 text-sm font-medium text-indigo-300">
                上传文件
              </h3>
              <div className="rounded-lg bg-white/5 p-3 font-mono text-xs leading-relaxed text-white/60">
                <p>
                  StepUpload 按钮 → use-import.ts{" "}
                  <CodeRef>uploadFile()</CodeRef>
                </p>
                <p>
                  → voc-api.ts <CodeRef>vocImportUpload()</CodeRef>
                </p>
                <p>
                  → POST /api/voc/import/upload
                </p>
                <p>
                  → import_routes.py <CodeRef>upload()</CodeRef>
                </p>
                <p>
                  → import_service.py{" "}
                  <CodeRef>create_batch()</CodeRef> → INSERT
                  ingestion_batches
                </p>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium text-purple-300">
                LLM 映射生成
              </h3>
              <div className="rounded-lg bg-white/5 p-3 font-mono text-xs leading-relaxed text-white/60">
                <p>
                  StepMapping 自动触发 → use-import.ts{" "}
                  <CodeRef>generateMapping()</CodeRef>
                </p>
                <p>
                  → POST /api/voc/import/&#123;id&#125;/generate-mapping
                </p>
                <p>
                  → import_routes.py → asyncio.create_task(
                  <CodeRef>run_generate_mapping</CodeRef>)
                </p>
                <p>
                  → schema_mapping_service.py{" "}
                  <CodeRef>generate_or_reuse()</CodeRef>
                </p>
                <p>
                  → prompt_builder.py → llm_client.py → LLM
                  Service (reasoning slot)
                </p>
                <p>
                  → INSERT schema_mappings + UPDATE
                  ingestion_batches.status
                </p>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium text-emerald-300">
                批量数据导入
              </h3>
              <div className="rounded-lg bg-white/5 p-3 font-mono text-xs leading-relaxed text-white/60">
                <p>
                  StepImporting 确认 → use-import.ts{" "}
                  <CodeRef>startImport()</CodeRef>
                </p>
                <p>
                  → POST /api/voc/import/&#123;id&#125;/start-import
                </p>
                <p>
                  → import_routes.py → asyncio.create_task(
                  <CodeRef>run_import_data</CodeRef>)
                </p>
                <p>
                  → import_background.py → file_parser.py{" "}
                  <CodeRef>parse_file()</CodeRef>
                </p>
                <p>
                  → 按 chunk 批量 INSERT voices + 去重检查
                </p>
                <p>
                  → UPDATE ingestion_batches（进度 / 完成状态）
                </p>
              </div>
            </div>
          </div>
        </Section>
      </div>
    </PageContainer>
  );
}
