# R5 Delta 评审 B：LLM 服务简化 — 4 槽位模型替代别名系统

> **评审类型**：用户修正 Delta 评审
> **修正编号**：#5
> **修正内容**：简化 llm-service，用 4 个固定模型槽位（fast/reasoning/embedding/rerank）替代别名系统，保留故障转移能力
> **影响范围**：llm-service 架构重构
> **评审日期**：Phase 2 进行中
> **提出方**：系统最终用户代表（行业背景：汽车/阿维塔 + 消费品/Peets Coffee）

---

## 1. 变更影响分析

### 1.1 用户修正摘要

当前 llm-service 采用三层抽象模型（Provider → Model → Alias），用户认为别名系统过于复杂，提出简化为 4 个固定功能槽位：

| 槽位 | 用途 | 对应原别名系统示例 |
|------|------|------------------|
| `fast` | 快速推理（格式校验、快速分类） | `fast-chat` |
| `reasoning` | 深度推理（语义拆解、标签涌现） | `default-chat` |
| `embedding` | 向量化（Stage 3） | `default-embedding` |
| `rerank` | 重排序（搜索结果优化） | `default-rerank` |

每个槽位关联 provider + model + fallback_chain，保留故障转移能力。

### 1.2 受影响的文档与代码章节

| 文档/代码 | 受影响章节 | 影响程度 | 说明 |
|-----------|----------|---------|------|
| `docs/llm-service-design.md` | 核心概念/三层抽象模型 | **重写** | 三层模型降为两层（Provider → Slot） |
| `docs/llm-service-design.md` | 数据模型/PostgreSQL Schema | **重写** | `llm.aliases` 表删除，新增 `llm.model_slots` 表；`llm.models` 表可能合并入 slots |
| `docs/llm-service-design.md` | API 设计/调用类 API | **修改** | `"model": "default-chat"` 改为 `"slot": "reasoning"` 或隐式路由 |
| `docs/llm-service-design.md` | API 设计/管理类 API | **重写** | 别名 CRUD 替换为槽位配置 API |
| `docs/api-contracts.md` | llm-service API | **修改** | Chat/Embedding/Rerank 请求体中的 `model` 字段语义变更 |
| `docs/architecture-overview.md` | 项目结构 | **小改** | `llm_service/core/alias.py` 删除，新增 `slot.py`；`models/alias.py` 替换为 `slot.py` |
| `02-prd-phase1.md` | 4.2 数据模型 | **间接** | llm Schema 描述需更新 |
| `02-prd-phase1.md` | US-1 异常流程 | **措辞** | "故障转移引擎切换到降级模型"的实现载体从别名变为槽位 |
| `llm-service/src/` | `core/alias.py`, `core/router.py`, `models/alias.py` | **删除/重写** | 别名解析逻辑替换为槽位路由逻辑 |
| `llm-service/src/` | `api/chat.py`, `api/embedding.py`, `api/rerank.py` | **修改** | 请求参数从别名改为槽位或无参数（按端点隐式路由） |
| `llm-service/src/` | `api/admin.py` | **重写** | 别名管理 CRUD 替换为槽位配置 CRUD |
| `apps/web/` | `pages/ModelConfig.tsx` | **重写** | 从别名管理 UI 改为槽位配置 UI |
| `apps/cli/` | `commands/model.py` | **修改** | CLI 模型管理命令适配槽位概念 |

### 1.3 对 AI 管线的影响

AI 管线当前通过别名调用 LLM：

```
Stage 1 语义拆解：调用 "default-chat"（别名） → 改为调用 "reasoning"（槽位）
Stage 2 标签涌现：调用 "default-chat"（别名） → 改为调用 "reasoning"（槽位）
Stage 3 向量化：  调用 "default-embedding"（别名） → 改为调用 "embedding"（槽位）
守卫层 L1 格式校验：调用 "fast-chat"（别名） → 改为调用 "fast"（槽位）
搜索结果重排序：调用 "default-rerank"（别名） → 改为调用 "rerank"（槽位）
```

从 AI 管线消费端看，变更几乎是同构映射，改动成本低。

---

## 2. 专家辩论记录

### 议题 B1：4 槽位 vs 别名系统的利弊

#### 第一轮：正方开场

**苏明远（产品策略师）** 率先发言：

> 让我从用户视角讲。我们的目标用户画像是"非技术背景的一线产品负责人"——PRD 第 1.2 节写得清清楚楚。这个用户需要在 Web UI 上配置 LLM 模型。你让他面对一个"别名管理"界面——什么是别名？别名和模型是什么关系？为什么一个别名可以关联多个模型？他需要理解三层抽象才能完成配置。
>
> 4 个槽位就不一样了。打开配置页面，看到四个卡片：快速模型、推理模型、向量化模型、重排序模型。每个卡片选一个 Provider、选一个模型、可选配置降级链。30 秒搞定。这就是我一直说的——**用户 30 秒内感受不到价值 = 产品不存在**。
>
> 补充一个行业视角：用户代表来自阿维塔（汽车）和 Peets Coffee（消费品），他们的产品经理团队不是 AI 工程师。别名是工程师的概念，槽位是业务人员的概念。

**王磊（全栈工程师）** 附议：

> 从工程交付角度，别名系统需要三张表（providers、models、aliases）、三套 CRUD API、三个管理页面。槽位系统可以简化到两张表（providers、model_slots）、两套 CRUD API、一个配置页面。
>
> 我算了一下工时：
> - 别名系统完整实现：Provider CRUD 3 天 + Model CRUD 2 天 + Alias CRUD 2 天 + 路由/解析逻辑 2 天 + 前端配置页 3 天 = **12 天**
> - 槽位系统完整实现：Provider CRUD 3 天 + Slot CRUD 1.5 天 + 路由逻辑 1 天 + 前端配置页 2 天 = **7.5 天**
>
> 省 4.5 天。而且更关键的是——别名系统的灵活性在 Phase 1 到 Phase 3 完全用不到。我们实际需要的别名就这四个：`default-chat`、`fast-chat`、`default-embedding`、`default-rerank`。四个别名 = 四个槽位。别名系统多出来的"自定义别名"能力，在可见的 18 周内没有任何消费者。

