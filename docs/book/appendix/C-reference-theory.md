# 附录 C：理论参考文献

本附录整理了 Prism 项目文档中引用的所有学术框架和理论的出处与简介，按主题分组呈现。每个条目包含理论名称、代表学者、核心文献、核心观点、文档引用位置及在 Prism 项目中的具体应用。

---

## 一、服务与价值理论

### 服务主导逻辑（Service-Dominant Logic, S-D Logic）

| 项目 | 内容 |
|------|------|
| **提出者** | Stephen L. Vargo, Robert F. Lusch |
| **核心文献** | Vargo, S. L., & Lusch, R. F. (2004). Evolving to a New Dominant Logic for Marketing. *Journal of Marketing*, 68(1), 1-17. |
| **核心观点** | 价值不是由生产者单方面制造并交付给消费者的，而是由多方在互动中共同创造的。在传统的"商品主导逻辑"中，价值在交易时转移；在 S-D Logic 中，价值在使用过程中、在互动中、在知识整合中涌现。 |
| **文档引用位置** | 第 2 章 VP3（Agent-Human 价值共创）、第 2 章 Key Takeaways |
| **Prism 应用** | Agent 和人类作为价值共创伙伴，而非工具-使用者关系。Agent 与人类在持续对话中共同构建理解，价值在交互过程中不断涌现和深化——Agent 每次探索触发人类新提问，人类每次确认为 Agent 提供更好的判断基准。 |

---

## 二、知识管理理论

### DIKW 金字塔（DIKW Pyramid）

| 项目 | 内容 |
|------|------|
| **提出者** | Russell L. Ackoff |
| **核心文献** | Ackoff, R. L. (1989). From Data to Wisdom. *Journal of Applied Systems Analysis*, 16, 3-9. |
| **核心观点** | 信息存在层级递进关系：Data（数据）→ Information（信息）→ Knowledge（知识）→ Wisdom（智慧）。每一层都是对下一层的提炼和升华，越往上越接近可行动的洞察。 |
| **文档引用位置** | 第 1 章 三、3.1（量化组织代价）、第 2 章 VP2（两阶段知识资产）、第 2 章 价值交付的三层递进（第二层）、第 3 章 5.1（Truth vs Acceleration 分层） |
| **Prism 应用** | Prism 的数据层级映射为 Voice(Data) → SemanticUnit(Information) → Signal/Concept(Knowledge) → Insight(Wisdom)，每一层都在积累而非每次从零开始。数据存储的 Truth vs Acceleration 分层同样受此框架启发。 |

### SECI 知识创造模型（SECI Model）

| 项目 | 内容 |
|------|------|
| **提出者** | 野中郁次郎（Ikujiro Nonaka）、竹内弘高（Hirotaka Takeuchi） |
| **核心文献** | Nonaka, I., & Takeuchi, H. (1995). *The Knowledge-Creating Company*. Oxford University Press. |
| **核心观点** | 知识创造是隐性知识与显性知识之间螺旋式转化的过程，包含四个阶段：社会化（Socialization，隐性→隐性）、外部化（Externalization，隐性→显性）、组合化（Combination，显性→显性）、内部化（Internalization，显性→隐性）。 |
| **文档引用位置** | 第 1 章 三、3.2（对齐延迟）、第 1 章 四、4.1（现有工具版图）、第 2 章 VP2（SECI 模型映射）、第 2 章 Key Takeaways |
| **Prism 应用** | LLM 涌现标签对应外部化（将用户隐性需求表达为显性标签）；Signal 发现对应组合化（将分散标签整合为体系化知识）；Concept 确认对应内部化（知识融入组织决策）；组织知识积累完成社会化（共享理解扩散）。传统 VOC 工具只覆盖了 SECI 螺旋的前半程，Prism 补全了后半程。 |

---

## 三、创新与扩散理论

### 创新扩散理论（Diffusion of Innovations）

