# Fieldguide 待办清单

> 最后更新：2026-07-10  
> 来源：项目检查 + Obsidian 对齐 UX 方案（2026-07-10）  
> 相对完整路线图约 **90–95%**；用户可感知闭环约 **85%**；**视觉/交互质感约 55%**；Phase 4 可发布约 **45%**  
> 产品分阶段任务见 [roadmap.md](./roadmap.md)；界面规格见 [ui-spec.md](./ui-spec.md)；本文跟踪**下一步工程待办**。

---

## 当前快照

| Phase | 完成度 | 备注 |
|-------|--------|------|
| 0 设计 + Spike | 100% | 文档与 UA 集成 Spike 已通过 |
| 1 桌面壳 + UA | ~98% | 主链路可用；内置 demo 已接线；**分割窗口/活动面板未对齐 Obsidian** |
| 2 智能层 | ~95% | diff/增量/全量 UI 已接线；仅增量/全量无 LLM cost dialog 集成 |
| 3 理论 + 桥接 | ~90% | 桥接 + RAG + 对照 Tour + PDF 阅读器 + AI 推荐桥接均已接线 |
| 4 发布 | ~45% | 安装包可构建（2026-07-10）；干净机器实测与用户自测未验收 |
| **UX 质感** | **~55%** | 5 个 CSS 变量 + emoji 图标；无主题预设/缩放/细滚动条/活动面板 |

**基线验证**（2026-07-10）：`pnpm typecheck` ✅ · `pnpm test:unit` ✅ · `pnpm dist` 可产出 NSIS + 免安装版

### 用户场景完成度（相对 product-spec）

| 场景 | 完成度 | 主要缺口 |
|------|--------|----------|
| A 读懂新项目 | ~90% | 内置 demo 已接线；30 分钟用户自测未验收 |
| B 论文↔实现 | ~85% | 对照 Tour + PDF 内阅读器 + AI 推荐桥接已接线；划词高亮桥接已通 |
| C 影响评估 | ~90% | diff 一键分析 + 增量/全量选择已接线；Dashboard 高亮需实测
| 可发布产品 | ~45% | 安装包可构建；UX 质感与 IDE 式加载反馈待补齐 |

---

## 待办（按优先级）

### P0 — Obsidian 对齐 UX（2026-07-10 方案）

> **目标**：默认羊皮纸质感、精致侧栏与滚动条、界面缩放、活动面板文件路由、IDE 式索引进度。  
> **依赖顺序**：Phase A（视觉）→ Phase B（交互内核）与 Phase C（加载/图谱）可部分并行。  
> **分屏策略（已定 2026-07-10）**：见 **ux-split-policy** — 双栏默认**左代码 / 右图谱**，可配置且持久化，不写死。

#### Phase A — 设计系统与默认主题（Week 1）

- [x] **ux-tokens** · 语义化 CSS 令牌层  
  - 新建 [`src/renderer/theme/tokens.css`](../src/renderer/theme/tokens.css)，从 [`index.css`](../src/renderer/index.css) 迁出并扩展  
  - 令牌：`--fg-bg` `--fg-card` `--fg-border` `--fg-text-*` `--fg-accent` `--fg-accent-muted` `--fg-tree-selected` `--fg-tree-hover` `--fg-tab-active` `--fg-scrollbar-thumb` `--fg-scrollbar-track`  
  - 验收：`index.css` 仅 `@import` tokens；壳层组件不再新增硬编码 `#E4E6F1` / `gray-*`（存量逐步替换）

- [x] **ux-parchment-default** · 默认「羊皮纸」主题  
  - 主背景 `#F5F0E1`，卡片 `#FAF6EB`，浅绿选中 `#E8F0E4`，边框 `#D4C9A8`，文字 `#3D3529`，强调 `#6B8F71`  
  - 修改 [`config.ts`](../src/main/config.ts)：`appearance.themePreset` 默认 `parchment`；[`App.tsx`](../src/renderer/App.tsx) `applyTheme` 按 preset 注入 `data-theme-preset`  
  - 同步修订 [ui-spec.md](./ui-spec.md) §5.1 浅色默认值  
  - 验收：全新安装首屏为羊皮纸暖黄+浅绿，非当前 `#FAFAFA` 灰白

