# D1-A：架构与代码 -- 聚焦辩论记录

> 议题组 A 覆盖 monorepo 包结构、导入规则强制执行、LiteLLM 集成方式三个子议题。六位开发团队成员基于 D0 独立立场宣言展开结构化辩论，遵循钢人论证规则。

**日期**：开发启动 D1
**主持人**：赵一凡（技术负责人）
**记录员**：AI 辅助记录
**参与者**：赵一凡、陈思琪、王磊、周安、张晨曦、李维
**辩论规则**：钢人论证（反驳前必须复述对方观点） / 正方 -> 反方 -> 自由交锋 -> 决议

---

## 子议题 1：monorepo 包结构

**核心分歧**：每个服务内部的目录层级应该多深？AI 管线和爬虫/ETL 在 monorepo 中如何定位？

---

### 1.1 正方陈述：三层结构（赵一凡）

**赵一凡**：

在 D0 中我的立场已经很明确了，今天我要把它具体化。每个后端服务--无论是 llm-service、voc-service 还是 agent-service--必须遵循 `api/ -> service/ -> repository/` 三层结构。这不是学院派的洁癖，而是从多年维护大型 Python 项目得出的结论。

让我具体说明每一层的职责边界：

**`api/` 层**：只做请求解析和响应封装。FastAPI 路由函数在这里，Pydantic 的请求/响应 Schema 在这里，HTTP 状态码映射在这里。它不包含任何业务判断。一个 `api/` 层的函数体不应该超过 15 行--接收请求、调用 service、返回响应。

**`service/` 层**：包含全部业务逻辑。它接收类型安全的参数（不是 Request 对象），返回领域对象。它不知道 HTTP 的存在，不知道 FastAPI 的存在。如果将来要给 voc-service 加一个 gRPC 入口，只需要新写一个 `grpc/` 层调用同一个 `service/`，零业务代码重复。

**`repository/` 层**：负责数据访问。SQLAlchemy 查询写在这里，Redis 读写写在这里。它是唯一允许 `import sqlalchemy` 的层。这意味着如果未来某个表要从 PostgreSQL 迁到 DynamoDB，影响范围被严格限制在 `repository/` 层。

现在看具体目录结构，以 voc-service 为例：

```
voc-service/src/voc_service/
├── api/
│   ├── __init__.py
│   ├── router.py           # 汇总所有路由
│   ├── import_api.py       # POST /api/voc/import
│   ├── search_api.py       # POST /api/voc/search
│   ├── tag_api.py          # GET /api/voc/tags
│   └── schemas/            # Pydantic 请求/响应模型
│       ├── import_schemas.py
│       ├── search_schemas.py
│       └── tag_schemas.py
├── service/
│   ├── __init__.py
│   ├── import_service.py   # 导入业务逻辑
│   ├── search_service.py   # 搜索业务逻辑
│   └── tag_service.py      # 标签业务逻辑
├── repository/
│   ├── __init__.py
│   ├── voice_repo.py       # Voice 数据访问
│   ├── tag_repo.py         # EmergentTag 数据访问
│   └── unit_repo.py        # SemanticUnit 数据访问
├── models/                 # SQLAlchemy ORM 定义
│   ├── __init__.py
│   ├── voice.py
│   ├── semantic_unit.py
│   └── emergent_tag.py
└── migrations/             # Alembic
```

我这个方案的核心论据是**可测试性**。service 层可以 Mock repository 做纯逻辑测试；api 层可以 Mock service 做端点测试；repository 层可以用 TestContainers 做真实 DB 测试。三层分离让每一层的测试都干净利落。

---

### 1.2 反方陈述：两层结构（王磊）

**王磊**：

我先复述赵一凡的观点，确认我理解正确：你主张三层结构（api/service/repository），核心理由是每一层的职责边界清晰，可独立测试，未来更换数据存储或新增 API 入口时变更范围可控。对吧？

**赵一凡**：准确。

**王磊**：

好。我完全理解这个设计的理论优势，但我要从 Prism 的实际情况出发提出反对。

**第一，我们是 6 个人的团队，不是 60 个人。** 赵一凡你画的那个 voc-service 目录结构，光空文件就有 20 多个。voc-service 的 Phase 3 核心功能就五六个 API 端点，代码量预计在 2000-3000 行。在这个规模下，repository 层的每个方法大概长这样：

```python
class VoiceRepository:
    async def get_by_id(self, session: AsyncSession, voice_id: UUID) -> Voice | None:
        return await session.get(Voice, voice_id)

    async def create(self, session: AsyncSession, voice: Voice) -> Voice:
        session.add(voice)
        await session.flush()
        return voice
```

这就是 SQLAlchemy session 的透传。它没有隐藏任何复杂度，只是增加了一层间接调用。SQLAlchemy 2.0 的 async session 本身就已经是数据访问的抽象了。

**第二，"未来可能换数据库"是一个伪论据。** Prism 选择了 PostgreSQL + pgvector，数据模型里有 `vector(1024)` 类型、有 JSONB、有 PostgreSQL 特有的 Schema 隔离。我们深度绑定了 PostgreSQL 的特性。说"未来某个表可能迁到 DynamoDB"是不现实的假设。

**第三，来看我的方案：**

```
voc-service/src/voc_service/
├── api/
│   ├── __init__.py
│   ├── router.py
│   ├── import_api.py
│   ├── search_api.py
│   ├── tag_api.py
│   └── deps.py             # FastAPI 依赖注入
├── core/
│   ├── __init__.py
│   ├── import_logic.py     # 导入：业务逻辑 + 数据访问
│   ├── search_logic.py     # 搜索：业务逻辑 + 向量查询
│   ├── tag_logic.py        # 标签：业务逻辑 + 数据访问
│   └── schemas.py          # 内部数据结构（非 API Schema）
├── models/
│   ├── __init__.py
│   ├── voice.py
│   ├── semantic_unit.py
│   └── emergent_tag.py
└── migrations/
```

`api/` 层的职责和赵一凡方案一致--只做请求解析和响应封装。`core/` 层合并了 service + repository，业务逻辑和数据访问放在同一个模块里。

好处是什么？

