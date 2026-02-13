# D1-B：API 与测试 — 聚焦辩论记录

> 议题组 B 聚焦 API 错误处理模式、LLM 测试策略、前后端契约管理三个子议题。基于 D0 各成员独立立场宣言，进入结构化对抗辩论。

**日期**：开发启动前（D1 辩论第二场）
**主持人**：赵一凡（技术负责人）
**参与者**：赵一凡、陈思琪、王磊、周安、张晨曦、李维
**机制**：每个子议题按"正方陈述 → 反方质疑 → 自由辩论 → 修正提案 → 投票"流程进行

---

## 子议题 B1：错误处理模式

### 背景

PRD v2.0 已确定统一错误格式 `{ error: { code: "STRING_CODE", message: "..." }, meta: {...} }`。但围绕错误码粒度、LLM 特有错误的分层方式、前端消费友好性等问题，团队存在明显分歧。本子议题需要产出可执行的错误码体系。

---

### 第一轮：立场陈述

**陈思琪**（AI 工程负责人）：

> 我在 D0 中提出的 LLM 错误码分层不是学术设计，是实际需求驱动的。我们的 AI 管线有三阶段处理（Stage 1 语义拆解 → Stage 2 标签涌现 → Stage 3 向量化），每个阶段都会调用 LLM。当调用失败时，前端和调用方需要知道**问题出在哪一层**，才能决定下一步动作：
>
> 1. **`LLM_PROVIDER_ERROR`**：Provider 不可用（网络超时、认证失败、限流）。这意味着故障转移引擎已经尝试降级但全部失败，调用方应该等待或通知管理员检查 Provider 配置。
> 2. **`LLM_RESPONSE_INVALID`**：Provider 返回了，但内容无法解析（JSON 格式错误、缺少必要字段、输出被截断）。这是 LLM 输出质量问题，守卫层 L1 格式校验捕获了它。调用方应知道模型可能需要调参或换模型。
> 3. **`LLM_GUARD_REJECTED`**：LLM 输出格式正确但语义不合格（L2 语义一致性检查失败，例如情感标注自相矛盾）。这意味着 AI 质量层面有问题，但基础设施没有问题。
>
> 这三类错误的**处理策略完全不同**——Provider 错误可以重试或等待恢复，响应无效可以记录并反馈给模型调优，守卫拒绝则需要评估是守卫规则太严还是模型输出确实有问题。如果都归为一个笼统的 `LLM_ERROR`，前端和运维都没法判断该怎么办。

**王磊**（后端负责人）：

> 我同意错误码用字符串——这一点我在 D0 里写得很清楚，`VALIDATION_ERROR` 比 `40001` 好一百倍。但陈思琪的三层分类我觉得需要**再想想前端的感受**。
>
> 从前端的角度，用户看到一个导入任务失败了，他需要知道：1）这个错误是暂时的还是需要我做什么？2）我能做什么来修复？错误码应该**直接指向用户行动**，而不是指向系统内部的技术分层。
>
> 我的建议是错误码按**域**而非按**技术层**组织：
> - `VOC_IMPORT_FAILED` — 导入整体失败
> - `VOC_IMPORT_PARTIAL` — 部分成功（100 条中 5 条失败）
> - `LLM_UNAVAILABLE` — LLM 不可用（含所有 Provider 级别的错误）
> - `LLM_QUALITY_ERROR` — LLM 输出质量问题（含格式和语义）
>
> 至于 `PROVIDER_ERROR` 和 `RESPONSE_INVALID` 的区分，放在 `error.details` 字段里，前端**需要的时候可以读，不需要的时候不用管**。这样错误码列表不膨胀，但细粒度信息不丢失。

**张晨曦**（前端负责人）：

> 我补充前端消费侧的真实需求。我在 D0 中强调过——**响应字段不可为 `null` 除非有明确语义**。错误处理也一样：
>
> 第一，错误码必须是**穷举的、可枚举的**。如果后端随意新增错误码而前端不知道，TypeScript 的 switch-case 就漏了分支，用户看到的是一个空白的错误页面。我需要错误码在 OpenAPI Spec 中作为 enum 显式声明，任何新增错误码都是 API 变更，需要走契约变更流程。
>
> 第二，错误消息 `message` 字段必须是**用户可展示的**。不要给我 `"Provider siliconflow returned HTTP 429 with body: rate limit exceeded"`，给我 `"AI 服务暂时繁忙，请稍后重试"`。技术细节放 `details` 里，前端的 Sentry 上报可以带上，但用户看到的必须是人话。
>
> 第三，`null` 语义问题。`error.details` 可以为 `null`（表示无额外信息），但 `error.code` 和 `error.message` 不允许为 `null`——它们是必填字段。

**周安**（安全/DevOps）：

> 我关注的点和他们不太一样。错误响应有一条安全红线：**不能泄露系统内部信息**。
>
> `error.details` 如果包含 Provider 的 API 错误原文（比如 "Invalid API Key: sk-xxxx..."），那就是安全事故。我要求所有面向客户端的错误响应经过一层**脱敏处理**：
> - Provider 名称可以暴露（用户可能需要知道"硅基流动不可用"）
> - API Key、内部 URL、堆栈跟踪、原始 HTTP 响应体——全部不出去
> - 详细技术信息只进结构化日志，不进 HTTP 响应
>
> 另外，安全相关的错误码我要求独立命名空间：`AUTH_TOKEN_EXPIRED`、`AUTH_TOKEN_INVALID`、`AUTH_INSUFFICIENT_SCOPE`。这三个码的 HTTP 状态码分别对应 401、401、403，前端必须能区分——token 过期可以刷新，token 无效要重新登录，权限不足要提示用户。

---

### 第二轮：交叉质疑

**王磊 → 陈思琪**：

> 你的三层 LLM 错误分类，在**前端实际处理**上有差异吗？`PROVIDER_ERROR` 和 `RESPONSE_INVALID` 对用户来说，不都是"AI 处理失败，请稍后重试"吗？你给前端三个码，但前端可能对其中两个做完全一样的事——那区分的意义在哪里？

**陈思琪**：