**林晓薇（用户研究官）** 补充：

> 我支持简化，但理由和明远、王磊不同。我关心的是认知负担对用户研究的影响。
>
> 当我们将来做用户测试时——不管是 dogfooding 还是外部 Design Partner——如果用户在"配置 LLM"这一步就卡住了，后续所有的标签涌现、语义搜索的体验数据都会被污染。用户的挫败感会迁移到对整个产品的评价上。
>
> 4 个槽位是"即知即用"的概念。快速模型用来干什么、推理模型用来干什么，名字本身就是文档。别名系统需要用户先建立"别名-模型映射"的心智模型，这对非技术用户是额外的认知成本。

#### 第一轮：反方回应

**赵一凡（首席架构师）** 回应：

> 让我先做钢人论证。正方的核心观点是：4 槽位降低用户认知负担，减少开发工时，且在 Phase 1-3 的功能范围内和别名系统等价。我承认这三点都成立。
>
> 但我要提出一个更根本的问题：**4 槽位是别名系统的一个特例**。别名系统天然支持"4 个固定别名 + 每个别名关联 fallback chain"的配置方式。也就是说，你想要 4 槽位的简洁体验，完全可以在别名系统上面做一层 UI 简化——固定创建 4 个别名，前端只展示这 4 个卡片，隐藏别名管理的复杂度。
>
> 如果我们把别名系统改成 4 槽位，我们失去的是什么？是**扩展性**。考虑这些场景：
>
> 1. AI 管线需要一个 `summarize` 模型角色——用不同于 reasoning 的模型做摘要生成
> 2. 多语言场景需要 `translate` 模型角色
> 3. 不同的 VOC 数据集可能需要不同的 embedding 模型（中文用 BGE，英文用 text-embedding-3）
> 4. 未来 Phase 4 的关系构建可能需要专门的图谱推理模型
>
> 每次新增模型角色，槽位系统都需要修改 Enum、改数据库、改 API、改前端。别名系统只需要创建一个新别名。
>
> 我的立场是：**保留别名系统的底层抽象，在 UI/API 层面提供"槽位视图"的简化体验**。骨架不变，皮肤可以简化。

**陈思琪（AI/ML 工程师）** 附议：

> 赵一凡说的扩展性问题是真实的。我从 AI 管线的角度补充几个具体场景：
>
> 1. **标签涌现和语义拆解可能需要不同模型**。当前 PRD 把它们都归为"reasoning"，但实际上语义拆解需要的是强指令跟随能力（结构化输出），标签涌现需要的是强创造性（高 temperature）。未来很可能需要拆分成两个独立的模型角色。
>
> 2. **合成数据生成（US-5）也需要 LLM 调用**。用来生成 1000-3000 条模拟 VOC 数据的模型，和用来做语义拆解的模型，最好不是同一个——合成数据需要多样性，用一个高创造性模型更合适。
>
> 3. **守卫层 L2 语义一致性检查**。L1 格式校验可以用 fast 模型，但 L2 语义一致性检查可能需要一个比 fast 更强但比 reasoning 更便宜的中间模型。
>
> 4 个槽位在 Phase 3 刚好够用，但 Phase 4 开始就会捉襟见肘。我不想在 Phase 4 启动时第一件事就是重构 LLM 调用层。

#### 自由交锋

**苏明远** 反驳赵一凡：

> 赵一凡，你说"在别名系统上面做 UI 简化"——但这不就是承认别名系统对用户不友好吗？你建议用 UI 层掩盖底层复杂度，那为什么不直接简化底层？上面加 UI 层不是免费的，那也需要开发工时。
>
> 至于扩展性，你列举的 4 个未来场景，每一个都是"Phase 4+"的假设。我们现在是 Phase 2，团队 4.5 人，18 周工期。你在为一年后**可能**需要的场景预付架构税。这不就是你自己说的"过度工程"吗？

**赵一凡** 回应：

> 不一样。过度工程是"为不确定的需求提前实现"。保留别名系统不是提前实现——它已经设计好了，数据模型已经定义在 `llm-service-design.md` 里了。你现在要做的是**拆掉已有设计换一个更简单的**。这不是避免过度工程，这是"先建好的墙拆掉换矮墙"。
>
> 而且别名系统的实现成本并不比槽位系统高多少。王磊说差 4.5 天，但那是因为别名系统需要 models 表的 CRUD。如果我们采用"别名系统 + 固定 4 别名 + 简化 UI"方案，models 表只需要 seed data，不需要完整 CRUD，差距缩小到 2 天以内。

**王磊** 插入：

> 赵一凡，2 天也是 2 天。而且你说的"别名 + 简化 UI"方案，意味着代码库里存在两套概念——底层是别名，上层是槽位。新人加入团队时要理解两层抽象。我们 4.5 人的团队，每多一层抽象就多一个理解成本。
>
> 而且说实话，如果 Phase 4 真的需要更多模型角色，把 Enum 从 4 个扩展到 6 个的成本有多高？一次 ALTER TABLE + 一次 Alembic migration + 更新 Enum 定义。1-2 小时的事。这远比维护一个通用别名系统的长期认知成本低。

**陈思琪** 补充：

> 王磊说的"扩展 Enum"确实成本不高，但问题在于**频率**。如果每个 Phase 都要加 1-2 个槽位，到 Phase 6 我们有 10+ 个固定槽位，那和别名系统有什么区别？区别只是别名系统用字符串命名，槽位用 Enum。后者还更不灵活。

**苏明远** 回应陈思琪：

