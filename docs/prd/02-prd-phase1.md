# Prism Phase 1 产品需求文档（PRD）

> 本文档由虚拟专家团队经过 4 轮结构化辩论（R0 独立立场宣言 → R1 对抗辩论 → R2 妥协构建 → R4 终审投票）后正式定稿。所有功能条目均通过五维加权评分（用户价值 25% / 技术可行性 20% / 战略意义 20% / 风险可控性 15% / 组织可采纳性 20%），Must Have 条目加权分均 >= 3.5。
>
> **v2.0 修订说明**：本版本基于 PRD v1.0 经 R5 Delta 评审后修订。R5 Delta 评审由 3 个并行 Agent 针对用户 6 项修正意见进行增量辩论，详见 `01-discussion-records/R5-delta-review-a.md`（数据摄入重构）、`R5-delta-review-b.md`（LLM 服务简化）、`R5-delta-review-c.md`（基础设施 + 架构弹性）。

**文档版本**：v2.0
**定稿日期**：Phase 2 进行中
**适用范围**：从 Phase 2 完成时间点到 Phase 3 核心子集验收 + Wave 2 数据采集扩展
**投票记录**：详见 `01-discussion-records/R4-final-voting.md`、`R5-delta-review-a.md`、`R5-delta-review-b.md`、`R5-delta-review-c.md`

---

## 1. 产品定位与目标

### 1.1 一句话定位

**Prism Phase 1 是一个 AI 驱动的 VOC 语义分析平台，支持多源数据自动采集（R5-A 决议），通过涌现式标签系统帮助产品团队从海量客户反馈中发现"不知道自己不知道的"未知问题，将检测延迟从周级压缩到天级。**

这个定位包含四个关键词：

- **多源数据自动采集**（R5-A 决议）：支持 CSV/Excel 手动上传 + 懂车帝/微博爬虫自动采集，通过 LLM 自动映射将多种不固定 Schema 的数据源统一纳入分析管线。
- **涌现式标签**：与传统 VOC 系统的预设分类体系根本不同。LLM 从数据中自由发现语义主题，标签从数据中"生长"出来（VP1，`02-vision-proposition.md`）。
- **语义分析**：不是关键词匹配，而是基于向量空间的语义理解。搜索"支付卡顿"能找到"结账时转了好久的菊花"——这是传统工具做不到的。
- **检测延迟压缩**：传统 VOC 的三重延迟（检测 4-6 周 + 对齐 2-3 周 + 行动 6-8 周，`01-market-problem.md`）是整个产品叙事的出发点。

### 1.2 目标用户画像

**主要用户：一线产品负责人（产品经理 / 产品总监）**

| 维度 | 描述 |
|------|------|
| 工作职责 | 负责某产品线的用户体验和功能迭代，需定期分析客户反馈制定产品决策 |
| 当前痛点 | 每周花 5-8 小时手动阅读反馈或扫描预设标签报表；30% 反馈归入"其他"无法分析；新问题平均 4-6 周后才被发现 |
| 对 Prism 的期望 | 导入反馈数据后 5 分钟内看到 AI 自动发现的问题标签；用自然语言搜索找到语义相关的反馈 |
| 技术能力 | 非技术背景，不能使用 curl/API，必须有可交互的 Web UI |

**真实用户画像（R5 Delta 评审确认）**：

| 用户 | 行业 | 核心数据源 | 关键需求 |
|------|------|-----------|---------|
| Prism 汽车品牌团队 | 汽车行业 | 懂车帝车主评论 | 监控车主口碑，发现产品改进方向（如 M3 芯片发热、空调制冷等问题） |
| Prism Coffee 品牌团队 | 消费品行业 | 微博消费者口碑 | 追踪消费者对新品的即时反应，监测品牌口碑变化 |

**次要用户（Phase 1 dogfooding 阶段）：Prism 开发团队自身**

| 维度 | 描述 |
|------|------|
| 角色 | 既是开发者，也是第一批使用者 |
| 价值 | 验证 AI 管线技术质量，同时建立对传统 VOC 痛点的感性认知 |
| 局限 | 不代表目标用户画像，反馈可能系统性地偏向技术维度（R1 辩论 f，林晓薇论证） |

### 1.3 成功标准（可量化 KPI）

| KPI | 目标值 | 衡量方式 | 时间节点 |
|-----|--------|---------|---------|
| AI 管线端到端处理可靠性 | > 95%（1000 条中失败 < 50 条） | 自动化测试 + 守卫层降级统计 | Phase 3 验收（M5） |
| 涌现标签标注一致性 | > 70%（同一反馈重复处理的标签重叠率） | 自动化一致性测试 | Phase 3 验收（M5） |
| 语义搜索 Top-5 命中率 | > 60% | 预定义 10 个测试查询的人工评审 | Phase 3 验收（M5） |
| 用户反馈数据量（dogfooding） | > 100 条 thumbs-up/down/error | `voc.tag_feedback` 表统计 | M7（Phase 3 后 4 周） |
| 外部用户信号校准 | 至少 1 名非团队成员确认涌现标签有价值 | 产品演示 + 反馈收集 | M7（Phase 3 后 4 周） |
| 对比基线验证 | 涌现标签在至少 60% 的场景中被评为"优于预设分类" | 对比视图中的用户偏好数据 | M7（Phase 3 后 4 周） |
| 爬虫采集成功率（R5-A 决议） | > 90% | 爬虫执行日志统计 | M8（Wave 2 验收） |
| 增量去重准确率（R5-A 决议） | > 95% | content hash 去重测试 | M8（Wave 2 验收） |

### 1.4 "产品第一阶段"的定义

产品第一阶段覆盖技术 Phase 2 + Phase 2.5（精简版）+ Phase 3（核心子集），总体目标为**"到达用户可感知价值"**。R5 Delta 评审后，Phase 1 采用两波交付模式（R5-C 决议）。

此定义源自 R1 辩论 a 的核心分歧和 R2 的黄区妥协：

- **对外（管理层沟通）**：产品第一阶段的目标是"让用户能导入数据、看到涌现标签、做语义搜索"——一个可感知的价值闭环。
- **对内（工程执行）**：保持 Phase 2 → Phase 2.5（精简版）→ Phase 3 三个工程里程碑独立验收。Phase 2 结束后保留 Go/No-Go 评审窗口。
- **两波交付**（R5-C 决议）：Wave 1（核心价值闭环）不后移；Wave 2（爬虫 + 增量采集）在 M7 假设验证后启动，附 Go/No-Go 判定。
- **假设验证指标**（R2 方若琳 + 林晓薇补充条件）：Phase 3 验收时必须满足标注一致性 > 70%、至少 100 条用户反馈、至少 1 名外部用户信号校准。

**预估总工期**：18-22 周（从 Phase 2 完成时间点开始）（R5-C 决议，原 14-18 周延长至此以容纳 Wave 2）。

---

## 2. 核心场景（User Stories）

### US-1：多格式数据上传与 LLM 自动映射（R5-A 决议，重写）

- **角色**：作为一个产品经理
- **目标**：我需要将任意格式的客户反馈数据（CSV/Excel）上传到 Prism，系统自动理解数据结构并完成处理，无需我手动指定字段对应关系
- **前置条件**：
  - 用户已注册并登录 Prism
  - 拥有 CSV 或 Excel 格式的数据文件（字段名不限，但至少有一列包含文本内容）
  - LLM Provider 已配置并测试连通