- [x] **ux-theme-presets** · 设置页 5 套主题预设  
  - 预设：`parchment`（默认）· `forest` · `slate` · `midnight` · `paper-dark`  
  - 扩展 [`SettingsPanel.tsx`](../src/renderer/views/SettingsPanel.tsx)「外观」分组：色块预览卡片 + 点击即时预览 + 保存持久化  
  - i18n：`appearance.themePreset.*`（zh-CN / zh-TW / en-US）  
  - 验收：切换预设后顶栏/侧栏/面板 Tab/状态栏同步变色；重启后保持

- [x] **ux-scrollbar** · 细滚动条（主题感知）  
  - 在 `tokens.css` 增加 `::-webkit-scrollbar` 规则（宽 8px、圆角 thumb、track 随主题）  
  - 验收：文件树、代码区、设置弹窗内滚动条风格一致，暗色/羊皮纸均可读

- [x] **ux-icons** · Lucide 图标 + 文件类型图标  
  - 依赖：`lucide-react`  
  - 新建 [`src/renderer/components/icons/FileIcon.tsx`](../src/renderer/components/icons/FileIcon.tsx)（按扩展名映射 10–15 种，参考 Seti 简化）  
  - 替换 [`FileTree.tsx`](../src/renderer/views/CodeMap/FileTree.tsx)、[`App.tsx`](../src/renderer/App.tsx) 顶栏、[`SettingsPanel.tsx`](../src/renderer/views/SettingsPanel.tsx) 中的 emoji  
  - 验收：目录树文件夹开/合图标；`.go` `.ts` `.md` 等有区分色图标

- [x] **ux-filetree-visual** · 文件树视觉与主题对齐  
  - 文件：[`FileTree.tsx`](../src/renderer/views/CodeMap/FileTree.tsx)  
  - 选中/悬停改用 `--fg-tree-selected` / `--fg-tree-hover`；单行 ellipsis；16px 缩进  
  - 验收：深色/羊皮纸下选中项对比度达标（WCAG AA）；与 ui-spec §3.2 一致

- [x] **ux-modal-theme** · 弹窗/引导全主题适配  
  - 文件：[`SettingsPanel.tsx`](../src/renderer/views/SettingsPanel.tsx)、[`OnboardingWizard.tsx`](../src/renderer/views/OnboardingWizard.tsx)、[`ProjectLibrary`](../src/renderer/views/ProjectLibrary/) 各 Dialog、[`CostDialog.tsx`](../src/renderer/views/CostDialog.tsx)  
  - 将 `bg-white` / 硬编码输入样式改为 `var(--fg-card)` + 主题感知 `.fg-input`  
  - 验收：系统暗色 + 应用羊皮纸时，设置/onboarding 文字与背景均可读

#### Phase B — 缩放与布局舒适度（Week 2，可与 A 尾部并行）

- [x] **ux-zoom** · 界面缩放 50%–200%（默认 100%）  
  - 配置：[`config.ts`](../src/main/config.ts) `appearance.zoom: number`（默认 100）  
  - 实现：[`App.tsx`](../src/renderer/App.tsx) 挂载时 `document.documentElement.style.fontSize` 或 `#root` zoom；代码区可选独立 `--fg-code-font-size`  
  - 设置页：滑块 + 数字输入，步进 10%  
  - 快捷键：`Ctrl+=` / `Ctrl+-` / `Ctrl+0`（[`App.tsx`](../src/renderer/App.tsx) 或全局 hotkey）；toast 显示当前比例  
  - 命令面板「切换主题」同步改为持久化写入 config（修现有不落盘问题）  
  - 验收：缩放后布局不破；重启保持；代码区行号仍对齐

- [x] **ux-font-settings** · UI / 代码字体分开（Obsidian 式）  
  - 设置页：UI 字体、代码字体下拉（Segoe UI / Inter / Cascadia Code / Consolas 等）  
  - 写入 config + CSS 变量 `--fg-font-ui` `--fg-font-mono`  
  - 验收：仅代码面板字体变化，顶栏/侧栏跟随 UI 字体

- [x] **ux-sidebar-persist** · 侧栏宽度持久化  
  - [`App.tsx`](../src/renderer/App.tsx) 文件树拖拽宽度写入 `config.appearance.sidebarWidth`（160–400，默认 260）  
  - 验收：重启后侧栏宽度保持