> 思琪，Phase 6 是至少 18 个月后的事。18 个月后的 Prism 可能已经完全不是现在的架构了。你在为一个 18 个月后的技术决策，牺牲现在的用户体验和开发效率。我们连 Phase 3 的 dogfooding 数据都还没有，就开始为 Phase 6 的模型数量操心？

#### 魔鬼代言人发言

**周安（安全与合规顾问）** 作为魔鬼代言人发言：

> 双方都没有讨论一个关键问题：**配置变更的审计追踪**。
>
> 不管是别名系统还是槽位系统，当有人把 reasoning 槽位从 qwen-plus 切换到 gpt-4o 时，这个变更必须被记录。因为 LLM 模型的切换直接影响涌现标签的质量——今天用 qwen-plus 跑出来的标签和明天用 gpt-4o 跑出来的标签可能完全不一样。
>
> 如果没有审计日志，用户看到标签质量突然变化时，我们甚至无法溯源是模型切换导致的还是数据质量导致的。
>
> 我的第三种方案：**无论采用哪种系统，都必须在 model_slots 或 aliases 表上加 `previous_config` JSONB 字段和 `changed_by` / `changed_at` 审计字段**。这个成本在两个方案中是等价的，但不能遗漏。
>
> 另外，槽位系统有一个安全优势是正方没提到的：**配置项是有限且已知的**。4 个槽位意味着我可以精确验证"系统在任何时刻都有且仅有 4 个活跃模型配置"。别名系统的开放性意味着可能有人创建了 `test-alias-for-fun` 然后忘记删除，造成配置漂移。

#### 第二轮：钢人论证升级

**赵一凡** 对正方做钢人论证：

> 我认真思考了正方的论点，核心逻辑链是：
>
> 1. Prism 的目标用户是非技术产品经理
> 2. 别名是工程概念，槽位是业务概念
> 3. 在 Phase 1-3 的功能范围内，4 槽位和别名系统的表达能力等价
> 4. 4 槽位节省 2-4.5 天开发工时
> 5. 简化的心智模型降低后续用户测试的噪音
>
> 这个逻辑链是自洽的。我承认，如果 Prism 永远只有 4 种 LLM 使用场景，槽位系统是严格更优的方案。
>
> 我的核心忧虑归结为一个判断：**Prism 的 LLM 使用场景会不会长期固定在 4 个？**如果答案是"大概率是"，我可以接受槽位方案。

**苏明远** 对反方做钢人论证：

> 赵一凡和陈思琪的核心关切是扩展性。他们担心的是：
>
> 1. 4 个固定槽位可能不够用
> 2. 每次扩展需要改 Enum/DB/API/前端
> 3. 频繁扩展最终会退化成"硬编码版的别名系统"
>
> 这个担忧不是空穴来风。陈思琪列举的 4 个具体场景（语义拆解/标签涌现分离、合成数据生成、L2 语义检查、多语言 embedding）都有技术合理性。
>
> 但我注意到一个关键点：这些场景中，有 3 个可以通过在调用时传入 `override_model` 参数解决，不需要新增槽位。只有"多语言 embedding"是真正需要独立配置的。

#### 第三轮：寻求共识

**王磊** 提出折中方案：

> 听完三轮交锋，我有一个"渐进式"提案：
>
> **Phase 2（当前）：实现 4 槽位系统。** 简单直接，满足 Phase 1-3 的所有需求。数据模型用 `llm.model_slots` 表 + `slot_type` Enum。
>
> **预留扩展接口**：在 `ModelSlot` 数据模型中加一个 `config: JSONB` 字段，用于存放未来的自定义配置。如果 Phase 4 需要更多模型角色，评估两条路径：
> - 路径 A：扩展 Enum（成本 < 0.5 天）
> - 路径 B：如果角色数量增长到 8+，重构为通用别名系统（成本约 3 天）
>
> 这样我们现在享受简化的收益，未来保留升级的选项。赵一凡一直说"Type 1 决策必须 Day 1 做对"——但这个决策是 Type 2 的，可逆的。从 4 槽位升级到别名系统，数据迁移很简单：每个 slot 变成一个 alias，加一个 models 中间表。

**赵一凡** 回应：

> 王磊的提案解决了我最大的顾虑——可逆性。如果从槽位到别名的升级路径是清晰且低成本的，那确实可以接受先做槽位。
>
> 但我有一个附加条件：**代码架构层面，槽位路由逻辑必须封装在一个独立的 `SlotRouter` 类中，不能把路由逻辑散落在各个 API handler 里**。这样未来替换路由策略时只需要改一个类。

**陈思琪** 最终表态：

> 我仍然认为别名系统是更正确的长期选择，但王磊的"可逆性"论点说服了我。如果我们在文档中明确记录"Phase 4 启动前必须评估槽位是否够用，不够则升级为别名系统"这个检查点，我可以接受 4 槽位方案。
>
> 但我要记录一个保留意见：**4 个槽位的命名需要仔细斟酌**。`fast` 和 `reasoning` 的分界线在哪里？Stage 2 标签涌现用 `reasoning`，但如果我想用一个更便宜的模型做初步分类呢？`fast` 是"快速"还是"便宜"？命名的歧义可能在未来造成困惑。

#### 投票

| 专家 | 投票 | 简要理由 |
|------|------|---------|
| 苏明远 | **支持简化（4 槽位）** | 用户认知负担是第一优先级；4 槽位对目标用户画像显著更友好 |
| 赵一凡 | **有条件支持简化** | 接受王磊的渐进式提案；条件：SlotRouter 独立封装 + Phase 4 检查点 |
| 陈思琪 | **有条件支持简化** | 接受可逆性论证；条件：Phase 4 启动前评估是否需要升级为别名系统 |
| 林晓薇 | **支持简化（4 槽位）** | 降低用户测试的认知噪音；业务概念优于工程概念 |
| 周安 | **支持简化（4 槽位）** | 有限配置项更易审计；附加条件：必须加审计字段 |
| 王磊 | **支持简化（4 槽位）** | 提出渐进式方案的发起人；省 2-4.5 天工时 |
| 方若琳 | **支持简化（4 槽位）** | 见议题 B1 补充发言 |