1. **文件数量减少 40%**，导航成本显著降低。
2. **开发一个功能不需要同时改三个文件**。在三层结构下，新增一个"按标签过滤搜索结果"的功能，你需要改 `search_api.py`、`search_service.py`、`tag_repo.py` 三个文件。在两层结构下，你改 `search_api.py` 和 `search_logic.py` 两个文件。
3. **当代码量增长到需要分层时再分**。如果 `import_logic.py` 膨胀到 500 行以上，那时候把它拆成 `import_service.py` + `import_repo.py` 是一件水到渠成的事。反过来，提前分层再合并，成本更高。

---

### 1.3 补充陈述：AI 管线独立（陈思琪）

**陈思琪**：

我先复述两位的分歧：赵一凡主张三层结构保证职责清晰和可测试性，王磊主张两层结构在当前团队规模下更务实。我理解双方都认同 `api/` 层应该独立。

我要加入第三个维度的讨论。无论最终选两层还是三层，voc-service 中的 AI 管线需要一个独立的 `pipeline/` 目录。原因如下：

AI 管线是一个 DAG（有向无环图），不是请求-响应模式。看我们的三阶段设计：

```
Voice → [Stage 1: 语义拆解] → SemanticUnit[]
                                    ↓
                            [Stage 2: 标签涌现 + 标准化] → EmergentTag[]
                                    ↓
                            [Stage 3: 向量化] → embedding vectors
```

每个 Stage 有自己的：
- **输入/输出 Schema**（Stage 1 的输入是 Voice，输出是 SemanticUnit[]）
- **LLM 调用逻辑**（Stage 1 和 2 调用 reasoning 槽位，Stage 3 调用 embedding 槽位）
- **Prompt 模板**（Stage 1 用 `semantic_split.jinja2`，Stage 2 用 `tag_emergence.jinja2`）
- **守卫层配置**（L1 JSON Schema 校验 + L2 语义一致性检查）
- **重试与降级策略**（单条失败不阻塞批量）

如果把这些塞进 `service/import_service.py` 或 `core/import_logic.py`，这个文件会迅速膨胀到 1000 行以上，而且职责混杂：一半是"导入编排逻辑"（解析文件、去重、创建 IngestionBatch），一半是"AI 处理逻辑"（LLM 调用、Prompt 渲染、输出解析）。

我的提议是在 voc-service 内部增加 `pipeline/` 目录：

```
voc-service/src/voc_service/
├── api/
├── core/ 或 service/       # 看最终选哪个方案
├── pipeline/                # AI 管线（独立于 Web 请求处理）
│   ├── __init__.py
│   ├── orchestrator.py      # 管线编排器（Stage 1 → 2 → 3）
│   ├── stage1_split.py      # 语义拆解
│   ├── stage2_tag.py        # 标签涌现 + 标准化
│   ├── stage3_embed.py      # 向量化
│   └── guards.py            # L1/L2 守卫层
├── prompts/                 # Prompt 模板
│   ├── semantic_split_v1.jinja2
│   ├── tag_emergence_v1.jinja2
│   └── schema_mapping_v1.jinja2
├── models/
└── migrations/
```

`pipeline/` 和 `core/`/`service/` 的关系是：`core/import_logic.py` 处理文件解析、去重、创建 IngestionBatch，然后**调用** `pipeline/orchestrator.py` 执行 AI 管线。`pipeline/` 不知道 HTTP 请求的存在，也不直接操作数据库--它只接收数据、调用 LLM、返回结构化结果，数据持久化由调用方负责。

这样划分的好处是：AI 管线可以独立于 Web 框架做单元测试，Prompt 变更的影响范围被限制在 `pipeline/` + `prompts/` 目录内。

---

### 1.4 补充陈述：爬虫/ETL 独立（李维）

**李维**：

我支持陈思琪把 AI 管线独立出来的思路，同时我要为爬虫和 ETL 争取类似的独立性。

D0 中我已经说过，爬虫不是 Web 请求处理。它的运行模式、错误恢复机制、依赖项都与 voc-service 完全不同：

1. **运行环境不同**：voc-service 是 FastAPI 常驻进程，爬虫是 CLI 触发的短生命周期脚本。爬虫可能需要 Playwright 做浏览器渲染（微博反爬），而 voc-service 不需要。
2. **依赖项不同**：爬虫需要 `httpx`、`beautifulsoup4`、可能还需要 `playwright`。这些依赖不应该污染 voc-service 的依赖树。
3. **开发节奏不同**：爬虫在 Wave 2（M8）才交付，voc-service 的核心功能在 Wave 1（M3-M5）就要就绪。

我的提议是爬虫作为 monorepo 内的独立 Python 包：

```
prism-micro/
├── shared/
├── llm-service/
├── voc-service/
├── apps/
│   ├── web/
│   └── cli/
└── tools/
    └── crawlers/            # 爬虫独立包
        ├── pyproject.toml   # 独立依赖声明
        └── src/
            └── prism_crawlers/
                ├── __init__.py
                ├── base.py          # 爬虫基类
                ├── dongchedi.py     # 懂车帝爬虫
                ├── weibo.py         # 微博爬虫
                └── output.py        # 标准化 JSONL 输出
```

爬虫输出标准化 JSONL 文件，然后通过两种方式进入系统：
1. CLI 调用 `prism crawl dongchedi` → 爬虫输出 JSONL → CLI 调用 `POST /api/voc/import` 导入
2. 后续自动化时，通过内部任务队列触发

这样爬虫与 voc-service 完全解耦，依赖独立管理，开发和测试互不干扰。

---

### 1.5 自由交锋

**赵一凡**：

王磊，我承认你说的"提前分层增加模板代码"是合理的顾虑。但我想反问一个问题：你的 `core/import_logic.py` 现在合并了业务逻辑和数据访问，当我们要为导入逻辑写单元测试时，你怎么处理数据库依赖？

**王磊**：

用 `pytest-asyncio` + `AsyncSession` 的 fixture。测试时注入一个绑定到 TestContainers PostgreSQL 的 session。这不算 Mock，是真实数据库测试，但速度可接受--TestContainers 启动一次，整个测试 session 复用。

**赵一凡**：

那如果我只想测"导入逻辑是否正确调用了 AI 管线"这一个点呢？在你的方案里，我必须启动真实数据库才能运行这个测试，因为业务逻辑和数据访问混在一起。在三层方案里，我 Mock 掉 repository 层，纯内存测试，毫秒级完成。

