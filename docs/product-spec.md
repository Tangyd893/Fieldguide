# Fieldguide 产品规格（PRD）

> 版本：v0.4 | 状态：愿景对齐（独立软件理解工作台；可组合分屏；不耦合外部 PKB）

---

## 一、背景与愿景

### 1.1 问题

在 AI 时代，技术迭代加速。软件开发者面临两类并行的学习压力：

1. **工程侧**：优秀开源项目体量越来越大，clone 之后不知从何读起，缺乏「全景地图」。
2. **理论侧**：arXiv 论文、技术文档与代码实现之间存在鸿沟，读完论文仍不知道「在仓库里对应哪一段」。
3. **理解侧**：AI 可大量生成代码后，工程师需要更快地理解、判断与评估设计，而不是只会「解释片段」。

现有工具要么偏向 IDE 内的代码跳转（缺全局叙事），要么是通用 ChatGPT 问答（缺结构化项目上下文）。**[Understand-Anything](https://github.com/Egonex-AI/Understand-Anything)** 已提供成熟的代码知识图谱与多 Agent 索引（IDE/CLI 插件形态），但缺少独立桌面产品、论文学习模块与「理论 ↔ 实现」桥接——Fieldguide 在此之上构建**独立的软件理解工作台**。

### 1.2 愿景

**Fieldguide**（野外手册）—— AI 时代的软件理解系统：在应用内把仓库变成可读的架构地图、知识卡片与面试演练，并通过**有限面板类型的分屏组合**，让用户按自己的方式理解项目。

Fieldguide **不依赖** Obsidian 或其他外部个人知识库；知识与问题产物保存在本机 Fieldguide 数据中。

### 1.3 设计原则

1. **教，而非炫**：节点少而精、摘要可读、Tour 有叙事顺序。
2. **本地优先 / 产品独立**：索引、图谱、知识卡、面试题在用户机器；不与外部笔记应用耦合。
3. **有限选择、自由搭配**：代码地图提供固定面板目录（总览 / 图谱 / 代码 / 问答 / 导览 / 知识 / 面试），用户用 1～2 分屏自行组合。
4. **理论 + 代码并重**：理论与桥接仍为顶栏模块；常与代码并读的能力优先进入分屏面板。
5. **打磨优先**：不追求最快 MVP，追求同类用户愿意 daily 打开的体验。
6. **渐进分析**：结构 → 架构 → 知识 → 面试，可跳过后续阶段。

---

## 二、目标用户

| 画像 | 描述 |
|------|------|
| **首发用户** | 有 3+ 年经验的软开从业者，Windows 环境，主动跟踪 GitHub 热门项目与 arXiv |
| **扩展用户** | 同类的独立开发者、技术博主、准备贡献开源的新手（有基础读码能力） |

**非目标用户**：完全零基础编程入门者（Fieldguide 假设用户能读代码片段）；企业级 Code Review / CI 替代工具需求。

---

## 三、用户场景与成功标准

### 场景 A：读懂一个新 Star 的开源项目

**故事**：用户看到 GitHub Trending 上的一个 Agent 框架，clone 后打开 Fieldguide，添加本地路径并索引。

**成功标准**（30 分钟内）：
- 能在「架构总览」面板说出项目的入口、核心模块、主数据流
- 能跟随 Tour 完成至少一条「从 HTTP 入口到核心逻辑」的路径
- 能列出「下一步应精读的 3 个文件」
- 可选：用「知识 | 代码」或「总览 | 图谱」预设分屏搭配阅读

### 场景 B：论文 ↔ 实现对照

**故事**：用户阅读一篇关于 RAG 的 arXiv 论文，同时索引了 LangChain / 某 RAG demo 仓库。

**成功标准**：
- 在「概念桥接」中将论文段落关联到代码节点
- 生成一条「论文概念 X → 代码实现 Y」的对照 Tour
- AI 助手能基于论文 + 图谱回答「chunk 策略在代码里如何实现」

### 场景 C：改代码前的影响评估

**故事**：用户 fork 项目并修改某个 service 函数，提交前想评估影响范围。

**成功标准**：
- diff 分析高亮受影响的节点与调用链
- 用户能判断是否需要同步修改测试或 API 层

### 场景 D：项目面试演练

**故事**：用户准备用某个开源项目作为面试谈资，在 Fieldguide 内打开面试面板。

**成功标准**：
- 能抽到基于本项目架构/技术选型的问题
- 对照参考答案后，能跳转到相关知识卡或代码节点
- 可并排打开问答面板继续深挖

---

## 四、信息架构

```
Fieldguide
├── 项目库          # 已索引项目列表、添加/删除、索引状态
├── 代码地图        # 可组合分屏：总览 / 图谱 / 代码 / 问答 / 导览 / 知识 / 面试
├── 理论学习        # arXiv、PDF、笔记（顶栏模块）
├── 概念桥接        # 论文段落 ↔ 代码节点
├── AI 助手         # 跨论文+桥接 Agent；纯代码问答亦可在图谱侧
└── 设置            # API Key、语言（简中/繁中/en-US）、项目根目录、主题
```

### 4.1 项目库

- 添加项目：本地文件夹 / Git URL clone（Git 默认落盘 `{projectsRoot}/{slug}/`）
- 列表展示：名称、语言、最后索引时间、节点数、状态（索引中/完成/失败/源码已变更）
- 操作：打开地图、重新索引、增量索引、移除（可选保留图谱缓存）
- **首次启动**：引导 wizard 设置语言、项目根目录、可选 Demo（见 [onboarding-spec.md](./onboarding-spec.md)）

### 4.2 代码地图（P0 核心）

> 由 **Understand-Anything** 提供图谱能力，Fieldguide 嵌入 Dashboard，并提供可组合分屏面板。详见 [understand-anything-integration.md](./understand-anything-integration.md) 与 [ui-spec.md](./ui-spec.md)。

**有限面板目录（V1）**：

| Tab | 职责 |
|-----|------|
| `overview` | 架构总览：分层、模块、数据流、技术选型 |
| `graph` | UA 结构图谱 |
| `code` | 代码阅读 |
| `chat` | 学习教练问答 |
| `tour` | Tour 导览 |
| `knowledge` | 应用内知识卡片（原理 / 取舍 / 示例） |
| `interview` | 项目面试演练 |

布局预设（标题栏）：总览\|图谱、知识\|代码、面试\|问答、导览\|代码。

- **结构视图**：文件 / 函数 / 类节点，import / call 边，按 architectural layer 着色（UA）
- **业务域视图**（延期）：domain → flow → step（UA `/understand-domain`）
- **Tour**：UA 生成与播放；壳层面板提供快捷入口
- **搜索**：名称模糊 + 语义（UA Dashboard）
- **渐进分析**：索引后自动跑架构 → 知识 → 面试（无 Key 时启发式；可单独重跑）
- **刻意不做**：Obsidian / 外部 PKB 同步（知识留在 Fieldguide）

### 4.3 理论学习（P1 并列模块）

- arXiv 关键词搜索，收藏到论文库
- PDF 导入（拖拽），文本提取，分块，本地 RAG
- 阅读器：分页、高亮、笔记
- 针对当前论文的 AI 问答

**不做**：BibTeX 批量管理、引用格式转换、Zotero 同步（非核心学习路径，后续可插件化）

### 4.4 概念桥接（P2）

- 左侧：论文章节 / 高亮段落 / 术语
- 右侧：关联的代码节点（手动选择或 AI 推荐）
- 生成「对照 Tour」并保存到项目

### 4.5 AI 助手

分两层，避免与 UA Dashboard 内聊天重复：

| 场景 | 负责方 | 能力 |
|------|--------|------|
| 纯代码结构问答 | **UA**（Dashboard 内） | 基于图谱的问答、节点引用 |
| 论文 RAG | **Fieldguide**（Phase 3） | `query_paper` |
| 跨论文 + 代码 + 桥接 | **Fieldguide**（Phase 3） | 扩展 ReAct：`link_concept`、对照 Tour |

Fieldguide 右栏 Agent（Phase 3，**已实现 2026-07-13**）：
- **ReAct 工具调用循环**（`src/main/agent/react.ts`），最多 4 轮；UI 展示 thought / action / observation / answer
- 工具：`search_nodes`、`query_paper`、`get_node_source`、`list_concept_links`
- 上下文绑定：项目图谱、论文 RAG、concept_links；聊天历史持久化至 SQLite
- 纯代码结构问答：仍建议在 UA Dashboard 内提问；壳层 Agent 侧重跨源对照

---

## 五、功能清单与优先级

> **实现来源**：标有 UA 的功能由 [Understand-Anything](https://github.com/Egonex-AI/Understand-Anything) 提供，Fieldguide 负责集成与桌面壳；标有 FG 的为 Fieldguide 自建。详见 [understand-anything-integration.md](./understand-anything-integration.md) **§交付边界**。
>
> **当前交付口径**：F-02/F-03（结构图谱 + Dashboard）已交付；F-05/F-06 在有 Key 时为精简 LLM；业务域 / graph-reviewer **延期**。

| ID | 功能 | 来源 | 优先级 | Phase |
|----|------|------|--------|-------|
| F-01 | 添加本地/Git 项目并索引 | FG 壳 + UA 精简 pipeline | P0 | 1 |
| F-02 | 多语言结构图谱（26+ 类型） | UA core（✅ 已交付） | P0 | 1 |
| F-03 | 交互式图谱 UI（缩放、选中、邻居） | UA Dashboard 嵌入（✅ 已交付） | P0 | 1 |
| F-04 | 节点详情 + 源码预览 | UA Dashboard + 壳层开文件（✅） | P0 | 1 |
| F-05 | LLM 节点摘要 + 架构分层 | UA prompts（部分；非完整 Agent） | P0 | 1–2 |
| F-06 | 引导 Tour | UA prompts + 壳层 TourPanel（部分） | P0 | 1–2 |
| F-07 | 语义代码搜索 + 代码问答 | UA / FG Agent | P0 | 2 |
| F-08 | arXiv 搜索 + 论文库 | FG | P1 | 3 |
| F-09 | PDF 导入 + RAG 问答 | FG | P1 | 3 |
| F-10 | 概念桥接 + 对照 Tour | FG | P1 | 3 |
| F-11 | Git diff 影响分析 | FG diff overlay（非完整 `/understand-diff` Agent） | P2 | 2–4 |
| F-12 | 增量索引 | FG `mergeIncrementalGraph` + UA | P2 | 2 |
| F-13a | i18n 三语 UI 骨架（简中/繁中/en-US） | FG shell + UA language | P0 | 1 |
| F-13b | LLM 输出随 locale + 文案 polish | UA + FG | P1 | 2 / 4 |
| F-14 | Windows 安装包 | FG | P1 | 4 |
| F-15 | 跨论文+图谱统一 Agent | FG 扩展 | P1 | 3 |
| F-16 | 业务域视图 / graph-reviewer | UA Agent（**延期**） | P2 | 延期 |

---

## 六、非功能需求

| 类别 | 要求 |
|------|------|
| 平台 | Windows 10/11 首发 |
| 性能 | 5 万行级项目：静态索引 < 2 分钟；图谱首屏渲染 < 3 秒 |
| 隐私 | 源码与图谱默认不出本机；LLM 调用仅发送用户配置的 API 所需片段 |
| 可靠性 | 索引可取消、可重试；失败保留部分结果 |
| 可扩展 | 语言解析随 UA 上游扩展；LLM Provider 可配置 |
| 国际化 | 默认简中；支持繁中、en-US；UI 与 LLM 输出随 locale |

---

## 七、非目标（明确不做）

- Web SaaS 多租户服务
- Docker 微服务部署
- **以 IDE 插件形态分发 Fieldguide**（代码地图复用 UA，但产品形态是独立桌面）
- 实时代码编辑、LSP 补全、调试器
- 学术 citation 管理与排版
- **自研 Tree-sitter 解析管线、FileAnalyzer 等 UA 已有 Agent**（必须复用上游）
- 依赖 Dify 等外部编排平台作为运行时

---

## 八、与上游及竞品的关系

| 产品 | 关系 |
|------|------|
| **[Understand-Anything](https://github.com/Egonex-AI/Understand-Anything)** | **上游引擎**：代码索引、图谱、Tour、diff；Fieldguide 集成而非竞争 |
| Sourcegraph / GitHub Code Search | 企业搜索导向；Fieldguide 是学习叙事 + Tour + 理论桥接 |
| ChatGPT / Cursor Chat | 无持久项目图谱；Fieldguide 结构化上下文 + 可视化 |
| EasyIdea（参考 UI） | 未开源；Fieldguide 以 UA Dashboard 为基底扩展桌面体验 |

---

## 九、已定稿决策（原开放问题）

| # | 问题 | 决策 |
|---|------|------|
| 1 | 内置 sample 项目 | **按需 clone demo**（`fieldguide-demo`），首次引导三选一：体验 Demo / 打开本地项目 / 稍后再说；不内嵌安装包 |
| 2 | 默认 LLM | 设置页 placeholder 示例 DeepSeek；**不预填 Key、不绑定单一厂商** |
| 3 | EPUB / Markdown | **Phase 3 不做**（仅 PDF）；Phase 4+ 按需求评估 |
| 4 | 代码地图技术基础 | **基于 Understand-Anything**（`@understand-anything/core` + Dashboard）；不自研索引管线 |
| 5 | 图谱存储位置 | `{projectRoot}/.understand-anything/knowledge-graph.json`（与 UA 一致，就地索引） |

---

## 十、设置项摘要

| 分组 | 项 |
|------|-----|
| LLM | Base URL、API Key、Chat/Embed Model、测试连接 |
| 通用 | 语言（简体中文 / 繁體中文 / English (US)，默认简中）、主题 |
| 项目 | 项目根目录（Git clone 默认父路径） |
| 索引 | 忽略规则、并行度、浅克隆默认 |
| 数据 | 打开数据目录、清除缓存、导出图谱 |