> 不一样。`PROVIDER_ERROR` 意味着基础设施层的问题，可能 5 分钟后就恢复了，前端可以展示"服务暂时不可用，系统正在自动恢复"并提供自动重试按钮。而 `RESPONSE_INVALID` 意味着模型本身的输出质量有问题，短期内重试**大概率还是失败**，前端应该展示"处理异常，已记录待人工处理"。
>
> 但我接受你的批评——这两个码**对终端用户**的差异确实不大。我修正一下提案：面向用户的 `error.code` 可以合并为 `LLM_UNAVAILABLE` 和 `LLM_QUALITY_ERROR` 两类，但在 `error.details` 中必须包含 `sub_code` 字段区分具体原因，供前端 Sentry 上报和管理后台的错误分析面板使用。

**张晨曦 → 陈思琪**：

> `error.details` 里的 `sub_code` 我可以接受，但你得保证它也是 enum 类型，不能是随意字符串。否则我的 TypeScript 类型定义又变成 `string` 了，类型安全就没了。

**陈思琪**：

> 可以。`sub_code` 枚举：`PROVIDER_TIMEOUT`、`PROVIDER_AUTH_FAILED`、`PROVIDER_RATE_LIMITED`、`RESPONSE_PARSE_FAILED`、`RESPONSE_TRUNCATED`、`GUARD_FORMAT_REJECTED`、`GUARD_SEMANTIC_REJECTED`。这七个覆盖了当前所有已知的 LLM 错误场景。新增 sub_code 走 PR 审查，我在 Prompt 变更流程里同步更新。

**赵一凡 → 王磊**：

> 你提到按域组织错误码——`VOC_IMPORT_FAILED`、`VOC_IMPORT_PARTIAL`。这个思路我同意，但你的 `VOC_IMPORT_PARTIAL` 不应该用错误格式返回。HTTP 200 + 响应体中包含逐条处理结果才对。部分成功不是错误，是正常的批量处理结果。

**王磊**：

> 对，你说得对。`VOC_IMPORT_PARTIAL` 撤回。批量导入的响应应该用 HTTP 200 + `{ data: { total: 100, succeeded: 95, failed: 5, failures: [...] } }` 的格式。只有导入整体失败（比如文件格式无法解析）才是 400 + `VOC_IMPORT_INVALID_FILE`。

**李维 → 王磊**：

> 批量导入的 `failures` 数组里，每条失败记录需要包含哪些信息？我们的 CSV 可能有几千行，如果每条失败都要返回原始数据，响应体会很大。

**王磊**：

> 好问题。每条失败记录包含：`row_number`（行号）、`error_code`（单条错误码）、`message`（错误原因）。不返回原始数据——如果用户需要看原始数据，可以通过行号回 CSV 里查。`failures` 数组最多返回前 100 条，超过的给一个 `has_more: true` 标记，完整失败列表通过 `GET /api/voc/import/{id}/failures` 分页获取。

---

### 第三轮：自由辩论

**周安**：

> 我还有一个问题没解决。AI 管线是异步的——1000 条 Voice 的处理不可能在一个 HTTP 请求内完成。陈思琪在 D0 中提过返回 `task_id` + 轮询状态 API。那异步任务的错误码机制和同步 API 是同一套吗？

**陈思琪**：

> 不完全一样。同步 API（如 `POST /api/llm/chat`）的错误直接在 HTTP 响应中返回。但异步任务（如 `POST /api/voc/import`）的错误分两层：
> 1. **提交层错误**：文件格式不对、文件太大——这是同步返回的 400 错误。
> 2. **执行层错误**：AI 管线处理过程中某条 Voice 失败——这通过 `GET /api/voc/import/{id}/status` 轮询获取，状态中包含错误统计和失败详情。
>
> 错误码体系是同一套枚举，但承载的 HTTP 机制不同。

**张晨曦**：

> 这意味着我前端需要处理两种错误流：同步的 try-catch 和异步的轮询状态检查。这可以接受，但我要求 `import/{id}/status` 响应中的错误格式和同步错误格式**完全一致**——不要搞两套结构，否则我的错误处理组件没法复用。

**王磊**：

> 好，那我来统一一下。异步任务状态响应中，如果任务整体失败，`status.error` 字段的结构和同步错误响应的 `error` 字段**完全相同**——都是 `{ code, message, details }`。逐条失败的信息放在 `status.failures` 数组里。

**赵一凡**：

> 把迄今为止的讨论汇总一下。我看到一个共识在形成：
>
> 1. 顶层错误码按域前缀组织：`AUTH_*`、`LLM_*`、`VOC_*`、`VALIDATION_*`
> 2. 每个域内的错误码数量控制在 5-8 个
> 3. 精细粒度通过 `error.details.sub_code` 承载
> 4. `error.message` 必须用户可读，技术细节不出现在 message 中
> 5. `error.details` 经过脱敏处理
>
> 有反对意见吗？

**李维**：

> 我补充一点。数据管线有特有的错误场景：编码检测失败（GBK 文件被当 UTF-8 解析）、CSV 分隔符识别错误、Excel 工作表为空。这些应该归到 `VOC_*` 域下面吗？

**王磊**：

> 对，`VOC_IMPORT_INVALID_FILE`——文件本身有问题。具体原因通过 `details.sub_code` 区分：`ENCODING_ERROR`、`EMPTY_CONTENT`、`UNSUPPORTED_FORMAT`。不需要给每种文件错误一个独立的顶层码。

---

### 修正提案与投票

**赵一凡**宣读最终提案：

#### 错误响应格式

```json
{
  "error": {
    "code": "LLM_UNAVAILABLE",
    "message": "AI 服务暂时不可用，系统正在尝试恢复",
    "details": {
      "sub_code": "PROVIDER_RATE_LIMITED",
      "provider": "siliconflow",
      "retry_after_seconds": 30
    }
  },
  "meta": {
    "request_id": "uuid",
    "timestamp": "2026-02-12T10:00:00Z"
  }
}
```

#### 顶层错误码枚举（Phase 1 完整列表）

