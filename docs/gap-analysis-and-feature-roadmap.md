# Fieldguide 差距分析 & 功能点扩展路线图

> 版本：v2.4（**在 v2.3 基础上新增 F-17 Obsidian vault 联动**：CLI 硬门禁 + 卡片/索引同步 + Agent 回读，落地于 Phase 6） | 基线 commit：`e9fb5e6`（README 重写 + understanding workbench）
> 审计方式：全量阅读 `src/**`（含 main / preload / renderer / shared）、`docs/**`；实跑 `tsc` 三份 tsconfig + `vitest`；grep 交叉验证文档承诺与代码实现
>
> **实测基线**：`pnpm typecheck` ✅（renderer / node / vitest 三份全过）· `pnpm test:unit` ✅ 21 文件 · **128 passed / 2 skipped**
>
> 本文用途：回答「作为成熟产品级项目还缺什么」+「功能点往哪里加」，并给出与毕设论文/答辩对齐的落地顺序。

---

## 0. 一句话结论

**技术栈不缺，工程骨架也不缺；缺的是三件事：**

| # | 缺口 | 一句话说明 |
|---|------|-----------|
| **1** | **学习闭环缺环** | 图谱、知识卡、面试题、论文、笔记全部是**只读展示**——产品的动词只有「看」，没有「记 / 练 / 评 / 进」。「学习工作台」的名字有了，学习行为数据是零。 |
| **2** | **已有能力未接线** | 7 个 IPC（`graph:search` / `graph:neighbors` / `graph:stats` / `graph:getSource` / `paper:index` / `paper:query` / `paper:indexStatus`）后端已实现，**渲染层零调用**；其中 `paper:index` 未接线导致 **F-09「PDF 导入 + RAG 问答」全链路实际不可用**。 |
| **3** | **缺可验证性** | 无评测集、无指标体系、无 E2E、无 lint、无干净机验收记录（`docs/screenshots/ux-baseline/` 只有一个 `.gitkeep`）。答辩时能讲「我做了个系统」，讲不出「我证明了什么」。 |

指导老师说「技术栈足够但功能点不够」，对应的正是 **1 + 3**：技术选型（Electron + React + TS + SQLite + Tree-sitter 图谱 + ReAct Agent + 向量 RAG + 三语 i18n）已经是一套完整的系统级栈，但**功能模块的数量、体系的完整度、可量化的验证**还撑不满一篇毕设。

---

## 1. 现状盘点（先把已有的家底数清楚）

### 1.1 规模与技术栈

