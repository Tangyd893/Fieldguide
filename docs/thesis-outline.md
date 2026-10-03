# 毕业论文结构与素材映射

> 用途：把仓库里已经存在的东西对应到论文章节，并标注每一条结论的**证据命令**。
> 原则：论文里的每个数字都能由命令重新生成；不能重新生成的数字不写进论文。

---

## 一、题目与一句话贡献

**题目建议**：《面向陌生代码库理解的知识图谱增强问答系统设计与实现》

**一句话**：用代码知识图谱约束大模型的上下文，把问答从"文本相似度检索"升级为
"结构约束 + 词汇桥接的检索增强"，并用离线可复现的基准量化每一步的收益与边界。

**贡献边界（答辩第一页就要讲清）**：

| 能力 | 归属 | 说明 |
|---|---|---|
| Tree-sitter 解析、索引流水线、图谱画布 | 上游 Understand-Anything（MIT，commit pin） | 本项目只集成，不改上游一行代码 |
| 问答教练、上下文装配、检索改进、学习闭环、Obsidian 导出、任务中心、评测体系 | 本课题 | 集成层之上的全部能力 |

---

## 二、章节映射

### 第 1 章 绪论
- **讲什么**：三类痛点（读不动陌生仓库 / 论文与实现割裂 / AI 时代要会判断而不只是会生成）；
  与 IDE、通用聊天、Sourcegraph 类工具的差别。
- **素材**：`docs/product-spec.md` §1、`docs/design-review.md` §3.2、`docs/项目介绍.md` §2。
- **证据**：—

### 第 2 章 相关工作与关键技术基础
- **讲什么**：代码知识图谱与代码检索；RAG 与检索融合（BM25、RRF）；ReAct 与工具调用；
  提示上下文预算；间隔重复（SM-2）。
- **素材**：`src/main/ua/lexical.ts` 头部注释（为什么是 BM25 + RRF 而不是调分）、
  `src/main/agent/react.ts`（context-first 循环）、`src/main/srs.ts`。
- **证据**：—

### 第 3 章 需求分析与总体设计
- **讲什么**：四个用户场景与成功标准（场景 A–D）；非功能需求（可取消、可重试、
  **失败保留部分结果**、本地优先）；架构分层与进程模型；数据归属（图谱就地、学习数据入库、
  vault 是外部落点）。
- **素材**：`docs/product-spec.md` §三、`docs/architecture.md`、`docs/ui-spec.md`。
- **证据**：`pnpm qa:contracts`（108 个 IPC 通道与三端类型一致）。

### 第 4 章 系统实现
- **4.1 桌面壳与安全边界**：contextIsolation / preload 手写白名单 / 路径防护 / 密钥加密 / 原子写。
  → `src/main/paths.ts`、`src/main/config.ts`、`src/main/fs-atomic.ts`；证据 `pnpm test:unit`。
- **4.2 图谱集成**：就地索引、增量合并（mtime 水位线 + 在场集合）、iframe + postMessage 桥
  （15 下行 / 3 上行）、大图布局等待态。
  → `src/main/ua/client.ts`、`src/main/ua/dashboard.ts`；证据 `pnpm qa:graph`。
- **4.3 学习教练**：上下文装配（10k 字符预算）、6 轮 ReAct、末轮协议层收口、13 个工具
  （读宽写窄、参数执行侧夹取、路径不来自模型）、流式与可中止。
  → `src/main/agent/*`、`src/main/llm/client.ts`；证据 `pnpm test:unit`。
- **4.4 学习闭环**：进度 / 笔记 / 间隔重复 / 导师 / 学习路径 / 报告导出。
  → `src/main/srs.ts`、`src/main/review-cards.ts`、`src/main/coach-plus.ts`。
- **4.5 索引任务中心**：`index_jobs` 落地、逐阶段结果、部分结果保留、重试。
  → `src/main/db/index.ts`（作业 CRUD、`pruneIndexJobs`、`failStaleIndexJobs`）、
  `src/main/ua/client.ts`（`IndexStageOutcome`）；证据 `pnpm test:e2e`（boot 场景断言阶段结果）。

### 第 5 章 检索增强方法（论文的方法章节）
- **讲什么**：问题的定位（中文提问 12.8% vs 关键词 68.0%，同一套代码）→ 归因（分词 + 词汇表）
  → 方法（CJK 二元分词、标识符拆词、中英术语映射、BM25、RRF 融合）→ 消融 → 结论与残留问题。
- **素材**：`src/main/ua/lexical.ts`、`src/main/ua/search.ts`（`hybridSearch` / `semanticSearchOnly`）。
- **证据**：`pnpm eval:agent` → `docs/eval/agent-baseline.md`（含"两个机制各自的贡献"与"改进效果"表）。

### 第 6 章 可信性与产物所有权
- **6.1 引用可信性**：忠实度 / 精确率 / 召回率 / 幻觉率的口径与录制-评分分离
  → `src/main/eval/metrics.ts`、`scripts/record-answers.mjs`、`scripts/score-answers.test.ts`；
  证据 `pnpm eval:answers` → `docs/eval/agent-answers.md`。
- **6.2 所有权模型**：托管块 / 四方决策表 / 预览即执行 / 幂等 / 四条性质
  → `src/main/obsidian/plan.ts`、`render.ts`；证据 `pnpm test:unit`（含随机化属性测试
  `src/main/obsidian/__tests__/properties.test.ts`，覆盖 7 类动作）。

### 第 7 章 实验与评估
| 小节 | 数据来源 | 命令 |
|---|---|---|
| 7.1 检索基准与消融 | 2 仓库 / 34 题 / 84 变体 | `pnpm eval:agent` |
| 7.2 答案级指标 | 录制回答的离线评分 | `pnpm eval:record-answers` → `pnpm eval:answers` |
| 7.3 图算法与路径 | 路径可达率 100%、跳数与 import 结构一致 | `pnpm eval:agent` |
| 7.4 工程可靠性 | 单测 498 例 / E2E 19 例 / 契约审计 | `pnpm qa:baseline`、`pnpm test:e2e` |
| 7.5 可用性（**待真人数据**） | SUS + 任务指标 + 留存曲线 | `docs/eval/user-study-protocol.md` |

### 第 8 章 总结与展望
- 结论、局限（见 `docs/项目介绍.md` §8 的十条）、未来工作：
  术语映射自动化、查询改写（录制回放）、ANN 向量检索、改名断边修复、覆盖率门禁、
  E2E 进 CI、真人用户研究。

---

## 三、写作纪律（给自己定的规矩）

1. **数字只从命令来**：`docs/eval/*.md` 由脚本重写；手写数字在评审时无法自证。
2. **口径写在表下**：命中定义（节点 id 或所在文件）、标注非穷举、`nodeRefs` 的语义
   （"依据的节点"而非"答案点名的引用"）必须随表出现。
3. **负结果照写**：邻居扩展的零增益、中文档仍偏低、术语映射是人工覆盖瓶颈。
4. **不写做不到的话**：用户研究没有真实参与者之前，只写"协议与工具就绪"。