**投票结果**：7:0（全票通过，其中 2 票附条件）

**方若琳补充发言**（投票后）：

> 从组织采纳角度，4 槽位有一个被忽略的优势：**对话语言的统一**。当产品经理和工程师讨论"我们用的什么模型"时，"reasoning 槽位配的是 qwen-plus"比"default-chat 别名解析到 siliconflow 的 qwen-plus 模型"直观十倍。
>
> 阿维塔和 Peets Coffee 的产品经理不需要理解"别名解析"这个中间概念。他们需要的是："我们有 4 种模型能力，每种能力背后绑了什么，出了问题自动切换"。这就是 Christensen 的 Jobs to be Done——用户"雇佣"Prism 来完成 VOC 分析，而不是来学习 LLM 架构。

---

### 议题 B2：故障转移在槽位模式下的实现

#### 第一轮：技术方案讨论

**赵一凡** 主导技术方案：

> 故障转移在槽位模式下的实现本质上和别名模式是同构的。核心变更是路由的入口从"按别名查找"变成"按槽位查找"。让我画出两种模式的故障转移流程对比：
>
> **别名模式**：
> ```
> 请求("default-chat") → 查 aliases 表 → 获取 primary_model_id + fallback_models
>   → 加载 primary model 的 provider → 调用 → 成功/失败
>   → 失败 → 加载 fallback[0] 的 provider → 调用 → ...
> ```
>
> **槽位模式**：
> ```
> 请求("reasoning") → 查 model_slots 表 → 获取 primary_provider + primary_model + fallback_chain
>   → 加载 primary provider → 调用 primary_model → 成功/失败
>   → 失败 → 加载 fallback_chain[0] 的 provider → 调用其 model → ...
> ```
>
> 区别在于：别名模式的 fallback 是模型级别的（UUID 引用 models 表），需要二次查表获取 provider 信息；槽位模式的 fallback 是 provider+model 的组合，直接在 fallback_chain JSON 中携带完整信息，少一次查表。
>
> 槽位模式在故障转移路径上反而更高效。

**王磊** 补充实现细节：

> 健康检查机制无需调整。现有设计是 Provider 级别的健康状态，缓存在 Redis（`llm:health:{provider_id}`）。不管是别名还是槽位，健康检查的对象都是 Provider，不受影响。
>
> `BaseLLMProvider` 接口也不需要变。Provider 适配器不关心调用方是通过别名还是槽位找到它的——它只需要 `model_id` 和请求参数。接口签名完全兼容：
>
> ```python
> # 不管别名还是槽位，最终调用都是这样
> provider = provider_registry.get(provider_id)
> response = await provider.chat(model_id="qwen-plus", messages=[...])
> ```

**陈思琪** 提出一个细节问题：

> 有一个边界情况需要讨论：**不同槽位可以指向同一个 Provider 的同一个模型吗？**
>
> 比如，如果用户资源有限，只有一个 siliconflow 的 API Key，可以把 `fast` 和 `reasoning` 都指向 `qwen-plus`，只是调用参数不同（fast 用低 temperature，reasoning 用高 temperature）？
>
> 如果可以，那 `config: JSONB` 字段需要支持存储"默认调用参数"（temperature、max_tokens 等），在槽位级别覆盖模型默认参数。

**赵一凡** 确认：

> 这是一个合理需求。`ModelSlot.config` 字段的 JSONB 正好用来存储槽位级别的默认参数覆盖。数据模型定义中加上文档说明即可。

**周安** 插入安全提醒：

> 故障转移日志必须包含以下信息：
> 1. 原始槽位请求（如 `reasoning`）
> 2. 首选 provider+model（如 `siliconflow/qwen-plus`）
> 3. 故障原因（超时、HTTP 错误码、rate limit）
> 4. 降级到哪个 provider+model
> 5. 最终结果（成功/失败）
>
> 这些日志需要结构化存储，不能只是 stdout 打印。建议写入 `llm.call_logs` 表或者发送到结构化日志系统。

#### 投票

| 专家 | 投票 | 简要理由 |
|------|------|---------|
| 苏明远 | **无异议** | 故障转移是技术实现细节，信任技术团队 |
| 赵一凡 | **同意方案** | 槽位模式下的故障转移更简洁 |
| 陈思琪 | **同意方案** | 补充 config 字段需求 |
| 林晓薇 | **无异议** | 关注最终用户体验：降级时 UI 上需有标记 |
| 周安 | **同意方案** | 条件：故障转移日志必须结构化存储 |
| 王磊 | **同意方案** | 实现比别名模式更简单 |
| 方若琳 | **无异议** | 技术层面，不干预 |

**投票结果**：7:0（全票通过）

---

### 议题 B3：对现有设计文档和代码的影响

#### 第一轮：逐项盘点

**王磊** 主导盘点：