| 域 | 错误码 | HTTP 状态码 | 含义 |
|---|---|---|---|
| AUTH | `AUTH_TOKEN_EXPIRED` | 401 | JWT 过期，前端应刷新 |
| AUTH | `AUTH_TOKEN_INVALID` | 401 | JWT 无效，需重新登录 |
| AUTH | `AUTH_INSUFFICIENT_SCOPE` | 403 | API Key 权限不足 |
| AUTH | `AUTH_CREDENTIALS_INVALID` | 401 | 用户名/密码错误 |
| VALIDATION | `VALIDATION_ERROR` | 422 | 请求参数校验失败（Pydantic 错误） |
| LLM | `LLM_UNAVAILABLE` | 503 | LLM 服务不可用（所有 Provider 失败） |
| LLM | `LLM_QUALITY_ERROR` | 502 | LLM 输出质量不合格（守卫拒绝） |
| LLM | `LLM_SLOT_NOT_CONFIGURED` | 503 | 请求的槽位未配置 |
| VOC | `VOC_IMPORT_INVALID_FILE` | 400 | 导入文件格式/编码/内容有误 |
| VOC | `VOC_IMPORT_MAPPING_FAILED` | 422 | LLM Schema 映射失败（置信度 < 0.7） |
| VOC | `VOC_TASK_NOT_FOUND` | 404 | 异步任务不存在 |
| GENERAL | `RESOURCE_NOT_FOUND` | 404 | 通用资源不存在 |
| GENERAL | `INTERNAL_ERROR` | 500 | 未分类的内部错误 |

#### sub_code 枚举（`error.details.sub_code`）

| 域 | sub_code | 所属顶层码 |
|---|---|---|
| LLM | `PROVIDER_TIMEOUT` | `LLM_UNAVAILABLE` |
| LLM | `PROVIDER_AUTH_FAILED` | `LLM_UNAVAILABLE` |
| LLM | `PROVIDER_RATE_LIMITED` | `LLM_UNAVAILABLE` |
| LLM | `RESPONSE_PARSE_FAILED` | `LLM_QUALITY_ERROR` |
| LLM | `RESPONSE_TRUNCATED` | `LLM_QUALITY_ERROR` |
| LLM | `GUARD_FORMAT_REJECTED` | `LLM_QUALITY_ERROR` |
| LLM | `GUARD_SEMANTIC_REJECTED` | `LLM_QUALITY_ERROR` |
| VOC | `ENCODING_ERROR` | `VOC_IMPORT_INVALID_FILE` |
| VOC | `EMPTY_CONTENT` | `VOC_IMPORT_INVALID_FILE` |
| VOC | `UNSUPPORTED_FORMAT` | `VOC_IMPORT_INVALID_FILE` |
| VOC | `COLUMN_NOT_RECOGNIZED` | `VOC_IMPORT_MAPPING_FAILED` |

#### 约束规则

1. `error.code` 和 `error.message` 为必填字段，不可为 `null`
2. `error.details` 可为 `null`（表示无额外信息），但存在时 `sub_code` 为必填
3. `error.message` 必须为用户可读文本，禁止包含 API Key、内部 URL、堆栈跟踪
4. 新增顶层错误码视为 API breaking change，需走契约变更流程
5. 新增 sub_code 为非 breaking change，但需更新 OpenAPI Spec 并通知前端
6. 异步任务状态中的 `error` 字段与同步错误格式完全一致
7. 批量操作成功使用 HTTP 200，`failures` 数组内的单条错误使用同一套错误码枚举

**投票结果**：6:0 全票通过。

| 成员 | 投票 | 理由 |
|------|------|------|
| 赵一凡 | 赞成 | 两层错误码既保证了前端消费简洁性，又保留了诊断精度 |
| 陈思琪 | 赞成 | sub_code 枚举覆盖了 AI 管线所有已知错误场景，可以接受 |
| 王磊 | 赞成 | 顶层码数量可控（13 个），前端 switch-case 不会爆炸 |
| 周安 | 赞成 | 脱敏规则明确，安全红线得到保障 |
| 张晨曦 | 赞成 | 错误码和 sub_code 都是枚举，TypeScript 类型安全有保障 |
| 李维 | 赞成 | 数据管线特有的文件格式错误被妥善处理 |

---

## 子议题 B2：LLM 测试策略

### 背景

PRD v2.0 定义了 AI 管线三阶段处理（Stage 1-3）+ LLM 输出守卫层（L1/L2）+ 4 槽位模型。LLM 调用的不确定性（输出可能变化、API 有成本、响应延迟高）使得测试策略成为技术关键决策。本子议题需要明确 CI 中的 Mock 策略、真实 LLM 测试的触发条件、以及质量回归基准。

---

### 第一轮：立场陈述

**陈思琪**（AI 工程负责人）：

> 我在 D0 中提出的三层测试策略不是过度设计——它是 AI 系统测试的**行业最佳实践**。让我展开每一层的具体设计：
>
> **第一层：快速测试（CI 必跑，< 2 分钟）**
>
> Mock 所有 LLM 调用。每个 Stage 的测试用例至少覆盖：
> - Stage 1（语义拆解）：输入一段 Voice 原文，Mock LLM 返回预设的 JSON，验证管线正确解析出 SemanticUnit 列表
> - Stage 2（标签涌现）：输入 SemanticUnit，Mock LLM 返回标签列表，验证标准化逻辑（同义词合并、格式规范化）
> - Stage 3（向量化）：Mock embedding 接口返回固定维度向量，验证向量存储和索引更新
> - 守卫层 L1：Mock LLM 返回格式异常的响应（缺字段、JSON 残缺），验证守卫拦截
> - 守卫层 L2：Mock LLM 返回格式正确但语义矛盾的响应（情感为 positive 但关键词全是负面），验证语义检查
> - 错误路径：Mock Provider 超时、返回 429、返回空响应，验证故障转移和降级逻辑
>
> **第二层：Golden Dataset 回归测试（PR 标签触发，每次 5-10 分钟）**
>
> 用 10-20 条标注好的真实 VOC 数据（脱敏后），调用真实 LLM，验证输出质量不退化。重点检查：
> - 语义拆解的粒度是否合理（一条 Voice 被拆成合理数量的 SemanticUnit）
> - 涌现标签是否覆盖已知主题（如"电池续航"、"售后服务"应被识别）
> - 置信度分布是否合理（不能全是 0.99 也不能全是 0.3）
>
> 这一层只在 PR 包含 Prompt 变更或 AI 管线核心逻辑变更时触发，通过 GitHub Labels 控制（`ai-regression` 标签）。
>
> **第三层：基准测试（里程碑前手动触发，30-60 分钟）**
>
> 100+ 条数据全流程处理，评估：标注一致性（同一输入跑两次的标签重叠率 > 70%）、标签涌现多样性（产出 >= 20 个不同标签）、端到端处理时间。这是 M3/M5 Go/No-Go 的验收手段。