**王磊**：

这一点我接受。不过我觉得陈思琪的 `pipeline/` 方案实际上已经解决了这个问题。AI 管线独立在 `pipeline/` 中，它不依赖数据库，可以纯内存测试。`core/import_logic.py` 负责编排（解析文件 → 去重查询 → 调用 pipeline → 持久化结果），这部分本来就需要数据库参与，用真实数据库测也合理。

**陈思琪**：

我同意王磊的分析。实际上 `pipeline/` 的存在已经把最需要隔离测试的部分（AI 管线逻辑）分出来了。剩下的 CRUD 操作，用真实数据库测试反而更有价值--你 Mock 一个 `session.execute()` 能测出什么？

**赵一凡**：

那 llm-service 呢？llm-service 没有 AI 管线，它的 `core/` 层是纯粹的路由逻辑 + 数据访问。你们觉得 llm-service 也不需要 repository 层？

**王磊**：

llm-service 我也主张两层。看 R5-B 的决议，我们用 LiteLLM 替代自建 Provider 适配器，4 槽位模型也简化了数据模型。llm-service 的数据操作就是对 `llm.providers`、`llm.model_slots` 两张表的 CRUD。这个量级的数据访问不需要独立 repository。

**周安**：

我插一句。无论选两层还是三层，我对 `api/` 层的独立性有一个强制要求：**所有输入验证必须在 `api/` 层完成**。这包括 Pydantic 模型校验、请求参数范围检查、权限检查。`api/` 层是安全边界，业务逻辑层收到的数据必须是已验证的。

如果选两层方案，`core/` 层不应该做任何"这个参数是否合法"的判断--那是 `api/` 层的活。

**王磊**：

完全同意。这一点两层和三层方案是一致的。

**张晨曦**：

我从前端角度补充一点。前端项目 `apps/web/` 的组织方式我在 D0 中已经说了--按功能域组织（`src/features/{import,search,tags,admin}/`），这与后端选两层还是三层无关。但我有一个要求：**后端的 Pydantic Schema（`api/schemas/`）必须与 OpenAPI 自动生成保持一致**。我需要用 `openapi-typescript-codegen` 从后端的 OpenAPI JSON 自动生成 TypeScript 类型。如果后端的 API Schema 散落在各处，OpenAPI 文档质量会下降。

**赵一凡**：

这一点无论两层还是三层都能保证。FastAPI 的 OpenAPI 生成基于路由函数的类型注解，只要 `api/` 层的 Pydantic 模型定义规范，OpenAPI 文档自然是准确的。

**李维**：

回到爬虫的话题。我提议的 `tools/crawlers/` 作为独立包，大家有异议吗？

**赵一凡**：

我支持爬虫独立。PRD R5-A 决议也明确说了"懂车帝 + 微博爬虫作为独立 Python 脚本"。但我建议路径用 `tools/crawlers/` 而不是 `apps/crawlers/`，因为它不是面向用户的应用，是内部工具。

**王磊**：

同意。而且爬虫包不应该加入 uv workspace 的 members 吗？如果它需要引用 shared 的某些工具函数的话。

**赵一凡**：

不，爬虫不应该 import shared。爬虫是独立脚本，输出标准化 JSONL，通过 HTTP API 或文件导入的方式与系统交互。如果爬虫直接 import shared，就违反了依赖方向的原则--tools 不应该依赖 shared 的内部实现。

**李维**：

那如果爬虫需要一些通用的工具函数，比如 HTTP 重试、日志格式化呢？

**赵一凡**：

爬虫可以有自己的 utils。通用性够高的话，未来可以提取到一个独立的 `prism-utils` 包。但 Phase 1 不需要这个抽象层。

**陈思琪**：

我有一个边界问题要澄清。数据导入管线（CSV/Excel 解析 → LLM Schema 映射 → 去重 → 入库）和 AI 管线（Stage 1-3）在代码上怎么划分？我的 `pipeline/` 目录只包含 AI 管线（Stage 1-3），不包含数据导入的前置步骤。数据导入的解析和映射逻辑应该放在 `core/`/`service/` 层。

**李维**：

对，数据导入的解析器（CSV parser、Excel parser、编码检测）应该在 voc-service 的 `core/` 里，而不是在 `pipeline/` 里。`pipeline/` 只管"拿到结构化的 Voice 之后怎么做 AI 处理"。

**王磊**：

这其实进一步支持了我的两层方案。看 voc-service 的完整图景：

```
voc-service/src/voc_service/
├── api/                    # HTTP 入口
├── core/                   # 业务逻辑 + 数据访问
│   ├── import_logic.py     # 文件解析、LLM 映射、去重、入库
│   ├── search_logic.py     # 向量搜索、结果排序
│   ├── tag_logic.py        # 标签管理、反馈
│   └── parsers/            # CSV/Excel 解析器
│       ├── csv_parser.py
│       └── excel_parser.py
├── pipeline/               # AI 管线（陈思琪的方案）
├── prompts/                # Prompt 模板
├── models/                 # ORM
└── migrations/
```

`core/` + `pipeline/` 合起来就已经有清晰的职责划分了。再从 `core/` 中拆出 `repository/`，是在给一个已经够清晰的结构加不必要的复杂度。

---

### 1.6 决议

**赵一凡**（总结）：

经过讨论，我看到以下共识和分歧。

#### 共识点

1. **`api/` 层独立，作为安全边界**（全员一致）：所有输入验证、权限检查、请求清洗在 `api/` 层完成。`api/` 层函数体保持精简（<15 行），只做请求解析、调用业务逻辑、响应封装。

2. **AI 管线独立为 `pipeline/` 目录**（全员一致）：voc-service 中的 Stage 1-3 处理逻辑放在 `pipeline/` 目录下，与 Web 请求处理逻辑分离。`pipeline/` 不依赖 FastAPI 和数据库，只接收数据、调用 LLM、返回结构化结果。

3. **Prompt 模板独立为 `prompts/` 目录**（全员一致）：Prompt 模板集中管理，支持版本号命名（如 `semantic_split_v1.jinja2`），变更影响范围可追踪。