| 项目 | 内容 |
|------|------|
| **提出者** | Everett M. Rogers |
| **核心文献** | Rogers, E. M. (2003). *Diffusion of Innovations* (5th ed.). Free Press. |
| **核心观点** | 创新的采纳速度取决于五个因素：相对优势（Relative Advantage）、兼容性（Compatibility）、复杂性（Complexity）、可试用性（Trialability）、可观测性（Observability）。采纳者按时间分布为创新者→早期采纳者→早期多数→晚期多数→落后者，其间存在"鸿沟"（Chasm）。 |
| **文档引用位置** | 第 1 章 四、4.1（市场空白与机会窗口）、第 2 章 VP4（可解释的 AI 洞察）、第 8 章 R6（用户接受度） |
| **Prism 应用** | 涌现式标签作为创新特性，其采纳策略需重点考虑兼容性（并行运行期，让用户在 2-3 个月内同时使用预设标签和涌现标签）和可观测性（提供对比视图，让用户直观看到涌现标签的增量价值）。"点击即溯源"的设计同时提升可试用性和可观测性。 |

### 颠覆性创新（Disruptive Innovation）

| 项目 | 内容 |
|------|------|
| **提出者** | Clayton M. Christensen |
| **核心文献** | Christensen, C. M. (1997). *The Innovator's Dilemma*. Harvard Business Review Press. |
| **核心观点** | 颠覆性创新最初在主流市场看来"不够好"，但从低端或新市场切入后逐步蚕食主流市场。在位企业往往因为过度关注现有高利润客户的需求，而忽略了来自低端的颠覆性威胁。 |
| **文档引用位置** | 第 2 章 VP1（涌现式标签） |
| **Prism 应用** | AI-Native VOC 对传统 VOC 工具的颠覆路径——被现有系统过滤掉的"非消费者"声音，往往是颠覆性创新的线索。涌现式标签能发现那些被预设分类体系遗漏的反馈，这些反馈中可能隐藏着下一个产品突破点。 |

---

## 四、VOC 与质量管理

### Griffin-Hauser VOC 框架（Voice of the Customer Framework）

| 项目 | 内容 |
|------|------|
| **提出者** | Abbie Griffin, John R. Hauser |
| **核心文献** | Griffin, A., & Hauser, J. R. (1993). The Voice of the Customer. *Marketing Science*, 12(1), 1-27. |
| **核心观点** | VOC 是"对客户需求的完整、层次化描述，以客户自身语言组织，按客户感知的相对重要性排列，并与客户满意度的量化指标相关联。"该框架建立了从客户需求采集到产品设计映射的系统方法论。 |
| **文档引用位置** | 第 1 章 一、1.1（什么是 VOC） |
| **Prism 应用** | 从传统 VOC 方法论的局限性出发（预设分类体系、关键词匹配、聚合仪表板），论证 AI-Native 方法的必要性。Prism 继承了 Griffin-Hauser 对 VOC 的本质定义，但用涌现式方法替代了其中的预设分类范式。 |

### 卡诺模型（Kano Model）

| 项目 | 内容 |
|------|------|
| **提出者** | 狩野纪昭（Noriaki Kano）等 |
| **核心文献** | Kano, N., Seraku, N., Takahashi, F., & Tsuji, S. (1984). Attractive Quality and Must-Be Quality. *Journal of the Japanese Society for Quality Control*, 14(2), 39-48. |
| **核心观点** | 产品质量分为三层：必备属性（Must-Be，缺失则严重不满）、期望属性（One-Dimensional，线性相关满意度）和魅力属性（Attractive，存在则惊喜，缺失也无不满）。随着时间推移，魅力属性会逐渐退化为期望属性乃至必备属性。 |
| **文档引用位置** | 第 1 章 二、2.1（分类陷阱） |
| **Prism 应用** | 涌现式标签发现的往往是魅力属性和未预期的需求——这些需求在预设分类体系中没有对应的格子，因此被传统 VOC 工具系统性遗漏。Prism 的开放世界假设让系统有能力捕获超越已知分类的新型需求。 |

---

## 五、组织与战略理论

### 康威定律（Conway's Law）

| 项目 | 内容 |
|------|------|
| **提出者** | Melvin E. Conway |
| **核心文献** | Conway, M. E. (1968). How Do Committees Invent? *Datamation*, 14(4), 28-31. |
| **核心观点** | 设计系统（广义上）的组织，其产出的设计等价于该组织沟通结构的映射。即：系统的架构必然反映设计该系统的组织的沟通结构。其逆命题同样成立——如果想要特定形状的系统，就必须先构建与之匹配的组织形状。 |
| **文档引用位置** | 第 3 章 1.1（Conway 定律）、第 3 章 Key Takeaways、第 8 章 R9（跨专业协作困难） |
| **Prism 应用** | 微服务边界设计需要与团队结构匹配。Prism 的架构设计本质上是在回答一个组织问题：产品以什么方式演化。如果团队沟通有壁垒，系统模块边界会反映这些壁垒而非最优技术架构。 |