#### Phase C — 活动面板与分割窗口（Week 2–3）

- [x] **ux-split-policy** · 分屏策略定稿 (2026-07-10)  
  - **单面板**：默认「图谱」Tab（进入代码地图先看全景，与 ui-spec §2.2 一致）  
  - **双面板默认布局**：**左 = 代码，右 = 图谱**（与当前实现左图右码相反，实现时以 config 默认值驱动，禁止写死在组件内）  
  - **打开文件**：不自动分屏（对齐 Obsidian）；仅更新**活动面板**的 `filePath`  
  - **可更改（不写死）**：  
    - 顶栏布局按钮：单栏 / 左右 / 上下（`ux-split-controls`）  
    - 每面板 Tab 可自由切换图谱/代码/问答/Tour  
    - **交换左右面板**（按钮或拖拽，纳入 `ux-split-controls`）  
    - 分屏比例 `splitPos`、面板顺序与 `activeTab` 写入 `workspaceLayout` 并持久化（`ux-layout-persist`）  
  - **实现约束**：默认布局仅从 `config.workspaceLayout` 或 store 初始值读取；禁止在 `SplitPanel` `useEffect` 里硬编码左右内容  
  - 下游：`ux-panel-model` → `ux-open-routing` 按此策略实现

- [x] **ux-panel-model** · 每面板独立状态  
  - 重构 [`SplitPanel.tsx`](../src/renderer/views/CodeMap/SplitPanel.tsx)：`PanelState { id, tabs, activeTab, filePath? }`  
  - 新建 [`src/renderer/stores/workspaceLayout.ts`](../src/renderer/stores/workspaceLayout.ts)（或同级 hook）：`panels[]` `activePanelId` `splitPos` `splitDirection`  
  - **默认双栏初始值**（`ux-split-policy`）：`panels[0].activeTab='code'`，`panels[1].activeTab='graph'`；单栏时 `activeTab='graph'`  
  - 移除 [`App.tsx`](../src/renderer/App.tsx) 全局 `activeFilePath` 作为唯一真相；改为 layout store  
  - 验收：双面板时两栏可显示不同内容与文件；新建双栏为左代码右图谱

- [x] **ux-active-panel** · 活动面板焦点  
  - 点击面板标题栏/内容区 → `setActivePanel(id)`；活动面板 `ring-1 ring-[var(--fg-accent)]` 或底边高亮  
  - 验收：用户能明确看到当前哪个面板接收「打开文件」

- [x] **ux-open-routing** · 文件打开路由到活动面板  
  - 文件树、命令面板跳文件、节点搜索 → 更新 `activePanel.filePath`；若 activePanel 非 code 则切到 code tab  
  - 删除 `SplitPanel` 中 `useEffect` 强制分屏/右栏切 code 的逻辑（见当前 L22–28）  
  - 验收：双栏（左代码右图谱）时，活动面板在右侧图谱、点文件 → **仅右栏**切代码并打开；左栏代码文件不变

- [x] **ux-graph-node-routing** · 图谱节点 → 活动面板  
  - [`App.tsx`](../src/renderer/App.tsx) `dashboard nodeSelected` 回调写入 activePanel.filePath（非全局）  
  - 验收：图谱点节点后，仅活动面板跳转代码；另一面板保持

- [x] **ux-split-controls** · 顶栏分屏布局按钮 + 面板交换  
  - ui-spec §2.3：单面板 / 左右 / 上下（[`App.tsx`](../src/renderer/App.tsx) 代码地图 Tab 内）  
  - 扩展 `SplitPanel` 支持 `flex-col` 纵向分割；面板最小宽 280px  
  - **交换左右面板**：一键互换 `panels[0]`/`panels[1]` 顺序（满足「默认左码右图但可改」）  
  - 验收：三种布局可切换；交换后左右内容对调且可持久化；比例可拖拽

- [x] **ux-layout-persist** · 工作区布局持久化  
  - config：`workspaceLayout`（`panels` 顺序与各 `activeTab`/`filePath`、`activePanelId`、`splitPos`、`splitDirection`）  
  - 用户交换左右栏或改 Tab 后写入 config；**默认值**左代码右图谱，用户改动覆盖默认  
  - 按 `projectId` 或全局存储（先全局，后续可 per-project）  
  - 验收：重启应用恢复上次布局（含左右顺序）；重置布局可回到默认左码右图