**周安**（安全/DevOps）：

> 我的立场非常明确：**CI 不能依赖任何外部服务**。
>
> 这不是原则洁癖，是工程必要性。我们用的四家 LLM Provider（硅基流动、OpenRouter、Kimi、MiniMax）都是第三方 SaaS。它们的 SLA 不是我们能控制的。上周硅基流动维护了 3 小时——如果 CI 依赖它，我们全团队的 PR 都会被阻塞。
>
> 所以我的红线是：
> 1. `main` 分支保护规则里的 CI check 必须 100% 可离线运行。不允许有任何一个 required check 依赖外部网络。
> 2. 真实 LLM 测试可以存在，但必须是 **optional check**——PR 合并不依赖它的结果。
> 3. CI 环境中的 LLM 调用全部走 Mock（`respx` 或 `responses` 拦截 httpx 请求）。Redis 用 `fakeredis`。PostgreSQL 用 `testcontainers`（这是本地容器，不算外部依赖）。
>
> 另外，从安全角度，CI 环境中不应该有真实的 LLM API Key。API Key 是敏感信息，存在 CI Secret 中只是减少暴露面，但 CI 日志泄露的风险始终存在。真实 LLM 测试如果一定要做，应该在**专用的安全测试环境**中运行，不是通用 CI。

**王磊**（后端负责人）：

> 我的立场比周安稍微宽松，但核心一致——**CI 要快、要稳、要可预测**。
>
> 我支持陈思琪的第一层（Mock 快速测试），这是必须的。但第二层（Golden Dataset 回归测试）我有疑虑：
>
> 1. LLM 输出本身就有随机性。即使 temperature 设为 0，不同时间调用同一个模型，输出也可能略有不同。你的 Golden Dataset 怎么定义"通过"？字符串精确匹配？那几乎每次都会失败。语义相似度匹配？那你需要一个额外的 LLM 来判断——测试的复杂度翻倍了。
>
> 2. 10-20 条样本做回归，统计显著性很弱。除非某个 Prompt 改动导致**全面崩溃**（10 条全错），否则 1-2 条差异根本说明不了问题。
>
> 我的替代方案：**把回归测试做成结构化评审而不是自动化判断**。PR 中触发真实 LLM 调用，输出结果以 Markdown 表格的形式贴在 PR comment 中（输入、期望标签、实际标签、人工判定列）。由 PR reviewer（陈思琪或指定的 AI 工程师）**人工判断**输出质量是否退化。这样既利用了真实 LLM 调用，又避免了自动化判定的误报问题。

**李维**（数据工程负责人）：

> 我要补充数据管线测试的特殊性。AI 管线的输入不是 API 请求——它是**文件**。CSV 的编码问题、Excel 的多工作表、空行、特殊字符——这些边界情况用 Faker 生成的假数据覆盖不到。
>
> 我在 D0 中提的"真实样本数据"还是要坚持：`tests/fixtures/` 中保存真实格式的 CSV/Excel 样本（当然是脱敏后的）。包括：
> - UTF-8 BOM 文件
> - GBK 编码文件
> - 含空行和不规则分隔符的 CSV
> - 多工作表 Excel（只有第二个工作表有数据）
> - 含合并单元格的 Excel
> - 超长文本（单条 Voice > 10000 字符）
>
> 这些样本文件走数据管线的前半段（文件解析 + Schema 映射），不需要调用真实 LLM。Mock LLM 就能测试。但样本本身必须是真实格式的。

---

### 第二轮：交叉质疑

**陈思琪 → 周安**：

> 你的 CI 完全隔离原则我理解也认同。但"真实 LLM 测试只能是 optional check"这一点我要 push back。
>
> 假设有人改了 Stage 2 的 Prompt 模板，PR 通过了所有 Mock 测试（因为 Mock 返回的永远是预设数据），合并到 main。结果真实 LLM 在新 Prompt 下的输出全是垃圾。我们要到 Dogfooding 阶段才发现——那时候整个数据集已经被污染了。
>
> 我的妥协方案是：**Prompt 变更的 PR 强制要求 AI 回归测试通过**。不是所有 PR，只是 `prompts/` 目录下的文件变更触发。这个 check 可以标记为 `required for specific paths`——GitHub 支持 CODEOWNERS + path-based required checks。

**周安**：

> 我理解你的担忧。但 path-based required checks 有个实际问题：如果一个 PR 同时改了 Prompt 和业务代码，那整个 PR 都会被这个 check 阻塞。而且真实 LLM 测试的不确定性——如果硅基流动那天正好限流，Prompt 改动的 PR 就合不了。
>
> 我的对案：Prompt 变更的 PR 不设 required check，但设**强制 reviewer**。陈思琪是 `prompts/` 目录的 CODEOWNER，任何 Prompt 变更必须经她 approve。她 approve 之前**必须先在本地或专用环境跑一遍回归测试**并把结果贴在 PR comment 里。这样质量保障由人保证，CI 稳定性不受影响。

**王磊 → 陈思琪**：

> 你说 Golden Dataset 10-20 条——这个数据集谁来标注？什么时间点标注？标注标准是什么？
>
> 如果标注标准是"陈思琪认为合理"，那就是单人主观判断，不是客观基准。如果标注标准是"标签必须包含 X"，那你等于在用预设分类的思路测试涌现标签——这和产品理念自相矛盾。

**陈思琪**：

> 好问题。Golden Dataset 的标注标准不是"必须产出某个特定标签"，而是：
>
> 1. **结构正确性**：Stage 1 的输出是合法的 SemanticUnit JSON（有 text、intent、sentiment 字段）
> 2. **语义覆盖度**：一条 3 句话的 Voice 应该被拆成 2-4 个 SemanticUnit，不能只拆出 1 个也不能拆出 10 个
> 3. **标签相关性**：涌现标签与原文**语义相关**（不一定字面匹配）。"这车电池冬天掉电太快了"应该产出包含"电池"或"续航"相关的标签，不应该产出"座椅舒适度"
> 4. **置信度分布**：置信度不全是 0.99（过于自信）也不全是 0.3（过于不确定）
>
> 标注工作由我和李维在 M3（数据底座里程碑）之前完成。我们会用真实的阿维塔车主评论（脱敏后）作为样本源。标注结果走 PR 审查，团队都能看到标注逻辑。

**赵一凡 → 所有人**：

