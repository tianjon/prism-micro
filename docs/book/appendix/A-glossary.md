# 附录 A：术语表

本术语表涵盖 Prism 项目文档中出现的所有专业术语，按类别分组，每组内按英文字母顺序排列。

---

## 1. 核心概念

| 英文术语 | 中文翻译 | 定义 | 在 Prism 中的用法 |
|---------|---------|------|------------------|
| Concept | 概念 | 经过人类确认的、稳定的知识资产，由 Signal 升级而来，具有稳定 ID、规范名称、别名集合、证据样本和生命周期状态。 | Signal 经过人类"确认"操作后成为 Concept，纳入组织知识库。Concept 是 Prism 知识资产体系的核心产出，支持命名、合并、静音、追踪等治理操作（Phase 4）。 |
| Embedding | 向量嵌入 | 将文本转换为高维实数向量的技术，使语义相似的文本在向量空间中距离较近，从而支持语义搜索和聚类分析。 | 每条 SemanticUnit 在语义拆解管线的 Stage 3 被向量化（默认 1024 维），存入 pgvector 索引，支撑 `vector_search` 和 `get_neighbors` 等原子查询工具。 |
| Emergent Tag | 涌现式标签 | 由 LLM 在处理用户反馈时自由生成的标签，不受预设词表约束，能够捕获全新的、未被预见的语义主题。 | 语义拆解管线 Stage 2 为每个 SemanticUnit 生成 3-7 个涌现式标签，经标准化（去停用词、同义词映射、向量相似度合并）后存入涌现标签库。与 Preset Tag 共同构成"双轨制"标签体系。 |
| Preset Tag | 预设标签 | 使用结构化枚举定义的固定维度标签（如 intent、sentiment），保证统计口径一致。 | 与涌现式标签并行，用于情感极性、意图类型、紧迫度等确定性高的维度，确保跨周期的可比性和统计稳定性。 |
| SemanticUnit | 语义单元 | Prism 数据模型的原子粒子，一个独立的、自包含的、表达单一完整观点的语义片段。 | 一条 Voice 被语义拆解管线拆分为一个或多个 SemanticUnit，每个承载六层信息（内容层、语义分析层、实体层、上下文层、向量层、质量层），是系统中所有检索、标注和关联分析的最小单位。 |
| Signal | 信号 | AI 自动检测到的、尚未经人类确认的不稳定候选洞察，代表数据中"值得注意的变化"。 | 洞察发现引擎的五个分析器（趋势、异常、聚类、情感、涌现）持续监控数据变化，自动产生带优先级（P0-P3）的 Signal。Signal 是"矿石"，需要人类确认后才升级为 Concept（"金属"）。 |
| Source | 数据来源 | 客户反馈的渠道定义，描述数据从何处被采集。 | 通过声明式 Source Adapter 配置接入，支持 8 种来源类型（feedback、review、interview、social、support、survey、nps、community），每种类型有对应的默认字段映射模板。 |
| Tag | 标签 | 对语义片段进行标注的结果，分为涌现式标签和预设标签两类。 | 标签是 Prism 语义理解引擎的核心产出之一，每个标签携带使用次数、关联 Voice 数、趋势、平均情感倾向等统计元数据，构成知识资产体系的基础。 |
| VOC (Voice of Customer) | 客户之声 | 对客户需求的完整、层次化描述，以客户自身语言组织，涵盖来自多渠道的所有客户反馈。 | Prism 的核心业务领域。系统旨在将 VOC 从传统的"分类-计数-出报表"模式升级为 AI Native 的语义理解、知识积累和行动驱动平台。 |
| Voice | 声音条目 | 一条原始的、不可变的客户反馈记录，是系统的数据输入单位。 | Voice 进入系统后只读（append-only），经四阶段语义拆解管线处理后产出 SemanticUnit。字段包括 content、source_type、author、language、collected_at 及 source_metadata（JSONB）。 |

---

## 2. 架构概念