### 动态能力理论（Dynamic Capabilities）

| 项目 | 内容 |
|------|------|
| **提出者** | David J. Teece, Gary Pisano, Amy Shuen |
| **核心文献** | Teece, D. J., Pisano, G., & Shuen, A. (1997). Dynamic Capabilities and Strategic Management. *Strategic Management Journal*, 18(7), 509-533. |
| **补充文献** | Teece, D. J. (2007). Explicating Dynamic Capabilities: The Nature and Microfoundations of (Sustainable) Enterprise Performance. *Strategic Management Journal*, 28(13), 1319-1350. |
| **核心观点** | 企业在不确定环境中的持续竞争优势来自三项动态能力：感知（Sensing）——识别环境变化与机会；捕获（Seizing）——动员资源抓住机会；转化（Transforming）——重新配置组织资产以适应变化。 |
| **文档引用位置** | 第 1 章 一、1.3（VOC 作为竞争优势的理论基础）、第 1 章 Key Takeaways |
| **Prism 应用** | VOC 系统的质量直接决定了企业感知、捕获和转化外部变化的速度。Prism 作为增强组织感知能力（语义理解 + 涌现发现）和学习速度（知识复利结构）的基础设施，缩短了感知→捕获→转化的全链路时间。 |

### 吸收能力（Absorptive Capacity）

| 项目 | 内容 |
|------|------|
| **提出者** | Wesley M. Cohen, Daniel A. Levinthal |
| **核心文献** | Cohen, W. M., & Levinthal, D. A. (1990). Absorptive Capacity: A New Perspective on Learning and Innovation. *Administrative Science Quarterly*, 35(1), 128-152. |
| **核心观点** | 组织识别外部新知识的价值、消化并将其应用于商业目的的能力（即吸收能力），是决定其创新能力的关键因素。吸收能力具有路径依赖性——过去的知识积累决定了当前能吸收何种新知识。 |
| **文档引用位置** | 第 1 章 一、1.3（VOC 作为竞争优势的理论基础） |
| **Prism 应用** | Concept Layer 作为提升组织吸收能力的工具——经过确认和治理的概念资产，构成组织的"先验知识"，使其能更快地识别和消化后续的外部反馈。VOC 系统的质量直接决定了组织吸收能力的上限。 |

### 学习型组织（Learning Organization）

| 项目 | 内容 |
|------|------|
| **提出者** | Peter M. Senge |
| **核心文献** | Senge, P. M. (1990). *The Fifth Discipline: The Art and Practice of the Learning Organization*. Doubleday. |
| **核心观点** | 组织的持续学习能力是最根本的竞争优势。学习型组织通过五项修炼——系统思考、自我超越、心智模式、共同愿景、团队学习——实现持续的自我更新与适应。 |
| **文档引用位置** | 第 1 章 四、4.2（AI Native VOC 的蓝海空间） |
| **Prism 应用** | Prism 的知识复利结构让组织越用越聪明——每一次探索的结果反哺系统，让下一次探索更精准。系统从"单向报表"升级为"学习闭环"（Learning Loop），是 Senge 所描述的学习型组织在 VOC 领域的具体实现。 |

---

## 六、复杂系统理论

### 自组织理论（Self-Organization）

| 项目 | 内容 |
|------|------|
| **提出者** | Stuart A. Kauffman |
| **核心文献** | Kauffman, S. A. (1993). *The Origins of Order: Self-Organization and Selection in Evolution*. Oxford University Press. |
| **核心观点** | 复杂系统中的秩序可以自发涌现，无需外部设计者刻意安排。在满足特定条件（足够的多样性、适当的连接密度）时，系统会自然趋向有序状态。涌现的秩序既非完全随机，也非完全预设，而是"自组织临界态"的产物。 |
| **文档引用位置** | 第 2 章 VP1（涌现式标签）、第 4 章 2.3（涌现式标签机制） |
| **Prism 应用** | 涌现式标签的理论基础——标签从数据中自发涌现，而非由人类预设。LLM 阅读每条反馈并自由提取语义主题，标签在足够多样的数据中自然收敛为有意义的概念集合，体现了自组织系统中"秩序从混沌中涌现"的原理。 |

### 范式转换（Paradigm Shift）