- **主流程**：
  1. 用户在数据导入页面点击"上传文件"按钮
  2. 选择本地 CSV 或 Excel 文件
  3. 系统读取文件前 10 行，调用 LLM 自动识别字段含义，生成 Schema 映射建议
  4. **首次上传新格式**：系统展示映射预览面板——左侧为原始列名，右侧为 Voice 字段名，置信度 < 0.8 的映射项高亮标注。用户可修正映射后点击"确认并开始导入"。系统保存映射模板以供后续复用
  5. **复用已有模板**：系统检测到文件结构与已有映射模板匹配，自动应用模板，跳过确认步骤直接导入
  6. 系统执行增量导入：通过 content hash 去重，跳过已存在的数据
  7. 系统展示导入进度条（已解析 / 去重跳过 / 处理中 / 已完成 / 失败），每 5 秒刷新
  8. AI 管线自动执行 Stage 1（语义拆解）→ Stage 2（标签涌现 + 标准化）→ Stage 3（向量化）
  9. 处理完成后，页面展示导入摘要（新增 X 条、跳过 Y 条重复、失败 Z 条）
  10. 用户点击"查看结果"跳转到标签列表页
- **异常流程**：
  - LLM 无法识别内容字段（置信度 < 0.7）→ 系统暂停导入，提示用户"无法自动识别数据结构，请手动指定内容列"
  - 文件编码错误 → 系统提示"文件编码不支持，请使用 UTF-8 或 GBK 编码"
  - 全部数据为重复 → 系统提示"所有数据已存在，无需重复导入"
  - AI 管线处理某条反馈失败 → 原始数据保留并标记 `status = failed`，不阻塞其他条目
  - LLM Provider 不可用 → 故障转移引擎切换到降级模型，处理结果标记 `degraded=true`
- **验收标准**：
  - AC1：上传一个列名为 `评论内容`、`发布时间`、`用户名` 的 CSV，LLM 能正确映射到 `content`、`collected_at`、`author_id`
  - AC2：相同文件重复上传时，第二次导入重复数据被跳过
  - AC3：导入完成后展示准确的新增/跳过/失败摘要
  - AC4：1000 条反馈的端到端处理时间 < 30 分钟
  - AC5：处理完成后至少产出 20 个不同的涌现标签
  - AC6：每个标签附带置信度标注且 UI 正确展示三档颜色
  - AC7：映射模板保存后，下次上传同格式文件可自动匹配并跳过确认步骤

### US-2：懂车帝/微博爬虫数据自动采集（R5-A 决议，新增）

- **角色**：作为一个品牌运营经理
- **目标**：我需要一键触发懂车帝或微博的数据采集，系统自动抓取指定关键词/品牌的用户评论，自动转化为 Voice 并完成分析
- **前置条件**：
  - 用户已注册并登录 Prism
  - Prism CLI 已安装并配置
  - LLM Provider 已配置并测试连通
  - 网络环境可访问懂车帝/微博
- **主流程**：
  1. 用户通过 CLI 触发爬虫采集：
     - `prism crawl dongchedi --keyword "阿维塔" --pages 5`
     - `prism crawl weibo --keyword "Peets Coffee" --days 7`
  2. 爬虫脚本自动执行：访问目标网站、解析页面结构、提取评论数据
  3. 爬虫输出标准化 JSON 文件，包含 content、author、published_at、source_url 等字段
  4. 系统自动将数据导入摄入管线：
     - 通过 content hash 去重，跳过已存在的数据
     - 创建 Voice 记录（source_type = social/review，source_metadata 包含平台信息）
     - AI 管线自动执行 Stage 1-3
  5. CLI 输出采集摘要：总抓取 X 条、新增 Y 条、跳过 Z 条重复、失败 W 条
  6. 用户打开 Web UI，查看新采集数据产生的涌现标签
- **异常流程**：
  - 目标网站不可达 → CLI 输出错误提示，建议检查网络或稍后重试
  - 反爬机制触发 → 爬虫自动执行指数退避并重试，超过重试次数后报错退出
  - 爬虫抓取的内容为空或无效 → 跳过无效数据，记录到日志
  - 部分数据 AI 管线处理失败 → 原始数据保留，标记 `status = failed`
- **验收标准**：
  - AC1：`prism crawl dongchedi --keyword "阿维塔"` 能成功抓取至少 50 条评论
  - AC2：`prism crawl weibo --keyword "Peets Coffee"` 能成功抓取至少 30 条微博
  - AC3：重复执行同一爬虫命令时，已抓取的数据不会重复入库
  - AC4：爬虫数据自动进入 AI 管线处理，无需用户额外操作
  - AC5：请求频率不超过 1 次/秒，尊重目标网站的 robots.txt
  - AC6：爬虫采集的数据在 Web UI 中与手动上传的数据无差异地展示

### US-3：语义搜索与溯源验证（原 US-2，编号调整）

- **角色**：作为一个产品经理
- **目标**：我需要用自然语言搜索某类问题，获得语义相关的结果，并能溯源到原始反馈
- **前置条件**：系统中已有经 AI 管线处理的反馈数据（至少完成 Stage 1-3）
- **主流程**：
  1. 用户在搜索页输入"支付卡顿"
  2. 系统调用 `vector_search` API，在向量空间中进行 ANN 近邻搜索
  3. 返回语义相关的 SemanticUnit 列表，包含"结账时转了好久的菊花""付款页面卡死重启才行"等语义相关但关键词不同的内容
  4. 每条结果展示：摘要文本、关联标签（带置信度颜色）、来源信息
  5. 用户点击某条结果，展开原始反馈全文和 AI 拆解详情（意图、情感、标签列表）
- **异常流程**：
  - 搜索无结果 → 系统提示"未找到语义相关内容"，建议换用同义词或缩短查询
  - 搜索结果中包含低置信度标注 → 结果旁展示"AI 生成，仅供参考"提示
- **验收标准**：
  - AC1：搜索"支付卡顿"返回的 Top-5 结果中至少 3 条与支付体验语义相关
  - AC2：搜索响应时间 P95 < 2 秒
  - AC3：每条结果可点击溯源到原始反馈全文

### US-4：标签质量反馈（原 US-3，编号调整）

- **角色**：作为一个产品经理
- **目标**：我需要标记涌现标签的质量，帮助系统积累人类反馈数据
- **前置条件**：标签列表页已展示涌现标签
- **主流程**：
  1. 用户浏览涌现标签列表
  2. 对有价值的标签点击"有用"按钮
  3. 对无关的标签点击"无用"按钮
  4. 对 AI 幻觉产生的错误标签点击"错误"按钮
  5. 系统即时保存反馈到 `voc.tag_feedback` 表，页面给予视觉反馈（按钮高亮）
- **异常流程**：
  - 用户修改之前的反馈 → 系统更新反馈记录（`updated_at` 刷新）
  - 网络中断 → 前端本地暂存，恢复后自动同步
- **验收标准**：
  - AC1：反馈操作响应时间 < 500ms
  - AC2：反馈数据正确关联到 `tag_id` 和 `user_id`
  - AC3：累计反馈数据可通过 API 查询统计

### US-5：管理层演示场景（原 US-4，编号调整）

- **角色**：作为产品负责人
- **目标**：在 Go/No-Go 评审会上演示 Prism 核心能力，让管理层理解投资价值
- **前置条件**：系统中有经 AI 管线处理的演示数据集（1000+ 条公开 VOC 数据）
- **主流程**：
  1. 打开浏览器进入 Prism 登录，使用演示账号登录
  2. 展示标签列表页：指出涌现标签发现了预设分类无法覆盖的新问题
  3. 展示对比视图：左侧涌现标签结果 vs 右侧预设分类结果，让管理层亲眼看到差异
  4. 展示语义搜索：输入"用户体验差"，返回语义相关而非关键词匹配的结果
  5. 展示置信度标注：指出系统对 AI 输出的透明度设计（"AI 生成，仅供参考"）
  6. 展示反馈按钮：说明系统具备人机协同的质量改进机制
