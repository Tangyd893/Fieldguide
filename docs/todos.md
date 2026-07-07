# Fieldguide 待办清单

> 最后更新：2026-07-07  
> 来源：项目检查（相对完整路线图约 **75–80%**；用户可感知闭环约 **70%**；Phase 4 可发布约 **20%**）  
> 产品分阶段任务见 [roadmap.md](./roadmap.md)；本文仅跟踪**下一步工程待办**。

---

## 当前快照

| Phase | 完成度 | 备注 |
|-------|--------|------|
| 0 设计 + Spike | 100% | 文档与 UA 集成 Spike 已通过 |
| 1 桌面壳 + UA | ~98% | 主链路可用；引导 Step 5 已实现；`fieldguide-demo` 本地就绪但未推 GitHub |
| 2 智能层 | ~95% | diff/增量/全量 UI 已接线；仅增量/全量无 LLM cost dialog 集成 |
| 3 理论 + 桥接 | ~90% | 桥接 + RAG + 对照 Tour + PDF 阅读器 + AI 推荐桥接均已接线 |
| 4 发布 | ~20% | builder 配置有，`resources/icon.ico` 缺失，未实测安装包 |

**基线验证**（2026-07-07）：`pnpm typecheck` ✅ · `pnpm test:unit` ✅（47 passed / 2 skipped）

### 用户场景完成度（相对 product-spec）

| 场景 | 完成度 | 主要缺口 |
|------|--------|----------|
| A 读懂新项目 | ~85% | Demo 冷启动、引导收尾、30 分钟用户自测未验收 |
| B 论文↔实现 | ~85% | 对照 Tour + PDF 内阅读器 + AI 推荐桥接已接线；划词高亮桥接已通 |
| C 影响评估 | ~90% | diff 一键分析 + 增量/全量选择已接线；Dashboard 高亮需实测
| 可发布产品 | ~20% | 图标、安装包、日志诊断、关于页 |

---

## 待办（按优先级）

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

- [ ] **p1-demo-push** · 推送 `fieldguide-demo` 至 GitHub org  
  - Phase 1 / 冷启动  
  - 本地代码就绪（`../fieldguide-demo`），引导 clone URL：`https://github.com/fieldguide-app/fieldguide-demo`  
  - 待做：创建 org 仓库并 push，验证 Onboarding「体验 Demo」可 clone + 索引  
  - 规格见 [fieldguide-demo-spec.md](./fieldguide-demo-spec.md)

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

- [x] **p1-fieldguide-demo** · 创建 `fieldguide-demo` 仓库（本地）  
  - 已完成：Go 三层架构 HTTP 服务（~350 行），go build + go vet 通过  
  - 跟进：见 **p1-demo-push**（远程仓库）

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
  - 47 passed / 2 skipped（config-bridge 10 + graph-reader 16 + IPC 8 + vector 15）

- [x] **eng-tsconfig** · TypeScript 三份 tsconfig 分层，`pnpm typecheck` 通过

- [x] **eng-workspace** · pnpm workspace 与 UA sibling 对齐

- [x] **eng-docs-sync** · 同步 README/roadmap/doc-index（2026-07-05 批次）  
  - 跟进：README 仍将 diff 标为待办，见 **eng-docs-sync-2**

- [x] **p2-diff-backend** · 变更影响分析后端 + Dashboard overlay  
  - 实现：[`diff.ts`](../src/main/ua/diff.ts) + IPC `diff:analyze` + `setDiffOverlay` postMessage  
  - UI 接线见 **p2-diff-ui**

- [x] **p2-domain-view** · 领域视图（层导航栏 + Dashboard `drillIntoLayer`）

- [x] **p3-cross-tour-backend** · 对照 Tour 生成 + 跨源 Agent 上下文  
  - 实现：[`cross-tour.ts`](../src/main/ua/cross-tour.ts) + IPC `bridge:generateTour` + chat:send Concept Links 段  
  - UI 接线见 **p3-cross-tour-ui**

### P3 — Phase 4 发布与打磨

- [ ] **p4-release** · NSIS 安装包实测 + 设置页日志/诊断入口  
  - [`logger.ts`](../src/main/logger.ts) 已有；[`SettingsPanel.tsx`](../src/renderer/views/SettingsPanel.tsx) 未暴露  
  - 阻塞项：补 `resources/icon.ico` 后跑 `pnpm dist`；干净 Win10/11 机器验收

- [ ] **p4-about** · 关于页 + UA 归属说明（MIT）  
  - roadmap 4.x 验收项

- [ ] **p4-theme-unify** · Dashboard 与 Fieldguide 壳层视觉统一（可选）  
  - roadmap 4.6；iframe 嵌入割裂感仍在

- [ ] **p4-i18n-polish** · 三语文案补全  
  - 现状：OnboardingWizard 等仍有硬编码中文

- [ ] **eng-docs-sync-2** · 同步 README 与 todos 至实际状态  
  - README「diff 影响 ⏳」应改为已完成（后端）/ UI 待补  
  - 场景完成度、测试数与本文对齐

- [ ] **eng-user-test** · 场景 A「30 分钟口述主链路」用户自测  
  - roadmap Phase 2 验收；功能齐但未经真实用户路径验证

---

## 目录与配置索引（维护参考）

```
Fieldguide/
├── docs/                    设计文档（入口：doc-index.md）
├── resources/               应用图标、安装包资源（icon.ico 待补）
├── scripts/                 Spike 脚本（spike-electron.mjs 等）
├── src/
│   ├── main/                Electron 主进程
│   │   ├── ua/              UA 集成层（client / dashboard / config-bridge / graph-reader / diff / cross-tour）
│   │   ├── ipc/             IPC handler 聚合（index.ts）
│   │   ├── vector/          PDF 分块 + 向量检索
│   │   └── db/              SQLite 接入
│   ├── preload/             contextBridge API
│   ├── renderer/            React UI
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

- 完成一项后，将 `- [ ]` 改为 `- [x]`，并在提交说明中注明 id（如 `p2-diff-ui`）。
- **后端与 UI 分拆**：后端已通但 renderer 未接线时，用 `*-backend`（已完成）+ `*-ui`（待办）两条跟踪，避免误标完成。
- 新增待办请标明优先级（P0–P3）与对应 roadmap 任务 ID。
- 大范围优先级调整时，同步更新本文件与 Cursor 计划中的 todos。
- 改 tsconfig / workspace / 目录结构后，跑 `pnpm typecheck && pnpm test:unit` 验证。