- [x] **ux-file-tabs** · 每面板文件 Tab 栏（Obsidian 多文件）  
  - 每 panel：`openFiles: { path, id }[]` `activeFileId`；Tab 可关闭、切换  
  - 验收：同面板打开 3 个文件可 Tab 切换；关闭 Tab 不关闭面板

- [x] **ux-panel-maximize** · 面板最大化  
  - 快捷键 `Ctrl+Shift+M`（ui-spec）；临时隐藏另一面板  
  - 验收：最大化后还原比例

#### Phase D — 索引进度与图谱体验（Week 3–4）

- [x] **ux-index-phase-i18n** · 索引阶段文案本地化  
  - 主进程 [`client.ts`](../src/main/ua/client.ts) / IPC 输出 phase key（`scan` `parse` `embed` …）  
  - i18n：`index.phase.*`；状态栏显示「正在解析文件…」而非 `parse 45/100`  
  - 验收：三语阶段名正确；保留 `current/total` 数字

- [x] **ux-progress-store** · 索引进度全局状态  
  - 新建 [`src/renderer/stores/indexProgress.ts`](../src/renderer/stores/indexProgress.ts)：订阅 `index:progress` / `complete` / `error`  
  - 验收：App / Onboarding / ProjectLibrary 可共享同一进度源

- [x] **ux-statusbar-progress** · 状态栏 IDE 式进度条  
  - 扩展 [`App.tsx`](../src/renderer/App.tsx) 状态栏：3px determinate 条 + 阶段标签 + `current/total`  
  - 非阻塞：索引中仍可切换 Tab（ui-spec 已有要求）  
  - 验收：打开项目 reindex 时底部可见连续进度；完成后淡出

- [x] **ux-onboarding-progress** · 引导 Step 5 真实进度  
  - [`OnboardingWizard.tsx`](../src/renderer/views/OnboardingWizard.tsx) 替换固定 60% 假条，接入 `ux-progress-store`  
  - 验收：demo/本地项目索引时进度条与状态栏一致

- [x] **ux-projectlib-progress** · 项目库索引进度环  
  - [`ProjectLibrary.tsx`](../src/renderer/views/ProjectLibrary/ProjectLibrary.tsx) `indexing` 状态显示环形进度（非仅文字 badge）  
  - 订阅 `index:progress` 实时更新，无需手动刷新列表  
  - 验收：索引中项目卡片可见旋转/百分比

- [x] **ux-graph-skeleton** · 图谱加载骨架与空态  
  - [`GraphPanel.tsx`](../src/renderer/views/CodeMap/GraphPanel.tsx)：iframe `onLoad` 前骨架屏；无 graph JSON 时说明「索引完成后显示图谱」  
  - 索引失败时错误态 + 重试  
  - 验收：首次打开项目不再长时间白屏；用户能理解「图谱未就绪」≠「功能缺失」

- [x] **ux-graph-refresh** · 索引完成后自动刷新图谱  
  - `index:complete` → 通知 GraphPanel reload iframe 或 postMessage `reloadGraph`  
  - 验收：无需手动切换项目即可看到新节点

- [x] **ux-dashboard-theme** · Dashboard iframe 主题与壳层统一  
  - 合并原 **p4-theme-unify**；postMessage 或 URL 参数传递 `--fg-accent` / 背景色  
  - 依赖 UA Dashboard 是否支持主题注入；不支持则文档记录限制  
  - 验收：羊皮纸主题下图谱背景不刺眼割裂

- [ ] **ux-tree-index-dots** · 文件树索引状态点（可选）  
  - ui-spec：已索引绿点 / 未索引灰点（按文件或目录聚合）  
  - 验收：reindex 后绿点更新

#### Phase E — 文档与验收（贯穿）

- [ ] **ux-spec-sync** · 同步 ui-spec / README  
  - 更新 [ui-spec.md](./ui-spec.md) §5 主题、§2.3 布局控制、§3.2 文件树图标  
  - README 增加外观/缩放/主题预设说明  
  - 验收：文档与实现一致