- **异常流程**：无特殊异常
- **验收标准**：
  - AC1：完整演示流程可在 5 分钟内完成
  - AC2：演示数据集中至少包含 3 个"令人惊喜"的涌现标签
  - AC3：对比视图清晰展示涌现标签与预设分类的差异
  - AC4：UI 在非技术受众面前可理解、可操作

### US-6：合成数据冷启动（原 US-5，编号调整）

- **角色**：作为 AI 工程师
- **目标**：用高质量合成数据初始化标签标准化表，避免真实用户看到冷启动阶段散乱的标签
- **前置条件**：LLM Provider 已配置；合成数据生成 Prompt 已就绪
- **主流程**：
  1. 使用 LLM 生成 1000-3000 条模拟 VOC 反馈（覆盖多种表达风格和主题）
  2. 将合成数据通过 CSV 导入管线
  3. AI 管线处理后积累初始标签标准化表和同义词映射
  4. 验证标签标准化效果（"加载慢""响应慢""卡顿"是否被合理聚合）
  5. 真实用户数据进入时，系统基于已积累的标签知识进行更高质量的标注
- **异常流程**：
  - 合成数据领域与真实业务不匹配 → 标签标准化表中特定领域条目被真实数据覆盖
- **验收标准**：
  - AC1：合成数据处理完成后，系统中存在至少 50 个已标准化的标签
  - AC2：同义标签合并率 > 30%（如"加载慢"和"响应慢"被合并或关联）

### US-7：涌现标签 vs 预设分类对比验证（原 US-6，编号调整）

- **角色**：作为产品负责人
- **目标**：我需要科学地验证涌现标签是否真的比传统预设分类更有价值
- **前置条件**：系统已处理一批数据（至少 500 条），涌现标签和预设分类结果均已生成
- **主流程**：
  1. 用户在对比验证页面选择一个数据集
  2. 系统左侧展示涌现标签结果，右侧展示基于关键词匹配的预设分类结果
  3. 用户逐组对比，标记"涌现标签更好""预设分类更好""差不多"
  4. 系统统计用户偏好数据，展示涌现标签的"胜率"
- **异常流程**：
  - 预设分类引擎结果为空 → 提示"未匹配到预设分类"
- **验收标准**：
  - AC1：对比视图可同时展示两套标签结果
  - AC2：用户偏好数据正确记录并可查询

### US-8：LLM 模型槽位配置（R5-B 决议，新增）

- **角色**：作为系统管理员（初期即开发团队成员）
- **目标**：我需要为 Prism 的 4 种 LLM 能力分别配置模型和降级方案，确保 AI 管线能正常运行
- **前置条件**：
  - 已登录 Prism 管理后台
  - 至少配置了 1 个 LLM Provider（含有效 API Key）
  - Provider 连通性测试通过
- **主流程**：
  1. 用户进入"模型配置"页面，看到 4 个模型槽位卡片：
     - **快速模型**（fast）：用于格式校验、快速分类等低延迟任务
     - **推理模型**（reasoning）：用于语义拆解、标签涌现等深度分析任务
     - **向量化模型**（embedding）：用于文本向量化
     - **重排序模型**（rerank）：用于搜索结果排序优化
  2. 每个卡片显示当前配置状态（已配置/未配置）和健康状态（健康/异常/未知）
  3. 用户点击某个卡片（如"推理模型"），进入配置面板：
     - 选择 Provider（下拉列表，只显示已启用的 Provider）
     - 输入模型 ID（如 `Qwen/Qwen2.5-72B-Instruct`）
     - （可选）配置调用参数覆盖（temperature、max_tokens）
     - （可选）添加降级链：点击"添加降级模型"，选择备选 Provider + 模型 ID，可排序
  4. 用户点击"测试连通性"按钮，系统调用 `POST /api/llm/admin/slots/{slot_type}/test` 验证配置有效
  5. 测试通过后，用户点击"保存"，配置即时生效
  6. 返回槽位卡片列表，已配置的卡片显示绿色"已就绪"状态
- **异常流程**：
  - 连通性测试失败 → 显示错误详情（如"认证失败：无效的 API Key"），不允许保存
  - Provider 被禁用 → 槽位卡片显示"Provider 已禁用"警告，提示用户切换 Provider
  - 保存时 Provider 不存在 → 返回 404 错误，提示用户重新选择
  - 降级链中的 Provider 不可用 → 保存时给出警告但允许保存（降级链是 best-effort 的）
- **验收标准**：
  - AC1：4 个槽位的配置独立保存，互不影响
  - AC2：每个槽位的连通性测试在 10 秒内返回结果
  - AC3：降级链支持至少 3 个降级模型的有序配置
  - AC4：槽位配置变更后，下次 LLM 调用即使用新配置（无需重启服务）
  - AC5：未配置的槽位在被调用时返回明确的错误信息（HTTP 503 + `"error": {"code": "SLOT_NOT_CONFIGURED"}`）
  - AC6：配置变更产生结构化日志（含变更前后快照）

### US-9：LLM Studio — 交互式模型测试工作台（计划外，已实现）

- **角色**：作为一个 LLM 工程师或系统管理员
- **目标**：我需要一个交互式工作台来测试不同 Provider/模型的能力（Chat、Embedding、Rerank），验证槽位配置和故障转移行为
- **前置条件**：已登录 + 至少配置了 1 个 Provider
- **主流程**：
  1. Playground：选择 Provider/Model → 三模式测试（Chat 流式对话 / Embedding 向量化+相似度矩阵 / Rerank 重排序）
  2. 槽位测试：选择槽位 → 发送消息 → 查看路由决策 + 故障转移时间线
- **验收标准**：
  - AC1：Chat 模式可流式显示模型回复
  - AC2：Embedding 模式可展示向量维度和余弦相似度矩阵
  - AC3：槽位调用可展示 routing 信息和 failover_trace

---

## 3. 功能清单

### 3.1 Must Have（加权分 >= 3.5，R4 通过）