> 让我逐一梳理变更清单，给出工时估算：
>
> **1. `llm-service-design.md` 文档重写**
> - 三层抽象模型 → 两层抽象模型（Provider → Slot）
> - 别名系统章节 → 槽位系统章节
> - 数据库 Schema：删除 `llm.aliases` 和 `llm.models` 表，新增 `llm.model_slots` 表
> - API 设计：调用类 API 的 `model` 参数语义变更；管理类 API 重写
> - 工时：**0.5 天**（文档更新）
>
> **2. 数据库 Schema 变更**
>
> 从：
> ```sql
> llm.providers  -- 保留
> llm.models     -- 删除
> llm.aliases    -- 删除
> ```
>
> 到：
> ```sql
> llm.providers    -- 保留，无变更
> llm.model_slots  -- 新增
> ```
>
> 需要新的 Alembic migration。如果 Phase 2 还在开发中，可以直接修改初始 migration 而非追加——减少 migration 链的复杂度。
> - 工时：**0.5 天**（含 migration 编写和测试）
>
> **3. 代码变更**
>
> | 文件/模块 | 操作 | 工时 |
> |-----------|------|------|
> | `models/alias.py` | 删除 | 0 |
> | `models/model.py` | 删除 | 0 |
> | `models/slot.py` | 新建 | 0.5 天 |
> | `core/alias.py` | 删除 | 0 |
> | `core/router.py` | 重写（别名解析 → 槽位路由） | 1 天 |
> | `core/slot.py` | 新建（SlotRouter 封装） | 含在 router.py |
> | `api/admin.py` | 重写（别名 CRUD → 槽位 CRUD） | 1 天 |
> | `api/chat.py` | 小改（参数适配） | 0.5 天 |
> | `api/embedding.py` | 小改 | 含在上面 |
> | `api/rerank.py` | 小改 | 含在上面 |
>
> 后端代码变更合计：**3 天**
>
> **4. 前端变更**
> - `ModelConfig.tsx`：从三级管理（Provider → Model → Alias）改为两级管理（Provider → Slot），UI 更简单
> - 工时：**1.5 天**（含联调）
>
> **5. CLI 变更**
> - `commands/model.py`：命令从 `prism model alias list` 改为 `prism model slot list`
> - 工时：**0.5 天**
>
> **总工时**：约 **6 天**（对比别名系统约 10 天，净节省 4 天）

**赵一凡** 审查代码架构：

> 王磊的工时估算合理。我补充代码架构的约束：
>
> 1. **`SlotRouter` 必须是一个独立类**，不是一组散落的函数。它负责：
>    - 从 DB 或缓存加载槽位配置
>    - 解析槽位到 provider+model
>    - 执行故障转移逻辑
>    - 发出故障转移事件（供日志和监控消费）
>
> 2. **`SlotRouter` 的接口要面向未来**：方法签名应该是 `async def route(self, slot_type: SlotType, **call_params) -> ProviderModel`，而不是 `async def route(self, slot_name: str)`。使用 Enum 而非字符串，编译期就能捕获错误。
>
> 3. **API 端点变更策略**：调用类 API（chat/embedding/rerank）可以不需要 `slot` 参数——端点本身已经隐含了模型角色：
>    - `POST /api/llm/chat` → 默认使用 `reasoning` 槽位
>    - `POST /api/llm/chat?slot=fast` → 指定使用 `fast` 槽位
>    - `POST /api/llm/embedding` → 默认使用 `embedding` 槽位
>    - `POST /api/llm/rerank` → 默认使用 `rerank` 槽位
>
>    这样 chat 端点支持两个槽位（fast/reasoning），其他端点各对应一个。消费方大多数情况下不需要指定槽位，减少 API 变更对下游的影响。

**陈思琪** 补充 AI 管线影响：

> AI 管线代码中所有调用 LLM 的地方都需要适配。当前设计中，管线通过 HTTP 调用 llm-service 的 API。变更前后的调用对比：
>
> ```python
> # 变更前（别名模式）
> response = await llm_client.chat(model="default-chat", messages=[...])
> response = await llm_client.embedding(model="default-embedding", input=[...])
>
> # 变更后（槽位模式，方案 A：显式指定）
> response = await llm_client.chat(slot="reasoning", messages=[...])
> response = await llm_client.embedding(messages=[...])  # embedding 端点只有一个槽位，可省略
>
> # 变更后（槽位模式，方案 B：赵一凡的端点隐式路由）
> response = await llm_client.chat(messages=[...])  # 默认 reasoning
> response = await llm_client.chat(messages=[...], slot="fast")  # 指定 fast
> ```
>
> 我更倾向方案 B，对消费方更友好。

**方若琳** 提出文档一致性要求：

> 提醒各位注意：PRD 第 4.2 节的数据模型描述中，llm Schema 只提到了"LLM 相关配置"但没有详细列出表结构。但 `llm-service-design.md` 是 llm-service 的权威设计文档，它的变更需要同步到：
> 1. `architecture-overview.md` 的项目结构树
> 2. `api-contracts.md` 的 llm-service API 章节
> 3. PRD 中所有引用"别名"概念的措辞
>
> 建议在 PR 中用 checklist 追踪这些文档同步。

#### 投票

| 专家 | 投票 | 简要理由 |
|------|------|---------|
| 苏明远 | **同意** | 变更清单清晰，工时可控 |
| 赵一凡 | **同意** | 附加条件：SlotRouter 独立封装 + Enum 路由 |
| 陈思琪 | **同意** | 倾向赵一凡的端点隐式路由方案 |
| 林晓薇 | **同意** | 无额外意见 |
| 周安 | **同意** | 补充：API 变更需在 OpenAPI Schema 中体现 |
| 王磊 | **同意** | 方案发起人，工时估算有信心 |
| 方若琳 | **同意** | 条件：文档同步用 checklist 追踪 |

**投票结果**：7:0（全票通过）

---

### 议题 B4：新增 `ModelSlot` 数据模型设计

#### 第一轮：模型评审

**赵一凡** 主导数据模型评审：