> 我来把分歧聚焦一下。核心分歧是：**Prompt 变更的 PR 是否需要真实 LLM 测试作为合并的硬性条件？**
>
> - 陈思琪主张：是，通过 path-based required check
> - 周安主张：否，通过 CODEOWNER 强制审查 + 人工验证
> - 王磊主张：否，通过 PR comment 中贴回归结果 + 人工判断
>
> 我倾向于周安和王磊的方案，理由是：Phase 1 我们只有 6 个人，CI 稳定性的优先级高于自动化程度。但我要加一个约束——**陈思琪作为 CODEOWNER 必须在 approve comment 中附上回归测试结果截图或日志链接，不能空 approve**。

---

### 第三轮：自由辩论

**张晨曦**：

> 前端的测试策略你们讨论完了，我说一下前端侧。我的方案在 D0 中写了——Testing Library 组件测试 + MSW Mock 后端 API + Playwright E2E。
>
> 但有一个和后端强相关的点：**前端的 API Mock 数据从哪里来？** 如果我用 MSW 拦截请求，Mock 数据是我手写的 JSON——那这些 JSON 和后端真实返回的格式不一致怎么办？
>
> 我的建议是：后端的 API 集成测试中，把真实的响应 JSON 固化成 fixtures（`tests/fixtures/api_responses/`）。前端的 MSW handler 直接读这些 fixtures。这样**前后端用同一份测试数据**，格式不一致的问题在 CI 阶段就能暴露。

**王磊**：

> 这个主意我喜欢。不过实操上有个问题——后端的 API 响应 fixtures 如果改了，前端怎么知道？
>
> 更好的方案是：**不要共享 fixtures，而是共享 OpenAPI Spec**。后端每次 PR 会自动导出最新的 OpenAPI JSON（FastAPI 的 `/openapi.json`），CI 中比对当前 Spec 和上一个版本的 Spec，如果有 breaking change 就报红。前端基于 Spec 自动生成类型和 Mock。这样比共享 fixtures 更可靠——Spec 是契约，fixtures 只是例子。

**张晨曦**：

> 同意。那我的方案调整为：MSW 的 Mock 数据手写（基于 OpenAPI Spec 的类型约束），但 CI 中增加一个 Spec 兼容性检查。具体实现我在子议题 B3 中再展开。

**陈思琪**：

> 我最后争取一点。即使 Prompt 变更的 required check 我让步了，基准测试（第三层）在 M3 和 M5 里程碑前必须跑，而且结果必须纳入 Go/No-Go 评审。PRD 中已经写了标注一致性 > 70%、语义搜索 Top-5 命中率 > 60%——这些指标不能只是文档上的数字，必须有实际的测试报告支撑。

**赵一凡**：

> 这一点完全同意。基准测试是里程碑验收的一部分，不是 CI 的一部分。M3 和 M5 的 Go/No-Go 评审必须包含基准测试报告，由陈思琪出具。

---

### 修正提案与投票

**赵一凡**宣读最终提案：

#### LLM 测试三层策略

| 层级 | 名称 | 触发条件 | 耗时 | LLM 调用 | CI 属性 | 负责人 |
|------|------|---------|------|----------|---------|--------|
| L1 | 快速测试 | 每次 PR / push | < 2 分钟 | 全部 Mock | Required Check | 全员 |
| L2 | 回归测试 | Prompt 变更 PR（CODEOWNER 人工触发） | 5-10 分钟 | 真实 LLM | 非 Required，但 CODEOWNER 必须附结果 | 陈思琪 |
| L3 | 基准测试 | M3、M5 里程碑前手动触发 | 30-60 分钟 | 真实 LLM | Go/No-Go 评审材料 | 陈思琪 + 李维 |

#### L1 快速测试 Mock 策略

| 组件 | Mock 方案 | 说明 |
|------|----------|------|
| LLM Provider（httpx 请求） | `respx` 拦截 | 预设固定的 LLM 响应 JSON |
| Redis | `fakeredis` | 内存模拟，无需容器 |
| PostgreSQL | `testcontainers` | 真实 PG 容器，保证 SQL 兼容性 |
| 外部 HTTP 服务 | `respx` 拦截 | 不允许任何出站 HTTP 请求 |

#### L2 回归测试 Golden Dataset 规格

- **数据量**：10-20 条脱敏真实 VOC 数据
- **存储位置**：`tests/fixtures/golden/`，与代码同仓管理
- **标注维度**：结构正确性、语义覆盖度（拆解粒度合理范围）、标签相关性（语义相关即可）、置信度分布
- **判定方式**：人工判定（PR reviewer 对照标注基准评估），不做自动化 pass/fail
- **标注人**：陈思琪 + 李维，标注变更走 PR 审查
- **创建时间**：M3 里程碑前完成初始 Golden Dataset

#### L3 基准测试指标

| 指标 | 目标值 | 对应 PRD KPI |
|------|--------|-------------|
| AI 管线端到端处理可靠性 | > 95%（1000 条中失败 < 50） | PRD 1.3 |
| 标注一致性（同一输入跑两次标签重叠率） | > 70% | PRD 1.3 |
| 语义搜索 Top-5 命中率 | > 60% | PRD 1.3 |
| 涌现标签多样性 | >= 20 个不同标签 | US-1 AC5 |
| 千条批量处理时间 | < 30 分钟 | PRD 5.1 |

#### Prompt 变更 PR 审查规则

1. `prompts/` 目录设置 CODEOWNERS，陈思琪为必须 reviewer
2. Prompt PR 必须附带变更原因和预期影响评估（PR 模板强制要求）
3. 陈思琪 approve 前必须完成 L2 回归测试，结果以 Markdown 表格贴在 PR comment 中
4. 没有回归结果附件的 approve 无效

#### 数据管线测试样本

- `tests/fixtures/csv/` 和 `tests/fixtures/excel/` 中保存真实格式样本文件（脱敏后）
- 样本覆盖：UTF-8、GBK、BOM、空行、特殊字符、多工作表、合并单元格、超长文本
- 数据管线的文件解析 + Schema 映射阶段可用 Mock LLM 测试，不需要真实调用

**投票结果**：6:0 全票通过。