| # | 功能 | R4 加权分 | 工时 | 来源议题 | 关键约束 |
|---|------|----------|------|---------|---------|
| F1 | CSV/Excel 数据导入 + LLM Schema 自动映射（R5-A 决议，原"CSV 数据导入"扩展） | 4.18 | 12-15 人天 | b, 修正#1 | 含 Excel 解析（openpyxl）+ LLM 映射 Prompt + SchemaMapping 模型 + 前端映射预览 |
| F2 | Stage 2 标签涌现 + 基础标准化 | 4.00 | 5 人天 | d | 附三个质量保障条件 |
| F3 | Stage 3 向量化 + pgvector 索引 | 4.21 | 3 人天 | b | Qwen-Embedding-8B, 1024 维, HNSW 索引 |
| F4 | `vector_search` 语义搜索 API | 4.21 | 3 人天 | b | P95 < 2 秒 |
| F5 | LLM 输出守卫层 L1（格式校验）+ L2（语义一致性） | 3.85 | 3 人天 | b, d | 周安安全底线 |
| F6 | 置信度三档展示 + "AI 生成"标注 | 4.00 | 2 人天 | d | 不展示具体数值，仅颜色编码 |
| F7 | 精简版 Agent：Principal 抽象 | 3.57 | 3 人天 | c | Type 1 决策，不可精简 |
| F8 | 精简版 Agent：YAML SkillRegistry + Protocol 接口 | 3.57 | 2 人天 | c | 预留 DB 迁移路径 |
| F9 | 精简版 Agent：精简 Agent Loop | 3.57 | 6.5 人天 | c | 含硬编码迭代上限 + token 计数 |
| F10 | `voc` Schema 独立 | 架构提升 | 含在数据模型中 | b | 架构红线，不可协商 |
| F11 | 前端：数据导入页 | 3.93 | 3 人天 | e | 含上传进度、错误处理 |
| F12 | 前端：语义搜索页 | 3.93 | 4 人天 | e | 含标签侧栏、结果列表 |
| F13 | 前端：标签列表页 | 3.93 | 3 人天 | e | 含置信度颜色编码、反馈按钮 |
| F14 | 最小反馈机制（三元反馈按钮 + tag_feedback 表） | 3.76 | 2.5 人天 | g | 排在核心功能之后 |
| F15 | 对比基线验证（涌现 vs 预设分类对比视图） | 3.53 | 3-5 人天 | b, d | 验证 VP1 核心假设 |
| F16 | 合成数据冷启动 | — | 3 人天 | d | 1000-3000 条种子数据 |
| F17 | 内部 dogfooding + 4 周退出窗口 | 4.04 | 0（运营） | f | 4 周后必须接触外部用户 |
| F18 | Excel 上传支持（R5-A 决议） | — | ※F1 子项 | 修正#1 | 含 openpyxl 集成；独立估算约 1 人天，已包含在 F1 的 12-15 人天内 |
| F19 | LLM Schema 自动映射服务（R5-A 决议） | — | ※F1 子项 | 修正#1 | 含 Prompt 开发、SchemaMapping 模型；独立估算约 3-5 人天，已包含在 F1 的 12-15 人天内 |
| F20 | 前端映射确认 UI（R5-A 决议） | — | ※F1 子项 | 修正#1 | 含置信度高亮；独立估算约 1-2 人天，已包含在 F1 的 12-15 人天内 |
| F21 | llm-service 4 槽位模型（R5-B 决议） | — | 3-5 人天 | 修正#5 | Phase 2 内完成，替代原别名系统；SlotRouter 独立封装 |
| F22 | 懂车帝爬虫（独立脚本）（R5-A 决议） | — | 5-8 人天 | 修正#2 | Wave 2, M8；含反爬处理、分页、数据解析 |
| F23 | 微博爬虫（独立脚本）（R5-A 决议） | — | 5-8 人天 | 修正#3 | Wave 2, M8；微博反爬更复杂，含登录态处理 |
| F24 | 增量采集/去重引擎（R5-A 决议） | — | 1-1.5 人天 | 修正#4 | content hash（SHA-256）+ IngestionBatch 模型 |
| F25 | Neo4j 最小连接层（R5-C 决议） | — | 1 人天 | 修正#6 | 仅连接池 + health check，无业务逻辑 |
| F26 | 弹性策略 L0（连接池配置）（R5-C 决议） | — | 0.5 人天 | 修正#6 | SQLAlchemy pool_size/max_overflow 显式配置 |
| F27 | LLM Studio（Playground + 槽位测试 + 推理代理网关）（计划外） | — | 5-7 人天 | 开发过程中 | 含后端 gateway API + 前端 Studio 模块 |

> **UI 设计规范**：LLM Studio 采用 Liquid Glass 设计系统，布局为 OpenAI Playground 风格左右分栏。详见 `docs/designs/frontend/design.md` 第 10 章。

**Must Have 工时汇总（R5 修订后）**：
- **Wave 1 Must Have**：约 72-80 人天（原 F1-F17 调整后 + F18-F21 + F25-F26，含联调测试）
- **Wave 2 Must Have**：约 13-21 人天（F22 + F23 + F24 + 联调测试）
- **合计**：约 85-101 人天

### 3.2 Should Have（3.0 - 3.5，时间允许则做）

| # | 功能 | R4 加权分 | 工时 | 优先级 | 备注 |
|---|------|----------|------|--------|------|
| S1 | 前端第二批（反馈详情页 + 置信度精细交互 + 审核列表） | 3.37 | 10 人天 | Phase 3 后冲刺 | 从"能用"到"好用" |
| S2 | Agent 精简版还债（SkillRegistry 迁移 DB + Loop 配置化） | 3.24 | 8-13 人天 | Phase 3 后强制 | 陈思琪保留否决权 |
| S3 | 行为追踪埋点（标签点击、搜索查询、停留时间） | 3.16 | 1 人天 | 与反馈按钮互补 | 林晓薇建议 |
| S4 | Agent 行为评估基准（10 个标准化测试任务） | 3.14 | 3-5 人天 | Phase 3 交付前建立 | 赵一凡建议 |
| S5 | Redis 缓存失效降级（L3 弹性）（R5-C 决议） | — | 1 人天 | Phase 1 单机部署 | Redis 失效降级到 DB 直查 |

### 3.3 Won't Have（< 3.0，推迟到后续阶段）

| # | 功能 | R4 加权分 | 推迟到 | 推迟理由 |
|---|------|----------|--------|---------|
| W1 | Stage 4 关系构建 | 2.57 | Phase 3 后续 | AI 管线前三阶段优先；关系构建依赖标签积累到一定规模 |
| W2 | 完整 Signal -> Concept 治理工作台 | 2.81 | Phase 4 | 依赖五个并行分析器自动产生 Signal，Phase 3 不存在治理对象 |
| W3 | Agent 对话界面（SSE 流式） | 2.43 | Phase 5 | 前端复杂度过高；Phase 3 聚焦数据页面而非对话界面 |
| W4 | 数据可视化图表（趋势线、热力图） | 2.53 | Phase 4+ | 需要数据积累到一定规模才有统计意义 |
| W5 | 可配置周期性采集（R5-C 决议） | — | Phase 2 | Phase 1 只做手动触发，周期性采集需 dev-browser 通用框架 |
| W6 | Neo4j 知识图谱功能（R5-C 决议） | — | Phase 2 | Phase 1 数据量不足，Phase 2 启用 Stage 4 关系构建后再激活图谱 |
| W7 | 水平扩展部署（L4 弹性）（R5-C 决议） | — | Phase 4+ | Phase 1 单机 Docker Compose 部署，Kubernetes 扩展推迟 |

详见 `03-deferred-features.md`。

---

## 4. 技术架构约束

### 4.1 依赖图

```
apps/web → (HTTP) → llm-service, voc-service → (import) → shared → PostgreSQL, Redis
```

**依赖方向不可逆**：shared → services → apps。违反此方向的需求一律拒绝（R1 辩论 a，赵一凡）。

### 4.2 数据模型

**Schema 隔离（不可协商）**：

| Schema | 归属 | Phase 1 状态 | 新增时间 |
|--------|------|-------------|---------|
| `auth` | user-service | 已就位 | Phase 1 |
| `llm` | llm-service | 已就位 | Phase 1 |
| `agent` | Agent 服务 | Phase 2.5 引入 | Phase 2.5 |
| `voc` | VOC 数据 | Phase 3 引入 | Phase 3 |

**Neo4j**：不属于 PostgreSQL Schema 体系。Phase 1 仅建立最小连接层（连接池 + health check），不含业务逻辑。Phase 2 启用知识图谱时，通过 label 前缀（如 `voc_Tag`、`voc_Relation`）隔离不同领域的图数据（R5-C 决议）。

**核心实体（`voc` Schema）**：