- [ ] **ux-visual-regression** · 关键界面人工验收清单  
  - 羊皮纸默认、5 预设、缩放 80%/120%、双面板异文件、索引进度条、图谱骨架  
  - 干净 Win10/11 安装包跑一轮  
  - 验收：勾选清单全通过

---

### P0 — 解锁核心学习体验（后端已有，补 UI 接线）

- [x] **p2-diff-ui** · 变更影响分析 UI 接线  
  - Phase 2.6 / 场景 C  
  - 后端已完成：[`diff.ts`](../src/main/ua/diff.ts) + IPC `diff:analyze` + Dashboard `setDiffOverlay`  
  - 待做：在 [`ProjectLibrary.tsx`](../src/renderer/views/ProjectLibrary/ProjectLibrary.tsx) 或代码地图工具栏增加「分析变更影响」按钮，调用 `window.fieldguide.diffAnalyze(projectId)`，展示 changed/affected 节点摘要  
  - 验收：修改源码后 stale 项目可一键触发，Dashboard 高亮受影响节点

- [x] **p3-cross-tour-ui** · 对照 Tour 生成 UI 接线  
  - Phase 3.6 / 场景 B  
  - 后端已完成：[`cross-tour.ts`](../src/main/ua/cross-tour.ts) + IPC `bridge:generateTour`  
  - 待做：在 [`ConceptBridge.tsx`](../src/renderer/views/Theory/ConceptBridge.tsx) 或 [`BridgeView.tsx`](../src/renderer/views/Bridge/BridgeView.tsx) 增加「生成对照 Tour」按钮，生成后通知 Dashboard 播放  
  - 验收：≥3 条 concept_links 可一键生成 paper↔code 交替 Tour

- [x] **p1-bundled-demo** · 内嵌示例项目 + onboarding 复制安装 (2026-07-08)  
  - `resources/sample-project/` + `project:installDemo` IPC + electron-builder extraResources  
  - 预置 `knowledge-graph.json`，引导可离线秒开图谱  
  - 取代原 `fieldguide-demo` 独立 GitHub 仓库方案

- [x] ~~**p1-demo-push**~~ · ~~推送 `fieldguide-demo` 至 GitHub org~~（已取消，改用内嵌 sample）

### P0 — 已完成

- [x] **p2-ua-llm** · 接入 UA LLM 索引（摘要、Tour、架构分析），扩展 [`src/main/ua/client.ts`](../src/main/ua/client.ts)  
  - 已完成：LLM 文件摘要、架构层检测（layers）、Tour 生成（含 heuristic fallback），batch 3 文件/120s 超时/15KB 截断

- [x] **p2-postmessage** · Dashboard ↔ 壳层 postMessage（节点高亮、Tour 同步、Ctrl+K 跳转）  
  - 已完成：双向 postMessage 协议，通过 dashboard.ts HTML 注入 bridge 脚本

- [x] **p3-lancedb** · PDF 分块 + SQLite 向量检索 + `query_paper`  
  - 已完成：`src/main/vector/` 三模块 + IPC `paper:index`/`paper:query`/`paper:indexStatus`；chat:send 自动 RAG top-3

- [x] **p2-diff-ui** · 变更影响分析 UI 接线 (2026-07-07)  
  - 已完成：`preload` 新增 `onDiffResult` 事件桥接；`ProjectLibrary.tsx` 添加 📊 分析按钮 + DiffResultDialog；stale/ready 可一键触发变更影响

- [x] **p3-cross-tour-ui** · 对照 Tour 生成 UI 接线 (2026-07-07)  
  - 已完成：`preload` 新增 `onBridgeTourGenerated` 事件桥接；`BridgeView.tsx` 添加 🔮 生成对照 Tour 按钮 + TourResultDialog；≥1 条 concept_links 即可生成

### P1 — Phase 1 收尾 + 冷启动

- [x] **p1-onboarding-ui** · Onboarding Demo 三选一 UI 接线  
  - 已完成：[`OnboardingWizard.tsx`](../src/renderer/views/OnboardingWizard.tsx) demo clone / 本地文件夹 / skip

