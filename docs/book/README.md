# Prism 项目文档

> 从客户声音到组织智慧——AI 驱动的 VOC 分析平台

---

## 阅读指南

本文档面向三类读者：

| 读者 | 推荐路径 | 预计时间 |
|------|---------|---------|
| **C-Level / VP** | Ch00 执行摘要 → Ch01 市场问题 → Ch09 资源ROI | 30 分钟 |
| **产品 / 业务负责人** | Ch00 → Ch01 → Ch02 愿景价值 → Ch07 路线图 → Ch08 风险 | 1.5 小时 |
| **技术 Lead / 架构师** | 全文阅读，重点 Ch03 架构 → Ch05 Agent-First → Ch06 技术蓝图 | 3 小时 |

---

## 目录

### 核心章节

| 章节 | 标题 | 核心问题 |
|------|------|---------|
| [Ch00](./00-executive-summary.md) | 执行摘要 | Prism 是什么？为什么现在做？需要什么资源？ |
| [Ch01](./01-market-problem.md) | 市场洞察与问题定义 | 传统 VOC 为什么失败？市场空白在哪里？ |
| [Ch02](./02-vision-proposition.md) | 产品愿景与价值主张 | Prism 的核心差异化是什么？ |
| [Ch03](./03-platform-architecture.md) | 平台架构——双用户模型 | 为什么 Human + Agent 双用户是核心设计？ |
| [Ch04](./04-core-capabilities.md) | 核心能力深度剖析 | 五大能力群如何协同工作？ |
| [Ch05](./05-agent-first-design.md) | Agent-First 设计哲学 | 为什么 Agent 必须是基础设施？ |
| [Ch06](./06-technology-blueprint.md) | 技术蓝图 | 技术选型的 Why，不只是 What |
| [Ch07](./07-roadmap.md) | 发展路线图 | 6 个阶段如何渐进交付？ |
| [Ch08](./08-risk-mitigation.md) | 风险分析与对策 | 12 个核心风险及其缓解策略 |
| [Ch09](./09-resource-roi.md) | 资源需求与投资回报 | 需要多少人、多少钱、多长时间？ |

### 附录

| 附录 | 标题 | 内容 |
|------|------|------|
| [附录 A](./appendix/A-glossary.md) | 术语表 | 文中出现的专业术语中英文释义 |
| [附录 B](./appendix/B-competitor-analysis.md) | 竞品分析 | Qualtrics / Medallia / MonkeyLearn 对比 |
| [附录 C](./appendix/C-reference-theory.md) | 理论参考文献 | 文中引用的学术框架出处 |

---

## 写作风格说明

本文档采用**商学院跨学科创新教授**风格：

- 每个核心论点遵循 **What → Why → How → Risk → Benefit** 五段论
- 每章开头有 **TL;DR**（高管速读版），结尾有 **Key Takeaways**
- 理论有锚点（S-D Logic、DIKW 金字塔、Rogers 创新扩散、Nonaka SECI 模型等）
- 实践有案例（假设性但逼真的行业场景）
- 决策有框架（对比矩阵、风险矩阵、ROI 模型）

---

## 与草稿文档的关系

`docs/` 根目录下的文件为技术设计草稿，面向工程实现；本 `docs/book/` 目录下的文件为正式项目文档，面向管理决策与跨团队对齐。二者互为补充：

- 草稿提供技术深度 → 正式文档提供决策广度
- 草稿面向"怎么做" → 正式文档面向"为什么做"和"值不值得做"