| 英文术语 | 中文翻译 | 定义 | 在 Prism 中的用法 |
|---------|---------|------|------------------|
| Acceleration Layer | 加速层 | 可重建的索引、缓存和计算结果层，丢失后可从 Truth Layer 完整重建。 | 对应 pgvector 向量索引和 Redis 缓存。设计原则是"丢了可以重建，有了找数据快 100 倍"。与 Truth Layer 的分离确保灾难恢复优先级清晰，也支持模型升级后全量刷新加速层。 |
| Agent | AI 智能体 | 系统中与人类用户并列的一等公民用户，具有独立身份、权限、配额和审计追踪链路，能够自主调用系统 API 完成任务。 | Prism 的双用户模型中的核心角色。Agent 通过 API Key 认证获取 Principal 身份，在 Skill 注册表中发现可用工具，通过 Agent Loop 执行推理-行动循环完成分析任务。 |
| Agent Loop | Agent 循环 | Agent 执行任务时遵循的 ReAct（推理-行动）循环，包含推理、工具选择、执行、结果评估、继续/终止五个步骤。 | 每次循环消耗 LLM tokens + 工具调用 + 时间，受迭代上限（默认 20 轮）、成本上限（默认 0.50 USD）和时间上限（默认 5 分钟）三层防护约束。 |
| Orchestrator Agent | 编排 Agent | 多 Agent 协作模型中的"项目经理"角色，负责接收高层任务、分解为子任务、分配给 Specialist Agent 并综合输出。 | Phase 5-6 远景架构的核心组件，采用 Orchestrator → Specialist 模式实现复杂工作流编排，如"生成本周产品洞察周报"。 |
| Principal | 身份主体 | 统一的操作主体抽象，屏蔽人类用户和 AI Agent 之间的身份差异，具有 identity、credential、capability 和 boundary 四个维度。 | 人类通过 JWT 认证、Agent 通过 API Key 认证后，都被解析为同一个 Principal 对象。下游所有服务只认 Principal，不关心原始凭证类型，实现统一授权和审计。 |
| Skill | 技能 | Agent 可调用的原子能力单元，通过 JSON Schema 声明式定义，包含名称、描述、输入输出契约、权限声明、成本元数据和版本信息。 | Prism 提供 8 个内置原子 Skill（如 vector_search、get_neighbors、random_sample）、5 种复合 Skill（策略模板）以及自定义 Skill 注册机制。Skill 是 Agent 调用系统能力的唯一契约化接口。 |
| Skill Registry | 技能注册表 | 中心化的 Skill 元数据目录，Agent 在运行时查询注册表以发现可用工具及其详细定义。 | 持久化在 PostgreSQL 的 `agent` schema 中，通过 Redis 做热缓存。支持 CRUD 管理 API，新增 Skill 无需修改 Agent 代码——注册即可用。 |
| Specialist Agent | 专家 Agent | 多 Agent 协作模型中的"专业分析师"角色，专注于某一类子任务，拥有该领域最合适的 Skill 组合和提示词策略。 | 由 Orchestrator Agent 调度，例如趋势分析专家、问题诊断专家、竞品对比专家等，Phase 5-6 交付。 |
| Thin Agent | 轻量 Agent | Agent 演进路径中的早期形态，仅具备数据检索和初步分析能力，不做复杂推理，能替代人类的重复性搜索工作。 | Phase 3 的交付形态。Agent 能组合 8 个原子查询 Skill 完成基础分析任务，如"找到与支付功能相关的用户反馈"，是从"能跑"到"能干活"的关键跨越。 |
| Truth Layer | 真相层 | 不可变的数据事实层，采用 append-only 策略，任何写入都不覆盖历史记录。 | 对应 PostgreSQL 中存储的原始 Voice、AI 拆解快照（含模型版本）和人类治理决策的审计日志。是系统 Single Source of Truth，灾难恢复的最高优先级。 |

---

## 3. 技术术语