4. **爬虫作为独立包 `tools/crawlers/`**（全员一致）：爬虫有独立的 `pyproject.toml`，独立的依赖声明，不 import shared 或任何服务内部模块。输出标准化 JSONL，通过 API 导入。

5. **前端按功能域组织**（张晨曦主导，无异议）：`src/features/{import,search,tags,admin}/`，不按技术层分目录。

#### 残余分歧

**两层（`api/` + `core/`）vs 三层（`api/` + `service/` + `repository/`）**

| 维度 | 两层方案（王磊） | 三层方案（赵一凡） |
|------|---------------|----------------|
| 文件数量 | 少 ~40% | 多，模板代码多 |
| 业务逻辑单元测试 | 需真实 DB 或重构后 Mock | 可 Mock repository 层 |
| 新增功能改动文件数 | 2 个文件 | 3 个文件 |
| 未来重构成本 | 膨胀后拆分：中等 | 初期就位：无 |

#### 最终决定

**采用两层结构（`api/` + `core/`），但附带以下约束条件**：

1. **`core/` 模块行数上限 400 行**：任何 `core/` 模块超过 400 行必须拆分。拆分方式优先考虑按功能子模块拆（如 `core/import/` 目录），而非一律拆出 `repository/`。
2. **llm-service 同样适用两层结构**：鉴于 LiteLLM 替代了自建适配器，llm-service 的数据操作量级不需要独立 repository。
3. **Phase 3 M5 验收时评估是否需要升级为三层**：如果 voc-service 的 `core/` 层出现明确的职责混杂（业务逻辑和数据访问难以分离测试），赵一凡有权要求重构为三层。
4. **`pipeline/` 和 `prompts/` 是 voc-service 的标准目录**，不可省略。

**赵一凡**：我保留一个"技术负责人复查权"--如果在代码审查中发现 `core/` 层的某个模块业务逻辑和数据访问纠缠不清导致测试困难，我可以要求该模块单独拆出 repository 层。

**王磊**：接受。这比一开始就强制三层合理。

#### 行动项

| # | 行动 | 负责人 | 截止时间 |
|---|------|--------|---------|
| A1-1 | 撰写各服务目录结构模板文档（含 `api/`、`core/`、`pipeline/`、`prompts/`、`models/`、`migrations/` 的职责说明） | 赵一凡 | 设计阶段 |
| A1-2 | 创建 `tools/crawlers/` 包的骨架（`pyproject.toml` + 基类 + JSONL 输出格式定义） | 李维 | M8 启动前 |
| A1-3 | 定义 Prompt 模板命名规范和版本管理策略 | 陈思琪 | M3 前 |
| A1-4 | 将 `tools/crawlers/` 加入 monorepo 根 `pyproject.toml` 的 workspace members（作为独立成员，不依赖 shared） | 赵一凡 | 项目初始化时 |

---

## 子议题 2：导入规则强制执行

**核心分歧**：依赖方向的检查应该自动化工具强制执行，还是通过 PR 审查人工约定？

---

### 2.1 正方陈述：自动化强制执行（赵一凡）

**赵一凡**：

依赖方向不可逆是 Prism 的 Type 1 决策，在 PRD R1 辩论中已经确立。具体来说：

```
禁止方向：
- llm-service ✗→ voc-service
- voc-service ✗→ llm-service（只能通过 HTTP API 调用）
- 任何服务 ✗→ apps/web 或 apps/cli
- shared ✗→ 任何服务

允许方向：
- 服务 → shared（import 依赖）
- 服务 → 服务（仅通过 HTTP API，不允许 import）
- apps → 服务（仅通过 HTTP API）

服务内部：
- api/ → core/（允许）
- core/ → api/（禁止）
- pipeline/ → core/（禁止，pipeline 不依赖 core）
- core/ → pipeline/（允许，core 编排 pipeline）
```

我主张用 `import-linter` 做自动化检查，在 CI 流水线中强制执行。`import-linter` 的配置长这样：

```ini
[importlinter]
root_packages =
    llm_service
    voc_service
    prism_shared

[importlinter:contract:1]
name = services-cannot-import-each-other
type = forbidden
source_modules =
    llm_service
forbidden_modules =
    voc_service

[importlinter:contract:2]
name = shared-cannot-import-services
type = forbidden
source_modules =
    prism_shared
forbidden_modules =
    llm_service
    voc_service

[importlinter:contract:3]
name = api-does-not-import-from-service-internals
type = layers
layers =
    llm_service.api
    llm_service.core
containers =
    llm_service
```

CI 里就一行命令：`lint-imports`。任何违反依赖规则的 import 会让 CI 直接报红。

为什么不能靠 PR 审查？

1. **人会疏忽**。一个 300 行的 PR 里混了一行 `from voc_service.core.tag_logic import get_tags`，审查者不一定能看到。
2. **累积效应**。第一个违规 import 可能是"先这样用一下"，第二个人看到先例就会复制。半年后你发现 llm-service 和 voc-service 之间有 20 处交叉依赖，重构成本已经不可接受。
3. **自动化的成本极低**。`import-linter` 的配置文件写一次就好，运行速度快（秒级），维护成本几乎为零。

---

### 2.2 反方陈述：PR 审查足够（王磊）

**王磊**：

我先复述赵一凡的观点：依赖规则是 Type 1 决策，必须强制执行；人工审查存在疏忽和累积效应的风险；`import-linter` 的实施成本低。

我理解你的担忧，但我认为在当前阶段，PR 审查比自动化工具更合适。理由如下：

**第一，6 个人的团队，代码都是互相能看见的。** 我们不是一个 100 人的团队，各写各的不知道别人在干什么。每个 PR 至少有 1 个 reviewer，涉及服务边界的 PR 需要 2 个 reviewer（周安的要求）。在这个审查密度下，一行跨服务 import 不太可能漏过去。

**第二，`import-linter` 的规则维护不是零成本。** 你列的配置看起来简单，但当我们新增 voc-service、agent-service 后，每新增一个服务都要更新配置。服务内部的分层规则（api/ → core/）更是每个服务都要写一遍。而且 `import-linter` 需要加入 CI 依赖，增加了 CI 运行时间。