- [x] **p1-onboarding-step5** · 引导完成页 + Tour 提示 (2026-07-07)  
  - 已完成：`OnboardingWizard` 新增 Step 5（索引进度 → 完成页 + 「打开代码地图/留在项目库」按钮）；`App.tsx` 新增 `handleOnboardingSetup`（项目创建+索引，不关闭向导）  
  - 原 `handleOnboardingStart` 简化为 `skip` 的直接完成路径

- [x] **p1-fieldguide-demo** · ~~创建 `fieldguide-demo` 仓库~~ → 已合并为 `resources/sample-project/`

- [x] **p1-phase1-tail** · Phase 1 收尾：本地文件夹选择器、抽取 `graph-reader.ts`  
  - 已完成：`dialog:openFolder` IPC + graph-reader + graph:* IPC

### P1 — 差异化体验

- [x] **p2-incremental-ui** · 增量 / 全量索引显式选择 (2026-07-07)  
  - 已完成：`ProjectLibrary` 新增「🔁 全量」按钮（带确认对话框）+ `onFullReindex` prop；`App.tsx` 接入全量重建

- [x] **p3-pdf-reader** · 应用内 PDF 阅读器 + 高亮笔记 (2026-07-07)  
  - 已完成：`PdfReader.tsx`（react-pdf 分页阅读 + 文本选择 + 浮窗「🔗 桥接」按钮）；`TheoryView` 接入应用内阅读器；`ConceptBridge` 支持 `initialAnchorText` 预填；选中文本一键关联代码节点

- [x] **p3-bridge-ai-suggest** · AI 推荐桥接节点 (2026-07-07)  
  - 已完成：`ConceptBridge` 新增「🤖 AI 推荐」按钮；调用 `chat:send` 传入论文摘要+候选节点列表，LLM 返回编号后解析为推荐节点，紫色列表展示可点击选择

### P2 — 已完成（工程基线）

- [x] **p3-bridge-tab** · 顶栏「桥接」Tab 接入 [`BridgeView.tsx`](../src/renderer/views/Bridge/BridgeView.tsx)

- [x] **p2-cost-dialog** · LLM 索引成本确认对话框 [`CostDialog.tsx`](../src/renderer/views/CostDialog.tsx)

- [x] **p2-incremental-partial** · 增量索引后端 + stale badge「更新索引」  
  - UI 显式选择见 **p2-incremental-ui**

- [x] **eng-vitest** · Vitest 单测基线  
  - 49 passed / 2 skipped（config-bridge 10 + graph-reader 16 + IPC 8 + vector 15）

- [x] **eng-tsconfig** · TypeScript 三份 tsconfig 分层，`pnpm typecheck` 通过

- [x] **eng-workspace** · pnpm workspace 与 UA sibling 对齐

- [x] **eng-docs-sync** · 同步 README/roadmap/doc-index（2026-07-05 批次）

- [x] **p2-diff-backend** · 变更影响分析后端 + Dashboard overlay  
  - 实现：[`diff.ts`](../src/main/ua/diff.ts) + IPC `diff:analyze` + `setDiffOverlay` postMessage  
  - UI 接线见 **p2-diff-ui**

- [x] **p2-domain-view** · 领域视图（层导航栏 + Dashboard `drillIntoLayer`）

- [x] **p3-cross-tour-backend** · 对照 Tour 生成 + 跨源 Agent 上下文  
  - 实现：[`cross-tour.ts`](../src/main/ua/cross-tour.ts) + IPC `bridge:generateTour` + chat:send Concept Links 段  
  - UI 接线见 **p3-cross-tour-ui**

### P3 — Phase 4 发布与打磨

- [ ] **p4-release** · NSIS 安装包干净机器实测  
  - 已完成（2026-07-10）：`pnpm dist` 产出 `dist/Fieldguide Setup 0.2.0.exe` + `dist/win-unpacked/Fieldguide.exe`；含 UI 路径浏览/对比度/dashboard 路径等修复  
  - 待做：干净 Win10/11 机器安装验收；免安装版从非项目目录启动验收  
  - 与 **ux-visual-regression** 合并执行

- [x] **p4-about** · 关于页 + UA 归属说明（MIT） (2026-07-08)  
  - 已完成：[`AboutDialog.tsx`](../src/renderer/views/AboutDialog.tsx) + 三语 i18n `about.*` 键；设置面板底部 ℹ️ 链接打开