| 英文术语 | 中文翻译 | 定义 | 在 Prism 中的用法 |
|---------|---------|------|------------------|
| Alias | 别名 | LLM 模型的语义化逻辑名称，屏蔽了具体 Provider 和模型标识的复杂性。 | 上游服务使用 `default-chat`、`fast-chat`、`default-embedding` 等别名调用 LLM，别名背后绑定主模型和有序降级链。更换 Provider 或升级模型只需修改别名映射，业务代码零改动。 |
| ANN (Approximate Nearest Neighbor) | 近似最近邻搜索 | 在高维向量空间中快速找到与查询向量最相似的若干向量的算法，以牺牲少量精确度换取数量级的速度提升。 | pgvector 的 HNSW 索引实现 ANN 搜索，召回率 >95%，在毫秒级完成百万规模的近邻查询，支撑 Prism 的语义检索能力。 |
| Fallback Chain | 降级链 | 每个别名配置的有序降级模型列表，当主模型不可用时系统按列表顺序自动切换到可用的降级模型。 | 三级降级策略：Provider 级降级（切换同模型的其他 Provider）→ 模型级降级（切换到别名的降级模型）→ 功能级降级（使用缓存/规则兜底）。健康状态缓存在 Redis 中，所有服务实例共享。 |
| HNSW (Hierarchical Navigable Small World) | 分层可导航小世界图 | 一种高效的向量索引算法，构建多层图结构实现近似最近邻搜索，支持增量插入且无需重建索引。 | Prism 在 Phase 4 起采用 HNSW 索引（pgvector 扩展提供），核心优势是新数据插入时不需要重建索引，适合持续摄入 Voice 数据的场景。 |
| LiteLLM | LLM 统一调用库 | 一个覆盖 100+ LLM Provider 的统一调用库，由 Astral 社区维护，提供标准化的 Chat、Embedding、Rerank 接口。 | Prism 的 LLM 网关底层使用 LiteLLM 屏蔽各 Provider 的 API 差异。自建的 `providers/` 层退化为 LiteLLM 的配置映射层，只负责将数据库中的 Provider 配置翻译成 LiteLLM 参数格式。 |
| pgvector | PostgreSQL 向量扩展 | PostgreSQL 的扩展插件，为关系型数据库增加向量存储和相似度搜索能力，支持 IVFFlat 和 HNSW 索引。 | Prism 的关键技术赌注——将向量数据和关系数据放在同一事务边界内，避免分布式事务复杂度。SemanticUnit 的 embedding 向量存储在 pgvector 中，通过 `<=>` 操作符执行余弦距离计算。 |
| Provider | 提供者 | LLM 服务供应商，如硅基流动、OpenRouter、Kimi、MiniMax 等，通过 API 提供大语言模型推理能力。 | 在 llm-service 中注册管理，每个 Provider 包含 name、slug、base_url、api_key_encrypted 等字段。所有 Provider 实现同一抽象基类，差异主要在 Base URL、额外 Header 和错误响应格式上。 |
| ReAct (Reasoning + Acting) | 推理-行动模式 | 当前 AI Agent 领域最成熟的架构模式，将推理（Reasoning）和行动（Acting）交替进行，Agent 基于中间结果动态调整策略。 | Prism Agent Loop 的核心范式。每一轮循环包含推理、工具选择、执行、结果评估、继续/终止五步，区别于传统的固定流水线，支持"跟着线索走"的探索式分析。 |
| Schema Isolation | Schema 隔离 | 在同一 PostgreSQL 数据库实例中，通过不同 Schema 实现各服务数据的逻辑隔离。 | Prism 当前采用的数据隔离策略：`auth`（user-service）、`llm`（llm-service）、`voc`（Phase 3）、`agent`（Phase 2.5）。介于"共享表"和"独立数据库实例"之间的中间路线，低成本且可逆。 |
| SSE (Server-Sent Events) | 服务器推送事件 | 基于 HTTP 的单向实时通信协议，服务端持续向客户端推送数据流，常用于 LLM 流式输出场景。 | Prism 的 Chat API 支持 SSE 流式响应，从前端经 API 网关透传到 LLM Provider，第一个 token 到达时间（TTFT）通常在 200-500ms，用户无需等待完整响应即可开始阅读。 |