```
Voice（原始反馈）
├── id: UUID (PK)
├── source: String (CSV / Excel / API / ...)
├── raw_text: Text
├── content_hash: String (SHA-256, NOT NULL)                    [R5-A 新增，增量去重]
├── batch_id: UUID (FK → IngestionBatch, NULLABLE)              [R5-A 新增，批次追溯]
├── created_at: Timestamp
├── processed_status: Enum (pending / processing / completed / failed)
└── metadata: JSONB

SemanticUnit（语义单元，1 Voice → 1-N Unit）
├── id: UUID (PK)
├── voice_id: UUID (FK → Voice)
├── text: Text
├── summary: String
├── intent: String
├── sentiment: Enum (positive / negative / neutral / mixed)
├── confidence: Float
├── embedding: vector(1024) (pgvector, Qwen-Embedding-8B, HNSW)
└── created_at: Timestamp

EmergentTag（涌现标签）
├── id: UUID (PK)
├── name: String (标准化后)
├── raw_name: String (LLM 原始输出)
├── usage_count: Integer
├── status: Enum (active / merged / deprecated) [预留治理字段]
├── confidence: Float [预留治理字段]
├── parent_tag_id: UUID (nullable, FK → self) [预留合并字段，方若琳建议]
└── created_at: Timestamp

UnitTagAssociation（Unit-Tag 关联）
├── unit_id: UUID (FK → SemanticUnit)
├── tag_id: UUID (FK → EmergentTag)
├── relevance: Float
└── is_primary: Boolean

TagFeedback（标签反馈）
├── id: UUID (PK)
├── tag_id: UUID (FK → EmergentTag)
├── user_id: UUID (FK → auth.User)
├── feedback_type: Enum (useful / useless / error)
├── created_at: Timestamp
└── updated_at: Timestamp

SchemaMapping（Schema 映射模板）                                 [R5-A 新增]
├── id: UUID (PK)
├── tenant_id: UUID
├── name: String                    # 映射名称（如"懂车帝评论数据"）
├── source_format: String           # csv / excel / json
├── column_mappings: JSONB          # {"原始列名": "voice 字段名"}
├── created_by: String              # "llm" / "user" / "llm+user_confirmed"
├── confidence: Float               # LLM 映射的整体置信度
├── sample_data: JSONB              # 采样数据（用于展示预览）
├── usage_count: Integer            # 复用次数
├── created_at: Timestamp
└── updated_at: Timestamp

IngestionBatch（导入批次）                                       [R5-A 新增]
├── id: UUID (PK)
├── tenant_id: UUID
├── source: String                  # "csv_upload" / "excel_upload" / "crawler_dongchedi" / "crawler_weibo"
├── total_count: Integer            # 总记录数
├── new_count: Integer              # 新增数
├── duplicate_count: Integer        # 重复跳过数
├── failed_count: Integer           # 失败数
├── status: Enum (pending / processing / completed / failed)
├── created_at: Timestamp
└── completed_at: Timestamp (nullable)

CrawlState（爬虫增量状态表）                                     [R5-C 新增，Wave 2]
├── id: UUID (PK)
├── crawler_name: String            # "crawl_dongchedi" / "crawl_weibo"
├── last_crawl_at: Timestamp
├── last_position: JSONB            # 上次采集位置（结构因爬虫而异）
├── status: Enum (active / blocked / cooldown)
├── cooldown_until: Timestamp (nullable)
└── metadata: JSONB
```

**Agent 相关实体（`agent` Schema）**：

```
Principal（统一身份，精简版）
→ 通过中间件注入 request context: {"type": "human" | "agent", "id": "xxx"}

SkillRegistry（精简版，YAML 配置 → Phase 3 后迁移 DB）
├── name: String
├── description: String
├── input_schema: JSON Schema
├── output_schema: JSON Schema
└── cost_metadata: JSON

AgentExecutionLog（审计日志）
├── id: UUID (PK)
├── principal_id: String
├── principal_type: Enum (human / agent)
├── skill_name: String
├── input_params: JSONB
├── output_result: JSONB
├── token_usage: Integer
├── duration_ms: Integer
├── status: Enum (success / failed / terminated)
└── created_at: Timestamp
```

**LLM 相关实体（`llm` Schema）**（R5-B 决议，4 槽位模型替代别名系统）：

```sql
CREATE TYPE llm.slot_type AS ENUM ('fast', 'reasoning', 'embedding', 'rerank');

CREATE TABLE llm.model_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_type llm.slot_type UNIQUE NOT NULL,
    primary_provider_id UUID NOT NULL REFERENCES llm.providers(id) ON DELETE RESTRICT,
    primary_model_id VARCHAR(200) NOT NULL,
    fallback_chain JSONB DEFAULT '[]'::jsonb,
    is_enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- fallback_chain 格式：[{"provider_id": "uuid", "model_id": "string"}]
-- config 格式：{"temperature": 0.7, "max_tokens": 4096, "timeout_ms": 30000}
-- 槽位与 AI 管线映射：
--   fast      → 守卫层 L1 格式校验、Stage 2 标签标准化
--   reasoning → Stage 1 语义拆解、Stage 2 标签涌现、合成数据生成
--   embedding → Stage 3 向量化
--   rerank    → 搜索结果重排序
```

### 4.3 API 契约

**统一响应格式**：
```json
{
  "data": "...",
  "meta": { "request_id": "uuid", "timestamp": "ISO 8601" }
}
```

**统一错误格式**：
```json
{
  "error": { "code": "VALIDATION_ERROR", "message": "..." }
}
```

**核心 VOC API 端点（Phase 3 新增）**：

| 端点 | 方法 | 优先级 | 说明 |
|------|------|--------|------|
| `/api/voc/import` | POST | Must Have | CSV/Excel 批量导入 Voice（含 LLM Schema 映射） |
| `/api/voc/import/{id}/status` | GET | Must Have | 查询导入任务状态 |
| `/api/voc/search` | POST | Must Have | 语义搜索（vector_search） |
| `/api/voc/tags` | GET | Must Have | 涌现标签列表（含频率排序） |
| `/api/voc/tags/{id}/units` | GET | Must Have | 标签关联的 SemanticUnit |
| `/api/voc/units/{id}` | GET | Must Have | SemanticUnit 详情（含原始 Voice） |
| `/api/voc/voices/{id}` | GET | Must Have | 原始 Voice 全文 |
| `/api/voc/tags/{id}/feedback` | POST | Must Have | 提交标签反馈 |
| `/api/voc/tags/compare` | GET | Must Have | 涌现标签 vs 预设分类对比 |

**爬虫 API 端点（R5-A 决议，Wave 2 新增）**：

| 端点 | 方法 | 优先级 | 说明 |
|------|------|--------|------|
| `/api/voc/crawl/trigger` | POST | Wave 2 | 触发爬虫采集（懂车帝/微博） |
| `/api/voc/crawl/{id}/status` | GET | Wave 2 | 查询采集任务状态 |

**Agent 端点（Phase 2.5 精简版）**：

| 端点 | 方法 | 优先级 | 说明 |
|------|------|--------|------|
| `/api/agent/skills` | GET | Must Have | 可用 Skill 列表 |
| `/api/agent/execute` | POST | Must Have | 执行 Agent 任务 |
| `/api/agent/executions/{id}` | GET | Must Have | Agent 执行日志 |

**LLM 槽位管理 API（R5-B 决议）**：

| 端点 | 方法 | 优先级 | 说明 |
|------|------|--------|------|
| `/api/llm/admin/slots` | GET | Must Have | 获取所有槽位配置 |
| `/api/llm/admin/slots/{slot_type}` | PUT | Must Have | 更新指定槽位配置 |
| `/api/llm/admin/slots/{slot_type}/test` | POST | Must Have | 测试指定槽位连通性 |

**LLM 调用类 API 变更**（R5-B 决议）：Chat 端点支持通过 `slot` 参数指定槽位（默认 `reasoning`，可选 `fast`）；Embedding / Rerank 端点各对应一个固定槽位，无需指定。

**API 契约约束**：API 契约一旦冻结不允许 breaking change（新增字段可以，删除/重命名不行）。前端严格消费 OpenAPI Schema 生成的 TypeScript 类型。

### 4.4 基础设施（R5-C 决议，新增 Neo4j）

| 服务 | 镜像 | 端口 | Phase 1 角色 |
|------|------|------|-------------|
| PostgreSQL + pgvector | pgvector/pgvector:pg17 | 5432 | 核心关系 DB + 向量检索 |
| Redis | redis:7-alpine | 6379 | 缓存、会话管理 |
| Neo4j | neo4j:5 | 7474/7687 | 基础设施就位，最小连接层（Phase 2 启用图谱） |