> 用户提出的初始数据模型：
>
> ```
> ModelSlot
> ├── slot_type: Enum (fast/reasoning/embedding/rerank)
> ├── primary_provider_id: UUID (FK → providers)
> ├── primary_model_id: VARCHAR
> ├── fallback_chain: JSON [{ provider_id, model_id }]
> ├── is_enabled: Boolean
> ├── config: JSONB
> └── updated_at: Timestamp
> ```
>
> 我的评审意见：
>
> 1. **缺少主键**。需要加 `id: UUID PRIMARY KEY`。虽然 `slot_type` 理论上是唯一的，但 UUID 主键是 Prism 的一致性约定（所有表都用 UUID PK）。
>
> 2. **`slot_type` 需要 UNIQUE 约束**。同一时刻每种槽位只能有一个活跃配置。这是槽位系统和别名系统的核心区别——别名是 N:M 的，槽位是 1:1 的。
>
> 3. **`primary_model_id` 的类型**。用户提议 VARCHAR，但为了与 providers 表保持外键关系的一致性，我建议改为两个字段：
>    - `primary_provider_id: UUID (FK → providers)` — Provider 外键
>    - `primary_model_id: VARCHAR(200)` — Provider 侧的模型 ID（如 `Qwen/Qwen2.5-72B-Instruct`）
>
>    这样 provider 被删除时，关联的 slot 配置也需要级联处理。
>
> 4. **`fallback_chain` 的结构**。JSON 数组的每个元素需要包含 `provider_id`（UUID）和 `model_id`（VARCHAR）。需要在应用层校验 provider_id 的有效性。
>
> 5. **审计字段**。按照周安的要求，加上 `created_at` 和 `updated_at`，以及 `updated_by`（可选，关联操作者）。
>
> 6. **`config` 字段的 schema 约定**。建议定义一个 JSONB 的 schema convention：
>    ```json
>    {
>      "temperature": 0.7,
>      "max_tokens": 4096,
>      "timeout_ms": 30000,
>      "custom_headers": {}
>    }
>    ```

**王磊** 给出最终 SQL 定义：

> 综合赵一凡的评审意见，最终 Schema：
>
> ```sql
> CREATE TYPE llm.slot_type AS ENUM ('fast', 'reasoning', 'embedding', 'rerank');
>
> CREATE TABLE llm.model_slots (
>     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
>     slot_type llm.slot_type UNIQUE NOT NULL,
>     primary_provider_id UUID NOT NULL REFERENCES llm.providers(id) ON DELETE RESTRICT,
>     primary_model_id VARCHAR(200) NOT NULL,
>     fallback_chain JSONB DEFAULT '[]'::jsonb,
>     is_enabled BOOLEAN DEFAULT true,
>     config JSONB DEFAULT '{}'::jsonb,
>     created_at TIMESTAMPTZ DEFAULT now(),
>     updated_at TIMESTAMPTZ DEFAULT now()
> );
>
> COMMENT ON TABLE llm.model_slots IS '模型槽位配置，每种槽位类型只能有一个活跃配置';
> COMMENT ON COLUMN llm.model_slots.fallback_chain IS '降级链，JSON 数组：[{"provider_id": "uuid", "model_id": "string"}]';
> COMMENT ON COLUMN llm.model_slots.config IS '槽位级别参数覆盖：temperature, max_tokens, timeout_ms 等';
> ```
>
> 注意几个设计决策：
> - `ON DELETE RESTRICT`：Provider 不能在被槽位引用时删除。用户必须先更新槽位配置，再删 Provider。这比 CASCADE 更安全。
> - `fallback_chain` 用 JSONB 而非 UUID 数组：因为 fallback 需要同时记录 provider_id 和 model_id 两个字段。
> - `slot_type` 用 PostgreSQL Enum 而非 VARCHAR：编译期类型安全，且防止拼写错误。

**陈思琪** 审查与 AI 管线的匹配度：

> 对 4 个槽位与 AI 管线阶段的映射做最终确认：
>
> | AI 管线阶段 | 使用槽位 | 调用特征 |
> |------------|---------|---------|
> | Stage 1 语义拆解 | `reasoning` | 高准确性、结构化输出、中等 token |
> | Stage 2 标签涌现 | `reasoning` | 高创造性、自由文本、较长 token |
> | Stage 2 标签标准化 | `fast` | 简单比对任务、低 token |
> | Stage 3 向量化 | `embedding` | 批量处理、高吞吐 |
> | 守卫层 L1 格式校验 | `fast` | 快速验证、低 token |
> | 守卫层 L2 语义检查 | `reasoning` 或 `fast` | 取决于检查复杂度 |
> | 搜索重排序 | `rerank` | 查询时调用、低延迟要求 |
> | 合成数据生成(US-5) | `reasoning` | 高创造性、长文本 |
>
> 一个潜在问题：Stage 1 和 Stage 2 都用 `reasoning`，但最优的 temperature 设置不同（Stage 1 需要低 temperature 确保结构化输出，Stage 2 需要高 temperature 增加标签多样性）。
>
> 解决方案：**调用时传入参数覆盖**。槽位的 `config` 只是默认值，AI 管线代码在调用时可以 override：
> ```python
> # Stage 1：低 temperature
> await llm_client.chat(slot="reasoning", temperature=0.3, messages=[...])
> # Stage 2：高 temperature
> await llm_client.chat(slot="reasoning", temperature=0.8, messages=[...])
> ```
>
> 这样不需要额外的槽位。

**周安** 最终安全审查：

> 数据模型本身没有安全问题。补充两点：
>
> 1. **`fallback_chain` 中的 `provider_id` 需要应用层校验**。确保引用的 provider 存在且 `is_enabled = true`。这在 JSONB 中无法通过数据库外键约束实现，必须在 Service 层做校验。
>
> 2. **配置变更审计**。建议在 `model_slots` 表上创建一个触发器或在应用层记录变更日志。至少记录：
>    - 变更时间
>    - 变更前的完整配置快照
>    - 变更后的完整配置快照
>    - 操作者身份
>
>    实现方式可以是一个独立的 `llm.slot_change_logs` 表，也可以复用未来的通用审计日志框架。Phase 2 先用最简方式——在应用层写 INFO 级别的结构化日志即可。

#### 投票

| 专家 | 投票 | 简要理由 |
|------|------|---------|
| 苏明远 | **同意** | 数据模型清晰，对产品层面无影响 |
| 赵一凡 | **同意** | RESTRICT 外键 + UNIQUE Enum 的设计决策正确 |
| 陈思琪 | **同意** | 与 AI 管线匹配度确认，调用时参数覆盖解决 temperature 差异 |
| 林晓薇 | **同意** | 无额外意见 |
| 周安 | **同意** | 条件：fallback_chain 需要应用层校验 + 配置变更需结构化日志 |
| 王磊 | **同意** | 实现成本明确 |
| 方若琳 | **同意** | 无额外意见 |