| 项目 | 内容 |
|------|------|
| **提出者** | Thomas S. Kuhn |
| **核心文献** | Kuhn, T. S. (1962). *The Structure of Scientific Revolutions*. University of Chicago Press. |
| **核心观点** | 科学进步不是线性的知识累积，而是范式的革命性转换。旧范式无法解释越来越多的"异常"时，新范式取而代之。范式转换不是渐进的改良，而是世界观的根本重构——新旧范式之间存在"不可通约性"。 |
| **文档引用位置** | 第 1 章 二、2.1（分类陷阱）、第 1 章 四、4.2（AI Native VOC 的蓝海空间）、第 1 章 Key Takeaways、第 5 章 2.3（从 CGI 到 RESTful API 的范式转换） |
| **Prism 应用** | 从预设分类到涌现标签是 VOC 方法论的范式转换——传统范式（封闭世界假设、关键词匹配、聚合仪表板）无法应对开放世界中的语义多样性，用 AI 加速旧范式只会更快地产出更精致的噪音。Prism 的"涌现优于预设"是新范式的核心主张。 |

---

## 七、统计学概念

### 辛普森悖论（Simpson's Paradox）

| 项目 | 内容 |
|------|------|
| **命名者** | Edward H. Simpson（1951 年首次描述该现象） |
| **经典文献** | Simpson, E. H. (1951). The Interpretation of Interaction in Contingency Tables. *Journal of the Royal Statistical Society, Series B*, 13(2), 238-241. |
| **核心观点** | 在分组数据中观察到的趋势，在数据合并后可能完全逆转。这一悖论揭示了聚合统计指标的根本局限性——整体趋势不等于局部趋势之和，平均值可能掩盖甚至歪曲子群体中完全相反的真实情况。 |
| **文档引用位置** | 第 1 章 二、2.3（仪表板幻觉） |
| **Prism 应用** | NPS 等聚合指标可能掩盖子群体中完全相反的趋势——整体 NPS 稳定时，某个关键用户群的满意度可能已经在急剧下降。这是 Prism 主张"语义级穿透"而非"仪表板概览"的统计学依据。 |

---

## 参考文献汇总

按作者姓氏字母顺序排列：

1. Ackoff, R. L. (1989). From Data to Wisdom. *Journal of Applied Systems Analysis*, 16, 3-9.

2. Christensen, C. M. (1997). *The Innovator's Dilemma*. Harvard Business Review Press.

3. Cohen, W. M., & Levinthal, D. A. (1990). Absorptive Capacity: A New Perspective on Learning and Innovation. *Administrative Science Quarterly*, 35(1), 128-152.

4. Conway, M. E. (1968). How Do Committees Invent? *Datamation*, 14(4), 28-31.

5. Griffin, A., & Hauser, J. R. (1993). The Voice of the Customer. *Marketing Science*, 12(1), 1-27.

6. Kano, N., Seraku, N., Takahashi, F., & Tsuji, S. (1984). Attractive Quality and Must-Be Quality. *Journal of the Japanese Society for Quality Control*, 14(2), 39-48.

7. Kauffman, S. A. (1993). *The Origins of Order: Self-Organization and Selection in Evolution*. Oxford University Press.

8. Kuhn, T. S. (1962). *The Structure of Scientific Revolutions*. University of Chicago Press.

9. Nonaka, I., & Takeuchi, H. (1995). *The Knowledge-Creating Company*. Oxford University Press.

10. Rogers, E. M. (2003). *Diffusion of Innovations* (5th ed.). Free Press.

11. Senge, P. M. (1990). *The Fifth Discipline: The Art and Practice of the Learning Organization*. Doubleday.

12. Simpson, E. H. (1951). The Interpretation of Interaction in Contingency Tables. *Journal of the Royal Statistical Society, Series B*, 13(2), 238-241.

13. Teece, D. J., Pisano, G., & Shuen, A. (1997). Dynamic Capabilities and Strategic Management. *Strategic Management Journal*, 18(7), 509-533.

14. Teece, D. J. (2007). Explicating Dynamic Capabilities: The Nature and Microfoundations of (Sustainable) Enterprise Performance. *Strategic Management Journal*, 28(13), 1319-1350.

15. Vargo, S. L., & Lusch, R. F. (2004). Evolving to a New Dominant Logic for Marketing. *Journal of Marketing*, 68(1), 1-17.