**第三，灵活性。** 有些情况下"合理的违规"是存在的。比如测试文件中，你可能需要 `from llm_service.core.router import SlotRouter` 来做集成测试。`import-linter` 需要配置排除规则，而 PR 审查中我们可以直接讨论"这个 import 合理还是不合理"。

---

### 2.3 自由交锋

**周安**：

我先复述王磊的观点：小团队 PR 审查密度足够，工具维护有成本，灵活性更好。

王磊，我必须直接反对你。**安全边界不能靠人工保障。**

这不仅是代码组织问题，更是安全问题。如果 voc-service 错误地 import 了 llm-service 的内部模块，它可能绕过 llm-service 的 API 认证直接访问 Provider 配置。这种错误在 PR 审查中可能被忽略，但 `import-linter` 不会。

我举一个真实场景：假设有人在 voc-service 中写了 `from llm_service.models.provider import Provider`，只是为了在一个日志里打印 Provider 名称。reviewer 可能觉得"就读个名字，没事"，放过了。但这建立了一个模块级依赖，意味着 llm-service 的 ORM 模型变更可能导致 voc-service 运行时崩溃。

自动化工具的价值不在于"抓住坏人"，而在于**消除讨论的必要性**。CI 红了，就是不行，没有"这次例外"。

**王磊**：

周安说的安全场景我接受。但我对 `import-linter` 的配置维护成本还是有顾虑。能不能用更轻量的方式？比如一个简单的 shell 脚本检查 `grep -r "from llm_service" voc-service/`？

**赵一凡**：

`grep` 方案的问题是它不理解 Python 的模块系统。`import llm_service` 会被抓到，但 `from prism_shared.db import session` 不会被误报。`import-linter` 理解 Python 的导入语义，比文本匹配精确得多。

而且维护成本我来承担。我是平台组 Lead，CI 流水线配置本来就是我和周安的职责。

**张晨曦**：

前端这边我想补充一点。我们用 ESLint 的 `no-restricted-imports` 规则也能做类似的事--禁止前端代码直接 import 后端类型（必须通过 OpenAPI 生成的类型使用）。前后端一致使用自动化规则，形成统一的工程纪律。

**陈思琪**：

我支持自动化。Prompt 模板的导入规则也需要约束--`pipeline/` 目录可以 import `prompts/` 目录下的模板，但 `api/` 层不应该直接访问 Prompt 模板。

**李维**：

爬虫包（`tools/crawlers/`）不 import 任何服务模块，这一点在子议题 1 已经确认。如果用 `import-linter`，需要把 `prism_crawlers` 也加入检查范围，禁止它 import `prism_shared`、`llm_service`、`voc_service`。

**王磊**：

好吧，我被说服了。六个人的团队确实也需要自动化规则，尤其是周安说的安全边界论据。但我有一个条件：**`import-linter` 的配置由赵一凡和周安维护，其他人不需要管这个文件。** 如果有人的 PR 被 `import-linter` 拦住了，他只需要修改自己的代码，不需要去改 linter 配置。

**赵一凡**：

完全同意。

---

### 2.4 决议

#### 共识点

1. **使用 `import-linter` 自动检查导入规则**（5:1 通过，王磊有条件同意）：在 CI 流水线中集成 `import-linter`，任何违反依赖方向的 import 导致 CI 失败。
2. **规则覆盖范围**：
   - 服务间禁止交叉 import（llm-service, voc-service, agent-service 互不可见）
   - shared 不可 import 任何服务
   - 服务内部 `api/` → `core/` 单向依赖
   - `pipeline/` 不依赖 `core/`（`core/` 可以调用 `pipeline/`）
   - `tools/crawlers/` 不 import shared 或任何服务
3. **配置维护责任**：赵一凡 + 周安负责维护 `import-linter` 配置。其他成员如需新增合法 import 路径，提 PR 给赵一凡审批。
4. **测试文件排除**：`tests/` 目录中的集成测试文件可以豁免部分规则（如跨层 import），但跨服务 import 仍然禁止。

#### 残余分歧

无。王磊的条件（配置维护由赵一凡/周安负责）已被接受。

#### 行动项

| # | 行动 | 负责人 | 截止时间 |
|---|------|--------|---------|
| A2-1 | 编写 `import-linter` 配置文件（`.importlinter`），覆盖所有服务间和服务内部规则 | 赵一凡 | 项目初始化时 |
| A2-2 | 在 CI 流水线中集成 `lint-imports` 命令 | 周安 | CI 搭建时 |
| A2-3 | 编写前端 ESLint `no-restricted-imports` 规则，禁止直接 import 后端类型 | 张晨曦 | 前端项目初始化时 |
| A2-4 | 撰写"依赖规则速查卡"（一页纸，列出所有允许和禁止的 import 方向），放入 `CONTRIBUTING.md` | 赵一凡 | 项目初始化时 |

---

## 子议题 3：LiteLLM 集成方式

**核心分歧**：LiteLLM 应该直接作为 llm-service 的核心调用层，还是通过 SlotRouter 封装隔离？Embedding 和 Rerank 场景是否需要特殊处理？

---

### 3.1 正方陈述：LiteLLM 直接集成（王磊）

**王磊**：

PRD R5-B 决议已经确认用 LiteLLM 替代自建 Provider 适配器。我主张把 LiteLLM 深度集成到 llm-service 中，直接替代原来的 `providers/` 目录。

先看现有的架构设计文档（`llm-service-design.md`）里的 Provider 适配器：

```python
class BaseLLMProvider(ABC):
    async def chat(self, model_id: str, messages: list, **kwargs) -> ChatResponse: ...
    async def embedding(self, model_id: str, input: list[str], **kwargs) -> EmbeddingResponse: ...
    async def rerank(self, model_id: str, query: str, documents: list[str], **kwargs) -> RerankResponse: ...
    async def test_connection(self) -> bool: ...
```

然后我们为每个 Provider（siliconflow、openrouter、kimi、minimax）各写了一个实现类。但设计文档自己也承认了：**这四家均兼容 OpenAI API 格式**，差异仅在 Base URL、额外 headers、支持的能力不同。

LiteLLM 已经处理了这些差异。它支持 100+ Provider，OpenAI 兼容格式是它的核心能力。我们的自建适配器实际上是在重复 LiteLLM 已经做好的工作。