| 成员 | 投票 | 理由 |
|------|------|------|
| 赵一凡 | 赞成 | 三层策略职责清晰，CI 稳定性和 AI 质量保障兼顾 |
| 陈思琪 | 赞成 | L2 虽非 required check，但 CODEOWNER + 强制附结果的机制保障了质量 |
| 王磊 | 赞成 | L1 Mock 全覆盖 + L2 人工判定，避免了自动化误报 |
| 周安 | 赞成 | CI 完全隔离原则得到保障，真实 API Key 不进 CI 环境 |
| 张晨曦 | 赞成 | 前端 API Mock 策略与后端测试方案兼容 |
| 李维 | 赞成 | 真实格式样本文件的需求被纳入，数据管线测试有保障 |

**陈思琪附带声明**：

> 我保留一个条件——如果在 Dogfooding 阶段（M6-M7）出现因 Prompt 变更导致的质量退化事故（涌现标签一致性大幅下降），我会重新提议将 L2 升级为 Prompt PR 的 required check。届时全员重新投票。

**赵一凡确认**：声明记录在案。

---

## 子议题 B3：前后端契约管理

### 背景

PRD v2.0 明确了 API 契约约束："API 契约一旦冻结不允许 breaking change（新增字段可以，删除/重命名不行）"。但契约的**产生方式**存在两种路线：赵一凡主张 OpenAPI Spec 先于代码（API First），王磊主张 FastAPI 自动生成就够了（Code First）。张晨曦关注的是无论哪种方式，前端都要拿到类型安全的 TypeScript 定义。本子议题需要明确 API 设计流程和契约传递机制。

---

### 第一轮：立场陈述

**赵一凡**（技术负责人）：

> 我在 D0 中的立场是"OpenAPI Spec 先于代码"。让我解释为什么这不是过度设计：
>
> Phase 1 有 4 个服务的 API 需要设计：user-service（已有）、llm-service（已有）、voc-service（新建）、Agent 服务（Phase 2.5 新建）。其中 voc-service 的 API 最复杂——导入、搜索、标签、反馈、对比——涉及前后端联调、AI 管线触发、异步任务状态。
>
> 如果不先写 Spec 就直接写代码，会发生什么？王磊写了 `POST /api/voc/import` 的响应格式，张晨曦按自己的理解写了前端类型，两边到联调时发现字段名不一致——`batch_id` vs `import_id`，`status` 的枚举值 `processing` vs `in_progress`。改后端要改数据库，改前端要改组件树。这种故事在每个不做契约管理的项目里都发生过。
>
> 我的方案是：**voc-service 和 Agent 服务的 API 必须先写 OpenAPI YAML**，经前后端确认后再编码。已有的 user-service 和 llm-service 以 FastAPI 自动生成的 Spec 为准（因为代码已经存在了，补写手工 Spec 没有意义）。

**王磊**（后端负责人）：

> 赵一凡说的问题确实存在，但他的方案**增加了一个同步维护的负担**。
>
> 手写 OpenAPI YAML 意味着什么？每次后端改 API，除了改代码还要同步改 YAML。如果忘了改——而这在赶工期的时候几乎必然发生——Spec 和代码就不一致了。这比没有 Spec 更危险，因为前端在消费一个**过时的**契约。
>
> FastAPI 的杀手级特性就是**代码即文档**。Pydantic 模型定义了请求和响应的 Schema，FastAPI 自动生成完全准确的 OpenAPI JSON。这不是"自动生成勉强够用"——这是**自动生成就是最准确的**，因为它直接从运行时代码生成，不存在代码和文档不一致的可能。
>
> 我的方案是：
> 1. 后端用 FastAPI + Pydantic 模型定义 API，代码即是 Spec
> 2. CI 中自动导出 `/openapi.json`，提交到仓库的 `api-specs/` 目录
> 3. 前端基于 `api-specs/` 中的 JSON 自动生成 TypeScript 类型
> 4. CI 中比对当前 Spec 和上次 Spec，如果有 breaking change（字段删除/重命名/类型变更）就报红
>
> 这样既保证了契约准确性（代码自动生成），又有了变更检测（diff 检查），还不需要手写和维护 YAML。

**张晨曦**（前端负责人）：

> 我坦白说——**我不关心 Spec 是手写的还是自动生成的**。我关心的是三件事：
>
> 1. **TypeScript 类型自动生成**：我要用 `openapi-typescript` 从 Spec 自动生成类型定义。不管 Spec 来源如何，只要 `api-specs/` 目录下有最新的 OpenAPI JSON，我就能工作。
>
> 2. **Breaking change 检测**：后端改了 API 字段，我的构建必须在编译阶段就报错，不能到运行时才发现。这需要 CI 中的 Spec diff 检查。
>
> 3. **前端可以在后端完成前启动开发**：API 契约确定后（不管是手写 Spec 还是后端先写了空壳路由），我可以用 MSW 基于类型定义 Mock 数据，不等后端实现完成就开始开发页面。
>
> 所以我的核心需求是：**尽早拿到稳定的 API 契约**。如果赵一凡先手写 Spec 能让我更早拿到，我支持手写。如果王磊先写空壳路由（有 Pydantic 模型但业务逻辑 `raise NotImplementedError`）能更快，我也接受。

---

### 第二轮：交叉质疑

**赵一凡 → 王磊**：

> 你说的"代码即 Spec"有一个前提——**代码已经写好了**。但 voc-service 是新建的，Phase 3 才开始写代码。从现在到 Phase 3 的 W7，前端怎么知道 `/api/voc/import` 的响应格式是什么？张晨曦不可能干等着后端把代码写完。
>
> API First 的核心价值不在于"有一个 YAML 文件"，而在于**设计阶段的协作**。你我和张晨曦坐下来，在白板上讨论 `/api/voc/import` 应该返回什么字段、`/api/voc/search` 的查询参数怎么设计。讨论的成果固化为 OpenAPI YAML，大家签字确认，然后各走各的。这个过程 Code First 做不到——你不能说"等我写完代码你再看"。

**王磊**：

> 你说的"设计协作"我完全同意——但这不需要手写 YAML 来实现。
>
> 我的替代方案：**Design Doc PR + 空壳路由**。
>
> 1. 先写 Design Doc（Markdown），列出每个 API 端点的请求/响应字段、类型、必填/可选。这是设计协作阶段的产物——跟你说的白板讨论一样。
> 2. Design Doc 审查通过后，后端立刻创建空壳路由：有 Pydantic 模型定义、有 FastAPI 路由装饰器、处理函数体为 `raise NotImplementedError()`。
> 3. 空壳路由合并到 main 后，CI 自动导出 OpenAPI JSON。前端立即可以用。
>
> 这样设计协作有了（Design Doc 审查），类型准确性有了（Pydantic 模型），前端也能尽早启动了（空壳路由一天之内就能写完）。而且后续实现阶段不存在"代码和 YAML 不一致"的问题——因为根本就没有需要手动维护的 YAML。