### 4.5 弹性策略（R5-C 决议，新增）

| 层级 | 策略 | Phase 1 状态 | 实现方式 |
|------|------|-------------|---------|
| L0 | 连接池管理 | Must Have | SQLAlchemy pool_size/max_overflow 显式配置 |
| L1 | LLM 弹性 | Must Have（已有） | 故障转移降级链 + 单任务 Token 上限 |
| L2 | 爬虫弹性 | Must Have（Wave 2） | 指数退避 + 冷却期 + 部分采集标记 |
| L3 | 缓存弹性 | Should Have | Redis 失效降级到 DB 直查 |
| L4 | 水平扩展 | Won't Have | Phase 4+ Kubernetes 部署 |

### 4.6 Schema 隔离

四个 Schema（`auth` / `llm` / `agent` / `voc`）共用同一个 PostgreSQL 实例，通过 Schema 级别隔离。每个 Schema 独立执行 Alembic 迁移，互不干扰。跨 Schema 引用仅允许通过 API 调用，不允许跨 Schema 的外键约束——唯一例外是 `voc.tag_feedback.user_id` 引用 `auth.user.id`（R3 技术组确认此为可接受的妥协）。

---

## 5. 非功能需求

### 5.1 性能

| 指标 | 要求 | 验证方式 |
|------|------|---------|
| 单条 Voice 端到端处理 | < 10 秒 | 基准测试 |
| 千条批量导入处理 | < 30 分钟 | 基准测试 |
| 语义搜索 P95 延迟 | < 2 秒 | 负载测试 |
| pgvector 10 万向量查询 P95 | < 100ms | Phase 3 基准测试 |
| 单次爬虫采集超时（R5-C 决议） | < 5 分钟 | 爬虫执行日志 |
| 爬虫请求频率上限（R5-A 决议） | <= 1 次/秒 | 爬虫配置约束 |

### 5.2 安全

| 要求 | 说明 |
|------|------|
| 全 API 认证 | JWT（Human）/ API Key（Agent），统一 Principal |
| 审计日志 | Agent 每次执行生成完整日志；所有数据导入操作记录 |
| 数据安全 | Dogfooding 数据如包含 PII 须脱敏后导入 |
| AI 输出标注 | 所有涌现标签统一标注"AI 生成，仅供参考" |
| 置信度展示 | 三档颜色编码，不展示具体数值（避免虚假信心） |
| 爬虫合规（R5-A 决议） | 尊重 robots.txt、控制请求频率、数据仅用于客户自身分析 |

### 5.3 可观测性

| 阶段 | 要求 |
|------|------|
| Phase 3 | 结构化日志（JSON 格式）+ 错误追踪（异常堆栈上报） |
| Phase 6（推迟） | 完整可观测性（Prometheus + Grafana + OpenTelemetry） |

---

## 6. 排期与里程碑

### 6.1 总时间线

以 Phase 2 完成时间点为基线（W0），总工期约 18-22 周（R5-C 决议，原 14-18 周延长），采用两波交付模式。

```
W0          W3          W7          W9          W12         W16         W20-22
|           |           |           |           |           |           |
v           v           v           v           v           v           v
M1          M2          M3          M4          M5/M6       M7          M8
Phase 2     Phase 2.5   数据底座    语义搜索    前端+集成    假设验证     爬虫+增量
完成+槽位   精简+Neo4j  +LLM映射    完成        Dogfooding   Go/No-Go    采集就位
```

### 6.2 里程碑定义

| 里程碑 | 时间 | 交付物 | 团队 | Go/No-Go 条件 |
|--------|------|--------|------|--------------|
| **M1: Phase 2 完成** | W0 | LLM 网关（Chat/Embed API + 故障转移 + CLI）+ **4 槽位模型**（R5-B）+ **弹性 L0**（R5-C） | 后端x2 + 前端x0.5 | Chat API 可用 + 降级演示通过 + 4 槽位可配置 |
| **M2: Phase 2.5 精简完成** | W0 + 3 周 | Principal 抽象 + YAML SkillRegistry + 精简 Agent Loop + **Neo4j 最小连接层**（R5-C） | 后端x2 | Agent 完成一次 ReAct 循环 + 审计日志生成 |
| **M3: Phase 3 数据底座** | W0 + 7 周 | CSV/Excel 导入 + **LLM Schema 自动映射**（R5-A）+ Stage 1 语义拆解 + Stage 2 标签涌现 + 标准化 + **增量去重**（R5-A） | 后端x2 + AI x1 | 导入 1000 条数据，产出涌现标签；LLM 映射准确率 > 90% |
| **M4: Phase 3 语义搜索** | W0 + 9 周 | Stage 3 向量化 + vector_search API + 守卫层 L1/L2 | 后端x2 + AI x1 | 搜索"支付卡顿"返回语义相关结果 |
| **M5: Phase 3 前端 + 集成** | W0 + 12 周 | 数据导入页（含**映射确认 UI**，R5-A）+ 搜索页 + 标签列表页 + 对比视图 + **槽位配置页**（R5-B）+ 联调 | 前端x1 + 全员联调 | 完整端到端流程可演示 |
| **M6: Dogfooding 启动** | W0 + 12 周 | 内部团队开始使用 Prism 分析真实数据 | 全员 | — |
| **M7: 假设验证检查点** | W0 + 16 周 | 100+ 条标签反馈 + 至少 1 次外部用户演示 + **Wave 2 Go/No-Go 判定**（R5-C） | PM x0.5 | 标注一致性 > 70%，外部信号积极 |
| **M8: 爬虫 + 增量采集就位**（R5-A/C 新增） | W0 + 20-22 周 | 懂车帝爬虫 + 微博爬虫 + 增量去重引擎 + CLI 集成 + 爬虫弹性 L2 | 后端x1（专职） | 爬虫采集成功率 > 90%；增量去重正确运行 |

### 6.3 Go/No-Go 评审点

**M1（Phase 2 完成）**是产品第一阶段的关键评审点。评审内容：
1. LLM Chat/Embedding API 是否稳定可用？
2. 故障转移是否生效？
3. API 契约是否达到"冻结"标准？
4. 4 槽位模型是否可配置且正常路由？（R5-B）

三项全部通过 → Go（启动 Phase 2.5 精简版）。任一未通过 → 暂停修复后再评审。

**M5（Phase 3 前端集成完成）**是产品第一阶段的最终验收点。评审内容：
1. 端到端流程是否可演示？（US-1 到 US-5 全部通过）
2. AI 管线处理可靠性 > 95%？
3. 语义搜索 Top-5 命中率 > 60%？
4. 涌现标签数量 >= 20 个？

**M7（假设验证 + Wave 2 Go/No-Go）**（R5-C 决议，新增 Wave 2 判定）：
- 涌现标签在对比验证中"胜率" >= 60% → **Go**，启动 Wave 2 全部内容（懂车帝 + 微博爬虫）
- "胜率" < 40% → **No-Go**，Wave 2 暂停，团队转向根因分析
- "胜率"在 40%-60% 之间 → **有条件 Go**，Wave 2 只做懂车帝爬虫，微博爬虫暂缓

**Dogfooding 运营计划（M6-M7，方若琳交叉审查建议）**：

| 周次 | 活动 | 负责人 |
|------|------|--------|
| 第 1 周 | 全员导入数据并开始使用 Prism | 全员 |
| 第 2 周 | 收集内部反馈，讨论 AI 管线质量 | AI 工程师 |
| 第 3 周 | 安排至少 1 次外部用户产品演示 | PM |
| 第 4 周 | 汇总反馈数据，准备 M7 评审 | PM + 全员 |

---

## 7. 风险与缓解