我的方案是完全删除 `providers/` 目录，用 LiteLLM 的 `completion()`、`embedding()` 函数直接替代：

```python
# core/llm_client.py
import litellm

async def call_chat(provider_slug: str, model_id: str, messages: list, **kwargs):
    # LiteLLM 格式：provider/model_id
    model_string = f"{provider_slug}/{model_id}"
    response = await litellm.acompletion(model=model_string, messages=messages, **kwargs)
    return response

async def call_embedding(provider_slug: str, model_id: str, input_texts: list[str]):
    model_string = f"{provider_slug}/{model_id}"
    response = await litellm.aembedding(model=model_string, input=input_texts)
    return response
```

简洁。直接。不需要维护四个 Provider 类，不需要 Base/Abstract 模式。LiteLLM 的版本升级会自动带来新 Provider 支持和 bug 修复。

---

### 3.2 反方陈述：SlotRouter 封装隔离（赵一凡）

**赵一凡**：

我先复述王磊的观点：LiteLLM 已经处理了 Provider 差异，自建适配器是重复劳动，直接使用 LiteLLM 的函数更简洁高效。

我完全同意**不需要自建 Provider 适配器**。但我反对在 llm-service 的各处直接调用 `litellm.acompletion()`。我主张通过 `SlotRouter` 封装 LiteLLM 调用，理由如下：

**第一，隔离第三方依赖。** LiteLLM 是一个活跃的开源项目，API 经常变更。如果我们在 10 个文件里直接调用 `litellm.acompletion()`，LiteLLM 的一次破坏性更新（比如参数名变更、返回值结构调整）会导致 10 个文件需要修改。如果所有 LiteLLM 调用通过 `SlotRouter` 封装，影响范围被限制在一个文件。

**第二，`SlotRouter` 承载业务逻辑。** 4 槽位模型不只是简单地调用 LLM，还包含：

1. **槽位解析**：根据 `slot_type`（fast/reasoning/embedding/rerank）从数据库读取配置
2. **故障转移**：主模型失败后按 `fallback_chain` 顺序尝试降级模型
3. **健康检查集成**：跳过已知不健康的 Provider
4. **结构化日志**：记录调用的实际 Provider/Model、是否降级、耗时
5. **参数合并**：将槽位级默认参数与调用时的覆盖参数合并

这些逻辑放在哪里？如果不封装 SlotRouter，这些逻辑会散落在 `api/` 层的每个端点里，或者在 `core/` 层形成一堆独立函数但没有内聚的抽象。

我的方案：

```python
# core/slot_router.py
class SlotRouter:
    """4 槽位模型路由器，封装 LiteLLM 调用 + 故障转移 + 健康检查"""

    def __init__(self, session: AsyncSession, health_checker: HealthChecker):
        self._session = session
        self._health = health_checker

    async def chat(self, slot_type: SlotType, messages: list, **overrides) -> ChatResult:
        """通过槽位调用 Chat 能力，自动故障转移"""
        slot_config = await self._get_slot_config(slot_type)
        candidates = self._build_candidate_chain(slot_config)
        return await self._try_with_fallback(candidates, "chat", messages=messages, **overrides)

    async def embed(self, texts: list[str]) -> EmbedResult:
        """通过 embedding 槽位生成向量"""
        return await self.chat(SlotType.EMBEDDING, ...)  # 简化示意

    async def rerank(self, query: str, documents: list[str]) -> RerankResult:
        """通过 rerank 槽位重排序"""
        ...

    async def _try_with_fallback(self, candidates, operation, **kwargs):
        """核心故障转移逻辑"""
        for candidate in candidates:
            if not await self._health.is_healthy(candidate.provider_id):
                continue
            try:
                result = await self._call_litellm(candidate, operation, **kwargs)
                return result
            except LLMProviderError as e:
                await self._health.mark_unhealthy(candidate.provider_id)
                continue
        raise AllProvidersUnavailableError(...)

    async def _call_litellm(self, candidate, operation, **kwargs):
        """唯一调用 LiteLLM 的地方"""
        model_string = f"{candidate.provider_slug}/{candidate.model_id}"
        if operation == "chat":
            return await litellm.acompletion(model=model_string, **kwargs)
        elif operation == "embedding":
            return await litellm.aembedding(model=model_string, **kwargs)
        ...
```

关键点：**`_call_litellm()` 是整个 llm-service 中唯一调用 LiteLLM 的方法**。所有 LiteLLM 的 API 变更只影响这一个方法。SlotRouter 对外暴露的是 `chat()`、`embed()`、`rerank()` 三个业务方法，它们的签名稳定，不受 LiteLLM 变更影响。

---

### 3.3 补充陈述：Embedding/Rerank 特殊性（陈思琪）

**陈思琪**：

我先复述双方的核心分歧：王磊主张直接使用 LiteLLM 函数调用最简洁，赵一凡主张通过 SlotRouter 封装隔离 LiteLLM 并承载故障转移等业务逻辑。

我支持赵一凡的 SlotRouter 方案，但我要补充一个重要的技术细节：**Embedding 和 Rerank 的调用模式与 Chat 有本质差异**，这进一步证明了封装的必要性。

**差异一：批量 vs 单条。** Chat 是单条请求-单条响应。Embedding 是批量请求--Stage 3 向量化时，我们可能一次发送 50-100 条文本。LiteLLM 的 `aembedding()` 支持批量输入，但不同 Provider 的批量上限不同（siliconflow 可能限制 100 条，其他 Provider 可能限制 20 条）。SlotRouter 需要处理**批量分片**逻辑。

**差异二：模型锁定。** Chat 槽位的主模型和降级模型可以是不同架构的模型（比如主模型是 Qwen2.5-72B，降级模型是 Moonshot-v1-8k），因为 Chat 的输出格式是通用的。但 Embedding 槽位**绝对不能这样做**。如果主模型是 BGE-large-zh-v1.5（1024 维），降级模型的维度必须也是 1024 维，否则向量无法混合检索。这意味着 Embedding 槽位的降级链配置需要额外约束。

**差异三：Rerank 的 Provider 支持度。** LiteLLM 对 Rerank 的支持不如 Chat 和 Embedding 成熟。部分 Provider 的 Rerank API 不是 OpenAI 兼容格式，LiteLLM 可能需要额外配置或 fallback 到自定义实现。SlotRouter 可以在 `_call_litellm()` 中为 Rerank 做特殊处理。