**张晨曦 → 赵一凡**：

> 赵一凡，假设我们用你的 API First 方案，有一个实操问题：手写的 OpenAPI YAML 里定义了一个响应字段 `tags: array[Tag]`，但后端在实现的时候发现 `Tag` 对象还需要一个 `usage_count` 字段——这算 breaking change 吗？**新增字段**按 PRD 约定不算 breaking change，但如果前端的 TypeScript 类型是从手写 YAML 生成的，新增字段在前端类型中不存在，运行时虽然不会报错，但字段也用不了。
>
> 这意味着手写 YAML 和代码之间**必然**有一个同步更新的过程。而这个同步更新，就是王磊说的维护负担。

**赵一凡**：

> 你说的对。我重新评估一下我的立场。
>
> 手写 YAML 的核心价值是**设计阶段的协作**，不是**维护阶段的契约源**。如果王磊的"Design Doc + 空壳路由"方案能同时满足设计协作和准确性，那手写 YAML 确实不是必须的。
>
> 我修正我的立场：**voc-service 的 API 设计用 Design Doc PR 走协作审查流程，但 OpenAPI Spec 的唯一真实来源（single source of truth）是 FastAPI 自动生成的。** 手写 YAML 作为设计阶段的草案可以存在，但不作为正式契约——正式契约是 `api-specs/` 目录下的自动生成 JSON。

---

### 第三轮：自由辩论

**周安**：

> 我来加一条安全相关的约束。OpenAPI Spec 自动导出到仓库，OK。但 **Spec 中不能包含内部端点**。比如 `/api/llm/admin/providers` 这种管理端点，如果 Spec 是公开的（或者仓库将来开源），就泄露了管理接口的存在和参数格式。
>
> 建议：导出两份 Spec——`api-specs/public.json`（面向前端）和 `api-specs/admin.json`（面向管理后台）。前端只消费 public.json。FastAPI 支持通过 `include_in_schema=False` 控制哪些路由出现在 Spec 中。

**王磊**：

> 我觉得没必要分两份。Phase 1 的管理后台也是我们前端自己——张晨曦也要用 admin API。分两份 Spec 意味着前端要维护两套类型生成流程。
>
> 如果仓库开源（现在不是，将来也不确定），那时候再处理。Phase 1 一份完整的 Spec 就够了。

**周安**：

> 好吧，Phase 1 接受一份完整 Spec。但 README 里不能有"管理 API 列表"的公开文档。而且我要在 Spec 里给 admin 路由打上 `x-internal: true` 的 extension 标记——将来如果 Spec 要对外发布，一行脚本就能过滤掉。

**张晨曦**：

> 具体说一下前端的 TypeScript 类型生成流程。我计划使用 `openapi-typescript` 从 OpenAPI JSON 生成类型定义文件，输出到 `apps/web/src/api/types.generated.ts`。这个文件是自动生成的，**不允许手动修改**——`.gitignore` 中排除，CI 中自动生成。
>
> 基于生成的类型，我会手写一层薄薄的 API 客户端（`apps/web/src/api/client.ts`），使用 fetch + SWR 调用后端 API。API 客户端的函数签名严格基于生成的类型——入参和返回值都有类型约束。这样如果后端改了 API 字段，前端的 `tsc --noEmit` 就会报错。

**赵一凡**：

> 等一下——`types.generated.ts` 放在 `.gitignore` 中，意味着仓库里没有这个文件。那新开发者 clone 仓库后怎么办？必须先跑一次类型生成才能启动前端开发。
>
> 我建议生成的类型文件**提交到仓库**（不放 gitignore），但通过 CI check 验证它是最新的——CI 中重新生成一次，和仓库中的比对，不一致就报红。这样新开发者 clone 就能直接开发，而且类型准确性有 CI 保障。

**张晨曦**：

> 好，接受。生成的类型文件提交到仓库，CI 中做 freshness check。

**李维**：

> 我还有一个小问题。CLI 的契约怎么管理？CLI 调用的是和前端相同的 HTTP API，但 CLI 是 Python 写的（Typer），不消费 OpenAPI Spec 生成类型。CLI 的 API 调用用 httpx 手写请求——这部分的"契约"靠什么保证？

**王磊**：

> CLI 和后端在同一个 monorepo 里，都是 Python。CLI 可以直接 import 后端的 Pydantic 响应模型来做响应解析：
>
> ```python
> # apps/cli 中
> from voc_service.api.schemas import ImportResponse
> response = httpx.post("/api/voc/import", ...)
> result = ImportResponse.model_validate(response.json()["data"])
> ```
>
> 等等——这违反了服务依赖方向。CLI 不应该 import 后端服务的内部模块。

**赵一凡**：

> 没错，这是架构红线。CLI 应该通过 HTTP 调用后端 API，不能直接 import 后端代码。
>
> 正确的方案：**shared 包中放一份通用的响应 Schema 定义**（`shared/schemas/responses.py`），后端服务和 CLI 都 import shared 的 Schema。但 shared 只包含通用格式（分页、错误格式、meta），不包含业务 Schema（如 ImportResponse 的具体字段）。
>
> CLI 消费业务 API 的响应，只能用动态解析——`response.json()["data"]["batch_id"]`。如果后端改了字段名，CLI 会在运行时报 KeyError。这是可以接受的——CLI 的测试应该覆盖关键 API 调用路径，CI 跑 CLI 测试时会发现不一致。

**李维**：

> 明白了。CLI 的契约保障靠 API 集成测试，不靠编译时类型检查。

---

### 修正提案与投票

**赵一凡**宣读最终提案：

#### API 契约管理工作流