| # | 风险 | 概率 | 影响 | 缓解措施 | 责任人 |
|---|------|------|------|---------|--------|
| R1 | 涌现标签在小数据量下效果不显著 | 高 | 高 | 合成数据冷启动（1000-3000 条种子）；标注一致性 > 70% 基线；对比基线验证（Must Have） | 陈思琪 |
| R2 | LLM 幻觉产生错误标签被当作事实 | 中 | 高 | 置信度三档展示 + "AI 生成"标注 + 三元反馈 + L1/L2 守卫层 | 周安 |
| R3 | Phase 3 工期超出预期 | 中 | 中 | Stage 4 已列为 Won't Have；前端分两批；两波交付分散风险 | 王磊 |
| R4 | 精简版 Agent 还债被跳过 | 中 | 高 | 陈思琪保留否决权；M5 验收后 2 周内强制执行 | 陈思琪 |
| R5 | Dogfooding 反馈不具代表性 | 高 | 中 | 4 周退出窗口强制接触外部用户；概念验证访谈可并行；行为追踪埋点补充 | 林晓薇 |
| R6 | Phase 2 API 不稳定影响 Phase 3 | 中 | 高 | Phase 2 必须达到"API 冻结"状态后才启动 Phase 3（R1 辩论 b，赵一凡条件） | 赵一凡 |
| R7 | 前端开发与 API 迭代冲突 | 中 | 低 | 前端在 API 契约稳定后启动；严格基于 OpenAPI Schema TypeScript 类型开发 | 王磊 |
| R8 | 爬虫反爬风险（R5-A 决议） | 高 | 高 | 指数退避 + 冷却期 + 3 周工期上限（超时则降级为手动导入）；遵守 robots.txt | 王磊 |
| R9 | LLM Schema 映射准确率不达标（R5-A 决议） | 中 | 中 | 预置已知格式模板 fallback + 首次映射人工确认 + 低置信度（< 0.7）暂停 | 陈思琪 |
| R10 | 增量去重边界情况（R5-A 决议） | 低 | 低 | content hash（SHA-256）碰撞率可忽略不计；模糊去重推迟到 Phase 2 | 赵一凡 |
| R11 | Wave 2 工期缓冲不足（R5-C 决议） | 中 | 中 | M7 Go/No-Go 止损机制；爬虫工时上限 3 周；有条件 Go 可只做懂车帝 | 苏明远 |

---

## 8. 决策记录

### 议题 a：第一阶段的边界在哪里？

- **R1 投票**：正方 3 : 反方 2 : 弃权 2（R1-batch1.md）
- **核心分歧**：苏明远主张产品第一阶段推到可感知价值（Phase 3），赵一凡主张严格按技术阶段走
- **R2 妥协**：对外目标为"到达可感知价值"，对内保持三阶段独立验收。方若琳和林晓薇补充假设验证指标
- **R4 加权分**：3.97（Must Have）
- **最终决策**：产品第一阶段 = Phase 2 + Phase 2.5 精简 + Phase 3 核心子集，18-22 周（R5 修订后）。Phase 2 保留 Go/No-Go

### 议题 b：MVP 功能范围多大？

- **R1 投票**：正方 5 : 反方 0 : 弃权 2（R1-batch1.md）
- **共识**：MVP 必须包含数据摄入 + 涌现标签 + 语义搜索 + 守卫层 + 三元反馈
- **R4 结果**：相关条目（#2-#6）全部通过 Must Have，加权分 3.85-4.21
- **关键条件**：Phase 2 API 冻结后启动；Stage 4 不进入 MVP

### 议题 c：Agent-First 从第一天就要吗？

- **R1 投票**：正方 1 : 反方 4 : 弃权 2（R1-batch1.md）
- **共识**：渐进式 Agent——Type 1 决策（Principal 抽象）做对，Type 2 决策（SkillRegistry、Loop）先简后补
- **R4 加权分**：3.57（Must Have），精简版 11.5 人天（对比完整方案 33 人天）
- **还债计划**：Phase 3 后 2 周内完成，陈思琪保留否决权

### 议题 d：涌现标签是否必须进入第一阶段？

- **R1 投票**：正方 6 : 反方 0 : 弃权 1（R1-batch2.md）
- **共识**：涌现标签进入第一阶段，附三个质量保障条件（置信度展示、L1/L2 守卫层、三元反馈）
- **R4 加权分**：4.00（Must Have）
- **种子数据策略**：1000-3000 条合成数据冷启动，周安有条件接受

### 议题 e：前端投入多少？

- **R1 投票**：正方 5 : 反方 1 : 弃权 1（R1-batch2.md）
- **共识**：王磊"两批交付"方案。第一批 Phase 3 内 3 页面（Must Have），第二批 Phase 3 后冲刺（Should Have）
- **R4 加权分**：第一批 3.93（Must Have），第二批 3.37（Should Have）
- **API First**：前端不得要求后端修改 API 契约

### 议题 f：目标用户是谁？

- **R1 投票**：正方 2 : 反方 4 : 弃权 1（R1-batch3.md）
- **共识**：先 dogfooding + 4 周退出窗口。苏明远明确接受林晓薇的退出条件
- **R4 加权分**：4.04（Must Have）
- **并行活动**：林晓薇的概念验证访谈可在开发期间并行（不阻塞）

### 议题 g：是否需要治理/采纳机制？

- **R1 投票**：正方 5 : 反方 0 : 弃权 1（R1-batch3.md）
- **共识**：最小反馈机制（thumbs-up/down/error），排在 Must Have 之后、其他 Should Have 之前
- **R4 加权分**：3.76（Must Have）
- **方若琳让步**：从 3 组件（按钮 + 仪表板 + 过滤）降级为 1 组件（按钮），2.5 人天

### 议题 h：数据输入 Schema 不固定如何处理？（R5-A 决议，新增）

- **R5-A 投票**：7:0 支持 LLM 自动映射方案（其中 2 票有条件支持）
- **核心分歧**：陈思琪主张 LLM 自动映射可行 vs 周安要求人工安全网
- **决策**：用户上传 CSV/Excel 采用 LLM 自动映射 + 首次确认预览 + 映射模板缓存复用。爬虫数据采用硬编码解析器。低置信度映射（< 0.8）高亮提示，< 0.7 暂停等待确认
- **附加条件**：SchemaMapping 持久化（赵一凡）、为阿维塔/Peets 预置模板（林晓薇）

### 议题 i：Phase 1 是否包含爬虫？（R5-A 决议，新增）

- **R5-A 投票**：7:0 支持爬虫进入 Phase 1（其中 3 票有条件支持）
- **核心分歧**：苏明远/林晓薇主张真实用户的真实需求必须响应 vs 赵一凡关注架构耦合风险
- **决策**：懂车帝 + 微博爬虫作为独立 Python 脚本进入 Phase 1 Wave 2。通过 CLI 触发，输出标准化 JSON，走正常摄入管线。不与 Agent/Skill 引擎深度耦合
- **附加条件**：独立脚本架构（赵一凡）、合规约束（周安）、合规责任归属文档化（方若琳）

### 议题 j：增量模式如何实现？（R5-A 决议，新增）

- **R5-A 投票**：7:0 支持最小增量方案（其中 2 票有条件支持）
- **核心分歧**：赵一凡主张系统性增量设计 vs 王磊主张最小增量即可
- **决策**：Phase 1 增量去重 = content hash（SHA-256）+ 唯一索引 + 精简 IngestionBatch 模型。导入完成后展示新增/跳过/失败摘要。模糊去重推迟到 Phase 2
- **附加条件**：精简版 IngestionBatch 必须 Phase 1 落地（赵一凡）、被跳过数据可追溯（周安）

### 议题 k：LLM 自动转化的自动化程度？（R5-A 决议，新增）

