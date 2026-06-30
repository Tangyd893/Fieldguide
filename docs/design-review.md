# Fieldguide 设计审视：用户 × 开发者双视角

> 版本：v0.3 | 状态：设计定稿（Phase 0，已纳入 Understand-Anything 集成）  
> 目的：动工前明晰最终产品设计，评估是否足够好用、实用、易用

---

## 一、最终产品一句话

Fieldguide 是开发者的**本地学习工作台**：把陌生代码库变成「能跟着走的导览地图」，把论文变成「能对照实现的参考手册」，两者通过概念桥接形成闭环——**不是替代 IDE，而是回答「这个项目从哪读起、这段论文在代码里对应什么」。**

---

## 二、已决设计项

| 项 | 决策 |
|----|------|
| **代码地图引擎** | **[Understand-Anything](https://github.com/Egonex-AI/Understand-Anything)**（MIT）；不自研索引管线 |
| 本地项目存储 | **就地索引**；图谱在 `{root}/.understand-anything/` |
| 平台 | Windows 首发 |
| 形态 | 独立 Electron 桌面（非 IDE 插件分发） |
| LLM | OpenAI 兼容 API，用户自配 Key；桥接至 UA |
| 数据本地 | `%APPDATA%/Fieldguide/` 存 config、论文、桥接；图谱在源码目录 |
| Git clone | 默认 `{projectsRoot}/{slug}/` |
| 国际化 | Fieldguide UI 三语 + UA `language` 映射 |
| Demo 项目 | 按需 clone `fieldguide-demo` |

---

## 三、用户视角

### 3.1 谁在用、何时打开

| 维度 | 设计意图 |
|------|----------|
| 用户 | 3+ 年经验、主动学 GitHub 项目 + arXiv 的 Windows 开发者 |
| 打开时机 | clone 新项目后；读论文想对照实现时；改 fork 前想评估影响时 |
| 不服务 | 零基础入门、企业 Code Review、日常写码（仍在 IDE 完成） |

**与 IDE 的关系**：Fieldguide 是**并行工具**。用户在 Fieldguide（UA Dashboard）建立认知 → 跳转到 IDE 精读。源码预览由 **UA Dashboard** 提供，Fieldguide 不自建 Monaco 画布。

### 3.2 用户要完成的三件事（Jobs to be Done）

| Job | 成功标准 | 依赖能力 | 设计是否支撑 |
|-----|----------|----------|-------------|
| **A 读懂新项目** | 30 分钟内说出入口、主数据流、3 个精读文件 | UA 图谱 + Tour + 聊天 | 是（UA 提供核心） |
| **B 论文↔实现** | 段落关联节点 + 对照 Tour + 跨源问答 | 理论模块 + 桥接 + FG Agent | 是，**Fieldguide 自建** |
| **C 影响评估** | diff 高亮受影响节点 | UA `/understand-diff` | 是（Phase 2 集成） |

### 3.3 用户心智模型

用户应理解为：

1. **项目库** = 我的学习对象列表（不是 Git 客户端）
2. **代码地图** = 带讲解的结构导览（不是 Star 图炫技）
3. **理论** = 论文/PDF 笔记本（不是 Zotero）
4. **桥接** = 把两边连起来的工作台（**产品差异化核心**）
5. **AI 助手** = 有上下文的教练（不是代码生成器）

### 3.4 易用性：已覆盖 vs 仍有风险

**已覆盖**（见 [ui-spec.md](./ui-spec.md)）

- 打开即懂：三栏 + 顶栏 Tab，空状态有引导文案
- 渐进深入：LOD 三级展开（目录 → 文件 → symbol），防大图谱卡顿
- Tour 模式：步骤控制条 + 脉冲高亮 + 讲解文案
- 命令面板 Ctrl+K：跨项目跳转、重索引
- 无 API Key 仍可用静态模式
- 首次引导 wizard + Demo 三选一（见 [onboarding-spec.md](./onboarding-spec.md)）

**易用性风险**

| 风险 | 用户感受 | 设计应对 |
|------|----------|----------|
| Dashboard 与壳层视觉割裂 | 「像两个 App 拼在一起」 | Phase 1 嵌入 UA Dashboard；Phase 2 主题统一 |
| LLM 成本不透明 | 索引大项目费用未知 | UA 增量 + Fieldguide 成本对话框 |
| 论文与代码切换成本 | 桥接 Tab 体验割裂 | 顶栏平等导航 + 扩展 Agent |
| 首次无项目 | 冷启动空白 | 首次引导 + demo |
| UA 上游变更 | 功能异常 | 版本锁定 + 集成测试 |

### 3.5 最终产品验收清单

不以 Phase 拆分，以最终交付为准：

- [ ] 新用户 **15 分钟内**完成：添加项目 → 跟完一条 Tour → 说出主链路
- [ ] 论文段落 ↔ 代码节点关联 **≤3 次点击**完成，并可生成对照 Tour
- [ ] 全局搜索 / 聊天能回答「X 功能在哪」并 **一键跳到节点**
- [ ] 无网络 / 无 API Key 时，静态结构浏览仍流畅可用
- [ ] 索引失败、LLM 限流时有 **可操作** 文案
- [ ] 学习数据（图谱、笔记、桥接）**重启不丢**，默认不出本机

---

## 四、开发者视角

### 4.1 架构边界

| 层 | 职责 | 禁止 |
|----|------|------|
| Renderer | 渲染图谱、表单、聊天 UI；订阅 IPC 事件 | 直接读文件系统、调 LLM、访问 DB |
| Preload | contextBridge 暴露窄 API | 业务逻辑 |
| Main | 索引、持久化、Agent、Git | 阻塞 UI 线程的重计算 |
| Workers | Tree-sitter 解析、LLM 批处理 | 直接操作 BrowserWindow |

详见 [architecture.md](./architecture.md) 进程模型与 IPC 契约。

### 4.2 与 architecture.md 对齐（已定稿）

**本地项目就地索引**：

- `projects.source_uri` = 用户指定的本地路径或 Git URL
- `projects.root_path` = 实际索引根（只读，不复制到 APPDATA）
- `projects.slug` = Git clone 目录名

**Git URL clone 路径**：

- 默认 `{projectsRoot}/{slug}/`，`projectsRoot` 在首次引导或设置页配置
- 每次添加仍可通过资源管理器覆盖目标目录

**图谱存储**：

- **权威源**：`{root_path}/.understand-anything/knowledge-graph.json`（UA）
- **SQLite**：仅 projects、papers、concept_links、chat（Fieldguide 扩展）

**禁止**：自研 graph schema 主结构、重复实现 UA Agent。

### 4.3 已定稿项（原待决）

| 项 | 决策 |
|----|------|
| 代码地图技术 | **Understand-Anything** `@understand-anything/core` + Dashboard |
| Git URL clone 路径 | `{projectsRoot}/{slug}/` |
| 内置 sample | 按需 clone demo |
| LLM 默认推荐 | DeepSeek 示例，不绑定厂商 |
| EPUB / Markdown | Phase 3 不做 |
| 中文 UI + LLM | Fieldguide locale + UA language 映射 |
| 增量索引 | UA 内置；Phase 2 UI 暴露 |

### 4.4 核心子系统实现风险

| 子系统 | 主要风险 | 缓解 |
|--------|----------|------|
| **UA 集成** | core API 非为 Electron 设计 | Spike + `ua/client.ts` 适配层 |
| **UA Dashboard 嵌入** | 样式/通信 | postMessage；Phase 2 主题 |
| Index Engine | ~~自研 parser~~ | **由 UA 负责** |
| ReAct Agent | 工具结果过大 | UA 截断 + FG 扩展工具限长 |
| LanceDB | Electron native | 仅论文 RAG（Phase 3） |
| PDF + RAG | 扫描版 PDF | 明确错误提示 |
| 上游版本 | breaking change | pin + 月度评估合并 |

### 4.5 数据模型注意事项

**节点 ID 与增量行为**：遵循 **UA** 实现；Fieldguide 不自定义 ID 规则。升级 UA 版本时跑集成测试回归。

**就地索引 + 用户改文件**：

- UA 增量 hash（Phase 2 暴露 UI）；首版可手动重索引
- 项目卡片「源码已变更」badge（见 [ui-spec.md](./ui-spec.md) §3.1）

**IPC 实施顺序建议**：

1. `project:*` + `index:progress`（包装 UA pipeline）
2. `graph:get` / `getNode` / `neighbors` / `getSource`（读 `knowledge-graph.json` via `graph-reader`）
3. `graph:search`（**委托 UA** 语义/模糊搜索，非 LanceDB）
4. `chat:*`（Phase 2：桥接 UA 代码问答或 Dashboard 内完成）
5. `arxiv:*` / `paper:*`（Phase 3，Fieldguide 自建）

Preload 层通过 `src/shared/` 定义共享 TypeScript 类型，避免 main/renderer 漂移。

### 4.6 文档缺口（已补充）

| 缺口 | 文档 |
|------|------|
| UA 集成边界 | [understand-anything-integration.md](./understand-anything-integration.md) |
| 测试策略 | [testing-strategy.md](./testing-strategy.md) |
| IPC 错误形状 | [architecture.md](./architecture.md) §7.5 |
| 索引 freshness | [architecture.md](./architecture.md) §5.6 |
| 首次引导 | [onboarding-spec.md](./onboarding-spec.md) |
| logging / 诊断 | roadmap 4.7（Phase 4，可提前） |

---

## 五、用户 × 开发者交叉审视

### 5.1 设计一致

| 用户诉求 | 开发者设计 |
|----------|-----------|
| 本地隐私 | 源码不出本机，LLM 只发 snippet |
| 教而非炫 | Tour + LOD + 少而精 |
| 理论+代码并重 | 顶栏平等 Tab + concept_links |
| 无 Key 也能用 | 静态索引管线独立 |
| 可取消索引 | index_jobs + progress IPC |

### 5.2 存在张力

| 张力 | 建议 |
|------|------|
| Dashboard 与壳层视觉割裂 | Phase 1 嵌入；Phase 2 主题 token 统一 |
| 双聊天入口 | 代码问答在 Dashboard；右栏仅跨源 Agent |
| 中文体验 | Fieldguide locale + UA `language` 同步 |
| 图谱存储 | **已定稿**：`knowledge-graph.json` 权威；SQLite 仅存 FG 扩展数据 |

### 5.3 差异化是否成立

| 竞品/上游 | Fieldguide 差异 | 能否交付 |
|------|----------------|----------|
| **Understand-Anything** | 上游；FG 加桌面 + 理论 + 桥接 | 能，集成为主 |
| IDE 内 UA 插件 | 独立桌面，无需 IDE | 能 |
| ChatGPT | 持久图谱 + 可视化 | 能（UA） |
| Sourcegraph | 学习叙事 + 论文桥接 | 能（FG 差异化） |

**结论**：代码地图靠 **UA**；最终差异化靠 **概念桥接 + 跨源 Agent + 桌面学习工作台体验**。

---

## 六、动工前定稿清单

1. [x] 纳入 [Understand-Anything](https://github.com/Egonex-AI/Understand-Anything) 为代码地图引擎
2. [x] [understand-anything-integration.md](./understand-anything-integration.md) 定稿
3. [x] 更新 architecture / roadmap / product-spec
4. [x] 以第三节 3.5 验收清单作为全项目 Done 定义
5. [ ] Phase 1 第 0 周 UA Spike 完成 → [spike-ua.md](./spike-ua.md) 签收

---

## 七、相关文档

| 文档 | 说明 |
|------|------|
| [doc-index.md](./doc-index.md) | 文档地图、一致性检查、动工门禁 |
| [spike-ua.md](./spike-ua.md) | UA Spike 记录模板 |
| [understand-anything-integration.md](./understand-anything-integration.md) | UA 集成边界 |
| [fieldguide-demo-spec.md](./fieldguide-demo-spec.md) | Demo 仓库规格 |
| [getting-started.md](./getting-started.md) | 动工前引导 |
| [product-spec.md](./product-spec.md) | PRD、用户场景、功能优先级 |
| [architecture.md](./architecture.md) | 技术架构、数据模型、IPC |
| [ui-spec.md](./ui-spec.md) | 界面与交互 |
| [roadmap.md](./roadmap.md) | 分阶段路线图（内部排期，非最终验收依据） |
| [onboarding-spec.md](./onboarding-spec.md) | 首次启动引导 |
| [testing-strategy.md](./testing-strategy.md) | 测试策略 |