```
设计阶段                   实现阶段                     消费阶段
   │                         │                            │
   ▼                         ▼                            ▼
Design Doc PR            空壳路由 PR                  CI 自动流程
(Markdown 描述             (Pydantic 模型 +              │
 端点/字段/类型)            FastAPI 路由装饰器 +          ├─ 导出 OpenAPI JSON → api-specs/openapi.json
   │                       raise NotImplementedError)     ├─ 生成 TypeScript 类型 → apps/web/src/api/types.generated.ts
   │  审查: 前后端+AI工程    │                            ├─ 类型文件 freshness check
   │                         │  审查: 后端               ├─ Spec breaking change 检测（与上次 Spec diff）
   ▼                         ▼                            └─ 检测到 breaking change → CI 报红
合并后归档               合并后前端可启动开发
(docs/designs/)           (基于自动生成的类型)
```

#### 核心决策

| 决策项 | 结论 | 理由 |
|--------|------|------|
| Spec 唯一真实来源 | FastAPI 自动生成的 OpenAPI JSON | 消除手写 YAML 和代码不一致的风险 |
| 设计阶段协作方式 | Design Doc PR（Markdown） | 轻量、可审查、可归档 |
| 前端开发启动时机 | 空壳路由合并后即可启动 | 空壳路由有 Pydantic 模型，Spec 已完整 |
| TypeScript 类型生成 | `openapi-typescript` 自动生成，提交到仓库 | CI freshness check 保证准确性 |
| Breaking change 检测 | CI 中 Spec diff + 报红 | 字段删除/重命名/类型变更为 breaking |
| CLI 契约保障 | API 集成测试覆盖关键路径 | CLI 为 Python 动态语言，靠运行时测试 |
| 内部 API 标记 | admin 路由加 `x-internal: true` extension | 预留将来 Spec 对外发布时的过滤能力 |

#### Design Doc 要求

针对**新建服务**（voc-service、Agent 服务）的 API，实现前必须先提交 Design Doc PR：

1. **内容要求**：每个 API 端点的 HTTP 方法、路径、请求体 Schema、响应体 Schema、错误码、示例
2. **审查人**：至少包含后端负责人（王磊）、前端负责人（张晨曦）、AI 工程负责人（陈思琪，仅 AI 相关 API）
3. **存储位置**：`docs/designs/api/` 目录
4. **生命周期**：Design Doc 在空壳路由合并后转为归档状态，不再作为活文档维护——之后以代码自动生成的 Spec 为准

#### CI 集成清单

| Check | 类型 | 触发条件 | 失败行为 |
|-------|------|---------|---------|
| OpenAPI Spec 导出 | Required | 每次 PR | 导出失败 → 报红 |
| TypeScript 类型 freshness | Required | 前端代码变更 PR | 类型文件过时 → 报红 |
| Spec breaking change 检测 | Required | 后端代码变更 PR | 检测到 breaking change → 报红 |
| Spec admin 路由标记检查 | Warning | 后端代码变更 PR | 新 admin 路由缺少 `x-internal` → 警告 |

#### 已有服务（user-service、llm-service）契约处理

- 不需要补写 Design Doc
- 以当前 FastAPI 自动生成的 Spec 为基线
- CI 中同样进行 breaking change 检测

**投票结果**：6:0 全票通过。

| 成员 | 投票 | 理由 |
|------|------|------|
| 赵一凡 | 赞成 | Design Doc 保留了设计协作的价值，Code First 消除了双重维护负担 |
| 陈思琪 | 赞成 | AI 相关 API 的 Design Doc 审查流程保障了 AI 管线接口的严谨性 |
| 王磊 | 赞成 | Code First + 空壳路由是最务实的方案，维护成本最低 |
| 周安 | 赞成 | `x-internal` 标记预留了安全控制能力 |
| 张晨曦 | 赞成 | TypeScript 类型自动生成 + CI freshness check 完全满足前端需求 |
| 李维 | 赞成 | CLI 契约保障方案合理，API 集成测试已足够 |

---

## 议题组 B 综合决议

### 决议总览

| 子议题 | 核心决策 | 投票 |
|--------|---------|------|
| B1：错误处理模式 | 两层错误码（顶层 code + details.sub_code）+ 用户可读 message + 脱敏规则 | 6:0 |
| B2：LLM 测试策略 | 三层测试（CI Mock + CODEOWNER 回归 + 里程碑基准），CI 完全隔离 | 6:0 |
| B3：前后端契约管理 | Design Doc 协作 + Code First 生成 Spec + CI 自动类型生成和 breaking change 检测 | 6:0 |

### 跨子议题关联

1. **B1 → B2**：错误码枚举是 L1 快速测试的验证对象——每个错误码路径至少有一条测试用例
2. **B1 → B3**：错误码枚举必须出现在 OpenAPI Spec 中，TypeScript 类型生成需要覆盖错误类型
3. **B2 → B3**：API 集成测试产生的响应 fixtures 可作为前端 MSW Mock 的参考（非共享，仅参考）

### 待办事项

| 事项 | 负责人 | 时间节点 | 依赖 |
|------|--------|---------|------|
| 在 shared 包中实现统一错误响应基类 | 王磊 | Phase 2 完成前 | B1 决议 |
| 编写 voc-service API Design Doc | 王磊 + 张晨曦 + 陈思琪 | M3 启动前（W0+5） | B3 决议 |
| 搭建 CI Spec 导出 + diff 检查流程 | 周安 | Phase 2 完成前 | B3 决议 |
| 配置 openapi-typescript 生成管线 | 张晨曦 | Phase 2 完成前 | B3 决议 |
| 创建 Golden Dataset 初始版本 | 陈思琪 + 李维 | M3 前（W0+7） | B2 决议 |
| 准备真实格式 CSV/Excel 测试样本 | 李维 | M3 前（W0+7） | B2 决议 |
| 配置 CODEOWNERS 规则（prompts/ 目录） | 周安 | Phase 2 完成前 | B2 决议 |

### 保留条件

- **陈思琪保留条件**：若 Dogfooding 阶段（M6-M7）出现 Prompt 变更导致的质量退化事故，可重新提议将 L2 回归测试升级为 Prompt PR 的 required check，届时全员投票。
- **周安保留条件**：若将来仓库开源或 Spec 对外发布，须基于 `x-internal` 标记过滤内部 API，此为阻塞条件。

---

*本文档记录了 Prism 开发团队在议题组 B（API 与测试）上的聚焦辩论过程。所有决议基于 6 位成员的一致投票，反映了团队在 API 设计严谨性与工程务实性之间的平衡。决议内容将直接指导 Phase 2 完成后的实施工作。*