- [x] **eng-docs-sync-2** · 同步 README 与 todos 至实际状态 (2026-07-08)  
  - README：diff 标记 ✅，测试数 47→49，Phase 完成度更新，已完成列表补全

- [ ] ~~**p4-theme-unify**~~ · 已并入 **ux-dashboard-theme**（Obsidian UX Phase D）

- [x] **p4-i18n-polish** · OnboardingWizard i18n 化 (2026-07-08)  
  - 已完成：[`OnboardingWizard.tsx`](../src/renderer/views/OnboardingWizard.tsx) 全部硬编码中文替换为 `t()` 调用；三语添加 `onboarding.*` 翻译键（25 个键覆盖全部步骤）  
  - 待续：其他组件（ChatPanel、BridgeView、CostDialog 等）仍有少量硬编码

- [ ] **eng-user-test** · 场景 A「30 分钟口述主链路」用户自测  
  - roadmap Phase 2 验收；功能齐但未经真实用户路径验证；建议在 **ux-visual-regression** 后执行

---

## 目录与配置索引（维护参考）

```
Fieldguide/
├── docs/                    设计文档（入口：doc-index.md）
├── resources/               应用图标、内置 sample-project（demo）
├── scripts/                 Spike 脚本（spike-electron.mjs 等）
├── src/
│   ├── main/                Electron 主进程
│   │   ├── ua/              UA 集成层（client / dashboard / config-bridge / graph-reader / diff / cross-tour）
│   │   ├── ipc/             IPC handler 聚合（index.ts）
│   │   ├── vector/          PDF 分块 + 向量检索
│   │   └── db/              SQLite 接入
│   ├── preload/             contextBridge API
│   ├── renderer/            React UI
│   │   ├── theme/           CSS 令牌与主题预设（ux-tokens，待建）
│   │   ├── stores/          工作区/索引进度状态（ux-panel-model，待建）
│   │   └── components/icons/  文件类型图标（ux-icons，待建）
│   └── shared/              三端共用类型与 IPC schema
├── tests/fixtures/tiny-go/  测试 fixture（graph JSON + 样例 Go 项目）
├── tsconfig.json            renderer 类型检查
├── tsconfig.node.json       main / preload / shared 类型检查
└── tsconfig.vitest.json     单测类型检查
```

| 命令 | 检查范围 |
|------|----------|
| `pnpm typecheck` | renderer + main/preload/shared + 测试文件 |
| `pnpm test:unit` | `src/**/__tests__/**/*.test.ts` |
| `pnpm dev` | electron-vite 开发（依赖 sibling UA workspace） |
| `pnpm dist` | NSIS 安装包（需 `resources/icon.ico`） |

---

## 维护说明

- 完成一项后，将 `- [ ]` 改为 `- [x]`，并在提交说明中注明 id（如 `ux-tokens`）。
- **Obsidian UX 批次**：按 Phase A → B/C → D 推进；分屏策略已定（`ux-split-policy` ✅）。
- **后端与 UI 分拆**：后端已通但 renderer 未接线时，用 `*-backend`（已完成）+ `*-ui`（待办）两条跟踪，避免误标完成。
- 新增待办请标明优先级（P0–P3）与对应 roadmap / ui-spec 章节。
- 大范围优先级调整时，同步更新本文件与 Cursor 计划中的 todos。
- 改 tsconfig / workspace / 目录结构后，跑 `pnpm typecheck && pnpm test:unit` 验证。

### Obsidian UX 推荐实施顺序（速查）

| 顺序 | ID | 说明 |
|------|-----|------|
| 1 | ux-tokens → ux-parchment-default | 令牌 + 默认羊皮纸 |
| 2 | ux-scrollbar → ux-icons → ux-filetree-visual | 侧栏质感 |
| 3 | ux-theme-presets → ux-modal-theme | 设置页预设 + 弹窗适配 |
| 4 | ux-zoom | 缩放与快捷键 |
| 5 | ux-panel-model → ux-active-panel → ux-open-routing | 活动面板（默认左码右图，可配置） |
| 6 | ux-progress-store → ux-statusbar-progress → ux-onboarding-progress | 加载进度 |
| 7 | ux-graph-skeleton → ux-graph-refresh | 图谱可感知 |
| 8 | ux-split-controls → ux-layout-persist → ux-file-tabs | 布局完善 |