综上，我建议 SlotRouter 对三种能力分别实现不同的策略：

```python
class SlotRouter:
    async def chat(self, slot_type: SlotType, messages: list, **overrides) -> ChatResult:
        """Chat/Fast 槽位：标准故障转移"""
        ...

    async def embed(self, texts: list[str], batch_size: int = 50) -> list[list[float]]:
        """Embedding 槽位：批量分片 + 维度一致性校验"""
        slot_config = await self._get_slot_config(SlotType.EMBEDDING)
        # 注意：embedding 降级链需要维度一致性校验
        chunks = self._chunk_texts(texts, batch_size)
        results = []
        for chunk in chunks:
            result = await self._try_with_fallback(
                self._build_candidate_chain(slot_config),
                "embedding",
                input=chunk
            )
            results.extend(result.embeddings)
        return results

    async def rerank(self, query: str, documents: list[str], top_n: int = 10) -> RerankResult:
        """Rerank 槽位：Provider 兼容性处理"""
        ...
```

---

### 3.4 自由交锋

**王磊**：

我先复述赵一凡和陈思琪的论据：

赵一凡认为 SlotRouter 封装有两个价值--隔离 LiteLLM 依赖变更风险、承载故障转移等业务逻辑。陈思琪补充了 Embedding 的批量分片、维度一致性校验和 Rerank 的 Provider 兼容性问题。

我承认这些都是合理的关注点。我的原始方案确实没有考虑故障转移逻辑放在哪里的问题。但我想提出一个修正方案：**我接受 SlotRouter 作为封装层，但反对它成为"唯一调用 LiteLLM 的地方"这个硬约束。**

原因是：除了 4 槽位路由之外，还有一些场景需要直接调用 LiteLLM。比如 `POST /api/llm/admin/slots/{slot_type}/test` 连通性测试接口--它需要用指定的 Provider + Model 做一次测试调用，不经过 SlotRouter 的故障转移逻辑。

**赵一凡**：

连通性测试也可以通过 SlotRouter 暴露一个 `test_connection()` 方法实现。它跳过故障转移，只测试指定的 Provider + Model。这样 LiteLLM 调用仍然集中在一个类里。

```python
class SlotRouter:
    async def test_connection(self, provider_slug: str, model_id: str) -> TestResult:
        """直接测试指定 Provider + Model 的连通性，不经过故障转移"""
        try:
            await self._call_litellm_direct(provider_slug, model_id, operation="chat", messages=[{"role": "user", "content": "ping"}])
            return TestResult(success=True)
        except Exception as e:
            return TestResult(success=False, error=str(e))
```

**王磊**：

行，这样可以。但我还有一个实用性的问题：SlotRouter 是一个有状态的对象（持有 session 和 health_checker），在 FastAPI 的依赖注入体系里怎么管理它的生命周期？

**赵一凡**：

好问题。SlotRouter 是请求级别的--每个请求通过 FastAPI 的 `Depends` 获取一个 SlotRouter 实例：

```python
async def get_slot_router(
    session: AsyncSession = Depends(get_session),
    health: HealthChecker = Depends(get_health_checker),
) -> SlotRouter:
    return SlotRouter(session, health)

@router.post("/api/llm/chat")
async def chat_endpoint(
    request: ChatRequest,
    router: SlotRouter = Depends(get_slot_router),
):
    result = await router.chat(request.slot or SlotType.REASONING, request.messages)
    return result
```

`HealthChecker` 是应用级别的单例（维护 Provider 健康状态缓存），`AsyncSession` 是请求级别的。这与 FastAPI 的依赖注入模式完全兼容。

**周安**：

我支持 SlotRouter 封装。从安全角度看，所有 LLM 调用通过一个入口点意味着**审计日志的统一注入**。我可以在 SlotRouter 的 `_call_litellm()` 方法中统一记录：谁调用了什么模型、用了哪个 Provider、是否降级、耗时多久、Token 消耗多少。如果 LiteLLM 调用散落在各处，审计日志的完整性就无法保证。

**王磊**：

这个论据我无法反驳。统一审计入口确实是 SlotRouter 的一个重要价值。

**陈思琪**：

还有一点。未来 Phase 4 如果 4 槽位模型需要升级为更灵活的路由方案（PRD 中提到的"Phase 4 检查点评估"），SlotRouter 的封装让这个升级变得容易--只需要修改 SlotRouter 的内部实现，外部调用方（voc-service 的 AI 管线、agent-service 的 Skill 执行）完全不受影响。

**张晨曦**：

从前端角度，SlotRouter 对我来说是透明的--我只关心 API 端点的请求/响应格式。但我有一个需求：**当 LLM 调用使用了降级模型时，API 响应中必须包含降级信息**。PRD 中陈思琪已经提过这个要求（`degraded: true` + `original_model` + `actual_model`）。SlotRouter 返回的结果对象需要包含这些元数据，然后 `api/` 层将其透传到 HTTP 响应中。

**赵一凡**：

同意。SlotRouter 的返回类型应该是一个包含元数据的结果对象：

```python
@dataclass
class LLMResult:
    content: str | list[list[float]]   # Chat 文本或 Embedding 向量
    provider_slug: str                  # 实际使用的 Provider
    model_id: str                       # 实际使用的模型
    degraded: bool                      # 是否使用了降级模型
    original_slot_config: dict          # 原始槽位配置（用于审计）
    latency_ms: int                     # 调用耗时
    token_usage: dict | None            # Token 消耗（Chat 有，Embedding 无）
```

**李维**：

我确认一下：CLI 中 `prism chat` 命令通过 HTTP 调用 `/api/llm/chat`，SlotRouter 的存在对 CLI 完全透明，对吧？

**赵一凡**：

完全透明。CLI 只需要知道 API 契约，不需要知道内部用了 LiteLLM 还是自建适配器。

**王磊**：

好，我接受 SlotRouter 方案。总结一下我现在的立场：