---

## 4. 业务与学术术语

| 英文术语 | 中文翻译 | 定义 | 在 Prism 中的用法 |
|---------|---------|------|------------------|
| Absorptive Capacity | 吸收能力 | Cohen 与 Levinthal（1990）提出的概念，指组织识别外部新知识的价值、消化并应用于商业目标的能力。 | Prism 的 VOC 系统质量直接决定组织吸收能力的上限——感知、捕获、转化三项动态能力的操作化，缩短从客户声音到产品行动的闭环周期。 |
| Conway's Law | Conway 定律 | Melvin Conway（1967）提出的观察：设计系统的组织，其产出的系统架构必然映射该组织的沟通结构。 | Prism 架构设计的理论基础之一。双用户模型（Human + Agent）不只是技术选择，更是对产品形态的战略押注——系统结构必须与"人机协作"的组织目标匹配。 |
| Dashboard Illusion | 仪表板幻觉 | 聚合数据掩盖真相的系统性问题——NPS 等汇总指标的精确数字给人"一切尽在掌握"的错觉，而真正重要的新问题被淹没在大类统计中。 | 传统 VOC 的三大系统性失败之一。Prism 通过涌现式标签和三层渐进式信息架构（概览 → 探索 → 深钻）对抗仪表板幻觉，确保新兴问题不被聚合统计掩盖。 |
| DIKW Pyramid | 数据-信息-知识-智慧金字塔 | 信息科学中描述数据向知识逐层转化的经典模型：Data → Information → Knowledge → Wisdom。 | Prism 的数据架构哲学受 DIKW 启发，但做了工程化简化——存储只分 Truth Layer（不可变事实）和 Acceleration Layer（可重建加速器）。价值交付的三层递进（看见 → 理解 → 行动）对应 DIKW 的 Information → Knowledge → Wisdom 跃迁。 |
| Dynamic Capabilities | 动态能力 | Teece（2007）提出的理论框架，指企业在不确定环境中的持续竞争优势来源于感知（Sensing）、捕获（Seizing）和转化（Transforming）三项能力。 | VOC 系统作为动态能力的操作化：感知对应检测时间（Time to Detect），捕获对应对齐时间（Time to Align），转化对应行动时间（Time to Act）。Prism 的目标是系统性缩短这三个时间。 |
| Keyword Illusion | 关键词幻觉 | 传统 VOC 依赖关键词匹配和 TF-IDF 进行语义理解，无法捕获自然语言中的同义表达、隐喻和上下文语义，导致近 70% 相关反馈被遗漏。 | 传统 VOC 的三大系统性失败之一。用户说"像 PPT 一样"来描述卡顿，关键词系统完全无法捕获。Prism 通过 LLM 语义理解和向量嵌入彻底替代关键词匹配。 |
| NPS (Net Promoter Score) | 净推荐值 | 衡量客户忠诚度的标准化指标，通过"你有多大可能向朋友推荐"的 0-10 评分计算得出。 | Prism 数据接入框架支持的来源类型之一（source_type: nps）。NPS 数据中的开放式文本与评分被组合为 Voice 进入语义拆解管线，提供量化指标之外的深层语义理解。 |
| Rogers Diffusion | Rogers 创新扩散理论 | Everett Rogers 提出的理论，描述创新在社会系统中被采纳的过程，关键因素包括可试用性（Trialability）和可观察性（Observability）。 | Prism 的"点击即溯源"设计同时提升了 AI 洞察的可试用性（用户可自行验证结论）和可观察性（可展示给同事），加速组织对 AI 洞察的采纳速度。 |
| S-D Logic (Service-Dominant Logic) | 服务主导逻辑 | Vargo 和 Lusch（2004）提出的市场营销理论范式，核心命题是价值不由生产者单方面制造，而由多方在互动中共同创造。 | Prism 采用 S-D Logic 视角重新定义 VOC：Agent 和人类在持续对话中共同构建理解，价值在交互过程中不断涌现。系统从"输出报告"的商品逻辑转向"共创洞察"的服务逻辑。 |
| SECI Model | 知识创造螺旋模型 | 野中郁次郎（Nonaka）提出的知识管理框架，描述知识在隐性与显性之间转化的四个阶段：社会化（S）、外化（E）、组合（C）、内化（I）。 | Prism 的 Signal → Concept 两阶段模型映射 SECI 螺旋：用户反馈承载隐性体验（S）→ LLM 拆解为语义单元（E）→ Signal 治理为 Concept（C）→ 团队基于 Concept 决策（I）。传统 VOC 缺失的 C 和 I 阶段正是知识复利产生之处。 |
| Simpson's Paradox | 辛普森悖论 | 统计学悖论：在分组数据中各组都成立的趋势，在数据合并后反而消失甚至反转。 | 仪表板幻觉的理论根源之一。聚合的 NPS 分数可能掩盖各细分群体中截然不同的趋势。Prism 的深钻式信息架构让用户可从聚合层下钻到分组和原始证据层，避免被辛普森悖论误导。 |
| Taxonomy Trap | 分类陷阱 | 预设分类体系因其封闭世界假设而注定遗漏新兴问题，"其他"类别占比从 5% 膨胀到 30% 是其典型症状。 | 传统 VOC 的三大系统性失败之首。Prism 用涌现式标签彻底替代预设分类——将分类从"输入"降级为"输出"，让概念从数据中生长而非事先画格子。 |