- **R5-A 投票**：7:0 支持自动化方案（其中 3 票有条件支持）
- **核心分歧**：方若琳/苏明远主张最大化自动化 vs 周安要求置信度阈值安全网
- **决策**：Phase 1 Raw → Voice 转化设计为默认自动化。首次上传新格式文件保留映射确认（信任建设）。后续复用模板全自动。爬虫数据完全自动入库。低置信度（< 0.7）暂停等待确认

### 议题 l：llm-service 别名系统 vs 4 槽位？（R5-B 决议，新增）

- **R5-B 投票**：7:0 全票通过采用 4 槽位（其中 2 票有条件支持）
- **核心分歧**：苏明远/王磊/林晓薇主张 4 槽位降低认知负担 vs 赵一凡/陈思琪关注扩展性
- **决策**：4 槽位（fast/reasoning/embedding/rerank）替代别名系统。SlotRouter 独立封装，预留 Phase 4 检查点评估是否需要升级为通用别名系统
- **附加条件**：SlotRouter 独立封装（赵一凡）、Phase 4 启动前评估（陈思琪）、故障转移结构化审计日志（周安）

### 议题 m：Neo4j 角色与弹性策略？（R5-C 决议，新增）

- **R5-C 投票**：折中方案——正方 3 : 反方 2 : 魔鬼代言人方案 1 : 弃权 1
- **核心分歧**：赵一凡/陈思琪主张建立连接层保证架构完整性 vs 苏明远/王磊主张 Phase 1 聚焦用户价值
- **决策**：Phase 1 保留 Neo4j 基础设施，建立最小连接层（1 人天），但禁止 Phase 1 业务代码依赖 Neo4j。弹性策略分层实施：L0-L2 纳入 Phase 1 各里程碑，L3 为 Should Have，L4 推迟

### R6：LLM Studio 先于 VOC 功能实现

- **决策**：在 VOC 数据导入/搜索/标签功能之前，优先实现 LLM Studio 工作台
- **理由**：LLM Studio 是验证 llm-service 基础设施的必要工具；需要通过交互式测试确认 Provider 配置、模型调用、故障转移等底层能力正常后，才能放心构建依赖它们的上层 VOC 管线
- **影响**：新增 gateway 代理 API + Studio 前端模块，约 5-7 人天

---

## 附录

### A. 讨论记录摘要

| 轮次 | 文件 | 内容 |
|------|------|------|
| R1 Batch 1 | `r1-batch1.md` | 辩论 a（阶段边界）、b（MVP 范围）、c（Agent 时序） |
| R1 Batch 2 | `r1-batch2.md` | 辩论 d（涌现标签）、e（前端投入） |
| R1 Batch 3 | `r1-batch3.md` | 辩论 f（目标用户）、g（治理机制） |
| R2 | `R2-consensus-building.md` | 三区分析 + 妥协构建 + R3 PRD 草案 |
| R4 | `R4-final-voting.md` | 五维评分 + 否决权记录 + 最终分级 |
| R5 Delta A | `R5-delta-review-a.md` | 数据摄入重构：LLM 映射、爬虫、增量去重、自动化程度 |
| R5 Delta B | `R5-delta-review-b.md` | LLM 服务简化：4 槽位模型替代别名系统 |
| R5 Delta C | `R5-delta-review-c.md` | 基础设施 + 架构弹性 + 综合排期影响 |

### B. 投票详情引用

**R4 投票**：
- R4 评分总览表：见 `R4-final-voting.md` "评分总览"
- 否决权记录：2 次触发（#8 Schema 隔离、#16 Agent 还债），均通过申诉机制解决
- 最高分条目：#4 语义搜索（4.21）
- 最低分通过条目：#13 对比基线验证（3.53）

**R5 Delta 评审投票**：

| 议题 | 文档 | 投票结果 | 决议 |
|------|------|---------|------|
| A1：LLM 自动映射策略 | R5-A | 7:0（含 2 有条件） | LLM 映射 + 首次确认 + 模板缓存 |
| A2：爬虫进入 Phase 1 | R5-A | 7:0（含 3 有条件） | 两个爬虫作为独立脚本进入 Phase 1 Wave 2 |
| A3：增量模式设计 | R5-A | 7:0（含 2 有条件） | 最小增量（content hash）+ 精简 IngestionBatch |
| A4：LLM 自动转化程度 | R5-A | 7:0（含 3 有条件） | 默认自动化 + 低置信度暂停 |
| B1：4 槽位 vs 别名系统 | R5-B | 7:0（含 2 有条件） | 4 槽位替代别名系统，SlotRouter 独立封装 |
| B2：故障转移实现 | R5-B | 7:0 | 槽位模式下故障转移更简洁 |
| B3：文档和代码影响 | R5-B | 7:0 | 工时约 6 天，净节省约 5 天 |
| B4：ModelSlot 数据模型 | R5-B | 7:0 | RESTRICT 外键 + UNIQUE Enum 设计 |
| C1：Neo4j Phase 1 角色 | R5-C | 3:2:1:1（折中方案） | 最小连接层 + 文档化 |
| C2：架构弹性策略 | R5-C | 7:0 | L0-L2 分层弹性，L3/L4 推迟 |
| C3：综合排期影响 | R5-C | 7:0 | 18-22 周两波交付，M5 不后移 |
| C4：Phase 1/2 功能边界 | R5-C | 7:0 | Wave 1 + Wave 2 + M7 Go/No-Go |

### C. 术语表

| 术语 | 含义 |
|------|------|
| VOC | Voice of Customer，客户声音 |
| VP1 | Value Proposition 1：涌现式标签 vs 预设分类 |
| SemanticUnit | 语义单元，Voice 经 Stage 1 拆解后的结构化片段 |
| EmergentTag | 涌现标签，LLM 从 SemanticUnit 中自由生成的语义主题 |
| Principal | 统一身份抽象，涵盖 Human（JWT）和 Agent（API Key） |
| Type 1 决策 | 不可逆决策，必须 Day 1 做对（如 Principal 抽象、Schema 隔离） |
| Type 2 决策 | 可逆决策，可先简后补（如 SkillRegistry 持久化方式） |
| L1/L2 守卫层 | LLM 输出质量保障：L1=格式校验，L2=语义一致性检查 |
| Signal | AI 自动发现的语义信号（Phase 4 概念） |
| Concept | 经人类确认后沉淀的知识资产（Phase 4 概念） |
| Dogfooding | 内部团队使用自己的产品进行验证 |
| Design Partner | 愿意在早期阶段使用产品并提供反馈的外部合作者 |
| Wave 1（R5-C 决议） | Phase 1 的核心价值闭环交付（W0-W16），对应 PRD v1.0 + 修正 #1/#5/#6 |
| Wave 2（R5-C 决议） | Phase 1 的数据采集扩展交付（W16-W22），对应修正 #2/#3/#4 |
| L0-L4 弹性分层（R5-C 决议） | 从基础设施弹性（L0 连接池）到水平扩展（L4 Kubernetes）的五层弹性策略 |
| 4 槽位模型（R5-B 决议） | llm-service 的简化模型路由方案（fast/reasoning/embedding/rerank），替代原有别名系统 |
| SchemaMapping（R5-A 决议） | LLM 自动字段映射的模板模型，支持映射结果持久化和复用 |
| IngestionBatch（R5-A 决议） | 导入批次模型，记录每次数据导入的统计信息（总数/新增/重复/失败） |
| content hash（R5-A 决议） | 基于 SHA-256 的内容指纹，用于增量去重 |
| Go/No-Go | 关键里程碑的通过/不通过判定机制 |

---

*本文档为 Prism Phase 1 产品需求文档 v2.0 定稿。基于 PRD v1.0 经 R5 Delta 评审（3 个并行 Agent、12 个议题、全部 7:0 或折中方案通过）后修订。所有新增内容标注来源（R5-A/B/C 决议、修正 #1-#6）。工程团队可据此直接启动开发。*