**投票结果**：7:0（全票通过）

---

## 3. 具体修改建议

### 3.1 文档修改清单

| # | 文档 | 章节 | 修改内容 | 优先级 |
|---|------|------|---------|--------|
| D1 | `docs/llm-service-design.md` | 核心概念/三层抽象模型 | 重写为"两层抽象模型"：Provider 层 + 槽位层。删除"别名层"和"模型层" | P0 |
| D2 | `docs/llm-service-design.md` | 核心概念/别名系统 | 整个章节替换为"槽位系统"。描述 4 种槽位及其用途映射 | P0 |
| D3 | `docs/llm-service-design.md` | 故障转移与模型降级 | 更新流程图：`调用 reasoning 槽位` 替代 `调用 default-chat`。fallback 从模型 UUID 改为 provider+model 组合 | P0 |
| D4 | `docs/llm-service-design.md` | 数据模型/PostgreSQL Schema | 删除 `llm.models` 和 `llm.aliases` 表定义；新增 `llm.slot_type` Enum 和 `llm.model_slots` 表定义 | P0 |
| D5 | `docs/llm-service-design.md` | API 设计/调用类 API | `"model": "default-chat"` 改为默认端点路由 + 可选 `"slot": "fast"` 参数 | P0 |
| D6 | `docs/llm-service-design.md` | API 设计/管理类 API | 删除别名管理 CRUD（`/api/llm/admin/aliases`），替换为槽位配置 CRUD（`/api/llm/admin/slots`） | P0 |
| D7 | `docs/api-contracts.md` | llm-service API | 更新 Chat/Embedding/Rerank 请求体示例；新增 Slot 配置 API 契约 | P0 |
| D8 | `docs/architecture-overview.md` | 项目结构 | `models/alias.py` → `models/slot.py`；`core/alias.py` → `core/slot.py`；删除 `models/model.py` | P1 |
| D9 | `docs/prd/02-prd-phase1.md` | 4.2 数据模型 | 将 llm Schema 描述中的"别名"措辞更新为"槽位" | P1 |
| D10 | `docs/prd/02-prd-phase1.md` | US-1 异常流程 | "故障转移引擎切换到降级模型" → 保留措辞不变（机制相同，载体不同，用户故事层面无需暴露实现细节） | P2（可选） |
| D11 | `CLAUDE.md` | 关键设计/LLM 别名系统 | 更新为槽位系统描述 | P1 |

### 3.2 代码修改清单

| # | 路径 | 操作 | 说明 |
|---|------|------|------|
| C1 | `llm-service/src/llm_service/models/alias.py` | **删除** | 别名 ORM 模型不再需要 |
| C2 | `llm-service/src/llm_service/models/model.py` | **删除** | 独立的 Model 表不再需要 |
| C3 | `llm-service/src/llm_service/models/slot.py` | **新建** | `ModelSlot` ORM 模型 + `SlotType` Enum |
| C4 | `llm-service/src/llm_service/core/alias.py` | **删除** | 别名管理逻辑不再需要 |
| C5 | `llm-service/src/llm_service/core/router.py` | **重写** | 将别名解析替换为 `SlotRouter` 类：按 slot_type 加载配置 + 故障转移 |
| C6 | `llm-service/src/llm_service/api/admin.py` | **重写** | 别名 CRUD 端点替换为槽位配置端点 |
| C7 | `llm-service/src/llm_service/api/chat.py` | **修改** | 添加可选 `slot` 查询参数（默认 `reasoning`） |
| C8 | `llm-service/src/llm_service/api/embedding.py` | **修改** | 固定使用 `embedding` 槽位 |
| C9 | `llm-service/src/llm_service/api/rerank.py` | **修改** | 固定使用 `rerank` 槽位 |
| C10 | `llm-service/src/llm_service/migrations/` | **新增** | Alembic migration：创建 `llm.slot_type` Enum + `llm.model_slots` 表；删除 `llm.aliases` + `llm.models` 表 |
| C11 | `apps/web/src/pages/ModelConfig.tsx` | **重写** | 从三级管理 UI 改为槽位卡片 UI |
| C12 | `apps/cli/src/prism_cli/commands/model.py` | **修改** | `prism model alias list` → `prism model slot list` 等 |

### 3.3 API 端点变更

#### 调用类 API（影响较小）

| 变更前 | 变更后 | 说明 |
|--------|--------|------|
| `POST /api/llm/chat` `{"model": "default-chat"}` | `POST /api/llm/chat` `{"slot": "reasoning"}` 或省略（默认 reasoning） | `model` 参数改为 `slot` 参数 |
| `POST /api/llm/chat` `{"model": "fast-chat"}` | `POST /api/llm/chat?slot=fast` 或 `{"slot": "fast"}` | fast 模型通过显式指定 |
| `POST /api/llm/embedding` `{"model": "default-embedding"}` | `POST /api/llm/embedding` （无需指定） | embedding 端点只有一个槽位 |
| `POST /api/llm/rerank` `{"model": "default-rerank"}` | `POST /api/llm/rerank` （无需指定） | rerank 端点只有一个槽位 |

#### 管理类 API（完全替换）

| 变更前 | 变更后 | 说明 |
|--------|--------|------|
| `GET /api/llm/admin/models` | **删除** | 独立 Model 管理不再需要 |
| `POST /api/llm/admin/models` | **删除** | |
| `PUT /api/llm/admin/models/{id}` | **删除** | |
| `DELETE /api/llm/admin/models/{id}` | **删除** | |
| `GET /api/llm/admin/aliases` | `GET /api/llm/admin/slots` | 获取所有槽位配置 |
| `POST /api/llm/admin/aliases` | **删除** | 槽位是固定的，不需要创建 |
| `PUT /api/llm/admin/aliases/{id}` | `PUT /api/llm/admin/slots/{slot_type}` | 更新指定槽位的配置 |
| `DELETE /api/llm/admin/aliases/{id}` | **删除** | 槽位不可删除，只能 disable |
| — | `POST /api/llm/admin/slots/{slot_type}/test` | 新增：测试指定槽位的连通性 |