---

## 5. 项目与流程术语

| 英文术语 | 中文翻译 | 定义 | 在 Prism 中的用法 |
|---------|---------|------|------------------|
| ADR (Architecture Decision Record) | 架构决策记录 | 记录重大架构决策的标准化文档格式，包含决策背景、考虑的备选方案、最终选择及其理由。 | 用于记录 Prism 的 Type 1（不可逆）决策，如双用户模型、Schema 隔离策略、pgvector 选型等，确保决策过程可追溯、可审查。 |
| Dead Letter Queue | 死信队列 | 消息队列系统中用于存放无法被正常处理的消息的特殊队列，确保异常数据不丢失、可事后排查。 | 语义拆解管线中，当 Voice 处理在三级降级策略下仍然失败时，相关消息进入死信队列，标记待人工审核，防止数据丢失。 |
| Go/No-Go | 通过/不通过 | 阶段评审中的二元决策点——基于当前阶段的交付成果和验收标准，管理层决定是继续投入下一阶段还是调整方向或止损退出。 | 每个 Phase 结束时设有 Go/No-Go 评审点，确保投资风险可控。后一阶段的启动以前一阶段的验收通过为前提。 |
| P1/P2/P3 | 优先级等级 | 标识任务或问题紧急程度的分级标记，P1 为最高优先级（需立即处理），P2 为中等优先级，P3 为低优先级。 | Signal 产生时由加权优先级评估器自动打分（综合严重程度、影响范围、趋势方向、情感强度、置信度五个维度），P0/P1 级 Signal 自动触发通知。 |
| Phase | 阶段 | 路线图中的独立可交付单元，每个阶段有明确的交付物、验收标准和评审点。 | Prism 路线图共六个阶段：Phase 1（基础设施）→ Phase 2（LLM 调用）→ Phase 2.5（Agent 运行时）→ Phase 3（VOC 数据）→ Phase 4（概念治理）→ Phase 5（Agent 高级编排）→ Phase 6（洞察引擎）。遵循"先建地基、再通电力、搭骨架、长肌肉、练武功、开宗立派"的叠加逻辑。 |

---

*本术语表随项目演进持续更新。如发现遗漏或定义不准确，请在项目仓库中提交修改。*