| 层 | 技术 | 证据 |
|----|------|------|
| 桌面壳 | Electron 33 + electron-vite 5 + electron-builder 25（NSIS） | `package.json:49-62` |
| UI | React 18 + Tailwind 3 + Radix UI（dialog/tabs/dropdown/context-menu/tooltip/scroll-area）+ lucide-react | `package.json:23-45` |
| 状态/布局 | 自研 `useWorkspaceLayout`（365 行，多面板 + 分屏 + 持久化）+ `useIndexProgress` | `src/renderer/hooks/` |
| 图谱引擎 | 上游 [Understand-Anything](https://github.com/Egonex-AI/Understand-Anything)（`@understand-anything/core`，workspace 依赖，commit pin） | `package.json:32,63-66` |
| 解析 | UA core 的 Tree-sitter 管线（**不自研**，硬约束） | `src/main/ua/client.ts:264` |
| 存储 | better-sqlite3（WAL）+ `%APPDATA%/Fieldguide/app.db`；图谱权威源在**项目目录** `.understand-anything/knowledge-graph.json` | `src/main/db/index.ts:23-31` |
| LLM | OpenAI 兼容 `/v1/chat/completions`，7 家供应商内置（DeepSeek/OpenAI/Kimi/SiliconFlow/OpenRouter/Ollama/自定义） | `src/main/llm/catalog.ts:27` |
| Agent | 自研 ReAct 循环（最多 6 轮）+ 7 个工具 + 上下文打包器（10k 字符预算） | `src/main/agent/` |
| RAG | PDF 分块（512 token / 256 重叠）+ OpenAI 兼容 embedding + SQLite 存向量 + JS 余弦 | `src/main/vector/` |
| Git | simple-git（**仅用于 clone**） | `src/main/git.ts` |
| i18n | i18next 三语（zh-CN / zh-TW / en-US），约 **460 个文案键**，27 个分组 | `src/renderer/locales/*.json` |
| 测试 | Vitest 21 文件 / 128 用例 + 4 个 node 冒烟脚本（`qa:graph` / `qa:his-go` / `qa:scenario` / `qa:baseline`） | `scripts/` |
| CI | GitHub Actions（windows-latest：typecheck + unit + 两个 smoke） | `.github/workflows/` |

### 1.2 已实现能力矩阵

```
① 项目与分析层
   ├ 项目库：本地目录 / Git clone（--depth 1）/ 内置 Demo，多项目、状态徽标（pending/indexing/ready/failed/stale）
   ├ 全量 + 增量索引（指纹/mtime 合并，零变更保持 nodeCount），可取消（AbortController），IDE 式阶段进度条
   └ 渐进理解流水线：structure → architecture → knowledge → interview（四阶段可单独重跑，无 Key 走启发式兜底）

② 图谱与阅读层
   ├ UA Dashboard iframe 嵌入（自定义 ua-dashboard:// 协议 + token 鉴权 + postMessage 双向桥：16 条下行指令 / 3 类上行事件）
   ├ 架构分层兜底（无 layers 时调 detectLayers 或退化为单层）
   ├ 代码地图：7 种面板（总览/图谱/代码/问答/导览/知识/面试）× 分屏（单栏/左右/上下/交换/最大化）× 5 种布局预设
   ├ 文件树（depth 8 / 2000 节点）+ 代码查看器（行号 + 逐行正则高亮）+ 节点搜索（Ctrl+K）
   └ 变更影响分析（diff：git log 优先、mtime 回退 → 受影响节点 → Dashboard overlay）

③ 智能层
   ├ 学习教练 ReAct Agent：意图识别 → 上下文打包（项目身份/分层/Tour/焦点/RAG）→ 最多 6 轮工具调用 → 强制收敛作答
   ├ 7 工具：search_nodes / get_neighbors / list_layers / get_tour_step / query_paper / get_node_source / list_concept_links
   ├ LLM 索引富化：逐文件摘要（batch 3）+ 架构分层 + Tour 生成（含启发式 Tour）
   └ 推理过程可视化（thought / action / observation / answer 四类 step，可折叠）

④ 理论层
   ├ arXiv 搜索 + 论文库（去重）+ PDF 下载（60s 超时）+ 应用内 PDF 阅读器（react-pdf 分页 + 选区 + 高亮持久化）
   ├ 概念桥接：论文段落 ↔ 代码节点，手动 + AI 推荐，锚文本预填
   └ 对照 Tour 生成（论文摘录 ↔ 代码节点交替步骤，写入 graph.tour）

⑤ 壳层与体验
   ├ VS Code 式 Activity Bar + 自定义标题栏 + 全页设置（5 分类）+ 命令面板（9 条命令 + 文件/节点动态结果）
   ├ 5 套主题预设 × 50%–200% 双缩放（壳/图谱独立）× UI/代码字体字号分离
   ├ 首次引导 5 步（语言 → 项目根 → Demo/本地/跳过 → 真实索引进度 → 完成页）
   └ 诊断（日志查看/打开日志目录）+ 数据管理（打开数据目录/清导出缓存/导出图谱）

⑥ 数据层（9 张业务表 + 1 张运行期表）
   projects · index_jobs(⚠️ 死表) · papers · concept_links · paper_highlights · chat_messages
   architecture_summaries · knowledge_nodes · interview_questions · paper_chunks

⑦ 外部笔记联动（F-17 · Phase 6 · ✅ 已实现 2026-09-20）
   └ Obsidian vault 单向导出：设置页 CLI 硬门禁（三态 + 修复指引 + 手动 CLI 路径）→ 绑定 / 新建一个 vault → 把架构、分层、Tour、知识卡、面试题、论文桥接、学习路径与代码笔记同步成卡片 + 索引 MOC；托管块之外的用户批注永不覆盖，冲突在 Vault 面板里三选一
     闭合缺口：**拆解产物无法带走 / 无法与既有笔记体系结合**（此前只有 `project:exportGraph` 的图谱 JSON 与学习报告 Markdown，产物进不了用户自己的笔记库）
```

### 1.3 质量基线（本次实测）

| 项 | 结果 |
|----|------|
| `tsc` × 3 份 tsconfig | ✅ 全过（0 error） |
| `vitest` | ✅ 34 文件 / **276 passed / 2 skipped**（含 live `indexProject`、search/markdown/迁移计划/阶段隔离/LLM 工具/CSS 回归）；**当前 35 文件 / 279 passed / 2 skipped**，另有 `pnpm test:e2e` **8 例全绿** |
| 冒烟脚本 | `qa:graph`（Demo **104 节点** + Dashboard + HIS-Go 3656 节点 + `__uaStore` 桥接）、`qa:his-go`、`qa:scenario`、`regen:sample-graph` 齐备 |
| ❌ lint / format | **完全没有**（审计基线快照）：无 `.eslintrc*` / `eslint.config.*` / `.prettierrc*` / `.editorconfig`，`package.json` 无 `lint` 脚本 —— **已补齐**：ESLint 9 扁平配置上线，首跑抓到 18 个真实错误并全部修复，现 **0 error / 49 warning**（详见 todos「C 档与工程门禁」） |
| ❌ E2E | **无 Playwright / Spectron**（审计基线快照）：Electron 真实交互（点节点开文件等）靠 node 脚本 + 人工 —— **已补齐**：Playwright for Electron **8 例全绿**，覆盖安装 Demo → 图谱 iframe → 节点搜索开文件 → 7 面板挂载 → 内容搜索跳行（详见 todos「E2E 端到端测试层」） |
| ❌ LICENSE / CHANGELOG / CONTRIBUTING | 三个都缺（README 的 MIT 徽章指向 `NOTICE.md`） |
| ❌ 人工验收 | `docs/p4-release-checklist.md` 与 `docs/scenario-abc-test-record.md` 勾选为空；`docs/screenshots/ux-baseline/` 只有 `.gitkeep` |

**结论**：工程骨架在「个人项目里的优秀水平」，但按「成熟产品级」标准，**质量门禁、可观测性、安全边界、发布链路**这四块是系统性缺失，而不是零星遗漏。

---

## 2. 作为「成熟产品级项目」还缺什么

### 2.1 P0 — 会阻断演示或造成数据问题的（真 bug 级，建议先修）

| # | 问题 | 证据 | 影响 |
|---|------|------|------|
| 1 | **论文 RAG 全链路断链** ✅ **已修 2026-09-18** | `paper:downloadPdf`（`src/main/ipc/index.ts:898-926`）**不触发索引**；`indexPaper` 只被 `paper:index` 调用（`:969-981`），而渲染层**从不调用** `paperIndex` | 现已由 `TheoryView` 接管索引生命周期（建立/重建按钮、chunk 状态、下载后自动索引、论文内检索），并补齐 `env.d.ts` 的三个通道类型 |
| 2 | 增量索引**永不删除**已删/已移动文件的节点 ✅ **已修 2026-09-18** | `scanProject` 新增 `presentPaths`；`mergeIncrementalGraph` 据此清理已删文件的节点/边/layer 引用 | 现已支持 `git rm`、切分支后的图谱收敛 |
| 3 | **读路径会写用户项目文件** ✅ **已修 2026-09-18** | `setDashboardGraph` 不再调用 `ensureProjectGraphLayers`；分层改为内存补全，持久化只在索引/维护路径发生 | 「本地优先、不改用户文件」的承诺现在成立 |
| 4 | 对照 Tour **覆盖**原有 Tour ✅ **已修 2026-09-18** | `cross-tour.ts` 改为合并（`normalizeTours` 兼容扁平/目录两种形态），只替换自己的 `tour:paper-code-bridge` | 生成论文对照 Tour 不再冲掉架构 Tour |
| 5 | `file:read` / `shell:openFile` 无路径校验 ✅ **已修 2026-09-18** | 新增 `src/main/paths.ts`：`resolveProjectPath`（拒绝对路径/`..`/NUL/越界）+ `isAllowedOpenPath`（仅 appData、projectsRoot、已注册项目根）；四个 handler 接入 | 11 例单测覆盖越界与允许根 |
| 6 | 索引崩溃后 `status='indexing'` **永久卡死** ✅ **已修 2026-09-18** | 启动时 `resetStaleIndexingStatus()`；IPC 守卫改用进程内 `isIndexRunning()`；`indexProject` 外层 `finally { endIndex() }` | 崩溃后不再需要删记录重加项目 |
| 7 | API Key **明文落盘** ✅ **已修 2026-09-18** | `safeStorage` 加密为 `llm.apiKeyEnc`（内存形态不变），旧明文自动迁移，无钥匙串时回退并标记 | 产品级安全底线已补齐 |
| 8 | 图谱写入无原子性 ✅ **已修 2026-09-18** | 新增 `fs-atomic.ts`（temp + rename）；`ensure-layers` / `cross-tour` / `diff` / `config` 全部原子写；UA `saveGraph`（上游不可改）写后**校验+原子重写**，仍失败则返回 `GRAPH_WRITE_FAILED` | 中断不再留下半写 JSON |

### 2.2 P1 — 产品功能缺口（用户能直接感知）

| 缺口 | 现状 | 为什么算缺口 |
|------|------|-------------|
| **学习进度 / 掌握度** | 完全不存在（`locales` 里连进度相关键都没有） | 产品叫「学习工作台」，却无法回答「我学了哪些、还差哪些」 |
| **代码侧笔记 / 批注** | 论文有 `paper_highlights`（页+选区+颜色），**代码侧一张表都没有** | 左右不对称；「读懂一个项目」必然要留痕迹 |
| **复习 / 抽认卡 / 间隔重复** | 无 | 知识卡与面试题生成完就躺着，没有第二次触达 —— 学习科学上最该有的一环 |
| **学习报告 / 导出 / 分享** | 仅 `project:exportGraph`（复制图谱 JSON 到 exports/） | 无法把「我读懂了这个项目」变成一份可交付物（简历/周报/团队分享） |
| **代码查看器能力** | `CodeViewer.tsx` 57 行：行号 + 逐行正则高亮 ✅，**无**文件内搜索、跳行、折叠、虚拟滚动、节点范围高亮、在 IDE 打开 | 从图谱点节点进来后，看不到「这个函数在哪一行、被谁调用」 |
| **代码级 diff 视图** | 只有图谱 overlay（`setDiffOverlay`） | 场景 C「改代码前的影响评估」缺了最直观的那一半 |
| **文件内/全库内容搜索** | 只有文件名过滤 + 图谱节点子串搜索 | 「我记得有个地方写了 X」无法定位 |
| **聊天体验** | 非流式（一次性返回，无「停止生成」）；**无 Markdown 渲染**（纯 `whitespace-pre-wrap`）；无复制回答 / 重试 / 编辑重发 / 导出对话；无多会话与重命名 | 长回答要干等；代码块与列表糊成一片 |
| **引用溯源不完整** | 引用胶囊**已经可点**（`ChatPanel.tsx:214-226` → 打开文件）✅，但：① 历史回载**丢弃 nodeRefs**（`:58-64`），刷新后引用全消失；② 只开文件、不 `focusNode` 到图谱；③ 不带行号定位 | 一次会话有效，第二天全丢 |
| **深色模式被默认预设盖掉** | `theme: system` 与 `tokens.css:120-163` 的 `prefers-color-scheme` 都在，但 `:root[data-theme-preset="parchment"]`（`tokens.css:169`）与系统深色块特异性同为 (0,2,0) 且**位置在后** → 预设恒覆盖 ✅ **已修 2026-09-18**（系统深色加三重 `:not()` 守卫 → (0,4,0)，并排除 `midnight`/`paper-dark`） | 用户以为「没有深色模式」 |
| **无障碍基本缺位** | 全渲染层仅 8 处 aria；`index.css` **无任何 `:focus-visible` 规则**，而绝大多数可点元素是原生 `<button>`（分屏图标、文件页签、文件树、项目库操作…）→ **键盘焦点不可见**；无快捷键总览、无 skip-link、无 `prefers-reduced-motion` 降级 ✅ **已部分修复 2026-09-18**（焦点环 + reduced-motion + 分隔条键盘操作 + 分屏控件 aria；快捷键总览页仍未做） | 键盘用户无法使用；也是评审容易挑的点 |
| **论文高亮只能增不能删** | `paperRemoveHighlight`（`preload:120-121`）**零调用**，PdfReader 无删除入口；`onBridgeTourGenerated`（`:201-207`）**无人订阅** | 误标无法撤销；事件桥接了但没接线 |
| **成本估算与真实计费无关** | `CostDialog.tsx:61-63` 硬编码 `文件数 × 500` tokens、`¥3/1M` ✅ **已改 2026-09-18**：改为按源码字节估算（每文件 15KB 上限 ÷4），并**移除编造金额**（费用取决于用户配置的供应商/模型） | 「LLM 成本提示」名不副实；也是接入 token 计量的天然入口 |
| **全局 ErrorBoundary** | 全仓无；`KnowledgePanel.tsx:31-33` 等处大量 `catch { /* ignore */ }` | 单点异常可能白屏；失败静默无提示 |
| **图谱路径查找** | `getNeighbors` 有 BFS（depth ≤2），但无「A 怎么调到 B」的路径 | 读代码最常问的问题之一 |
| **应用内帮助 / 快捷键总览** | 无 | 12 个快捷键散落在菜单与状态栏提示里 |
| **导览可编辑** | Tour 由 LLM/启发式一次生成，用户不能增删步骤、不能自制学习路线 | 与「按自己的方式理解项目」的定位冲突 |

### 2.2.1 已经做好、**不要重复造**的部分（避免白干）

审计中容易误判为"缺失"、但代码里其实已经有的：

- **空态 / 错误态**：`ProjectLibrary.tsx:110-136`、`CodeViewer.tsx:24-26`、`FileTree.tsx:77-79`、`GraphPanel.tsx:182-199`、`BridgeView.tsx:88-110`、`TheoryView.tsx:221,254-258`、`OverviewPanel.tsx:51-65`、`KnowledgePanel.tsx:54-68`、`InterviewPanel.tsx:53-67`、`TourPanel.tsx:83-96` 全部有（缺的是**全局** ErrorBoundary 与「重试」按钮）
- **深色跟随系统**：`theme: system` + `tokens.css:120-163` 已实现，只是被默认预设覆盖（见上表）
- **回答引用胶囊可点**：`ChatPanel.tsx:214-226` 已能点开文件，且 `App.tsx:451` 一直会 `dashboardSelectNode()`；2026-09-18 补上 `navigateToNode`（把节点带入视口）并让引用随消息落库
- **代码查看器**：**有行号、有语法高亮**（`CodeViewer.tsx:46-50` + `syntax.tsx`），只是高亮是逐行正则（无跨行状态、无函数/类型着色）
- **分屏与布局**：每面板最多 10 个文件页签、拖拽分栏、双击复位、中键关页签、5 个布局预设、按 `projectId` 持久化（500ms 防抖）——`useWorkspaceLayout.ts:213-229`
- **三语 i18n**：约 460 键 / 27 分组，覆盖率已经很高（残留硬编码见下）
- **诊断与数据入口**：日志查看/打开目录、打开数据目录、清缓存、导出图谱（`SettingsPanel.tsx:641-655`）
- **成本确认对话框**、**Demo 离线秒开**、**索引进度三处联动**（状态栏/引导/项目库卡片）都已成型

**残留硬编码文案**（顺手清）：`SplitPanel.tsx:216-217`、`NodeSearchBar.tsx:75`、`ConceptBridge.tsx:127,140,148,166,169,235`、`App.tsx:354,372,406,415`；另有已定义未使用的键 `zh-CN.json:97,303,308,342,448`。

### 2.3 文档承诺、代码中不存在（契约漂移 — 答辩时最危险的一类）

> 这些是 `docs/architecture.md` 等**权威文档里写着的接口/字段/表**，但代码里没有。答辩老师若照文档提问，会当场露馅；反过来，它们每一个都是**"零设计成本的加功能入口"**。

| 文档承诺 | 出处 | 实际 |
|---|---|---|
| `chat:stream` 流式事件 + `chat:cancel` | `architecture.md:376-377` | 通道不存在；chat 一次性返回（`ipc/index.ts:538-599`） |
| `graph:search` 带 `mode: 'text'\|'semantic'` | `architecture.md:368` | 无 `mode`，实现是本地子串（`ipc/index.ts:423-431`）；且 **NodeSearchBar 压根不用这个 IPC**，而是 `graphGet` 拉全图 + `includes()` 过滤（`NodeSearchBar.tsx:29-40`）→ 文档宣称的"语义搜索"是**假语义**（UA 的 `SearchEngine` 只在 Agent 内部用，`agent/ua-search.ts:67-81`） |
| Agent 工具 **9 个**（`get_graph_overview`/`explain_node`/`search_code`/`find_call_path`/`analyze_diff`/`search_arxiv`/`link_concept`/`index_project`） | `architecture.md:450-460` | 实际 **7 个**且命名不同；缺 `find_call_path`、`analyze_diff`、`search_arxiv`、`link_concept` |
| `chat_sessions` 表 + `tool_trace JSON` | `architecture.md:325-339` | 不存在；改用 `chat_messages` + `steps_json` |
| `projects.ua_graph_path` 列 | `architecture.md:278` | 不存在 |
| `index_jobs` 表驱动取消/重试 | `architecture.md:284-294,416` | 建表但从不写入（死表） |
| 向量库 **LanceDB** | `architecture.md:71,113,141,474` | 早已换成 SQLite `paper_chunks`（`vector/index.ts:23`）；`roadmap.md:172` 记了这条变更，`architecture.md` 没同步 |
| E2E = Playwright + Electron | `testing-strategy.md:21,85-95` | ✅ **已补齐**：`playwright.config.ts` + `e2e/`（8 例，直连 Electron 二进制），`pnpm test:e2e`；CI 不跑，理由见 todos（UA sibling 仓库缺失时 Dashboard dist 无法构建） |
| 性能基准（tiny-go parse < 5s，CI 非阻塞） | `testing-strategy.md:80-82` | 无基准脚本 |
| 内置 Demo = "Go + TypeScript 混合，约 500 行" | `onboarding-spec.md:99` | ✅ **已修正 2026-09-18**：Demo 重做为 `pulsegate`（15 文件 / 104 节点 / 9 分层），文档同步 |
| parchment 已加网格纹理 | `todos.md:385-388` | `ui-spec.md:327` 与代码都显示**无网格** → 文档自相矛盾 |
| `vendor/Understand-Anything` submodule | `architecture.md:86-87`、`getting-started.md:46` | 无 `vendor/`；用 pnpm workspace 指向 sibling 目录（`pnpm-workspace.yaml:2`） |
| 设置页「索引」分组（忽略规则/并行度/浅克隆） | `ui-spec.md:247` | 设置只有 常规/外观/模型/数据/关于 |
| `Ctrl+Shift+E`（聚焦文件树）、`Ctrl+Shift+M`（面板最大化）、分隔条键盘操作 | `ui-spec.md:137,154,368` | 均未实现（最大化只有按钮，分隔条只支持指针） |
| 「在 IDE 打开」、文件内符号大纲、Monaco、文件树索引状态点 | `ui-spec.md:135,183-187` | 未实现（`syntax.tsx:4` 注释写着 "Phase 2+: Monaco"） |
| 代码面板选中符号 → 图谱高亮（反向联动） | `ui-spec.md:161-164` | 只做了图谱→代码单向 |

**另需注意**：`docs/OCR-report.md`（2026-07-29 的代码审查）的 12 条建议**逐条抽查全部未修**，其中第 3 条「pipeline 分阶段 try/catch、失败保留部分结果」直接对应 `product-spec.md:199` 的非功能需求「索引可取消、可重试；**失败保留部分结果**」—— 低成本、且能对上需求文档。

### 2.4 P2 — 工程与交付缺口

| 类别 | 具体缺口（证据） |
|------|------------------|
| **代码规范** | 无 ESLint / Prettier / husky / commitlint（`package.json` 无 lint 脚本）—— ✅ **ESLint 已补 2026-09-18**（0 error / 49 warning）；Prettier / husky / commitlint 仍未引入 |
| **测试结构** | `ipc/index.ts` **1176 行、61 个通道，零 handler 级测试**（`ipc/__tests__/handlers.test.ts` 只断言 `ipcErr` 语义）；~~无 E2E~~ ✅ **已补 2026-09-19**（Playwright 8 例覆盖真实 IPC → UI 链路）；仍无覆盖率门槛 |
| **数据演进** | ~~`db/index.ts:33 migrate()` 只有 `CREATE TABLE IF NOT EXISTS`，**无 `user_version` 版本化迁移**~~ ✅ **已修 2026-09-18**：新增 `db/migrations.ts`（声明式 `ADDED_COLUMNS` + 纯函数 `planMigrations()`），`migrate()` 按 `user_version` 与 `table_info` 应用 `ALTER TABLE`；规则抽成独立模块以便在原生模块不可用时仍可测试 |
| **死代码 / 死表** | `index_jobs` 表从不写入；`getChunks`、`buildDiffPostMessage`、`buildGraphOverview`、`shared/graph.ts` 大部分类型无调用方；`config:uaRuntime` / `paper:get` 已注册但 preload 未暴露 |
| **LLM 基建** | ~~`callLLM` 在 **4 个文件**各写一遍~~ ✅ **已收敛 2026-09-19**：全部走 [`llm/client.ts`](../src/main/llm/client.ts)（含 429/5xx/超时/网络错误的重试 + 指数退避 + jitter + 尊重 `Retry-After`、token 计量、工具调用类型），`understand/llm-utils.ts` 已删除、4 处显式调用点（understand 三阶段 / UA 摘要 / ReAct / 连通性测试）与 `agent/tools.ts` 的工具 schema 全部改用它；**仍缺**：限流（主动节流）、响应缓存、按模型的费用换算（`embed.ts` 声明了 `usage.total_tokens` 却从不读） |
| **性能** | `loadGraph` 每次 IPC 都 `readFileSync` + `JSON.parse` 全量图（7 个 graph 通道每个都重复解析）；向量检索无 ANN，全表拉取 + JS 余弦阻塞主线程；`paper:search` 全表加载后 JS 过滤；`CodeViewer.tsx:44-53` 对整文件 `map` 且**无 memo / 无虚拟滚动**，每次渲染重跑逐行正则高亮 → 大文件全量 DOM |
| **网络边界** | 渲染层**直连外网**（arXiv 搜索直接 fetch `export.arxiv.org`，`TheoryView.tsx:84`），绕过主进程；配合无 CSP 与无 sender 校验，网络出口不收敛 |
| **可观测性** | 只有 10 处 logger 调用；`chat:send` / `paper:index` / `diff:analyze` / `understand:run` 等关键路径**无日志**；无诊断包导出、无崩溃上报、日志无轮转且 `appendFileSync` 阻塞主线程 |
| **发布链路** | 无 `electron-updater` 自动更新；无代码签名；无版本发布流程；干净机验收未做 |
| **文档** | 双向漂移：`todos.md` 说 Phase 4 约 70%/UX 98%，但代码已有 diagnostics、data management、understanding workbench；`architecture.md` 仍写 LanceDB 与 vendor submodule；`roadmap.md` 未勾已完成的 Phase 3/5 项；`docs/OCR-report.md` 的 12 条建议（2026-07-29 的代码审查）**抽查全部未修** |

---

## 3. 功能点扩展空间（按毕设性价比排序）

> **进度（2026-09-18）**：A1 / A14 / A15 已落地 —— 论文 RAG 断链已修（`TheoryView` 接管索引生命周期 + 下载后自动索引 + 论文内检索）、语义搜索已真做（`ua/search.ts` 报告实际后端，`NodeSearchBar` 改服务端防抖搜索）、内置 Demo 已重做为分层示例 `pulsegate`（**104 节点 / 88 边 / 9 分层 / 5 步导览**，Go 测试全绿）。详见 [todos.md](./todos.md) 的「功能补强 · 第一批」。

> 排序依据：**① 是否形成"体系"（不是零散小功能）② 答辩可演示性 ③ 论文可量化性 ④ 与现有代码的衔接成本**

### A 档 — 「1–3 天/个，立刻能加」（先把已建未用的能力变现）

| # | 功能点 | 切入点（文件级） | 产出 / 演示价值 |
|---|--------|------------------|-----------------|
| **A1** | ~~**论文索引 + RAG 状态条**（修 F-09 断链）~~ ✅ **已完成 2026-09-18** | `TheoryView.tsx` 加「建立向量索引」按钮 → `paperIndex`；用 `paperIndexStatus` 显示 chunk 数；下载 PDF 后自动触发；另加论文内语义检索与库内 RAG 徽标；`env.d.ts` 补齐三个通道类型 | 论文 RAG 主线复活，Agent 的 `query_paper` 不再恒空 |
| **A2** | ~~**图谱检索面板**（邻居/统计/路径）~~ ✅ **已完成 2026-09-18** | 新面板 `search`（`src/shared/understand.ts:16-24` 加枚举 + 4 处注册即可，`migratePanelTabs` 自动兼容旧布局）→ 调 `graphSearch` / `graphNeighbors` / `graphStats` | 演示「搜 handleRequest → 看邻居 → 读源码」闭环（`graphSearch` 已在 A14 修好，仅剩 neighbors/stats 未接线） |
| **A3** | ~~**回答引用溯源增强**~~ ✅ **已完成 2026-09-18**（含修正） | `chat_messages` 新增 `node_refs` 列并落库/回填；`ChatPanel` 保留引用 + Markdown 渲染（零依赖、无 `dangerouslySetInnerHTML`）+ 复制回答 + 重新生成；`handleNodeRef` 追加 `navigateToNode` 把节点带入视口（`selectNode` 原本已有，**我上一版说反了**） | 引用跨重启不丢；回答可读性质变；顺带落地 `user_version` 版本化迁移 |
| **A4** | ~~**代码查看器增强**~~ ✅ **已完成 2026-09-18** | `CodeViewer` 重写：按 `focusedNodeId` 解析 `lineRange` 并高亮 + 滚动到视口、文件内搜索（计数/上下个/Ctrl+F）、跳行；行渲染 `useMemo` 化 | 把「只读文本」变成「可导航的代码视图」 |
| **A5** | ~~**全库内容搜索**（Ctrl+Shift+F）~~ ✅ **已完成 2026-09-18** | 复用 `file:tree` + 新 IPC `file:grep`，结果可点开 | 「我记得哪里写过 X」——IDE 级基本盘 |
| **A6** | ~~**学习报告导出**~~ ✅ **已完成 2026-09-18** | `understand:*` 三个通道已有数据 → 生成 Markdown/HTML 报告（架构总览 + 知识卡 + 面试题 + 桥接 + 图谱统计），落 `exports/` | 一键产出「我读懂了这个项目」的可见成果；简历/周报/答辩材料都是它 |
| **A7** | ~~**技术债扫描面板**~~ ✅ **已完成 2026-09-18** | 扫描 TODO/FIXME/HACK + 超大文件 + 高扇入节点（`graphStats` + `getNeighbors`） | 「上手陌生仓库第一步：哪里欠债」；也是自研指南 §六 AI 代码审查的轻量前置 |
| **A8** | ~~**快捷键总览 + 应用内帮助**~~ ✅ **已完成 2026-09-18** | 聚合 `menu.ts` 加速键 + `App.tsx:277-285` 的 Ctrl+K | 产品级完成度；顺手补 i18n |
| **A9** | ~~**全局 ErrorBoundary**（catch 治理仍未做）~~ ✅ **已完成 2026-09-18** | `App.tsx` 顶层 + `KnowledgePanel.tsx:31`、`OverviewPanel.tsx:25`、`ConceptBridge.tsx:63,74,110`、`TheoryView.tsx:56,106,116,142` 等处 | 稳定性体感；也可作为论文「可靠性设计」一小节 |
| **A10** | **引导第 6 步「30 秒自检」** | `OnboardingWizard.tsx`：问「这个项目的入口在哪/核心模块有哪些」→ LLM 打分 | **顺手补掉 `scenario-abc-test-record.md` 里场景 A 的人工验收空缺** |
| **A11** | ~~**无障碍与焦点可见性**~~ ✅ **已完成 2026-09-18** | `index.css` 全局 `:focus-visible` 令牌化焦点环 + `prefers-reduced-motion` 降级；`SplitPanel` 分隔条改为可键盘操作（方向键/Home/End/Enter）+ 图标按钮 `aria-label`/`aria-pressed` + 文件页签 `aria-current` | 键盘可用；新增 3 例 CSS 回归测试 |
| **A12** | ~~**修深色模式覆盖问题**~~ ✅ **已完成 2026-09-18** | `tokens.css` 系统深色选择器加三重 `:not()` 守卫（(0,4,0) > 预设 (0,2,0)），排除 `midnight`/`paper-dark`；`useDashboardThemeSync` 加 `matchMedia` 实时响应 | 一个选择器修复换来「系统深色真的生效」；含特异性回归测试 |
| **A13** | ~~**顺手接线 3 处"已建未用"**~~ ✅ **已完成 2026-09-18** | `paperRemoveHighlight`（PdfReader 删除按钮）、`onBridgeTourGenerated`（BridgeView 订阅）、`CostDialog` 改为按字节估算并**移除编造的金额** | 清理"半成品"观感 |
| **A14** | ~~**把"假语义搜索"变成真语义**~~ ✅ **已完成 2026-09-18** | `ua/search.ts` 新增 `searchNodesDetailed()` 报告实际后端（UA SearchEngine / 子串降级）；`graph:search` 支持 `mode` + `limit`；`NodeSearchBar` 改服务端防抖搜索 + 模式切换 + 后端徽标 + 命中分数；Agent 搜索复用同一实现并按分数排序 | 兑现 `architecture.md:368`；新增 8 例单测 |
| **A15** | ~~**扩充内置 Demo**（答辩门面）~~ ✅ **已完成 2026-09-18** | 重做为分层示例 `pulsegate`（15 源文件，Go 测试全绿）；`scripts/regen-sample-graph.test.ts` + `pnpm regen:sample-graph` 用真实管线生成预置图谱并补人工摘要/分层/导览 | **104 nodes / 88 edges / 9 layers / 5 tour steps**，layers 覆盖 104/104；答辩第一个画面不再是 74 行 demo |
| **A16** | ~~**清理 OCR 报告 12 条**~~ ✅ **已完成高价值项 2026-09-18** | pipeline 分阶段 try/catch + `stages[]` 结果（对应 `product-spec.md:199`）；`llm-utils.ts` 收敛 3 份重复 `callLLM`/`extractJson`；`llmOptions()` 去重；understand handler 返回类型具体化；删死代码；硬编码阶段名改用 `AnalysisStage`；`AppTitleBar` 嵌套三元改注册表遍历 | 一次清账，且能对上需求文档的可靠性条款；新增 17 例测试 |
| **A17** | ~~**补一个 Agent 工具：`find_call_path`**~~ ✅ **已完成 2026-09-18** | `graph-reader.findPath()`（BFS + 邻接表 + `maxDepth`/`truncated`）+ `tools.ts` 注册，返回带 `viaEdge` 的有序节点链 | 文档承诺过（`architecture.md:450-460`）、自带演示效果（"A 怎么调到 B"）；新增 9 例测试 |

### B 档 — 「1–2 周/个，成体系的模块」（真·功能点，建议挑 3–4 个做深）

| # | 功能点 | 设计要点 | 新增数据 | 可量化指标 |
|---|--------|----------|----------|-----------|
| **B1 ★** | **学习进度与掌握度**（旗舰） | `learn_progress(project_id, node_id, status, last_seen_at, review_count, confidence)`；图谱节点按「未看/在读/已掌握」着色；项目卡片出进度环；总览面板出「还剩 N 个核心节点未读」 | 1 张表 + 2 个 IPC + 面板徽标 | 覆盖率 %、掌握度分布、30 分钟会话内新增掌握节点数 |
| **B2 ★** | **代码笔记与批注** | `code_notes(project_id, file_path, line_start, line_end, node_id, markdown, tags)`；`CodeViewer` 行级批注 + 笔记面板（按文件/标签/节点聚合）；与论文高亮形成对称 | 1 张表 + 4 个 IPC + 1 个面板 | 笔记数、被引用笔记数、会话中笔记→跳转次数 |
| **B3** | **间隔重复复习（SRS-lite）** | 卡片源：`knowledge_nodes` + `interview_questions` + 用户笔记；调度用 SM-2 或 FSRS 简化版；「今日复习」入口在 Activity Bar | `review_cards` + `review_logs` 2 张表 | **留存率曲线**（1/3/7 天回忆正确率）、复习负荷 —— 论文最好写的一章 |
| **B4** | **AI 导师主动提问**（自研指南 §六） | 常驻侧栏：基于当前焦点/正在读的文件，主动抛「你知道这里为什么不用 X 吗？」；回答后给评价与追问 | 复用 chat 表 + `tutor_state` | 提问命中率（用户评为「有价值」的比例）、追问深度 |
| **B5** | **AI 代码审查 / 技术债报告**（自研指南 §六） | 以「架构风险 / 潜在 bug / 技术债」三类对关键文件做 LLM 审查，输出带节点引用的报告；图谱红色徽标 | `review_findings` | 与人工标注的**一致率 / 精确率召回率**（可做成对比实验） |
| **B6** | **学习路径生成**（自研指南 §六） | 输入目标岗位/JD → 抽能力关键词 → 与项目 architecture + knowledge 做差距分析 → 生成有序学习路线（每站一个节点 + 一条 Tour） | `learning_paths` | 路径完成率、路径 vs 随机顺序的**理解度增益对比** |
| **B7** | **架构演化时间轴**（`simple-git` 已在依赖里，目前只用于 clone） | 遍历 commit → 每文件的 churn/最后变更时间 → 图谱热力着色 + 「最近 30 天最活跃模块」榜；与 diff 影响分析串联 | 缓存 `git_metrics` | 热点识别与人工判断的一致率；对 3656 节点 HIS-Go 的耗时 |
| **B8** | **图谱社区检测 / 聚类视图** | `graphology` + `graphology-communities-louvain`（**已在上游依赖树里**）→ 自动发现高内聚模块簇 → 与 UA 的 layer 视图对照 | 无（派生） | 模块度 Q、与目录结构/架构层的吻合度 |
| **B9** | **面板双向联动 + 双聊天入口** | ① 代码面板选中符号 → 图谱高亮（现只有图谱→代码单向，`ui-spec.md:161-164` 承诺过）；② 把 UA Dashboard 内问答接进壳层（`doc-index.md:18-19` 的"双聊天入口分层"目前只实现了一半） | 无 | 联动触发次数、跨面板跳转路径长度 |

### C 档 — 「论文贡献级」（决定论文是不是只有"系统实现"）

| # | 工作 | 为什么必须有 |
|---|------|-------------|
| **C1** | ✅ **已完成 2026-09-18** ~~**Agent 评测基准**~~ | 基于 `resources/sample-project`（13 节点）+ `tests/fixtures/tiny-go` + HIS-Go（3656 节点）构造 **40–60 条问答对**（人工标注 ground truth 节点/文件），评测：节点检索 **Recall@k / MRR**、工具调用成功率与轮数、答案**忠实度**（引用是否命中真实节点）、**幻觉率**。→ 一张基准表就能撑起「实验与评估」整章 |
| **C2** | ✅ **已完成 2026-09-18** ~~**消融 / 对比实验**~~ | ① 有/无「上下文打包注入」对答案质量的影响；② 有/无「图谱检索」对幻觉率的影响；③ 启发式 vs LLM vs 多 Agent 评审管线（质量/成本/时延三角）；④ 中文 vs 英文 prompt 在中文项目上的表现。→ **A/B 对照是论文的骨架** |
| **C3** | ✅ **已完成工具与协议（数据待真人采集）2026-09-18** ~~**用户研究**~~ | N=8–12 名开发者，任务：30 分钟读懂一个陌生仓库。测：任务完成率、SUS 量表、NASA-TLX、理解度测验得分，对照组用「IDE + ChatGPT」。→ 场景 A 的「成功标准」在 `product-spec.md:53-57` 已经写好了，就差真做 |

### D 档 — 明确不建议投入（会稀释主线）

- 跨平台（macOS/Linux）——作者已在 README 声明只做 Windows
- 多人协作 / 云同步 / SaaS ——`product-spec.md:207-213` 的非目标
- 自研 parser / 自研图谱画布 —— 项目硬约束（README「几个硬性约束」）
- IDE 插件形态分发、实时代码编辑与 LSP —— 非目标

---

## 4. 建议的产品形态补齐（roadmap 目前止于 Phase 5）

`docs/roadmap.md:16` 的 Phase 表最后一行是 **Phase 5 理解工作台（进行中）**，**没有 Phase 6** —— 这正是「功能点不够」的结构性原因。建议补两条主线：

```
Phase 6 — 学习闭环（把「看得见」变成「学得会」）
  6.1 学习进度与掌握度（B1）      ← 地基，其余都挂在它上面
  6.2 代码笔记与批注（B2）        ← 与论文高亮对称
  6.3 间隔重复复习（B3）          ← 唯一能给出"留存率"证据的模块
  6.4 学习报告与学习包导出（A6）  ← 把成果变成可交付物
  6.5 AI 导师主动提问（B4）       ← 把"问答"升级为"教学"

Phase 7 — 可验证性（把「我做了」变成「我证明了」）
  7.1 Agent 评测基准与指标（C1）
  7.2 消融与对比实验（C2）
  7.3 用户研究（C3）
  7.4 智能深化：多 Agent 生成-评审-修订管线（`FieldGuide_Agent_Refactor_Guide.md:179-204` 的三个扩展方向）
```

**关键判断**：Phase 6 决定「功能点够不够」，Phase 7 决定「论文分数高不高」。两者都要，但如果时间只够一个，**先做 Phase 7 的实验设计 + Phase 6 的 B1/B2**（这两块能同时喂饱"功能点数量"和"实验数据"）。

---

## 5. 建议的 4 周落地排期

| 周 | 目标 | 交付 |
|----|------|------|
| **W1** | 修 P0（§2.1 的 1/3/4/5/6）+ A 档 A1–A3 | 论文 RAG 复活；不再改写用户图谱；引用可点；安全收口（`file:read`/`shell:openFile` 统一走 `file-content.ts` 的校验） |
| **W2** | B1 学习进度 + B2 代码笔记 | 2 张新表、2 个新面板、图谱着色 + 进度环；**功能点可见增长最快的一周** |
| **W3** | B3 间隔重复 + C1 评测基准 | 「今日复习」闭环；40–60 条 QA 基准 + 首次评测跑分（论文实验第一节） |
| **W4** | C2 消融实验 + A6 报告导出 + 工程门禁（ESLint/Prettier/E2E 一条主链路） | 实验表格成稿；报告导出可演示；CI 加 lint 与打包 —— ✅ **实际交付 2026-09-18/19**：C1/C2/C3 + ESLint + CI（lint / 单测 / QA / 离线基准）+ **Playwright E2E 8 例**；Prettier 未引入（有意，见 §7） |

> 每周结束都跑 `pnpm typecheck && pnpm test:unit`，并把新增表写进 `db/index.ts:migrate()` —— **顺手补 `user_version` 版本化迁移**，否则第 2 周加的 4 张表会让老库无法升级。

---

## 6. 答辩演示剧本（10 分钟版）

| 时间 | 演示动作 | 覆盖的功能点 |
|------|----------|-------------|
| 0:00–1:30 | 首次启动 → 引导 → 内置 Demo 秒开图谱 | 引导 5 步 + Demo + 索引进度 |
| 1:30–3:30 | 打开 HIS-Go（3656 节点）→ 架构总览 → 跟随 Tour → 点节点开文件 | 大图性能 + 分层 + Tour + 节点↔源码联动 |
| 3:30–5:00 | 提问「认证逻辑在哪」→ 看推理步骤 → **点引用 chip 跳图谱** → 看学习进度环变化 | ReAct Agent + 引用溯源 + **B1 学习进度** |
| 5:00–6:30 | 给一个模块加笔记 → 复习队列出现卡片 → 完成一次间隔重复 | **B2 笔记 + B3 SRS**（学习科学关键词） |
| 6:30–8:00 | 导入 RAG 论文 → 建索引 → 问「chunk 策略在哪实现」→ 生成论文↔代码对照 Tour | 理论层 + RAG（**修好的 A1**）+ 桥接 |
| 8:00–9:30 | 切到评测页：Recall@k / 工具成功率 / 幻觉率 / 消融对比表 | **C1 + C2**（论文核心） |
| 9:30–10:00 | 导出学习报告 + 一键生成学习路径 | A6 + B6 |

---

## 7. 风险与取舍

| 风险 | 说明 | 建议 |
|------|------|------|
| LLM 不可用时演示翻车 | 启发式兜底能出结构图，但知识卡/面试题质量会掉 | 演示前预热缓存；准备一份「离线演示数据集」（预生成的知识卡/面试题/评测结果） |
| 评测基准的"标准答案"主观 | 节点级 ground truth 需要人工标注 | 先做 20 条高质量，再扩到 60 条；标注规则写进论文附录 |
| 用户研究耗时 | 招募 + 伦理 + 统计 | 降到 N=8，用 within-subject（同人对比 Fieldguide vs IDE+ChatGPT），显著性好做 |
| 新模块稀释主线 | 一次开太多表/面板 | 严格按 W1–W4 排期，B 档只做 2–3 个并做深，其余写进"未来工作" |
| 上游 UA 变更 | 集成层已是四份独立 `loadCore` 回退路径 | 优先重构为统一的「UA 适配层」（也顺手消掉重复代码） |
| E2E 在 CI 里恒红 | CI 的 `pnpm install` 因 UA 指向 sibling 仓库而 `continue-on-error`，Dashboard dist 无法构建 → 嵌入图谱必然降级为占位符 | 有意不加 E2E job：与其加一个因环境缺件而恒红的 job，不如把 `pnpm test:e2e` 明确记为本地门禁；CI 只守不依赖外部仓库的链路 |
| Prettier 未引入 | 引入会一次性重排全仓库，diff 噪音会淹没本轮功能改动 | 留到功能冻结后再单独一个 commit 引入（`eslint-config-prettier` + 一次全量 `--write`） |

---

## 附：可挂载新功能的"缝"（改造成本最低的位置）

| 想加什么 | 最小改动点 |
|----------|-----------|
| 新面板 | `src/shared/understand.ts:16-24` `ALL_PANEL_TABS` + 4 处注册；`migratePanelTabs`（`:114`）自动给旧布局补页签，**零迁移成本** |
| 新分析阶段 | `src/shared/understand.ts:27` `AnalysisStage` + `understand/pipeline.ts:35`（阶段数组已支持按需选择） |
| 新 Agent 工具 | `src/main/agent/tools.ts:19`（schema 数组）+ `:142` `switch` —— 加一个 case 即生效 |
| 新表 / 迁移 | `src/main/db/index.ts:33` `migrate()`（**先补 `user_version`**） |
| 新 IPC | `src/main/ipc/index.ts`（单文件路由）+ `src/shared/ipc.ts` 错误码 + `src/preload/index.ts` |
| 统一 LLM 客户端（重试/限流/计量/流式） | ~~抽 `src/main/llm/client.ts`，替换 4 处重复 `callLLM`~~ ✅ **已完成 2026-09-19**：重试/退避/计量/工具调用均已落地；剩限流与流式 |
| 图谱查询缓存 | `src/main/ua/graph-reader.ts` 是全部图查询的唯一出口，加 LRU + mtime 失效即可 |
| Dashboard 新交互 | `src/main/ua/dashboard.ts:142` 桥接脚本 `switch(data.type)`（现 16 下行 / 3 上行） |

---

*本文为差距审计与规划建议，未修改任何产品代码。*
>
> **后续状态**：A/B/C 三档 + P0 缺陷 + E2E 均已落地，逐项完成记录见 [`todos.md`](./todos.md)（「第二批」→「E2E 端到端测试层」），实测数据见 [`eval/agent-baseline.md`](./eval/agent-baseline.md)。