---

## 4. 新增 User Story 草案

### US-7：LLM 模型槽位配置

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

---

## 5. 排期影响评估

### 5.1 工时对比

| 维度 | 别名系统 | 槽位系统 | 差异 |
|------|---------|---------|------|
| 数据模型 + Migration | 1.5 天（3 表 + Enum + FK） | 0.5 天（1 表 + Enum） | **-1 天** |
| 后端 CRUD API | 4 天（Provider + Model + Alias） | 2 天（Provider + Slot） | **-2 天** |
| 路由/解析逻辑 | 2 天（别名 → Model → Provider 两级查表） | 1 天（Slot → Provider 一级查表） | **-1 天** |
| 前端配置页 | 3 天（三级管理 UI） | 2 天（卡片式 UI） | **-1 天** |
| CLI 适配 | 1 天 | 0.5 天 | **-0.5 天** |
| 文档更新 | 0.5 天 | 0.5 天 | 0 |
| **合计** | **12 天** | **6.5 天** | **-5.5 天** |

### 5.2 重构成本评估

由于 Phase 2 仍在开发中，llm-service 的核心代码（alias.py、router.py、admin.py）尚未完全实现或已实现但可以直接替换。**重构成本约等于新建成本**——这是执行此修正的最佳时机。

如果等到 Phase 2 完成后再改，重构成本将显著增加：
- 需要编写 data migration 脚本（aliases → slots）
- 需要更新所有下游消费者的调用代码
- 需要处理已有的测试数据和集成测试

**结论**：在 Phase 2 进行中执行此修正，净节省约 5 天；延迟到 Phase 2 后执行，净节省缩减为 2-3 天（额外增加 2-3 天 migration 和回归测试成本）。

### 5.3 对总排期的影响

| 里程碑 | 影响 | 说明 |
|--------|------|------|
| M1: Phase 2 完成 | **提前 1-2 天** | 槽位系统实现更简单，节省的工时直接加速 Phase 2 交付 |
| M2: Phase 2.5 精简完成 | **无影响** | Agent 基础设施不依赖 LLM 路由的具体实现方式 |
| M3: Phase 3 数据底座 | **无影响** | AI 管线通过 API 消费 LLM 服务，接口变更已在 Phase 2 中完成 |
| M4-M7 | **无影响** | 下游里程碑不直接依赖 LLM 路由实现 |

### 5.4 未来扩展成本预估

| 场景 | 槽位系统扩展成本 | 时间节点 |
|------|-----------------|---------|
| 新增 1 个槽位（如 `summarize`） | 0.5 天（Enum 扩展 + Migration + 前端加一张卡片） | Phase 4+ |
| 从 4 槽位升级为通用别名系统 | 3 天（新建 models 表 + 数据迁移 + API 适配） | 仅当槽位数量 > 8 时考虑 |
| 维持 4-6 个槽位的日常维护 | 0（无额外成本） | 长期 |

---

## 6. 最终决议摘要

### 6.1 投票总览

| 议题 | 结果 | 票数 | 附加条件 |
|------|------|------|---------|
| B1: 4 槽位 vs 别名系统 | **通过（采用 4 槽位）** | 7:0 | 赵一凡：SlotRouter 独立封装；陈思琪：Phase 4 检查点 |
| B2: 故障转移实现 | **通过** | 7:0 | 周安：故障转移日志结构化存储 |
| B3: 文档和代码影响 | **通过** | 7:0 | 方若琳：文档同步用 checklist；赵一凡：端点隐式路由 |
| B4: ModelSlot 数据模型 | **通过** | 7:0 | 周安：fallback_chain 应用层校验 + 变更审计 |

### 6.2 承诺记录

| 承诺 | 承诺人 | 验收条件 | 时间节点 |
|------|--------|---------|---------|
| SlotRouter 封装为独立类 | 赵一凡（审查） + 王磊（实现） | Code Review 通过 | Phase 2 |
| Phase 4 启动前评估槽位数量是否需要升级 | 陈思琪 | 产出评估文档 | Phase 4 启动前 |
| 故障转移结构化日志 | 周安（规范） + 王磊（实现） | INFO 级日志含完整链路信息 | Phase 2 |
| 配置变更审计日志 | 周安（规范） + 王磊（实现） | 变更前后快照可追溯 | Phase 2 |
| fallback_chain 应用层校验 | 王磊 | provider_id 有效性检查 | Phase 2 |
| 文档同步 checklist | 方若琳（清单） + 全员（执行） | D1-D11 全部完成 | Phase 2 |

### 6.3 决策理由总结

采用 4 槽位系统替代别名系统，核心理由：

1. **用户认知负担**：目标用户是非技术产品经理，4 个功能槽位比 N 个自定义别名直观十倍
2. **开发效率**：节省约 5 天工时，在 4.5 人团队 / 18 周工期约束下有显著价值
3. **当前等价性**：在 Phase 1-3 的功能范围内，4 槽位和别名系统的表达能力等价
4. **可逆性**：从槽位升级到别名系统的成本约 3 天，属于 Type 2 可逆决策
5. **审计友好**：有限且固定的配置项更易于监控和审计

附加条件确保长期健康：
- SlotRouter 独立封装（赵一凡），保证未来路由策略可替换
- Phase 4 检查点（陈思琪），避免槽位不够用时被动重构
- 故障转移和配置变更的结构化审计日志（周安），保证可追溯性

---

*本文档为 R5 Delta 评审 B 的完整记录。用户修正 #5 经 7 位虚拟专家结构化辩论后全票通过。后续需按照第 3 节修改清单执行文档和代码变更。*