1. 删除自建 Provider 适配器（`providers/` 目录），用 LiteLLM 替代--这一点大家一致同意。
2. 通过 SlotRouter 封装所有 LiteLLM 调用--我原来反对，现在接受，理由是：故障转移逻辑需要一个载体、审计日志需要统一入口点、Embedding/Rerank 有特殊处理需求。
3. 但 SlotRouter 不应该过度设计--它就是一个类，不需要 Abstract 基类、不需要工厂模式、不需要策略模式。保持简洁。

**赵一凡**：

完全同意第 3 点。SlotRouter 是一个具体类，不需要抽象层。YAGNI。

---

### 3.5 决议

#### 共识点

1. **删除自建 Provider 适配器，全面采用 LiteLLM**（全员一致）：移除 `providers/` 目录及 `BaseLLMProvider` 抽象基类。所有 LLM 调用通过 LiteLLM 的 `acompletion()`、`aembedding()` 等异步方法。

2. **通过 `SlotRouter` 封装 LiteLLM 调用**（全员一致）：
   - `SlotRouter` 是 llm-service 中唯一调用 LiteLLM 的类
   - 承载槽位解析、故障转移、健康检查跳过、审计日志、参数合并等业务逻辑
   - 对外暴露 `chat()`、`embed()`、`rerank()`、`test_connection()` 四个方法
   - 通过 FastAPI `Depends` 注入，请求级别实例化

3. **Embedding 和 Rerank 的特殊处理**（陈思琪主导，全员同意）：
   - Embedding 槽位需要处理批量分片（batch_size 可配置）
   - Embedding 降级链需要维度一致性校验（降级模型的向量维度必须与主模型一致）
   - Rerank 需要处理 Provider 兼容性差异（部分 Provider 不支持或 API 格式不同）

4. **返回结果包含元数据**（张晨曦/陈思琪需求，全员同意）：
   - `LLMResult` 包含 `degraded`、`provider_slug`、`model_id`、`latency_ms`、`token_usage` 等元数据
   - `api/` 层将降级信息透传到 HTTP 响应的 `meta` 字段中

5. **审计日志统一注入**（周安主导，全员同意）：
   - SlotRouter 的每次 LLM 调用自动记录结构化日志
   - 日志包含：调用者身份（Principal）、槽位类型、实际 Provider/Model、是否降级、耗时、Token 消耗

6. **SlotRouter 保持简洁，不过度设计**（王磊条件，赵一凡同意）：
   - 具体类，不设抽象基类
   - 不引入工厂模式或策略模式
   - 当前只需要一个 `SlotRouter` 类，不需要 `ChatSlotRouter`/`EmbeddingSlotRouter` 的继承体系

#### 残余分歧

无。

#### 行动项

| # | 行动 | 负责人 | 截止时间 |
|---|------|--------|---------|
| A3-1 | 设计 `SlotRouter` 类的详细接口定义（方法签名、`LLMResult` 数据结构、异常类型），输出到 `docs/designs/llm-service/design.md` | 王磊 + 赵一凡 | LLM 服务设计阶段 |
| A3-2 | 调研 LiteLLM 对 Embedding 的批量支持情况（各 Provider 的 batch_size 上限），确认批量分片策略 | 王磊 | M1 前 |
| A3-3 | 调研 LiteLLM 对 Rerank 的支持现状（支持的 Provider 列表、API 兼容性），确认是否需要 fallback 到自定义实现 | 王磊 + 陈思琪 | M1 前 |
| A3-4 | 定义 Embedding 降级链的维度一致性校验规则（配置时校验 vs 运行时校验） | 陈思琪 | LLM 服务设计阶段 |
| A3-5 | 设计 SlotRouter 审计日志的结构化 Schema（JSON 格式、字段定义），与 `AgentExecutionLog` 对齐 | 周安 | M1 前 |
| A3-6 | 确认 LLM API 响应中降级信息的字段命名和格式（与前端约定） | 张晨曦 + 王磊 | API 契约冻结前 |

---

## 议题组 A 总结

### 决议汇总

| 子议题 | 核心决议 | 投票 |
|--------|---------|------|
| 1. monorepo 包结构 | 两层结构（`api/` + `core/`），附 400 行上限约束；AI 管线独立 `pipeline/`；爬虫独立 `tools/crawlers/` | 5:1（赵一凡有条件接受） |
| 2. 导入规则 | `import-linter` 自动检查，CI 强制执行 | 5:1（王磊有条件同意） |
| 3. LiteLLM 集成 | SlotRouter 封装 LiteLLM，承载故障转移/审计/批量分片 | 6:0 |

### 全部行动项

| # | 行动 | 负责人 | 截止时间 |
|---|------|--------|---------|
| A1-1 | 撰写各服务目录结构模板文档 | 赵一凡 | 设计阶段 |
| A1-2 | 创建 `tools/crawlers/` 包骨架 | 李维 | M8 启动前 |
| A1-3 | 定义 Prompt 模板命名规范和版本管理策略 | 陈思琪 | M3 前 |
| A1-4 | 将 `tools/crawlers/` 加入 workspace members | 赵一凡 | 项目初始化时 |
| A2-1 | 编写 `import-linter` 配置文件 | 赵一凡 | 项目初始化时 |
| A2-2 | CI 集成 `lint-imports` | 周安 | CI 搭建时 |
| A2-3 | 前端 ESLint `no-restricted-imports` 规则 | 张晨曦 | 前端初始化时 |
| A2-4 | 撰写依赖规则速查卡 | 赵一凡 | 项目初始化时 |
| A3-1 | SlotRouter 详细接口设计 | 王磊 + 赵一凡 | LLM 服务设计阶段 |
| A3-2 | LiteLLM Embedding 批量支持调研 | 王磊 | M1 前 |
| A3-3 | LiteLLM Rerank 支持现状调研 | 王磊 + 陈思琪 | M1 前 |
| A3-4 | Embedding 降级链维度一致性校验规则 | 陈思琪 | LLM 服务设计阶段 |
| A3-5 | SlotRouter 审计日志 Schema 设计 | 周安 | M1 前 |
| A3-6 | API 降级信息字段命名约定 | 张晨曦 + 王磊 | API 契约冻结前 |

---

*本文档记录了议题组 A（架构与代码）的完整辩论过程。三个子议题均达成了明确决议，共产生 16 项行动项。辩论过程中各成员保持了钢人论证纪律，残余分歧均通过附加约束条件消解。*
